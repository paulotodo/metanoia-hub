# Research: Busca Full-Text de Trilhas e Aulas (`trilhas-busca` / Story 8-8)

**Phase**: 0 (Outline & Research)
**Feature dir**: `docs/specs/trilhas-busca/`
**Authoritative constraints**: `_bmad-output/implementation-artifacts/RECONCILIACAO-EPIC8-W1b3.md` §1, §3 (8-8), §5

Todos os NEEDS CLARIFICATION foram resolvidos nesta fase. Não há marcadores residuais.

---

## D0. Drift de campos do schema (BLOQUEANTE — resolvido empiricamente)

**Decisão**: O `tsvector` indexa **`lessons.name` + `lessons.tags`**. NÃO existe
`lessons.title` nem `lessons.description`. `content_body` é OPCIONAL e fica **fora**
do `search_vector` nesta versão (evita inchaço do índice; nome+tags cobre os AC).

**Rationale**: verificação empírica de `apps/api/prisma/schema.prisma` (model `Lesson`):

```
name        String   @db.VarChar(255)
tags        String[] @default([])
contentBody String?  @map("content_body") @db.Text   # NÃO indexado nesta versão
contentType LessonContentType @map("content_type")
# NÃO HÁ title NEM description em Lesson.
```

`Trail` tem `name` + `description` + `status` (enum `draft|published|archived`).
`Module` tem `name`. Mapas DB: `lessons`, `trails`, `modules` (snake_case via `@@map`).

Nome de trilha/módulo NÃO entra no `search_vector` da lesson — vêm por **JOIN**
na query de busca (para compor o resultado), conforme RECONCILIACAO §1.

**Alternatives considered**: indexar `content_body` junto → rejeitado: Text grande
infla o índice GIN e o ranking fica dominado por corpo de aula, fora do escopo dos AC
(que falam de nome + tags). Pode ser adicionado incrementalmente.

---

## D1. Idioma do dicionário tsvector

**Decisão**: usar a configuração `'portuguese'` do `to_tsvector`/`to_tsquery`,
combinada com a extensão **`unaccent`** aplicada ANTES da tokenização, via uma
configuração de texto derivada OU `unaccent()` explícito nas expressões.

Abordagem escolhida (mais simples e determinística, sem criar text search config
custom): aplicar `unaccent()` na função de normalização tanto na **escrita**
(trigger que popula `search_vector`) quanto na **leitura** (montagem do `tsquery`):

```sql
to_tsvector('portuguese', unaccent(coalesce(name,'') || ' ' || coalesce(array_to_string(tags,' '),'')))
```

e na query:

```sql
to_tsquery('portuguese', unaccent(<termo-sanitizado>) || ':*')   -- prefixo
```

**Rationale**:
- `'portuguese'` ativa stemming PT (radicalização: "discipulado"/"discípulos" → mesmo radical),
  satisfazendo relevância e matching natural para o catálogo pastoral (PT-BR).
- `unaccent` garante FR-002 / SC-002 (insensível a diacríticos: "educação" == "educacao"),
  porque é aplicado em ambos os lados (índice e query), tornando a comparação simétrica.
- Aplicar `unaccent()` inline (em vez de criar `CREATE TEXT SEARCH CONFIGURATION`) reduz
  superfície de migration e evita objeto de catálogo extra a versionar; o custo é repetir
  `unaccent()` na query (aceitável, é IMMUTABLE).

**Alternatives considered**:
- `'simple'` (sem stemming): rejeitado — perde radicalização PT, prejudica relevância
  (FR-004) e prefix matching semântico.
- Criar text search config custom `portuguese_unaccent` com `ALTER ... MAPPING ... WITH unaccent, portuguese_stem`:
  funcionaria e seria "mais limpo" em queries, mas adiciona objeto de catálogo persistente
  que precisa de rollback explícito e cuidado de drift Prisma. Mantido como evolução futura.

**Observação de pré-requisito**: a extensão `unaccent` é parte do `contrib` do PostgreSQL
(disponível na imagem `postgres` usada nos docker-compose). Migration faz
`CREATE EXTENSION IF NOT EXISTS unaccent;` (idempotente).

---

## D2. Coluna `search_vector` no Prisma v7

**Decisão**: declarar a coluna no `schema.prisma` como
`searchVector Unsupported("tsvector")? @map("search_vector")` no model `Lesson`,
mais `@@index([searchVector], type: Gin)`. O **conteúdo** (trigger + função +
GIN + EXTENSION) é criado via **migration RAW SQL** (não schema-only).

**Rationale**:
- `Unsupported("tsvector")?` mantém `prisma migrate status` consistente: a coluna
  existe no schema declarado e na DDL aplicada, então não acusa drift. Prisma NÃO
  gera tipo TS utilizável para `Unsupported` (fica fora dos selects tipados), o que
  é exatamente o desejado — a coluna é gerida por trigger, nunca escrita por código.
- O índice GIN é declarado para o schema "saber" dele; o trigger/função/EXTENSION
  são raw SQL editados manualmente no `migration.sql` (Prisma migrate diff não
  modela trigger/função).
- RECONCILIACAO §3 (8-8) e §5 exigem cuidar de `prisma migrate status` para não
  dessincronizar → rodar `pnpm exec prisma migrate diff` / `status` após editar a
  migration manualmente.

**Procedimento de geração da migration** (a executar na fase de implementação,
NÃO nesta fase de plano):
1. Adicionar a coluna `Unsupported("tsvector")?` + `@@index(..., type: Gin)` ao schema.
2. `prisma migrate dev --create-only` para gerar o esqueleto da coluna + índice.
3. Editar o `migration.sql` gerado para inserir, em ordem: `CREATE EXTENSION` →
   função de trigger → `CREATE TRIGGER` → (índice GIN já gerado pelo Prisma; se não,
   adicionar). Garantir rollback reverso documentado no PR.
4. `prisma generate && prisma migrate status` → sem drift.

**Alternatives considered**:
- Manter a coluna 100% fora do schema (só raw): rejeitado — `prisma migrate status`
  passa a acusar drift ("column search_vector exists in DB but not in schema") a cada
  introspecção, gerando ruído e risco de o próximo `migrate dev` querer dropá-la.
- Generated column (`GENERATED ALWAYS AS (...) STORED`): rejeitado — expressão de
  tsvector com `unaccent`/`array_to_string` não é trivialmente IMMUTABLE-safe para
  generated column em todas as versões; o trigger com `WHERE deleted_at IS NULL`
  (não indexar soft-deleted) é mais explícito e é o padrão pedido pela RECONCILIACAO §3.

---

## D3. Trigger de indexação + soft-delete

**Decisão**: trigger `BEFORE INSERT OR UPDATE` em `lessons` que popula
`NEW.search_vector`. Para soft-deleted, **NÃO indexar**: quando `NEW.deleted_at IS NOT NULL`,
setar `search_vector = NULL` (linha deixa de casar qualquer `tsquery`).

```sql
CREATE OR REPLACE FUNCTION lessons_search_vector_update() RETURNS trigger AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN
    NEW.search_vector :=
      to_tsvector('portuguese',
        unaccent(coalesce(NEW.name,'') || ' ' || coalesce(array_to_string(NEW.tags,' '),'')));
  ELSE
    NEW.search_vector := NULL;   -- soft-deleted: fora do índice
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lessons_search_vector
  BEFORE INSERT OR UPDATE ON "lessons"
  FOR EACH ROW EXECUTE FUNCTION lessons_search_vector_update();
```

**Rationale**:
- FR-001 / FR-009 / SC-006: re-indexa em cada INSERT/UPDATE; soft-delete (que é um
  UPDATE setando `deleted_at`) limpa o vetor → aula sai dos resultados "na próxima
  atualização do registro" (eventual consistency aceitável por SC-006, <1min).
- Edge case (RECONCILIACAO + spec): o `WHERE deleted_at IS NULL` da RECONCILIACAO §3
  refere-se a NÃO indexar soft-deleted; implementamos isso pela lógica `IF NEW.deleted_at IS NULL`
  no corpo do trigger (mais portável que índice parcial sobre coluna gerada). O índice
  GIN é total, mas linhas soft-deleted têm `search_vector = NULL` e nunca casam.

**Backfill**: a migration deve, após criar trigger/coluna, rodar um `UPDATE lessons SET
updated_at = updated_at` NÃO — em vez disso popular diretamente: `UPDATE lessons SET
search_vector = to_tsvector(...) WHERE deleted_at IS NULL;` para indexar registros
pré-existentes (idempotente).

---

## D4. Query de busca: ranking, highlight, prefix

**Decisão**:
- **Match**: `search_vector @@ to_tsquery('portuguese', unaccent(<saneado>) || ':*')`
  (`:*` = prefix matching, FR-003 / SC-003).
- **Ranking**: `ts_rank(search_vector, <tsquery>)` ordenado `DESC` (FR-004 / SC-005-ordem).
- **Highlight (snippet)**: `ts_headline('portuguese', unaccent(name || ' ' || array_to_string(tags,' ')), <tsquery>, 'StartSel=\x02, StopSel=\x03, MaxFragments=1, MaxWords=15, MinWords=3')`
  → texto plano com **marcadores sentinela NÃO-HTML** (`\x02`/`\x03`, STX/ETX, caracteres
  de controle improváveis no conteúdo) delimitando os matches. O payload NÃO contém HTML
  (D4.1 / dec-014). FR-005 (destaque do termo) é satisfeito no FE via JSX `<b>{trecho}</b>`.
- **Limite**: top-20 fixo (`LIMIT 20`), sem paginação (Clarification + FR-012).

**Sanitização do termo (Edge Cases)**: o termo do usuário NÃO é interpolado direto em
`to_tsquery` (que falharia com aspas/parênteses → erro de sintaxe → 500). Estratégia:
usar `websearch_to_tsquery('portuguese', unaccent($1))` para o termo bruto **OU**
sanitizar para tokens alfanuméricos e montar `plainto_tsquery` + sufixo `:*`. Decisão:
**`websearch_to_tsquery`** para o corpo do termo (tolera aspas/parênteses sem erro),
e para prefix matching aplicar `:*` ao último token via construção controlada.

> Detalhe de borda: `websearch_to_tsquery` não suporta `:*` nativo. Para conciliar
> prefix matching (FR-003) com tolerância a caracteres especiais (Edge Cases), a
> implementação fará: (a) normalizar o termo removendo caracteres de controle de
> tsquery; (b) dividir em tokens; (c) montar `to_tsquery` com cada token + `:*`
> usando parâmetros vinculados (`$1`), nunca concatenação de string crua do usuário.
> Termo vazio/sem tokens válidos → retorna `{ data: [], meta: { total: 0 } }` (FR-010).
> Isto é decisão de research; o `contracts/` e o `quickstart` validam o comportamento
> observável (sem 500, lista vazia em casos degenerados).

**Rationale**: `ts_rank` é o ranking textual padrão do Postgres; `ts_headline` gera o
highlight pedido na Clarification, mas com **sentinelas não-HTML** em vez de `<b>`
(D4.1 / dec-014); prefix `:*` cobre SC-003.

**Alternatives considered**:
- `ts_rank_cd` (cover density): rejeitado por ora — `ts_rank` é suficiente para o
  volume e os AC; `ts_rank_cd` pode ser adotado se relevância de frases importar.
- Highlight 100% client-side (FE re-localiza o termo no texto): viável, mas reusar o
  `ts_headline` (com sentinelas) preserva a lógica de fragmento/stemming do Postgres
  sem reimplementar match no FE. O destaque visual (`<b>`) é montado no FE.

### D4.1 XSS no `snippet` (A03:2025 / CWE-79) — MITIGAÇÃO: SECURE BY CONSTRUCTION (Opção 2)

**Achado (gate owasp-security, severidade HIGH)**: a Clarification afirma "sem input de
usuário no conteúdo", mas isso é INCORRETO — `ts_headline` opera sobre `lessons.name` e
`lessons.tags`, que **são preenchidos pelo autor do conteúdo** (líder/admin que cria a
aula). `ts_headline` NÃO faz HTML-escape do texto de entrada: ele apenas envolve os
matches com `StartSel`/`StopSel`. Uma aula nomeada
`<img src=x onerror=alert(document.cookie)>` produziria, sob a abordagem antiga (HTML cru
no payload + `dangerouslySetInnerHTML` no FE), um `snippet` com HTML ativo → **XSS
armazenado**, possivelmente cross-tenant em telas de admin agregadas.

**Decisão (dec-014 — resposta do operador ao block-001): NÃO emitir HTML cru. Eliminar a
classe inteira de XSS por construção, em vez de mitigá-la com escape + sanitizer.**

1. **Backend — payload sem HTML**: o `ts_headline` usa `StartSel`/`StopSel` = **marcadores
   sentinela NÃO-HTML** (caracteres de controle improváveis: `\x02` STX / `\x03` ETX). O
   `snippet` retornado no payload é **texto plano** delimitado por essas sentinelas — não
   contém `<b>`, `<`, `>` nem qualquer markup HTML. (Forma equivalente alternativa: retornar
   o snippet em texto plano + `ranges: [[start,end], ...]` com os offsets dos matches; o FE
   reconstrói o destaque. A forma com sentinelas é a escolhida por reusar o
   fragmento/stemming do `ts_headline` sem cálculo de offset adicional.)
2. **Frontend — destaque via JSX, React escapa**: o FE faz `split` do snippet pelas
   sentinelas e monta o destaque com `<b>{trecho}</b>` em JSX. React **escapa
   automaticamente** o conteúdo do autor ao renderizar `{trecho}` como texto — qualquer
   `<`, `>`, `<script>` vira texto inerte. É **PROIBIDO** `dangerouslySetInnerHTML`.
3. **Dependências removidas**: a abordagem anterior (escape HTML manual server-side +
   **DOMPurify** no FE) é REVOGADA. Não adicionar DOMPurify ao FE; não fazer HTML-escape
   manual do texto-fonte no servidor. Não há HTML para sanitizar porque não há HTML.

**Rationale**: A03/CWE-79 é o weakness #1 do CWE Top 25:2025. `name`/`tags` são input de
usuário (autor), portanto a premissa "conteúdo confiável" da Clarification não se sustenta.
"Secure by construction" elimina a superfície inteira: sem HTML no payload + render via JSX
(escape automático do React) ⇒ não há caminho para o conteúdo do autor ser interpretado
como markup. Menos dependências (sem DOMPurify), menos código de escape, menos risco de
configuração frágil de sanitizer.

> Nota de borda: as sentinelas `\x02`/`\x03` são caracteres de controle que não ocorrem em
> nomes/tags legítimos; ainda assim, o backend faz `replace()` do texto-fonte removendo
> qualquer `\x02`/`\x03` pré-existente ANTES do `ts_headline`, para que o `split` no FE
> seja inequívoco. Isso é higiene de delimitador, não segurança HTML.

**Unit cobrindo XSS**: o unit do `search.service` DEVE incluir caso com
`name = '<script>alert(1)</script>'` e asseverar que (a) o `snippet` retornado é texto
plano (apenas as sentinelas como markup), e (b) nenhum HTML do autor (`<script>`, `<b>`,
`<img>`) aparece interpretável — só as sentinelas de controle. Complementarmente, o teste de
componente do FE renderiza esse snippet e verifica que NENHUM HTML do autor é
interpretado/renderizado (o conteúdo aparece como texto via JSX, sem nó `<script>`).

---

## D5. RLS / tenant isolation na busca

**Decisão**: a busca roda DENTRO de `withTenantTx` (que faz
`SET LOCAL app.current_tenant_id`), e a tabela `lessons` já tem a policy
`rls_lessons_tenant_isolation` (verificada empiricamente na migration 8-1):

```sql
CREATE POLICY rls_lessons_tenant_isolation ON "lessons"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

Portanto a query de busca **não filtra `tenant_id` em código** — a RLS é a última
linha de defesa (FR-006 / FR-011 / SC-005). `tenant_id` NUNCA é parâmetro (Princípio I).
Os JOINs para `modules`/`trails` também passam por RLS própria (ambas têm policy de
tenant isolation), garantindo que o snippet não vaze nome de trilha de outro tenant.

**RLS spec obrigatória** (Princípio I + RECONCILIACAO §3/§5):
`apps/api/test/rls/lessons-search.rls-spec.ts` — 2 tenants com lessons de nomes
idênticos; valida que a busca via `withTenantTx(tenantA)` retorna só lessons de A.
Segue o padrão Prisma v7 da RECONCILIACAO §5 (adapter `PrismaPg`, UUIDs hex fixos,
users globais, cadeia FK tenant→trail→module→lesson no `beforeAll`, cleanup no `afterAll`).

---

## D6. Visibilidade por papel (draft) — app-level

**Decisão**: a regra "Participante não vê aula de trilha `draft`; Líder/Admin vê com
badge Rascunho" é aplicada em **código de aplicação** (não RLS), via JOIN com `trails`
e filtro condicional pelo papel resolvido do `RequestContext` (Keycloak roles):

- Participante: `WHERE trails.status <> 'draft'` (e `archived` tratado como `published`,
  FR-013 — sem restrição adicional).
- Líder / Admin: sem filtro de status; resultado inclui `isDraft: boolean` derivado de
  `trails.status = 'draft'` para o FE exibir o badge "Rascunho" (FR-008 / SC-004).

**Rationale**: visibilidade por papel é regra de negócio (autorização camada Guard/serviço),
não isolamento de tenant — a RLS isola tenant; o papel modula quais status aparecem.
`archived` == `published` para visibilidade (FR-013, Clarification). Soft-deleted nunca
aparece (search_vector NULL, D3) independentemente do papel (FR-009 / SC-004-cláusula).

---

## D7. Performance (SC-001: <500ms p/ 10k lessons)

**Decisão**: índice GIN sobre `search_vector` + `LIMIT 20` + ranking. GIN é o índice
adequado para `tsvector @@ tsquery`. Para 10k lessons o GIN responde em milissegundos;
o custo dominante é `ts_headline` (executa sobre as linhas retornadas — limitado a 20).
Sem paginação, sem `OFFSET` (que degradaria). Sem match → resposta vazia rápida
(SC-007 <200ms): `tsquery` não casa nada, GIN retorna 0 linhas, sem `ts_headline`.

**Rationale**: `ts_headline` NÃO usa índice e é caro; aplicá-lo só nas ≤20 linhas do
resultado final (após ORDER BY rank LIMIT 20) mantém o custo previsível.

---

## D8. Reuso de infraestrutura (NÃO recriar)

Confirmado empiricamente (RECONCILIACAO §2):
- NÃO existe `apps/api/src/search/` → criar do zero.
- NÃO existe extensão `unaccent`/`tsvector` em migrations → migration nova.
- Padrão de módulo novo: espelhar `apps/api/src/reports/` (8-7, mais recente):
  `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.service.spec.ts`.
- Zod em `packages/types/src/content/` (ou novo `packages/types/src/search/`),
  registrado em `packages/types/src/index.ts`, com snapshot test.
- `withTenantTx` já disponível e usado largamente (`meetings/`, `admin-pastoral/`).
- `ZodValidationPipe` custom já existe (usado em `meetings.controller.ts` etc.).

---

## Resumo de decisões (rastreável)

| ID | Decisão | FR/SC ligados |
|----|---------|---------------|
| D0 | tsvector indexa `lessons.name` + `lessons.tags`; trilha/módulo por JOIN | FR-001, FR-005 |
| D1 | dicionário `'portuguese'` + `unaccent()` inline (índice e query) | FR-002, SC-002 |
| D2 | coluna `Unsupported("tsvector")?` no schema + raw SQL p/ trigger/GIN | RECONCILIACAO §3 |
| D3 | trigger BEFORE INSERT/UPDATE; soft-deleted → search_vector NULL | FR-001, FR-009, SC-006 |
| D4 | `to_tsquery(... :*)` prefix, `ts_rank`, `ts_headline` `<b>`, LIMIT 20 | FR-003/004/005/012 |
| D5 | tenant isolation via RLS existente + `withTenantTx`; RLS spec nova | FR-006/011, SC-005 |
| D6 | draft hidden p/ Participante (app-level); Líder/Admin vê com `isDraft` | FR-007/008, SC-004 |
| D7 | GIN + LIMIT 20; `ts_headline` só nas linhas finais | SC-001, SC-007 |
| D8 | módulo `search/` novo espelhando `reports/`; reusa `withTenantTx`/Zod pipe | — |
