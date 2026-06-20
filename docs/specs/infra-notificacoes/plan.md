# Implementation Plan: Infraestrutura de Notificações & Channel Router

**Feature**: `infra-notificacoes` | **Date**: 2026-06-20 | **Spec**: [./spec.md](./spec.md)
**Epic**: 14 — Notificações | **Story**: 14.1 (FR77)

## Summary

Infraestrutura centralizada de notificações: um `NotificationsService.dispatch()`
que qualquer módulo chama com `{ userId, type, title, body, channels, metadata? }`,
sem conhecer detalhes de entrega. Persiste cada notificação (RLS tenant-scoped),
enfileira 1 job por canal em `queue:notifications`, e um Channel Router roteia
para `InAppChannel` (persiste `sent` + publica Redis para SSE) ou `EmailChannel`
(stub). Digest agrupa notificações do mesmo tipo/usuário por janela configurável
(`pastoral_alert` nunca agrupado). Retry exponencial 3x com failed set retido.

Abordagem técnica reusa integralmente a infraestrutura existente: `BullMqService`,
`RedisService`, `RequestContext`/`requestContext.run`, `withTenantTx`, padrão de
worker do `meeting-event.worker.ts` e `audit-export.processor.ts`. Contratos Zod
compartilhados em `@metanoia/types` com snapshot.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`)
**Primary Dependencies**: NestJS 11.1.17, Prisma v7, BullMQ 5.73, ioredis 5.10, Zod 4.3, uuidv7
**Storage**: PostgreSQL + pgvector (tabela `notifications`, jsonb metadata); Redis (fila BullMQ `queue:notifications` + pub/sub `rt:*`)
**Testing**: Vitest (`*.spec.ts`, `*.integration-spec.ts`), RLS specs em `apps/api/test/rls/*.rls-spec.ts` (CI roda 2x), snapshot em `packages/types`
**Target Platform**: Docker (dev/test/prod compose); CI Turborepo
**Project Type**: web-service (NestJS backend, bounded context `notifications`)
**Performance Goals**: `pastoral_alert` entregue < 2s (SC-004); consulta notification center via índice composto (FR-012)
**Constraints**: tenant isolation 100% (RLS); tenant_id nunca como parâmetro; sem `@default(uuid())`; backoff exponencial 30s/60s/120s
**Scale/Scope**: 1 tabela nova, 1 enum-set (3 enums), 1 módulo NestJS, 1 fila, contratos Zod, RLS spec, snapshot

## Constitution Check

*GATE: Deve passar antes do Phase 0. Re-checado após Phase 1 (ETAPA 7).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS | `tenant_id` em `notifications` com RLS desde a criação; derivado de `RequestContext` (dispatch + processor via `requestContext.run`), nunca parâmetro; migration acompanha `notifications.rls-spec.ts`; guards Keycloak→RLS nos endpoints |
| II. Type-Safety & IDs Determinísticos (NON-NEGOTIABLE) | PASS | `strict: true`; `id: uuidv7()` no service (default DB `gen_random_uuid()` é só fallback, NÃO `@default(uuid())` do Prisma); datas ISO 8601; `read_at` null explícito |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs/Swagger em inglês; `title`/`body` PT-BR; digest usa vocabulário pastoral ("participantes precisam de cuidado") |
| IV. Contratos de API Padronizados | PASS | Schemas Zod em `@metanoia/types` (dispatch, payload, result, job, realtime) com snapshot; sucesso `{data, meta?}`; `/api/v1/`; `ZodValidationPipe` custom; eventos `notifications.notification.*` |
| V. Separação de Estado no Frontend | N/A | Feature é backend-only (infra). Consumo FE (notification center) é Story 14.2x |
| VI. Qualidade Verificável | PASS | unit + integration + RLS spec (idempotente, 2x) + snapshot; sem stack trace ao FE; CI verde antes de done |
| VII. Processo de Entrega Auditável | PASS | 1 story = 1 branch (`feat/`) = 1 PR; conventional commits PT-BR; sem push direto a `dev` |

**Resultado**: PASS — nenhuma violação de princípio MUST. `Complexity Tracking` vazio.

## Architecture Overview

```
[módulo X] ──dispatch()──▶ NotificationsService
                              │ persiste (status: pending, withTenantTx, id=uuidv7)
                              │ 1 job/canal ──▶ queue:notifications (BullMqService)
                              │   (pastoral_alert: imediato; demais: digest delayed)
                              ▼
                       NotificationsWorker (createWorker)
                              │ requestContext.run({tenantId,userId,...})
                              ▼
                       ChannelRouter.route(channel)
                          ├─ InAppChannel ─▶ persiste sent + publish rt:notifications:{tid}:{uid}
                          └─ EmailChannel ─▶ stub log (Story 14.3 = Resend)
                              │ result.success? false → throw → BullMQ retry (3x backoff)
                              ▼ esgotado → status: failed + failed set retido + log
```

## Project Structure

### Documentation (this feature)

```
docs/specs/infra-notificacoes/
├── spec.md
├── plan.md          # This file
├── research.md      # Phase 0 — 8 decisões
├── data-model.md    # Phase 1 — Notification + enums + RLS + interfaces
├── quickstart.md    # Phase 1 — 10 cenários
└── contracts/
    ├── notification-channel.md   # Zod: dispatch, payload, result, job, realtime
    └── notifications-api.md       # REST /api/v1/notifications (mínimo MVP)
```

### Source Code (repository root — paths REAIS)

```
apps/api/
├── prisma/
│   ├── schema.prisma                         # + model Notification + 3 enums
│   └── migrations/
│       └── 20260629000000_14-1-notifications/migration.sql   # tabela + enums + RLS (timestamp > 20260628000000)
├── src/
│   ├── notifications/                         # NOVO bounded context (supporting → service direto c/ Prisma)
│   │   ├── notifications.module.ts
│   │   ├── notifications.service.ts           # dispatch() — persiste + enfileira
│   │   ├── notifications.controller.ts        # GET /api/v1/notifications, PATCH :id/read
│   │   ├── notifications.worker.ts            # createWorker + requestContext.run (padrão meeting-event.worker)
│   │   ├── channel-router.ts                  # roteia por channel
│   │   ├── channels/
│   │   │   ├── notification-channel.interface.ts
│   │   │   ├── in-app.channel.ts              # persiste sent + publish redis rt:*
│   │   │   └── email.channel.ts               # stub
│   │   ├── digest.service.ts                  # job key determinística + agregação
│   │   └── __tests__/...                       # *.spec.ts (unit/integration)
│   ├── bullmq/bullmq.service.ts               # REUSADO (createQueue/createWorker)
│   ├── redis/redis.service.ts                 # REUSADO (publish) + subscriber dedicado
│   ├── prisma/with-tenant-tx.ts               # REUSADO
│   ├── common/context/request-context.ts      # REUSADO (requestContext.run)
│   └── config/env.validation.ts               # + NOTIFICATION_DIGEST_WINDOW_MS (default 300000)
└── test/rls/
    └── notifications.rls-spec.ts              # NOVO — isolamento 2 tenants, idempotente
packages/types/
├── src/notification.ts                        # NOVO — schemas Zod
├── src/index.ts                               # + re-export
└── src/__tests__/notification.snapshot.spec.ts # NOVO — snapshot
```

**Structure Decision**: bounded context `notifications` como pasta flat em
`apps/api/src/notifications/` (convenção real do projeto — NÃO existe
`apps/api/src/modules/`). É supporting subdomain → service direto com Prisma
(sem repository pattern), conforme CLAUDE.md. Reusa `BullMqService`,
`RedisService`, `RequestContext`, `withTenantTx` em vez de duplicar infra.

## Convenções de Borda

Feature multi-camada (DB ↔ backend ↔ fila/pubsub ↔ futuro FE).

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | migration + Prisma `@map`/`@@map` | `apps/api/prisma/migrations/20260629000000_14-1-notifications/migration.sql` |
| Prisma model (TS) | camelCase (model) ↔ snake_case (`@map`) | Prisma client | `apps/api/prisma/schema.prisma` |
| Backend DTO / API payload | camelCase | `ZodValidationPipe` custom + schemas | `packages/types/src/notification.ts` |
| Job payload BullMQ | camelCase (nível 1) | `NotificationJobPayloadSchema` | `packages/types/src/notification.ts` |
| Redis pub/sub (SSE) | camelCase | `NotificationRealtimeEventSchema` | `contracts/notification-channel.md` |
| URL path/query params | kebab-case / camelCase query | router NestJS | `notifications.controller.ts` |

**Mapper layer (DB ↔ DTO)**: Prisma ORM auto-mapping via `@map`/`@@map`
(snake_case no banco ↔ camelCase no model). Sem mapper manual. Datas
convertidas para ISO 8601 string na borda do controller (Princípio II).

**Validação Zod**:
- Request (`dispatch` input, query de listagem): `ZodValidationPipe` no backend.
- Response: shape garantido pelo schema `Notification` (snapshot test).
- Schema compartilhado: SIM — `packages/types` (`@metanoia/types`),
  re-export em `src/index.ts`, snapshot em `__tests__/notification.snapshot.spec.ts`.

## Phase 0 — Research

Ver [research.md](./research.md). 8 decisões (todas com origem em Clarify
score 2-3 ou padrão real do código). Zero NEEDS CLARIFICATION restantes.

## Phase 1 — Design

- [data-model.md](./data-model.md): `Notification` (model + 3 enums + RLS
  tenant-scoped sem ramo IS NULL), interfaces `NotificationChannel`, job payload,
  digest.
- [contracts/](./contracts/): schemas Zod + REST mínimo.
- [quickstart.md](./quickstart.md): 10 cenários (incl. RLS 2-tenant idempotente
  e roundtrip E2E real anti-drift).

## Phase 2 — Implementação (preview — detalhado em /create-tasks)

1. Schemas Zod em `@metanoia/types` + snapshot.
2. Prisma model + enums + migration (timestamp `20260629000000`) com RLS.
3. `notifications.rls-spec.ts` (isolamento 2 tenants, idempotente).
4. `NotificationsService.dispatch` (persiste + enfileira; tenant via contexto).
5. `ChannelRouter` + `InAppChannel` (persist sent + publish) + `EmailChannel` stub.
6. `NotificationsWorker` (createWorker + requestContext.run + retry 3x backoff + failed set).
7. `DigestService` (job key determinística; pastoral_alert bypass).
8. Endpoints REST mínimos + `env.validation` (`NOTIFICATION_DIGEST_WINDOW_MS`).
9. Validação Postgres local (docker-compose.test.yml 5433) + CI verde.

## Re-check de Constitution (pós Phase 1)

Design não introduziu serviço/camada extra além do bounded context previsto.
Reuso de infra (BullMQ/Redis/RequestContext) reduz superfície. RLS sem ramo
`IS NULL` fecha brecha cross-tenant. **Re-check: PASS** — todos os MUST mantidos.

## Complexity Tracking

> Vazio — nenhuma violação de constitution a justificar.

## Próximos Passos

1. `/checklist` — quality gate de requisitos antes de implementar.
2. `/create-tasks` — decompor em backlog executável.
3. `/analyze` — consistência cross-artifact (após tasks).
