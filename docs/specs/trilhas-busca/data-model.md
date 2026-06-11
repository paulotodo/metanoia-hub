# Data Model: Busca Full-Text (`trilhas-busca` / Story 8-8)

**Phase**: 1 (Design)
**Fonte empírica**: `apps/api/prisma/schema.prisma` (models `Lesson`, `Trail`, `Module`),
migration `20260610200000_8-1-content-trails-modules-lessons/migration.sql` (DDL + RLS).

> NÃO há novas entidades persistidas. A feature adiciona **uma coluna** (`search_vector`)
> a uma tabela existente (`lessons`) e infraestrutura de índice (trigger + função + GIN +
> EXTENSION). O "Resultado de busca" é uma projeção derivada em tempo de consulta.

---

## 1. Tabela afetada: `lessons` (model `Lesson`)

Colunas REAIS confirmadas (não há `title` nem `description` em Lesson):

| Coluna DB (snake_case) | Campo Prisma (camelCase) | Tipo | Papel na busca |
|------------------------|--------------------------|------|----------------|
| `id` | `id` | UUID (v7) | PK do resultado |
| `tenant_id` | `tenantId` | UUID | RLS (isolamento) — nunca em código |
| `module_id` | `moduleId` | UUID | JOIN → modules |
| `name` | `name` | VarChar(255) | **indexado** no `search_vector` |
| `tags` | `tags` | String[] | **indexado** no `search_vector` |
| `content_type` | `contentType` | enum `LessonContentType` | retornado no resultado |
| `content_body` | `contentBody` | Text? | NÃO indexado (D0) |
| `deleted_at` | `deletedAt` | Timestamptz? | soft-delete → search_vector NULL |
| **`search_vector`** (NOVA) | `searchVector` `Unsupported("tsvector")?` | tsvector | índice de busca (gerido por trigger) |

### 1.1 Nova coluna `search_vector`

- **DB**: `search_vector tsvector` (nullable). Populada/limpa pelo trigger
  `trg_lessons_search_vector` (research D3).
- **Prisma schema**:
  ```prisma
  model Lesson {
    // ... colunas existentes inalteradas ...
    searchVector Unsupported("tsvector")? @map("search_vector")

    @@index([searchVector], type: Gin)
    // @@index existentes ([tenantId]), ([moduleId]) preservados
    @@map("lessons")
  }
  ```
- **Semântica de conteúdo**: `to_tsvector('portuguese', unaccent(name || ' ' || tags))`
  quando `deleted_at IS NULL`; `NULL` quando soft-deleted.
- **Invariante**: a coluna NUNCA é escrita por código de aplicação — só pelo trigger.
  `Unsupported` garante que ela não aparece em selects tipados do Prisma Client.

### 1.2 Índice GIN

`CREATE INDEX idx_lessons_search_vector ON "lessons" USING GIN ("search_vector");`
(declarado no schema via `@@index([searchVector], type: Gin)` — nome efetivo pode ser
`lessons_search_vector_idx` conforme convenção Prisma; aceitável).

### 1.3 RLS (já existente — NÃO recriar)

A policy `rls_lessons_tenant_isolation` já existe (migration 8-1) e cobre a busca:
```sql
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```
A coluna nova NÃO altera a policy. A migration 8-8 NÃO mexe em policy de `lessons`
(apenas adiciona coluna/índice/trigger/extension). RLS spec da busca é exigida assim
mesmo (Princípio I + RECONCILIACAO) porque introduz um **novo caminho de leitura**
(query full-text com JOINs) que precisa provar isolamento.

---

## 2. Tabelas lidas por JOIN (sem alteração)

| Tabela | Coluna usada | Uso |
|--------|--------------|-----|
| `modules` | `name`, `trail_id`, `tenant_id`, `deleted_at` | nome do módulo no resultado; cadeia até trail |
| `trails` | `name`, `status`, `tenant_id`, `deleted_at` | nome da trilha + status (draft/published/archived) p/ visibilidade |

Edge case (spec linha 98): aula cujo módulo/trilha está soft-deleted em qualquer nível
NÃO deve aparecer → a query exige `modules.deleted_at IS NULL AND trails.deleted_at IS NULL`
no JOIN (além de `lessons.deleted_at IS NULL`, já garantido por search_vector NULL).

`TrailStatus` enum (confirmado): `draft | published | archived`.

---

## 3. Projeção "Resultado de busca" (não persistida)

Derivada em tempo de consulta. Mapeamento DB → DTO (ver `contracts/`):

| Campo resultado (DTO camelCase) | Origem | Notas |
|---------------------------------|--------|-------|
| `lessonId` | `lessons.id` | UUID v7 |
| `lessonName` | `lessons.name` | |
| `moduleId` | `modules.id` | |
| `moduleName` | `modules.name` | |
| `trailId` | `trails.id` | |
| `trailName` | `trails.name` | |
| `contentType` | `lessons.content_type` | enum |
| `snippet` | `ts_headline(..., 'StartSel=\x02, StopSel=\x03')` | texto plano; matches entre sentinelas não-HTML; destaque `<b>` montado no FE em JSX (FR-005 / dec-014) |
| `rank` | `ts_rank(search_vector, tsquery)` | float; ordena DESC |
| `isDraft` | `trails.status = 'draft'` | bool explícito; badge "Rascunho" (FR-008) |

Regras de visibilidade aplicadas na projeção (research D6):
- Participante: linhas com `trails.status = 'draft'` são EXCLUÍDAS.
- Líder/Admin: incluídas, com `isDraft = true`.
- `archived` tratado como `published` (FR-013): nunca excluído por status.

---

## 4. Convenções de borda (DB ↔ DTO ↔ Zod)

| Camada | Convenção | Exemplo |
|--------|-----------|---------|
| DB (Postgres) | snake_case | `content_type`, `search_vector`, `tenant_id` |
| Prisma model | camelCase + `@map` | `contentType @map("content_type")` |
| Query raw (busca) | retorna snake_case → **mapear no service** | service converte para DTO camelCase |
| DTO / resposta JSON | camelCase | `contentType`, `trailName`, `isDraft` |
| Zod (`packages/types`) | camelCase, snapshot test | `searchResultSchema` |

> A busca usa **raw SQL** (`$queryRaw`) por causa do `tsvector`/`ts_rank`/`ts_headline`.
> O resultado raw vem em snake_case/alias → o service mapeia **explicitamente** para o
> DTO camelCase validado pelo Zod (sem `undefined`; `null` explícito quando aplicável).

---

## 5. Migration (resumo — detalhe em research D2/D3)

Ordem de aplicação (transação; rollback reverso):
1. `CREATE EXTENSION IF NOT EXISTS unaccent;`
2. `ALTER TABLE "lessons" ADD COLUMN "search_vector" tsvector;`
3. `CREATE FUNCTION lessons_search_vector_update()` (trigger fn, soft-delete aware).
4. `CREATE TRIGGER trg_lessons_search_vector BEFORE INSERT OR UPDATE ...`
5. Backfill: `UPDATE lessons SET search_vector = to_tsvector(...) WHERE deleted_at IS NULL;`
6. `CREATE INDEX ... USING GIN ("search_vector");` (ou via `@@index` Prisma).

Rollback (down): DROP INDEX → DROP TRIGGER → DROP FUNCTION → DROP COLUMN →
(NÃO dropar EXTENSION unaccent — pode ser usada por outras migrations futuras; deixar).

`prisma migrate status` deve ficar limpo (coluna `Unsupported` declarada no schema).
