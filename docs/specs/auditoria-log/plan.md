# Implementation Plan: Log de Auditoria Imutável

**Feature**: `auditoria-log` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)
**Epic**: 9 (LGPD & Compliance) | **Story**: 9-3 | **Branch**: `feat/story-9-3-auditoria-log`

## Summary

Captura automática e **imutável** de toda ação mutativa (POST/PUT/PATCH/DELETE)
de usuários autenticados, via um `AuditInterceptor` global, persistida em uma
tabela `audit_events` nova com RLS **append-only** (só policies INSERT+SELECT,
sem UPDATE/DELETE → imutabilidade na camada de banco). Um viewer Super Admin
cross-tenant (`/app/admin/super/audit`) lista, filtra e expande eventos; um
export assíncrono CSV/JSON reusa o padrão BullMQ+polling+signed-url do módulo
`reports/` (8-7). Abordagem técnica: supporting subdomain (`audit.service.ts`
Prisma direto, sem repository), contratos Zod compartilhados em `packages/types`,
viewer Client Component com TanStack Query. Toda decisão técnica foi **verificada
empiricamente** contra o codebase (ver `research.md`).

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`), Node (NestJS 11.1.17 / Next.js 16.2)
**Primary Dependencies**: NestJS 11 (interceptor `APP_INTERCEPTOR`), Prisma v7 (`@prisma/adapter-pg`), BullMQ + Redis, Zod 4.x (`packages/types`), TanStack Query 5, shadcn/ui, Tailwind v4
**Storage**: PostgreSQL + RLS (tabela `audit_events`); Redis (estado do export job, namespace `queue:*`); MinIO/storage (arquivo de export via signed URL)
**Testing**: Vitest/Jest (`*.spec.ts`, `*.integration-spec.ts`), RLS specs (`apps/api/test/rls/`), jest-axe (viewer), Zod snapshot (`packages/types/src/__tests__/`)
**Target Platform**: Monorepo Turborepo (apps/api NestJS + apps/web Next.js); Docker compose local; deploy via CI
**Project Type**: web (backend NestJS + frontend Next.js + shared Zod contracts)
**Performance Goals**: viewer 1ª página < 2s com 10k eventos (SC-003); interceptor +≤50ms no P99 dos endpoints (SC-004); export 100k eventos < 5min (SC-006)
**Constraints**: imutabilidade absoluta no role da app (0 update/delete — SC-002); isolamento cross-tenant (0 vazamento — SC-007); retenção permanente (FR-INFRA-01); payload truncado a 64KB/campo
**Scale/Scope**: 1 tabela nova, 1 módulo NestJS novo (`audit/`), 1 interceptor global (primeiro do repo), 4 endpoints, 1 viewer FE, contratos Zod + snapshot, RLS spec com teste de imutabilidade

## Constitution Check

*GATE: Deve passar antes do Phase 0. Re-checado após Phase 1 — ver §Re-check.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS | `audit_events` tem `tenant_id`; RLS ENABLE+FORCE desde a criação. Write via `withTenantTx` (SET LOCAL), tenantId nunca param. RLS isolation spec obrigatório com 2 tenants + teste de imutabilidade. Cross-tenant super-admin segue padrão explícito verificado (`prisma.client` direto + `@Roles(SUPER_ADMIN)`), NÃO bypass inventado. |
| II. Type-Safety & IDs Determinísticos (NON-NEGOTIABLE) | PASS | `strict: true`. UUID v7 via `generateId()` (NÃO `@default(uuid())`). `timestamp` ISO 8601; `resourceId`/`previousState`/`newState` com `null` explícito (nunca `undefined`/omitidos). |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs/Swagger em inglês. User-facing PT-BR em `apps/web/messages/pt-BR.json` namespace `superAdmin.audit.*`, vocabulário pastoral, ícone+texto. Viewer passa por revisão de vocabulário. |
| IV. Contratos de API Padronizados | PASS | Zod em `packages/types/src/audit/` + snapshot test. Envelope `{data,meta?}` (paginação em meta); erro `{statusCode,error,message,details?}`. Async→202 (export); GET→200. `/api/v1/` prefix. `ZodValidationPipe` próprio (sem lib de terceiros). |
| V. Separação de Estado no Frontend | PASS | Viewer é Client Component (`'use client'`) + TanStack Query (`useAuditEvents`); área autenticada CSR. Sem TanStack em Server Component; sem mistura com Zustand. |
| VI. Qualidade Verificável | PASS | Unit + integration + RLS spec (com imutabilidade UPDATE/DELETE bloqueados) + snapshot Zod + jest-axe (WCAG AA gate). CI verde antes de done; sem stack trace exposto. |
| VII. Processo de Entrega Auditável | PASS | 1 story = 1 branch (`feat/story-9-3-auditoria-log`) = 1 PR; conventional commits PT-BR. Reconciliação já feita (RECONCILIAÇÃO-EPIC9). NUNCA push direto em dev. |

**Resultado**: PASS em todos os 7 princípios. Nenhuma violação MUST → Complexity
Tracking vazio.

## Project Structure

### Documentation (this feature)

```
docs/specs/auditoria-log/
├── spec.md
├── plan.md          # This file
├── research.md      # Phase 0 output (8 decisões verificadas)
├── data-model.md    # Phase 1 output (AuditEvent + AuditExportJob)
├── quickstart.md    # Phase 1 output (9 cenários incl. roundtrip)
└── contracts/
    └── audit-events.md   # Phase 1 output (4 endpoints + constantes)
```

### Source Code (repository root — árvore REAL do projeto)

```
apps/api/
├── prisma/
│   └── migrations/
│       └── <ts>_create_audit_events/migration.sql   # NOVO: tabela + RLS append-only + índice
│   └── schema.prisma                                 # +model AuditEvent (@map/@@map snake_case)
├── src/
│   ├── audit/                                        # NOVO módulo (supporting subdomain)
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts                          # Prisma direto; create + list/query; SEM update/delete
│   │   ├── audit.controller.ts                       # GET /api/v1/audit/events (tenant-scoped)
│   │   ├── audit.interceptor.ts                      # GLOBAL (APP_INTERCEPTOR); mutativos only
│   │   ├── audit.severity.ts                         # mapeamento action→severity
│   │   ├── super-audit.controller.ts                 # GET/POST /api/v1/admin/super/audit/* (cross-tenant)
│   │   ├── audit-export.processor.ts                 # BullMQ worker (padrão reports.processor.ts)
│   │   └── __tests__/                                 # *.spec.ts unit/integration
│   ├── prisma/with-tenant-tx.ts                       # EXISTE (reusar; não tocar)
│   └── super-admin/super-admin-tenants.repository.ts  # EXISTE (referência cross-tenant)
└── test/rls/
    └── audit-events.rls-spec.ts                       # NOVO: isolamento + imutabilidade UPDATE/DELETE

apps/web/
├── app/(authenticated)/app/admin/super/
│   └── audit/
│       ├── page.tsx                                   # NOVO Client Component (viewer)
│       └── __tests__/audit-page.a11y.spec.tsx         # NOVO jest-axe gate
├── src/lib/api/hooks/
│   └── use-audit-events.ts                            # NOVO useQuery hook (padrão use-super-admin-tenants.ts)
└── messages/pt-BR.json                                # +namespace superAdmin.audit.*

packages/types/
├── src/audit/index.ts                                 # NOVO Zod schemas + constantes
└── src/__tests__/audit.snapshot.spec.ts               # NOVO snapshot test
```

**Structure Decision**: módulo NestJS por bounded context (`audit/`) como
supporting subdomain (service direto com Prisma, sem repository) — alinhado à
Architecture Decision da constitution. Contratos no pacote semântico
`packages/types` (sem `packages/utils` genérico). Viewer sob a área super-admin
já montada (Cenário 09), reusando o layout `(authenticated)/app/admin/super/`.

## Convenções de Borda

Feature multi-camada (DB ↔ backend ↔ frontend) — fonte da verdade por convenção:

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | migration RAW SQL + CHECK (enums) | `apps/api/prisma/migrations/<ts>_create_audit_events/migration.sql` |
| Prisma model | camelCase (via `@map`/`@@map`) | Prisma schema | `apps/api/prisma/schema.prisma` (model `AuditEvent`) |
| Backend DTO (TS) | camelCase | `ZodValidationPipe` (query) + Zod parse | `packages/types/src/audit/index.ts` (re-exportado) |
| Frontend DTO (TS) | camelCase | Zod parse no `envelopeClient.get(url, Schema)` | `packages/types/src/audit/index.ts` (mesmo schema) |
| API payload (req/resp) | camelCase | Zod em ambos os lados | `contracts/audit-events.md` |
| URL query/path params | **camelCase** | router NestJS + `ZodValidationPipe` | `contracts/audit-events.md` |

**Decisão de query params**: **camelCase** (`perPage`, `dateFrom`, `dateTo`,
`userId`) — alinha 1:1 com o Zod de `packages/types`, evitando uma camada de
mapper kebab→camel. Espelha o padrão de `packages/types/src/reports/index.ts`
(`perPage`, `lastActivityAfter`).

**Mapper layer (DB ↔ DTO)**:
- ORM auto-mapping: **SIM** — Prisma `@map`/`@@map` faz snake_case (DB) ↔
  camelCase (model/DTO) automaticamente. NÃO há mapper manual; o ponto de
  vazamento a vigiar (roundtrip Scenario 9) é garantir que NENHUM `tenant_id`
  cru escape no JSON de resposta.
- JSONB `previous_state`/`new_state`: armazenados como objeto arbitrário; o
  truncamento a 64KB é lógica de aplicação no `audit.interceptor.ts`.

**Validação Zod**:
- Em qual borda? **Ambos** — request (query params via `ZodValidationPipe` no
  backend) e response (parse no FE via `AuditEventSchema`). Snapshot test em
  `packages/types` congela o contrato.
- Schema compartilhado: **SIM**, em `packages/types/src/audit/` (FE + BE
  consomem o mesmo `z.infer`).

## Reuso explícito (não reinventar)

| Necessidade | Reusar de | Verificado |
|-------------|-----------|------------|
| Cross-tenant SELECT super-admin | `super-admin/super-admin-tenants.repository.ts` (`prisma.client` direto + `@Roles(SUPER_ADMIN)`) | research.md D3 — **spike 15min na FASE 0 do create-tasks** |
| BullMQ job + polling + signed URL | `reports/{controller,service,processor}.ts` | research.md D5 |
| SET LOCAL tenant + RequestContext | `apps/api/src/prisma/with-tenant-tx.ts` | research.md D1 |
| RLS policy form `NULLIF(...,true)` | `migrations/20260510210000_consolidate_rls_nullif/migration.sql` | research.md D4 |
| UUID v7 | `packages/types/src/id.ts` (`generateId()`) | research.md D4 |
| RLS isolation spec scaffold | `apps/api/test/rls/group-members.rls-spec.ts` | research.md D4 |
| Zod contract + snapshot | `packages/types/src/reports/index.ts` + `__tests__/reports.snapshot.spec.ts` | research.md D6 |
| Viewer super-admin (Client + TanStack + a11y) | `app/(authenticated)/app/admin/super/tenants/` + `use-super-admin-tenants.ts` | research.md D7 |

## Nota cross-story (fora de escopo)

A Story 9-2 (anonimização LGPD `user_id` → `anonymous-<hash>`) conflita com a
imutabilidade append-only. **Resolvido na 9-2**, não aqui. O design da 9-3
**não usa trigger BEFORE UPDATE** justamente para não impedir um futuro caminho
privilegiado (SECURITY DEFINER restrito a `user_id`, ou flag lógica
`is_anonymized`). Ver research.md Decision 8.

## Re-check de Constitution (pós-Phase 1)

Design não introduziu complexidade não justificada: 1 tabela, 1 módulo supporting,
1 interceptor global (primeiro do repo, sem conflito de ordem), reuso de padrões
existentes (reports/super-admin/withTenantTx). Nenhuma camada adicional supérflua.
Todos os princípios MUST permanecem PASS. **Gate final: PASS.**

## Complexity Tracking

> Vazio — Constitution Check passou sem violações.

| Violação | Por Que Necessário | Alternativa Simples Rejeitada Porque |
|----------|-------------------|--------------------------------------|
| — | — | — |
