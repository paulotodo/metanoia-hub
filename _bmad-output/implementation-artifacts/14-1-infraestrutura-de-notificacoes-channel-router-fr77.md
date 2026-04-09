# Story 14.1: Infraestrutura de Notificações & Channel Router (FR77)

Status: ready-for-dev

## Story

As a developer,
I want a notification infrastructure with a channel router,
So that any module can send notifications through multiple channels without coupling to delivery details.

## Acceptance Criteria

**Given** the notifications module is set up in `modules/notifications/`
**When** the Prisma migration runs
**Then** a `Notification` table is created with:
  - `id` (UUID v7), `tenant_id`, `user_id`, `type` (enum: `meeting_reminder`, `content_new`, `pastoral_alert`, `export_ready`, `system`), `title`, `body`, `channel` (enum: `in_app`, `email`), `status` (enum: `pending`, `sent`, `failed`, `read`), `read_at` (nullable), `metadata` (JSONB — flexible payload per type, includes `actionUrl`), `created_at`
**And** RLS policy enforces `tenant_id` isolation
**And** index on `(user_id, status, created_at DESC)` for notification center queries

**Given** a domain event is emitted (e.g., `pastoral.participant.risk-detected`, `meetings.meeting.scheduled`, `content.trail.published`)
**When** the `NotificationService.dispatch()` is called with `{ userId, type, title, body, channels: ['in_app', 'email'] }`
**Then** `tenant_id` is read from `RequestContext` (AsyncLocalStorage) — NUNCA passado como parâmetro (conforme regra do projeto)
**And** for BullMQ jobs that execute outside the request context, the processor recreates the context via `RequestContext.run({ tenantId, userId }, callback)` using the tenant_id stored in the job payload
**And** a BullMQ job is created in `queue:notifications` for each channel
**And** the Channel Router routes to the correct processor: `InAppChannel` or `EmailChannel`
**And** both channels implement a common `NotificationChannel` interface: `send(notification: NotificationPayload): Promise<NotificationResult>`
**And** the interface is extensible for future channels (WhatsApp) without modifying the router

**Given** multiple notifications of the same type are dispatched within a 5-minute window for the same user
**When** the batching logic processes them
**Then** a "delayed job" is created with 5min delay; when it fires, it collects all pending notifications of the same type/user and aggregates into a single digest: "{count} participantes precisam de cuidado no grupo {groupName}"
**And** the digest threshold is configurable via environment variable `NOTIFICATION_DIGEST_WINDOW_MS` (default: 300000)
**And** notifications of type `pastoral_alert` are NEVER batched — always dispatched immediately (critical for pastoral care)

**Given** a BullMQ job fails
**When** the failure occurs
**Then** the job is retried with exponential backoff (3 attempts, 30s/60s/120s)
**And** after all retries exhausted, the job is moved to the `failed` set (retained for investigation, NFR-I4)
**And** the notification status is updated to `failed`
**And** failure is logged with `correlation_id`, `channel`, `error_message`

## Tasks / Subtasks

- [ ] Task 1: Create Prisma migration for `Notification` table (AC: #1)
  - [ ] Define model with all fields: id (UUID v7), tenant_id, user_id, type, title, body, channel, status, read_at, metadata (JSONB), created_at
  - [ ] Create enums: `NotificationType`, `NotificationChannel`, `NotificationStatus`
  - [ ] Add RLS policy for tenant_id isolation
  - [ ] Add index on `(user_id, status, created_at DESC)`
  - [ ] Map with `@@map("notifications")`
- [ ] Task 2: Create Zod schemas in `packages/types` (AC: #2)
  - [ ] Define `NotificationPayloadSchema` for dispatch input
  - [ ] Define `NotificationResponseSchema` for API responses
  - [ ] Define `NotificationResultSchema` for channel send result
  - [ ] Add snapshot tests
- [ ] Task 3: Implement `NotificationChannel` interface and Channel Router (AC: #2)
  - [ ] Define `NotificationChannel` interface with `send(notification): Promise<NotificationResult>`
  - [ ] Implement `ChannelRouter` that routes to `InAppChannel` or `EmailChannel`
  - [ ] Design for extensibility (future WhatsApp channel)
- [ ] Task 4: Implement `NotificationService.dispatch()` (AC: #2, #3)
  - [ ] Read `tenant_id` from `RequestContext` (AsyncLocalStorage)
  - [ ] Create BullMQ job per channel in `queue:notifications`
  - [ ] For BullMQ processors, recreate context via `RequestContext.run()`
  - [ ] Implement digest/batching logic with 5min delayed job
  - [ ] Make digest window configurable via `NOTIFICATION_DIGEST_WINDOW_MS`
  - [ ] Exempt `pastoral_alert` from batching (always immediate)
- [ ] Task 5: Implement `InAppChannel` processor (AC: #2)
  - [ ] Save notification to DB with `status: 'sent'`
  - [ ] Publish to Redis Pub/Sub for SSE (prepared for Story 14.2a)
- [ ] Task 6: Implement retry and failure handling (AC: #4)
  - [ ] Configure BullMQ retry: 3 attempts, exponential backoff 30s/60s/120s
  - [ ] On final failure, update notification status to `failed`
  - [ ] Retain failed jobs in BullMQ failed set (NFR-I4)
  - [ ] Log failure with `correlation_id`, `channel`, `error_message`
- [ ] Task 7: Write tests (AC: all)
  - [ ] Unit test of Channel Router (mock channels, verify routing)
  - [ ] Integration test: dispatch → BullMQ job created → processor executes → verify `RequestContext.run()` sets correct tenant
  - [ ] Digest test: 10 notifications of same type in 5min → 1 digest
  - [ ] Immediate test: `pastoral_alert` → verify NOT batched, sent immediately
  - [ ] Snapshot test for Zod schema of `NotificationPayload`
  - [ ] RLS isolation test

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Architecture Pattern
- Notifications is supporting subdomain — service direct with Prisma, no repository pattern
- Pipeline: domain event → BullMQ `queue:notifications` → Channel Router → InAppChannel | EmailChannel
- Extensible for WhatsApp (Phase 3, out of scope)

### Dependencies
- Epic 1 (auth + infra base)
- Epic 2 (multi-tenant + Keycloak)

### Project Structure Notes
- Backend: `apps/api/src/modules/notifications/`
  - `notification.service.ts` — dispatch logic
  - `channel-router.ts` — routes to correct channel
  - `channels/in-app.channel.ts` — InAppChannel implementation
  - `channels/email.channel.ts` — EmailChannel implementation (stub for Story 14.3)
  - `channels/notification-channel.interface.ts` — common interface
  - `jobs/notification.processor.ts` — BullMQ processor
- Migration: `apps/api/prisma/migrations/YYYYMMDD_add_notifications/`
- Shared types: `packages/types/src/notifications/`
- BullMQ queue: `queue:notifications`
- Redis namespace: `queue:*` for BullMQ

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-14.md` (Story 14.1)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
