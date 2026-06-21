# Implementation Plan: Notificações por Email via Resend

**Feature**: `notificacoes-email` | **Date**: 2026-06-21 | **Spec**: ./spec.md
**Story**: 14-3 (FR77, NFR-I1/I2/I3/I4)

## Summary

Completa o canal de entrega por email do sistema de notificações, substituindo
o stub `EmailChannel` (Story 14-1) por uma implementação real integrada ao
**Resend**, com comportamento resiliente: retry com backoff + fallback in-app
(NFR-I1/I2), timeouts explícitos (NFR-I3), jobs falhos retidos (NFR-I4),
rate-limiting diário atômico via **Lua script Redis**, templates por tipo com
**branding do tenant** (Epic 6), e **circuit breaker** integrável à Story 14-4
via porta abstraída com stub default. A feature **reusa** a infra de fila/retry/
roteamento por canal já entregue (DigestService, NotificationsWorker,
ChannelRouter, NotificationsService) sem modificá-la (OCP) — apenas pluga o
`EmailChannel` real e adiciona o caminho de fallback pós-falha.

Abordagem técnica (de research.md): `EmailChannel` depende de `EmailService`
(encapsula Resend SDK + timeouts NFR-I3); rate-limit via `RedisService.
defineCommand('emailRateLimit')` com chave `rate:email:{tenantId}:{YYYYMMDD}` e
`EXPIREAT` à meia-noite UTC; circuit breaker em Redis atrás de `EmailHealthPort`.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`), Node (NestJS 11)
**Primary Dependencies**: NestJS 11, BullMQ, ioredis (RedisService), Prisma v7,
Zod 4 (`packages/types`), **`resend` SDK (novo)**, `uuidv7`
**Storage**: PostgreSQL (RLS, tabela `notifications` existente) + Redis
(namespaces `rate:*`, `queue:*`, `rt:*`, `cache:*`)
**Testing**: Vitest (unit `*.spec.ts`, integration `*.integration-spec.ts`),
RLS isolation specs em `apps/api/test/rls/`, snapshot tests (templates + Zod)
**Target Platform**: backend container (apps/api), Docker compose / produção
**Project Type**: web-service (backend bounded context `notifications`)
**Performance Goals**: alerta crítico entregue ≤ 1 min (SC-01); timeouts Resend
connect ≤ 3s / read ≤ 10s (NFR-I3)
**Constraints**: continuidade 30 min sem provedor (NFR-I1/SC-03); atomicidade do
contador sob concorrência (FR-11/SC-04); nenhum cross-tenant leak (Constitution I)
**Scale/Scope**: multi-tenant SaaS; limite diário 100 emails/tenant (configurável)

## Constitution Check

*GATE: Deve passar antes do Phase 0. Re-checado após Phase 1 (§Re-check).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS | `notifications` já tem RLS; toda escrita via `withTenantTx`; `tenant_id` de RequestContext (worker reconstrói). Chaves Redis namespaced por `{tenantId}`. Teste RLS isolation roda 2× no CI. |
| II. Type-Safety & IDs Determinísticos (NON-NEGOTIABLE) | PASS | `strict:true`; `uuidv7()` para `eventId`/`notificationId`; datas ISO 8601; `null` explícito; sem `undefined` em JSON. |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs em inglês; corpo dos emails user-facing em PT-BR (vocabulário pastoral: cuidado, jornada, lembrete). Templates centralizam texto PT-BR. |
| IV. Contratos de API Padronizados | PASS | Schemas Zod em `packages/types` (NotificationType estendido) com snapshot gate; evento `notifications.email.circuit-open` no formato canônico. Sem novo endpoint REST. |
| V. Separação de Estado no Frontend | N/A | Feature é backend-only; não toca Server/Client Components. |
| VI. Qualidade Verificável | PASS | unit + integration + snapshot + RLS isolation (2×); CI verde antes de done. |
| VII. Processo de Entrega Auditável | PASS | 1 story = 1 branch = 1 PR (`feat/`); conventional commits PT-BR; reconciliação WDS↔BMad: infra real lida e reusada (14-1/14-2a/14-2b confirmadas no código). |

**Resultado**: PASS — nenhum princípio MUST violado. Prosseguir.

## Project Structure

### Documentation (this feature)

```
docs/specs/notificacoes-email/
├── spec.md          # Existente
├── plan.md          # Este arquivo
├── research.md      # Phase 0
├── data-model.md    # Phase 1
├── quickstart.md    # Phase 1 (cenários de teste C1..C10)
└── contracts/
    └── email-channel.contract.md
```

### Source Code (repository root — paths REAIS)

```
apps/api/src/notifications/
├── channels/
│   ├── notification-channel.interface.ts   # existente — NÃO modificar
│   ├── in-app.channel.ts                    # existente — reuso (fallback)
│   ├── email.channel.ts                     # SUBSTITUIR stub → impl real
│   └── email.service.ts                     # NOVO — abstração Resend SDK + timeouts NFR-I3
├── ports/
│   └── email-health.port.ts                 # NOVO — EmailHealthPort + StubEmailHealthPort (INTEGRATION POINT 14-4)
├── templates/
│   ├── base.layout.ts                       # NOVO — layout + branding (BrandingService)
│   ├── pastoral-alert.template.ts           # NOVO
│   ├── meeting-reminder.template.ts         # NOVO
│   ├── export-ready.template.ts             # NOVO (signed URL 1h)
│   └── content-new.template.ts              # NOVO
├── scripts/
│   └── rate-limit.lua                        # NOVO — INCR+compare atômico
├── email-rate-limiter.service.ts            # NOVO — carrega Lua via defineCommand, decide send/defer
├── email-circuit-breaker.service.ts         # NOVO — estado Redis + EmailHealthPort + evento de domínio
├── channel-router.ts                        # existente — NÃO modificar (OCP)
├── digest.service.ts                        # existente — reuso (retry config)
├── notifications.worker.ts                   # ESTENDER — disparar fallback in-app + failureReason pós-falha
├── notifications.service.ts                  # existente — reuso dispatch()
└── notifications.module.ts                   # ESTENDER — registrar novos providers + EMAIL_HEALTH_PORT

apps/api/prisma/migrations/
└── <ts>_14-3-email-notification-types/
    └── migration.sql                         # NOVO — ALTER TYPE notification_type ADD VALUE export_ready, content_new

apps/api/src/config/
└── env.validation.ts                         # ESTENDER — RESEND_API_KEY, EMAIL_DEFAULT_FROM, EMAIL_DAILY_LIMIT, EMAIL_RATE_THRESHOLD

packages/types/src/
└── notification.ts                           # ESTENDER — NotificationTypeSchema (+export_ready,+content_new)

apps/api/test/rls/
└── notifications-email.rls-spec.ts           # NOVO — isolamento 2 tenants (roda 2× no CI)
```

**Structure Decision**: manter tudo dentro do bounded context `notifications`
(Constitution Arch — módulos por contexto). Rate-limiter e circuit-breaker como
**serviços do módulo** (não subdomínio novo) — supporting logic do canal email.
`EmailHealthPort` em `ports/` para sinalizar a fronteira de integração com a
Story 14-4. `ChannelRouter` permanece intocado (OCP, FR já validado na 14-1).
Estado de rate/circuit em Redis (não DB) — efêmero, cross-worker, namespace `rate:*`.

## Convenções de Borda

A feature é majoritariamente **backend single-layer** (entrega assíncrona via
fila; sem novo endpoint FE↔BE). As fronteiras relevantes são DB↔backend,
Redis↔backend e backend↔provedor externo (Resend).

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | enum constraint + migration | `apps/api/prisma/migrations/*/migration.sql` |
| DB enum `notification_type` | snake_case values | `ALTER TYPE ADD VALUE` | `migrations/<ts>_14-3-.../migration.sql` |
| Backend DTO (TS) | camelCase | Zod | `packages/types/src/notification.ts` |
| Domain event payload | camelCase | formato canônico Constitution IV | `data-model.md §Domain Event` |
| Redis keys | kebab/colon namespaced | convenção `rate:*` | `data-model.md` (EmailRateCounter/CircuitBreakerState) |
| Resend API (request) | conforme SDK | tipagem do SDK `resend` | `contracts/email-channel.contract.md §EmailService` |

**Mapper layer (DB ↔ DTO)**: queries raw via `$executeRawUnsafe`/`$queryRawUnsafe`
em `notifications.service.ts` mapeiam colunas snake_case → campos do `NotificationRow`.
ORM auto-mapping: PARCIAL — `BrandingService` usa `tx.tenant.findUniqueOrThrow`
(Prisma auto-mapeia `@map`); `notifications` usa raw SQL (sem auto-map).

**Validação Zod**: na borda do payload de job (`NotificationJobPayloadSchema`) e
no schema compartilhado `NotificationTypeSchema` (snapshot gate). Schema
compartilhado em `packages/types`. Sem borda HTTP nova → sem roundtrip FE↔BE
nesta feature (N/A o cenário roundtrip end-to-end da §5.3 do template — feature
não atravessa backend↔frontend; entrega é assíncrona por email).

## Complexity Tracking

> Constitution Check = PASS sem violações. Nada a justificar.

| Violação | Por Que Necessário | Alternativa Simples Rejeitada Porque |
|----------|--------------------|--------------------------------------|
| — | — | — |

## Re-check (pós-Phase 1)

Re-validação dos princípios após o design:
- Nenhum serviço/camada extra injustificado: rate-limiter e circuit-breaker são
  lógica de suporte do mesmo módulo, não novo bounded context.
- `ChannelRouter` permanece intocado (OCP preservado).
- Multi-tenancy: chaves Redis e queries continuam tenant-scoped; teste RLS
  isolation previsto. PASS mantido.
- Type-safety: enum estendido com snapshot gate; sem `undefined` em payloads. PASS.

**Constitution pós-design**: PASS.

## Ponto de Integração Pendente (Story 14-4)

O circuit breaker depende de `EmailHealthPort.isHealthy()`. A Story 14-4
(health-check, NÃO done) fornecerá a implementação real. Até lá:
`StubEmailHealthPort` retorna sempre `healthy` (desabilita efetivamente o breaker
em dev). Documentado via comentário `// INTEGRATION POINT (Story 14-4)` na porta
e registrado no módulo via token `EMAIL_HEALTH_PORT`. SC-07: a troca do provider
NÃO altera `EmailChannel`.

## Artefatos

| Arquivo | Status |
|---------|--------|
| docs/specs/notificacoes-email/plan.md | Criado |
| docs/specs/notificacoes-email/research.md | Criado |
| docs/specs/notificacoes-email/data-model.md | Criado |
| docs/specs/notificacoes-email/contracts/email-channel.contract.md | Criado |
| docs/specs/notificacoes-email/quickstart.md | Criado |

## Próximos Passos

1. `/checklist` — quality gate antes de implementar
2. `/create-tasks` — decompor em backlog executável
3. `/analyze` — validar consistência cross-artifact (após tasks)
