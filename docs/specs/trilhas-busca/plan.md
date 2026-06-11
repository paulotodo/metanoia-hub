# Implementation Plan: Busca Full-Text de Trilhas e Aulas

**Feature**: `trilhas-busca` | **Story**: 8-8 (Epic 8 — Content)
**Branch**: `feat/story-8-8-trilhas-busca`
**Spec**: `docs/specs/trilhas-busca/spec.md`
**Constraints autoritativos**: `_bmad-output/implementation-artifacts/RECONCILIACAO-EPIC8-W1b3.md` §1, §3 (8-8), §5
**Date**: 2026-06-11

## Summary

Adicionar busca full-text de aulas (lessons) por nome e tags, escopada ao tenant,
ranqueada por relevância (`ts_rank`), com highlight em texto plano (`ts_headline` com
sentinelas não-HTML; destaque `<b>` montado no FE via JSX — dec-014),
prefix matching e insensível a diacríticos (`unaccent` + dicionário `'portuguese'`).
Implementação: coluna `search_vector tsvector` em `lessons` mantida por trigger
(soft-delete aware), índice GIN, módulo NestJS `apps/api/src/search/` novo, endpoint
`GET /api/v1/search?q=`, RLS para isolamento de tenant (policy existente), visibilidade
de rascunho por papel em app-level, e campo de busca no FE de trilhas. Top-20 sem paginação.

## Technical Context

- **Language/Runtime**: TypeScript `strict: true` (Node, NestJS 11 backend; Next.js 16 FE).
- **DB**: PostgreSQL + extensão `unaccent` (contrib), full-text search (`tsvector`/`tsquery`/
  `ts_rank`/`ts_headline`/GIN). Prisma v7 (`PrismaPg` adapter), RLS multi-tenant.
- **Contracts**: Zod em `packages/types` + snapshot test.
- **Backend pattern**: módulo por bounded context; `search/` é novo (espelha `reports/` 8-7).
  Query full-text via `$queryRaw` dentro de `withTenantTx`. `ZodValidationPipe` custom.
- **Frontend**: App Router; campo de busca em `app/(authenticated)/app/consumo/trilhas/`
  (Client Component + TanStack Query); render de snippet montando `<b>{trecho}</b>` em JSX
  (React escapa o conteúdo do autor). PROIBIDO `dangerouslySetInnerHTML`; sem DOMPurify.
- **Testing**: unit (`*.spec.ts`), RLS spec (`apps/api/test/rls/lessons-search.rls-spec.ts`),
  snapshot Zod, jest-axe no FE.
- **Performance target**: <500ms p/ 10k lessons (SC-001); sem match <200ms (SC-007).
- **Scale**: top-20 fixo, sem paginação nesta versão (FR-012).
- **NEEDS CLARIFICATION**: nenhum residual — Phase 0 (research.md) resolveu D0–D8.

## Constitution Check (GATE)

Avaliado contra `docs/constitution.md` v1.0.0. Gate: violação de MUST bloqueia.

| Princípio | Aderência do plano | Status |
|-----------|--------------------|--------|
| **I. Multi-tenancy Absoluto** | `lessons` já tem RLS `rls_lessons_tenant_isolation` (NULLIF pattern, verificado). Busca roda em `withTenantTx`; `tenant_id` NUNCA é parâmetro (resolvido por RequestContext). RLS spec nova obrigatória (`lessons-search.rls-spec.ts`, 2 tenants). JOINs em `modules`/`trails` também sob RLS. | PASS |
| **II. Type-Safety & IDs** | `strict: true`; sem novos `@default(uuid())` (a coluna nova é tsvector, sem PK; IDs existentes já v7). Datas ISO 8601; `null` explícito; sem `undefined` no JSON (ex: `isDraft` booleano explícito). | PASS |
| **III. Idioma & Vocabulário Pastoral** | código/logs/Swagger em inglês; empty state e mensagens user-facing em PT-BR (`apps/web/messages/pt-BR.json`); empty state com vocabulário pastoral, ícone + texto. | PASS |
| **IV. Contratos de API** | Zod em `packages/types` + snapshot; envelope `{ data, meta }`; erro `{ statusCode, error, message }` sem stack; `/api/v1/` prefix; `ZodValidationPipe` custom (sem lib terceiro). GET de busca → 200 (read-only, sem 201/204). | PASS |
| **V. Separação de Estado FE** | campo de busca é Client Component → TanStack Query (server state); sem TanStack em Server Component; sem mistura com Zustand. | PASS |
| **VI. Qualidade Verificável** | unit + RLS spec + snapshot Zod; jest-axe + navegação teclado no FE (WCAG AA); CI verde (lint+test+build) antes de done. Unit XSS no snippet + teste de componente FE (render via JSX, sem HTML interpretado) — research D4.1 / dec-014. | PASS |
| **Segurança (gate owasp-security)** | A05 Injection (tsquery): `q` bound `$1`, sanitização → MITIGADO. **A03/CWE-79 XSS no snippet**: achado HIGH — `name`/`tags` são input de autor; mitigação **secure by construction** (dec-014): payload SEM HTML (`ts_headline` com sentinelas não-HTML) + destaque montado em JSX no FE (React escapa); `dangerouslySetInnerHTML` e DOMPurify ELIMINADOS → classe de XSS removida por design (research D4.1). A01 Access Control (draft por papel; tenant via RLS): deny-by-default server-side → MITIGADO. | PASS |
| **VII. Processo Auditável** | 1 story = 1 branch (`feat/story-8-8-trilhas-busca`) = 1 PR; commits conventional PT-BR; reconciliação já feita (RECONCILIACAO-EPIC8-W1b3 confirma "NOVA"). | PASS |

**Architecture Decisions**: Content é core domain → repository pattern. A busca é leitura
especializada (raw SQL); encapsulada em `search.service.ts` (service direto com `$queryRaw`
sob `withTenantTx`), aceitável como subdomínio de leitura sobre Content. Sem `packages/utils`
genérico. Redis namespaces inalterados (busca não usa fila/cache nesta versão).

**Resultado do GATE**: PASS — nenhuma violação de MUST. Nenhuma entrada em Complexity Tracking.

## Project Structure (paths REAIS)

### Backend (`apps/api/`)
```
apps/api/prisma/
  schema.prisma                         # + coluna searchVector Unsupported("tsvector")? + @@index Gin em Lesson
  migrations/
    <ts>_8-8-lessons-search-vector/
      migration.sql                     # RAW SQL: EXTENSION unaccent + coluna + função + trigger + backfill + GIN
apps/api/src/search/                    # MÓDULO NOVO (espelha apps/api/src/reports/)
  search.module.ts
  search.controller.ts                  # GET /api/v1/search?q=  (ZodValidationPipe)
  search.service.ts                     # $queryRaw + withTenantTx + map snake->camel + visibilidade por papel
  search.service.spec.ts                # unit
apps/api/test/rls/
  lessons-search.rls-spec.ts            # RLS spec NOVA (2 tenants)
```

### Shared contracts (`packages/types/`)
```
packages/types/src/search/
  search-result.schema.ts               # searchResultItem + searchResponse (reusa content-type.enum)
packages/types/src/index.ts             # registrar export
packages/types/src/__tests__/
  search.snapshot.spec.ts               # snapshot Zod (gate breaking change)
```

### Frontend (`apps/web/`)
```
apps/web/app/(authenticated)/app/consumo/trilhas/
  (campo de busca + lista de resultados; Client Component + TanStack Query)
apps/web/src/lib/api/hooks/
  use-search.ts                         # useQuery (server state)
apps/web/messages/pt-BR.json            # + chaves de empty state / placeholder pastoral
```

## Convenções de Borda (DB ↔ DTO ↔ Zod)

Camada de tradução obrigatória — a busca usa raw SQL, então o mapeamento é manual e explícito.

| Fronteira | Convenção | Mecanismo |
|-----------|-----------|-----------|
| Postgres → resultado raw | snake_case (`content_type`, `trail_name`, `is_draft`) | aliases na query `$queryRaw` |
| resultado raw → DTO | snake_case → camelCase | mapeamento explícito no `search.service.ts` (sem spread cego) |
| DTO → resposta JSON | camelCase, `{ data, meta }` | controller; `null` explícito, sem `undefined` |
| FE ↔ BE | Zod `searchResponseSchema` (camelCase) | `packages/types/src/search/` + snapshot |
| coluna tsvector | NUNCA escrita por código | só trigger; `Unsupported` no Prisma a esconde do client tipado |

Pontos críticos:
- `tenant_id` jamais cruza a borda como parâmetro — resolvido por RequestContext, aplicado
  por RLS (`SET LOCAL app.current_tenant_id` via `withTenantTx`).
- Termo `q` bound como `$1` no `$queryRaw` (anti-injeção tsquery/SQL); sanitização server-side.
- `LessonContentType` reusa o enum de `packages/types/src/content/content-type.enum.ts`
  (não redefinir).
- `snippet` (A03/CWE-79 — gate owasp-security HIGH): `name`/`tags` SÃO input de autor, então
  `ts_headline` poderia emitir HTML ativo. Mitigação **secure by construction** (dec-014,
  research D4.1): o payload NÃO contém HTML — `ts_headline` usa `StartSel=\x02, StopSel=\x03`
  (sentinelas não-HTML); o `snippet` sai como texto plano e o FE monta `<b>{trecho}</b>` em
  JSX (React escapa o conteúdo do autor). `dangerouslySetInnerHTML` é PROIBIDO; DOMPurify e o
  escape HTML manual server-side foram REMOVIDOS. Unit test com `name='<script>'` asseverando
  que o snippet é texto plano (sem HTML do autor interpretável) + teste de componente FE.

## Phase 0 — Outline & Research

Concluída. Ver `research.md` (decisões D0–D8). Todos os NEEDS CLARIFICATION resolvidos:
- D0: tsvector indexa `lessons.name` + `lessons.tags` (Lesson NÃO tem title/description —
  confirmado empiricamente no schema); trilha/módulo por JOIN.
- D1: dicionário `'portuguese'` + `unaccent()` inline (escrita e leitura) → diacríticos.
- D2: coluna `Unsupported("tsvector")?` + raw SQL p/ trigger/GIN/EXTENSION; cuidar drift.
- D3: trigger BEFORE INSERT/UPDATE; soft-deleted → `search_vector = NULL`.
- D4: `to_tsquery(:*)` prefix + `ts_rank` + `ts_headline` (sentinelas não-HTML) + LIMIT 20; sanitização.
- D5: RLS existente + RLS spec nova; tenant nunca em código.
- D6: draft hidden p/ participante (app-level por papel); líder/admin vê com `isDraft`.
- D7: GIN + LIMIT 20; `ts_headline` só nas linhas finais (custo previsível).
- D8: módulo `search/` novo espelhando `reports/`; reuso `withTenantTx`/Zod pipe.

## Phase 1 — Design & Contracts

Concluída. Artefatos:
- `data-model.md`: coluna `search_vector` em `lessons`; tabelas lidas por JOIN; projeção
  "Resultado de busca"; convenções de borda; resumo da migration + rollback.
- `contracts/search-api.md`: `GET /api/v1/search?q=` — params, resposta 200, vazio, erros,
  shape canônico Zod.
- `quickstart.md`: roundtrip end-to-end REAL (curl ao backend) + cenários por SC.

## Phase 2 — Planejamento de tarefas (descrição, NÃO executar aqui)

A próxima fase (`create-tasks`) derivará tasks de plan.md + contracts + data-model. Ordem
esperada (TDD onde aplicável):
1. Schema: coluna `Unsupported("tsvector")?` + `@@index Gin` → `migrate dev --create-only`.
2. Editar `migration.sql` (EXTENSION → função → trigger → backfill → GIN); `migrate status` limpo.
3. Zod `search-result.schema.ts` + registrar + snapshot test (RED→GREEN).
4. `search.service.ts` ($queryRaw, withTenantTx, map, visibilidade por papel) + unit.
5. `search.controller.ts` (GET, ZodValidationPipe) + `search.module.ts` + wire no AppModule.
6. RLS spec `lessons-search.rls-spec.ts` (2 tenants, padrão Prisma v7 da RECONCILIACAO §5).
7. FE: hook `use-search.ts` + campo de busca + empty state pastoral PT-BR + jest-axe.
8. Gates CI: `prisma generate && turbo build && turbo lint`; commit `pnpm-lock.yaml` se dep nova.

## Complexity Tracking

Nenhuma violação de princípio constitucional. Tabela vazia (sem justificativas de exceção).

| Violação | Por que necessária | Alternativa mais simples rejeitada porque |
|----------|--------------------|-----|
| (nenhuma) | — | — |

## Guardrails / armadilhas (de RECONCILIACAO §5 — repassar a create-tasks/execute)

- **build ≠ lint**: após schema/migration → `prisma generate && turbo build && turbo lint`.
- **Prisma v7 + tsvector**: raw SQL; `prisma migrate status` SEM drift (coluna Unsupported).
- **NULLIF invariante**: qualquer policy RLS → `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`
  (a busca NÃO cria policy nova em lessons, mas a RLS spec deve usar o pattern).
- **RLS spec Prisma v7**: adapter `PrismaPg(DATABASE_APP_URL)`; UUIDs hex fixos; users globais;
  cadeia FK tenant→trail→module→lesson no `beforeAll`, derruba só no `afterAll`; `beforeEach`
  limpa só mutável; ids/emails únicos.
- **CI flaky**: `reflections.rls-spec.ts` FK P2003 → `gh run rerun --failed`; `gh pr merge` 401 → retry;
  E2E "registry-1.docker.io deadline" → re-run.
- Multi-tenant SEMPRE; UUID v7 `generateId()`; ISO 8601; nulls explícitos; `{data,meta?}`;
  inglês no código/log, PT-BR user-facing + vocabulário pastoral; conventional commits PT-BR.
