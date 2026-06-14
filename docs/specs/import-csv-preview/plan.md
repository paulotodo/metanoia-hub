# Implementation Plan: Importação CSV — Upload, Preview e Validação

**Feature**: `import-csv-preview`
**Spec**: [spec.md](./spec.md)
**Epic**: 10 — Onboarding Avançado | **Story**: 10-3
**Created**: 2026-06-13
**Status**: Planned

---

## Summary

Permitir que o **Admin Tenant** popule um grupo importando participantes a
partir de planilhas CSV/XLSX (exportadas do Excel BR), com **parse e validação
inteiramente client-side** e uma única chamada de leitura ao servidor para
checar e-mails já cadastrados no tenant. Esta story cobre **upload + preview +
validação**; a confirmação/processamento é a Story 10-4 (`import-csv-confirm`),
fora de escopo.

**Abordagem técnica**:
- **Frontend** (apps/web): `FileUploadZone` (drag&drop, .csv/.xlsx, ≤5 MB,
  "Baixar template" gerado no cliente) + `CSVPreviewTable` (10 linhas, status
  inline crítico/aviso/ok, resumo de totais). Parser de CSV via **papaparse**;
  XLSX via **xlsx (SheetJS)** carregado sob demanda com **dynamic `import()`**
  (SC-004). Encoding auto UTF-8/ISO-8859-1/Windows-1252.
- **Backend** (apps/api): endpoint novo `GET /api/v1/users/check-emails` no
  `users.controller.ts`, autenticado (Admin Tenant), tenant-scoped via
  `withTenantTx`, rate-limited (guard in-memory), batch ≤500.
- **Contratos** (packages/types): `csv-import.ts` com schemas Zod + snapshot
  test.

Nenhum dado do arquivo persiste no servidor (SC-007). **Sem migration**.

---

## Constitution Check

*GATE: passou antes do Phase 0. Re-checado após Phase 1 (§ Re-check) — sem
mudança.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS | `check-emails` consulta SOMENTE o tenant corrente via `withTenantTx` + Prisma extension auto-inject `tenant_id` + RLS. `users.email` é `@unique` global mas a query é filtrada por tenant (sem cross-tenant — FR-19). 3 camadas de authz: Keycloak `@Roles(ADMIN_TENANT)` → `RolesGuard` → RLS. Sem migration → sem mudança de policy → sem RLS spec nova obrigatória. |
| II. Type-Safety & IDs Determinísticos (NON-NEGOTIABLE) | PASS | `strict: true` mantido. Sem nova tabela/UUID (feature stateless no servidor). Contratos como schemas Zod; respostas usam `null` explícito. Nenhum `@default(uuid())`. |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs/Swagger em inglês; labels user-facing PT-BR em `apps/web/messages/pt-BR.json`. Vocabulário pastoral ("Importar participantes", "Pré-visualização", "Participante", "Líder") — FR-24. |
| IV. Contratos de API Padronizados | PASS | Schemas Zod compartilhados em `packages/types`; resposta `{ data, meta? }`; GET→200; `/api/v1/` prefix; `ZodValidationPipe` na query. |
| V. Separação de Estado no Frontend | PASS | Página é Server Component shell; `FileUploadZone`/`CSVPreviewTable` são Client Components. TanStack Query SÓ no Client Component para `check-emails`. Sem mistura TanStack↔Zustand. |
| VI. Qualidade Verificável | PASS | Unit (`*.spec.ts`), integration (`*.integration-spec.ts`), snapshot test Zod obrigatório, WCAG AA via jest-axe (gate real do CI). CI verde antes de done; sem stack trace exposto (resposta de erro padronizada). |
| VII. Processo de Entrega Auditável | PASS | 1 story = 1 branch = 1 PR; conventional commits PT-BR; nova dep → lockfile no PR. Reconciliação Epic 10 já feita (RECONCILIACAO-EPIC10 §10). |

**Resultado**: nenhuma violação de MUST. Gate PASS. Complexity Tracking vazio.

---

## Technical Context

| Campo | Valor |
|-------|-------|
| **Linguagem** | TypeScript (strict) — Node 20+ |
| **Frontend** | Next.js 16.2 (App Router, hybrid SSR+CSR), Tailwind v4, shadcn/ui, TanStack Query 5.x, Zustand 5.x |
| **Backend** | NestJS 11.1, Prisma v7 (PrismaPg adapter), PostgreSQL + RLS |
| **Auth** | Keycloak (roles) → NestJS `RolesGuard` → RLS |
| **Validação** | Zod 4.x (contratos compartilhados em `packages/types`) |
| **Parse CSV** | **papaparse** (NOVA dep — `apps/web`) |
| **Parse XLSX** | **xlsx / SheetJS** (NOVA dep — `apps/web`), dynamic `import()` (fora do bundle inicial) |
| **Encoding** | auto-detect UTF-8 / ISO-8859-1 / Windows-1252 |
| **Testing** | Vitest 4.x, Playwright 1.59, MSW, **jest-axe** (gate a11y real) |
| **Monorepo** | Turborepo + pnpm 10.x |
| **Storage** | N/A no servidor (stateless; nenhum dado do arquivo persiste) |
| **Migration** | NENHUMA (decisão §10 da spec) |
| **NEEDS CLARIFICATION** | 0 (todas resolvidas — ver research.md) |

---

## Convenções de Borda

> Feature multi-camada FE↔BE. Tabela de fonte-da-verdade obrigatória
> (lição dec-172/dec-173: drift snake_case×camelCase não declarado custou
> 40 ondas de retrabalho).

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case (`@map`/`@@map`) | Prisma schema + RLS | `apps/api/prisma/schema.prisma` (existente — `users.email`, sem nova coluna) |
| Backend DTO (NestJS/TS) | camelCase | Zod (`ZodValidationPipe`) | `packages/types/src/onboarding/csv-import.ts` |
| Frontend DTO (TS) | camelCase | Zod parse no fetch | `packages/types` (re-export, mesmo schema) |
| API payload (request/response) | camelCase | Zod em ambos os lados | `contracts/check-emails.api.md` |
| URL path (`/api/v1/users/check-emails`) | kebab-case | router NestJS | `apps/api/src/users/users.controller.ts` |
| URL query param `emails` | CSV-na-query (`?emails=a@x.com,b@y.com`) | `checkEmailsQuerySchema` (`z.string().transform(split)` + cap ≤500) | `contracts/check-emails.api.md` |

**Mapper layer (DB ↔ DTO)**:
- ORM auto-mapping: **SIM** — Prisma v7 mapeia `email` (camelCase no client) ↔
  `email` (coluna). Não há colunas multi-palavra novas nesta feature, então
  não há mapper manual snake↔camel adicional.
- A resposta da API expõe apenas `{ email, exists }` — campos single-word,
  sem ambiguidade de case.

**Validação Zod**:
- **Borda request**: query `emails` validada no backend via
  `ZodValidationPipe(checkEmailsQuerySchema)`.
- **Borda response**: validada no frontend via `checkEmailsResponseSchema.parse()`
  no hook TanStack Query (expõe drift de shape — ver quickstart roundtrip).
- **Schema compartilhado**: SIM, único, em `packages/types/src/onboarding/csv-import.ts`.

---

## Project Structure

### Documentação (feature dir)

```
docs/specs/import-csv-preview/
├── spec.md              (existente)
├── plan.md              (este arquivo)
├── research.md          (Phase 0)
├── data-model.md        (Phase 1)
├── contracts/
│   ├── check-emails.api.md
│   └── csv-import.types.md
└── quickstart.md        (Phase 1)
```

### Source code (árvore real do projeto)

```
packages/types/src/
└── onboarding/
    └── csv-import.ts                    (NOVO — schemas Zod)
    └── __tests__/csv-import.snapshot.spec.ts   (NOVO — snapshot Zod)
packages/types/src/index.ts             (EDIT — export do novo módulo)

apps/api/src/users/
├── users.controller.ts                 (EDIT — GET check-emails)
├── users.controller.spec.ts            (EDIT — unit do endpoint)
├── users.service.ts                    (EDIT — checkEmailsInTenant)
├── users.service.spec.ts               (EDIT)
├── check-emails-rate-limit.guard.ts    (NOVO — guard in-memory)
├── check-emails-rate-limit.guard.spec.ts (NOVO)
└── check-emails.integration-spec.ts    (NOVO — integration tenant-scope)

apps/web/
├── app/(authenticated)/app/admin/igreja/grupos/[groupId]/
│   └── importar/
│       ├── page.tsx                     (NOVO — Server Component shell)
│       └── import-client.tsx            (NOVO — Client orquestrador)
├── src/components/onboarding/
│   ├── file-upload-zone.tsx             (NOVO)
│   ├── file-upload-zone.spec.tsx        (NOVO — inclui jest-axe)
│   ├── csv-preview-table.tsx            (NOVO)
│   └── csv-preview-table.spec.tsx       (NOVO — inclui jest-axe)
├── src/lib/onboarding/
│   ├── csv-parser.ts                    (NOVO — papaparse + encoding + xlsx dynamic)
│   ├── csv-parser.spec.ts               (NOVO)
│   ├── csv-validator.ts                 (NOVO — classifica crítico/aviso/ok)
│   ├── csv-validator.spec.ts            (NOVO)
│   └── csv-template.ts                  (NOVO — gera template client-side)
├── src/lib/api/hooks/
│   └── use-check-emails.ts              (NOVO — TanStack Query + batching ≤500)
└── messages/pt-BR.json                  (EDIT — labels import.* pastoral)

apps/web/package.json                    (EDIT — papaparse, xlsx, @types/papaparse)
pnpm-lock.yaml                           (EDIT — lockfile da nova dep)
```

> Paths verificados contra o codebase real: `apps/api/src/users/` (módulo flat),
> `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/` (existe),
> `apps/web/src/components/onboarding/`, `packages/types/src/` (sem dir
> `onboarding/` ainda — criar). Rotas web SEM `src/` (App Router em
> `apps/web/app/`).

---

## Plano de Testes

| Camada | Tipo | Arquivo(s) | Cobertura |
|--------|------|-----------|-----------|
| Contratos | snapshot (Vitest) | `packages/types/.../csv-import.snapshot.spec.ts` | Gate contra breaking change nos schemas Zod (Princípio IV) |
| Backend | unit | `users.controller.spec.ts`, `users.service.spec.ts`, `check-emails-rate-limit.guard.spec.ts` | validação query, batch ≤500, rate-limit, role guard |
| Backend | integration | `check-emails.integration-spec.ts` | tenant-scope real: e-mail do tenant A NÃO aparece para tenant B (FR-19); degradação |
| Frontend | unit | `csv-parser.spec.ts`, `csv-validator.spec.ts` | encoding ISO-8859-1/Win-1252/UTF-8; classificação crítico/aviso/ok; identificação por nome de coluna; XLSX 1ª aba |
| Frontend | component + **a11y** | `file-upload-zone.spec.tsx`, `csv-preview-table.spec.tsx` | drag&drop, ≤5MB, extensão, template; tabela 10 linhas + status; **jest-axe sem violações** (FR-22/23, SC-005) |
| Frontend | hook | `use-check-emails.spec.ts` (em `__tests__`) | batching ≤500; degradação graciosa quando API indisponível (FR-21) |
| E2E | Playwright | `apps/web/e2e/import-csv-preview.e2e-spec.ts` | roundtrip REAL ao check-emails comparando shape vs `checkEmailsResponseSchema` (quickstart) |

**Validação local obrigatória antes de `done`**:
```bash
pnpm prisma generate
pnpm turbo build
pnpm turbo lint -- --max-warnings 0
pnpm turbo test
```

---

## Gotchas CI (embutidos)

- **Nova dependência** (`papaparse`, `xlsx`, `@types/papaparse`) → `pnpm-lock.yaml`
  DEVE entrar no PR (gotcha §8.4: CI falha se lockfile dessincronizado).
- **Sem migration** → sem RLS spec nova obrigatória. PORÉM: se a query usar
  `$queryRaw` em `users`, confirmar nomes de coluna snake_case reais do
  `schema.prisma`. **Plano evita raw**: usa Prisma client `user.findMany`
  com `withTenantTx` (RLS já confina ao tenant) — sem nomes de coluna manuais.
- **Snapshot test Zod** obrigatório — sem ele, o gate de contrato não existe.
- **jest-axe** é gate real — `FileUploadZone` e `CSVPreviewTable` têm bastante
  a11y; incluir testes desde o início (não deixar para o final).
- **XLSX dynamic import** — verificar que o chunk SheetJS NÃO aparece no bundle
  inicial (SC-004); o `import('xlsx')` deve estar dentro da função de parse,
  acionado só no branch `.xlsx`.

---

## Notas de Segurança (gate owasp-security — informativas, não-bloqueantes)

> Gate `owasp-security` PASSOU sem finding critical/high. A enumeração de
> usuários (A01/API3) está mitigada por design (auth + role + tenant-scope +
> rate-limit). Sub-findings informativos a observar na implementação:

1. **SheetJS (A03 Supply Chain)**: pinar uma versão **recente** de `xlsx` e rodar
   `pnpm audit` no CI. SheetJS teve CVEs históricos de prototype-pollution; o
   blast radius aqui é client-side sobre o arquivo do próprio Admin, mas a versão
   recente é defesa barata.
2. **PII em logs (A09)**: o path `check-emails` (incl. rate-limit guard e
   eventual audit) NÃO deve logar a lista de e-mails em claro. Logar apenas
   contagem (`checkedCount`) e o tenant/usuário, nunca os endereços.
3. **Injeção (A05)**: confirmado no plano — usar Prisma client
   `user.findMany({ where: { email: { in: emails } } })`, **sem `$queryRaw`**.

## Complexity Tracking

*Vazio — nenhuma violação de constitution exigindo justificativa.*

---

## Próximos Passos

1. `/checklist` — gerar quality gate antes de implementar
2. `/create-tasks` — decompor em backlog executável
3. `/analyze` — validar consistência cross-artifact (após tasks)
