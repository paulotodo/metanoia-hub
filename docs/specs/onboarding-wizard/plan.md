# Implementation Plan — onboarding-wizard (Story 10-1, Epic 10)

**Spec**: `docs/specs/onboarding-wizard/spec.md` | **FR de origem**: FR70
**Branch alvo**: `feat/onboarding-wizard` (1 story = 1 branch = 1 PR)
**Status**: Plan | **Gerado**: 2026-06-13 @ dev `c83e473`

## Summary

Wizard de onboarding full-screen (5 etapas) para `admin_tenant` no primeiro
login. Feature majoritariamente FE (Next.js Client Component) com backend leve:
2 endpoints PATCH novos (`/tenants/me`, `/users/me`), 1 GET novo
(`/onboarding/status` tenant-scoped), 4 colunas Prisma aditivas nullable
(`Tenant.onboardingProgress` JSONB + `Tenant.logoUrl`; `User.profilePhotoUrl` +
`User.roleTitle`), 1 evento de domínio via EventEmitter2. Reusa grupos (4-1),
convites (4-3), demo data (10-2), storage MinIO, vocabulary pastoral e o
redirect guard existente (engata, não recria). Abordagem técnica e ambiguidades
fundamentadas em `research.md` (Decisions 1-9, todas alinhadas a dec-007..011).

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript (strict) — Node/NestJS 11 (BE) + Next.js 16 App Router (FE) |
| ORM/DB | Prisma v7, PostgreSQL + pgvector, RLS multi-tenant |
| Eventos | EventEmitter2 (`@nestjs/event-emitter`) in-process (dec-009) |
| Contratos | Zod em `packages/types` + snapshot test |
| Upload | `apps/api/src/storage/storage.service.ts` (MinIO, política permanente) |
| FE state | TanStack Query (server state, client comp) + Zustand (client state) |
| UI | shadcn/ui, Tailwind v4, vocabulário pastoral (`packages/types/src/vocabulary`) |
| Testes | Vitest unit/integration, Playwright e2e, jest-axe (WCAG AA) |
| NEEDS CLARIFICATION | 0 (resolvidos na clarify + research.md) |

## Constitution Check

*GATE: passou antes do Phase 0; re-checado pós Phase 1 (idêntico — design não
introduziu violação).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS | Colunas novas em `tenants`/`users` que **já têm RLS habilitada** (migrations `20260413131927`/`20260414120000`/`20260409231601`). Migração é aditiva nullable — **não toca policy** (sem `CREATE/ALTER POLICY`). Writes (`PATCH /tenants/me`, `/users/me`) são RLS-scoped via `withTenantTx`/`AsyncLocalStorage` (nunca `tenant_id` por parâmetro). RLS isolation spec dos novos write paths incluído como defesa (research.md Decision 9). `hasRealGroups` derivado server-side RLS-scoped. |
| II. Type-Safety & IDs Determinísticos (NON-NEGOTIABLE) | PASS | `strict:true`. URLs de mídia em colunas tipadas (dec-008), não JSONB. Zod `OnboardingProgressSchema`/`UpdateTenant/UserProfileSchema` + snapshot. Sem novas PKs (sem `@default(uuid())`); `eventId` do evento via `uuidv7()`. Datas ISO 8601, nulls explícitos. |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs/Swagger em inglês; user-facing PT-BR em `apps/web/messages/pt-BR.json`; labels do wizard via `vocabulary.ts` (ex.: "Como seus discípulos te conhecem?"). WCAG AA via jest-axe (gate real). |
| IV. Contratos de API Padronizados | PASS | `/api/v1/*`; `{data,meta?}` / `{statusCode,error,message,details?}`; Create 201 (grupo via reuso); evento no formato `{eventId,eventType,version,tenantId,timestamp,data,metadata}`; `ZodValidationPipe` custom. |
| V. Separação de Estado no Frontend | PASS | Páginas Server Components default; `OnboardingWizard` é Client Component (usa TanStack Query para mutations/status — só em client). Zustand só para estado de UI local do wizard se necessário; sem TanStack em Server Components. `useMutation<undefined,Error,T>`. |
| VI. Qualidade Verificável | PASS | Unit (`*.spec.ts`), integration (`*.integration-spec.ts`), e2e Playwright, RLS isolation spec (defesa), snapshot Zod, jest-axe WCAG AA. CI verde antes de done. |
| VII. Processo de Entrega Auditável | PASS | 1 story=1 branch=1 PR; conventional commits PT-BR; reconciliação WDS↔BMad feita (RECONCILIACAO-EPIC10). **NUNCA push direto em dev** (ci.yml só em pull_request). |

**Resultado**: PASS em todos os princípios MUST. Sem violações → Complexity
Tracking N/A.

### Cobertura de FRs (rastreabilidade)

| FR | Onde é endereçado |
|----|-------------------|
| FR-01 | research.md Decision 6, contracts (GET /onboarding/status), quickstart Cenário 1 |
| FR-02 | data-model (OnboardingProgress state machine), contracts (PATCH /tenants/me), quickstart Cenário 8 |
| FR-03 | contracts (PATCH /users/me), quickstart Cenário 2 |
| FR-04 | contracts (PATCH /tenants/me), quickstart Cenário 3 |
| FR-05/06/07 | quickstart Cenários 4/5/6 (reuso POST /groups, convite, demo-radar) |
| FR-08 | contracts (invariante completedAt×skippedAt), quickstart Cenários 6/7 |
| FR-09 | research.md Decision 7, quickstart Cenário 9 (replay read-only) |
| FR-10 | contracts (evento onboarding.wizard.step_completed, EventEmitter2) |
| FR-11 | Constitution Check III/VI (WCAG AA via jest-axe, navegação por teclado — gate real de qualidade); quickstart a11y |
| FR-12 | contracts/onboarding-api.md inteiro (PATCH /tenants/me, PATCH /users/me, GET /onboarding/status — todos NOVOS) |
| FR-13 | research.md Decision 8, quickstart Cenários 2/4 (degradação graciosa de upload/demo) |

## Project Structure

### Documentação (feature dir — criada nesta onda)
```text
docs/specs/onboarding-wizard/
├── spec.md            (existente)
├── research.md        (Phase 0)
├── data-model.md      (Phase 1)
├── contracts/
│   └── onboarding-api.md
├── quickstart.md
└── plan.md            (este arquivo)
```

### Source code (árvore REAL do projeto — paths verificados)
```text
apps/api/
├── prisma/
│   ├── schema.prisma                         # + 4 colunas (Tenant, User)
│   └── migrations/<ts>_add_onboarding_wizard_tenant_user_fields/
├── src/
│   ├── tenants/tenants.controller.ts         # + PATCH /me (existe só GET /me)
│   ├── tenants/tenants.service.ts            # update + persist onboardingProgress
│   ├── users/users.controller.ts            # + PATCH /me (perfil)
│   ├── users/users.service.ts
│   ├── onboarding/
│   │   ├── onboarding.controller.ts          # + GET /status (tenant-scoped)
│   │   └── onboarding.service.ts             # status + emit step_completed (EventEmitter2)
│   ├── groups/groups.controller.ts           # REUSO POST /groups (4-1)
│   ├── invites/                              # REUSO convite admin (4-3)
│   └── storage/storage.service.ts            # REUSO upload MinIO
└── test/rls/                                 # RLS isolation spec (novos write paths)

apps/web/
├── app/(authenticated)/
│   ├── _components/onboarding-redirect-guard.tsx   # ENGATAR (não recriar)
│   ├── app/admin/boas-vindas/                      # renderiza o wizard
│   └── app/admin/configuracoes/rever-tutorial/     # replay read-only (dec-010)
├── src/components/onboarding/                       # já existe
│   └── steps/                                       # OnboardingWizard + 5 steps
└── messages/pt-BR.json                              # labels PT-BR

packages/types/src/
├── onboarding.ts                              # + OnboardingProgressSchema, status, update schemas
├── vocabulary/vocabulary.ts                   # REUSO labels pastorais
└── __tests__/                                 # snapshot Zod
```

## Convenções de Borda

A feature atravessa DB ↔ backend ↔ frontend. Fonte da verdade de cada
convenção:

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | migration + `@map` no Prisma | `apps/api/prisma/schema.prisma` + `migrations/*` |
| Prisma model fields | camelCase (com `@map`) | Prisma client tipado | `apps/api/prisma/schema.prisma` |
| Backend DTO (NestJS) | camelCase | `ZodValidationPipe` (custom) | `apps/api/src/{tenants,users,onboarding}/dto` + `packages/types` |
| Frontend DTO (TS) | camelCase | Zod `parse` no fetch | `packages/types/src/onboarding.ts` (re-export) |
| API payload (req/resp) | camelCase | Zod nos dois lados | `contracts/onboarding-api.md` |
| URL path params | kebab-case / `/me` | router NestJS | `*.controller.ts` |
| JSONB `onboarding_progress` | camelCase nas chaves internas | `OnboardingProgressSchema` | `packages/types/src/onboarding.ts` |

**Mapper layer (DB ↔ DTO)**:
- ORM auto-mapping: SIM — Prisma faz snake_case (`@map`) ↔ camelCase (field).
  As URLs (`profile_photo_url`/`logo_url`) e o JSONB (`onboarding_progress`)
  são mapeados pelo `@map`. Não há mapper manual; a borda crítica é o
  **shape do JSONB** e o roundtrip camelCase, cobertos pelo Cenário 10
  (quickstart) com chamada REAL ao backend.

**Validação Zod**:
- Borda: **ambos** (request via `ZodValidationPipe` no BE; response/status via
  `parse` no FE).
- Schema compartilhado: SIM, em `packages/types/src/onboarding.ts` (FE e BE
  importam o mesmo schema; snapshot test trava breaking changes).

## Security Considerations (owasp-security gate)

| Risco | Sev | Mitigação (MUST no execute-task) |
|-------|-----|----------------------------------|
| A03/API3 Mass assignment em `PATCH /tenants/me`/`/users/me` (merge JSONB / spread do body) | high | Zod `.strict()` allowlist; sem spread-merge; campos imutáveis (`status`, `tenantId`, `email`, `onboardingCompletedAt`) não atualizáveis |
| A04/A08 Stored XSS + API7 SSRF via `logoUrl`/`profilePhotoUrl` | high | Zod `.url()` + `https:` + host/bucket allowlist (origem MinIO); URL cunhada pelo upload server-side; render só `<img src>` |
| API5 BFLA — role `admin_tenant` em `PATCH /tenants/me` | medium | guard de role explícito + assertion de teste; 3-camadas (Keycloak→guard→RLS) |
| A01 cross-tenant write | medium | RLS + `withTenantTx`; RLS isolation spec dos write paths novos (research.md Decision 9) |
| Upload de mídia (tipo/tamanho/magic-bytes) | medium | allowlist content-type + max size + magic-bytes; fail-closed preservando FR-13 |
| A09 PII em logs/evento | low | payload do evento = `{step, stepName}` + tenantId (sem PII) — PASS |
| A05 Injection JSONB | low | Prisma parametriza; shape via `OnboardingProgressSchema` `.strict()` — PASS |

Sem findings `critical`. Os 2 `high` são requisitos de hardening de design já
incorporados aos contratos (MUST); escalados a bloqueio humano por política do
gate (severidade high → BloqueioHumano obrigatório) para ciência/ratificação
antes do `create-tasks`.

## Complexity Tracking

N/A — nenhuma violação de constitution; nenhuma camada/serviço extra além do
bounded context `onboarding` existente. Migração aditiva mínima (4 colunas
nullable), endpoints na convenção `/me` existente, evento in-process sem infra
nova.

## Próximos passos

1. `/checklist` — quality gate antes de implementar.
2. `/create-tasks` — decompor em backlog executável.
3. `/analyze` — validar consistência cross-artifact (após tasks).
