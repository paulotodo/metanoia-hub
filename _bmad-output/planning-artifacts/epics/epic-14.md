## Epic 14: Notificações & Comunicação

Sistema de notificações in-app via SSE e email transacional via Resend. Notifications é supporting subdomain — service direto com Prisma. Pipeline: domain event → BullMQ `queue:notifications` → Channel Router → In-app (SSE push) | Email (Resend). Extensível para WhatsApp (Phase 3, fora de escopo).

**FRs cobertos:** FR77
**NFRs cobertos:** NFR-I1 (operação contínua 30min sem provedor), NFR-I2 (retry automático), NFR-I3 (timeouts explícitos), NFR-I4 (jobs falhados retidos), NFR-I5 (health check por integração)
**Pré-requisitos:** Epic 1 (auth + infra base), Epic 2 (multi-tenant + Keycloak)
**Nota:** FR78 (preferências granulares de notificação por tipo) é Post-MVP/Epic 16. Este épico inclui apenas um toggle "silenciar" (localStorage, limitação: local ao dispositivo; sincronização cross-device virá com FR78).
**Ordem de implementação:** 14.1 → 14.4 → 14.3 → 14.2a → 14.2b → 14.2c (14.3 depende de 14.4 para circuit breaker)

### Story 14.1: Infraestrutura de Notificações & Channel Router (FR77)

As a developer,
I want a notification infrastructure with a channel router,
So that any module can send notifications through multiple channels without coupling to delivery details.

**Acceptance Criteria:**

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

**Teste:** Unit test do Channel Router (mock channels, verify routing). Integration test: dispatch → BullMQ job created → processor executes → verify `RequestContext.run()` sets correct tenant. Digest test: 10 notificações do mesmo tipo em 5min → 1 digest. Immediate test: `pastoral_alert` → verify NOT batched, sent immediately. Snapshot test para Zod schema do `NotificationPayload`. RLS isolation test.

### Story 14.2a: SSE Endpoint & Redis Pub/Sub Backend (FR77)

As a developer,
I want an SSE endpoint that pushes real-time notifications to connected clients,
So that users receive instant updates without polling.

**Acceptance Criteria:**

**Given** an authenticated user opens the application
**When** the frontend establishes an SSE connection to `GET /api/v1/sse/notifications`
**Then** the connection is tenant-scoped (guard validates Keycloak token, extracts `tenant_id` and `user_id`)
**And** the server sends a heartbeat comment (`: heartbeat`) every 30 seconds to keep the connection alive and detect dead connections
**And** the server enforces a maximum of 1000 concurrent SSE connections per NestJS instance (configurable via `SSE_MAX_CONNECTIONS`)
**And** if instance limit is reached, new connections receive 503 with `Retry-After: 30` header

**Given** a user already has SSE connections open in multiple tabs
**When** they open a 6th tab
**Then** the server tracks connections per user via Redis (`sse:connections:{tenantId}:{userId}` — SET of connection IDs)
**And** the maximum is 5 connections per user (configurable via `SSE_MAX_PER_USER`)
**And** when exceeded, the oldest connection is gracefully closed with an SSE event `event: close\ndata: { reason: 'max_connections_exceeded' }\n\n` before the new one is accepted

**Given** the `InAppChannel` processor sends a notification
**When** it processes the BullMQ job
**Then** the notification is saved to the `Notification` table with `status: 'sent'`
**And** an event is published to Redis Pub/Sub channel `rt:notifications:{tenantId}:{userId}` (tenant-scoped to prevent cross-tenant leakage)
**And** the SSE controller subscribes to the Redis channel and pushes to the client: `event: notification\ndata: { id, type, title, body, createdAt }\n\n`

**Given** the SSE connection is closed (user navigates away, tab closes)
**When** the server detects disconnection (via heartbeat timeout or explicit close)
**Then** the connection ID is removed from the Redis SET `sse:connections:{tenantId}:{userId}`
**And** the Redis Pub/Sub subscription for that connection is cleaned up

**Teste:** Integration test: dispatch notification → verify SSE event received via Redis Pub/Sub. Cross-tenant isolation test: user1 no tenant A e user1 no tenant B ambos conectados → notificação para tenant A → APENAS conexão do tenant A recebe. Per-user limit test: 6 connections → verify oldest closed. Load test: 500 concurrent SSE connections — critérios: memory heap < 512MB, event loop lag p99 < 100ms, zero dropped connections durante 5min. Heartbeat test: verify `: heartbeat` every 30s.

### Story 14.2b: Notification Center UI (FR77)

As a user,
I want a notification center in the header to view and manage my notifications,
So that I can quickly see what needs my attention and take action.

**Acceptance Criteria:**

**Given** a user is logged in
**When** they see the header
**Then** a bell icon is displayed with a badge showing unread count (capped at "99+")
**And** the badge has `aria-label="{count} notificações não lidas"` (or `"99 ou mais notificações não lidas"` when capped)
**And** when a new notification arrives via SSE, `aria-live="polite"` announces: "Nova notificação: {title}"

**Given** the user clicks the bell icon
**When** the notification dropdown opens
**Then** `GET /api/v1/notifications?status=unread&limit=20` returns the latest unread notifications
**And** each notification shows: icon by type, title, body preview (truncated at 100 chars), relative time ("há 5 min")
**And** clicking a notification marks it as read (`PATCH /api/v1/notifications/:id` with `{ status: 'read' }`) and navigates to `metadata.actionUrl`

**Given** the user has zero notifications
**When** they open the notification center
**Then** an empty state is displayed with illustration and message: "Tudo tranquilo por aqui! Suas notificações aparecerão aqui." (vocabulário pastoral, texto via i18n `pt-BR.json`)

**Given** a user wants to manage notifications
**When** they interact with the notification center
**Then** "Marcar todas como lidas" button marks all unread as read in batch (`PATCH /api/v1/notifications/mark-all-read`)
**And** a "Silenciar notificações" toggle is available — when enabled, SSE events are still received but no visual/audio alert is triggered
**And** the toggle is stored in `localStorage` (nota: local ao dispositivo; sincronização cross-device virá com FR78/Post-MVP)

**Teste:** E2E Playwright: bell icon → badge count → click → dropdown → notification list → click notification → mark as read → navigate to actionUrl. Empty state test: user sem notificações → verify empty state message. Silenciar toggle test: enable → verify no visual alert on new notification. Accessibility test: verify `aria-label` on badge, `aria-live` announcement.

### Story 14.2c: SSE Reconnection & Gap Fill (FR77)

As a user,
I want SSE connections to automatically reconnect and recover missed notifications,
So that I don't miss important updates due to network issues.

**Acceptance Criteria:**

**Given** the SSE connection is lost (network issue, server restart)
**When** the EventSource in the browser detects disconnection
**Then** it reconnects automatically with exponential backoff: 1s, 2s, 4s, 8s, max 30s
**And** a subtle indicator appears in the UI: "Reconectando..." (disappears on successful reconnect)

**Given** the SSE connection is re-established
**When** the client reconnects
**Then** it fetches missed notifications via `GET /api/v1/notifications?since={lastReceivedAt}&status=unread` to fill the gap
**And** the `lastReceivedAt` is tracked in memory (not persisted — page refresh fetches all unread)
**And** missed notifications are merged into the notification center without duplicates (deduplicate by `id`)

**Given** reconnection fails repeatedly (server down for extended period)
**When** backoff reaches max (30s) and 5 consecutive attempts fail
**Then** the reconnection continues in background but the UI shows: "Sem conexão. Notificações podem estar atrasadas." with a "Tentar agora" manual retry button

**Teste:** E2E Playwright: simulate disconnect (kill SSE endpoint) → verify auto-reconnect → verify gap fill fetches missed notifications. Extended outage test: 5 failed reconnects → verify UI warning. Reconnect success test: verify indicator disappears and missed notifications appear.

### Story 14.3: Notificações por Email via Resend (FR77, NFR-I1/I2/I3)

As a user,
I want to receive important notifications by email,
So that I'm informed even when I'm not using the platform.

**Acceptance Criteria:**

**Given** the `EmailChannel` processor receives a BullMQ job
**When** it processes the notification
**Then** it sends an email via Resend SDK using the `EmailService` abstraction (interface in `modules/notifications/channels/email.service.ts`)
**And** timeouts are enforced: connect ≤ 3s, read ≤ 10s (NFR-I3) via Resend SDK timeout config
**And** the email uses a template based on notification type:
  - `pastoral_alert`: subject "⚠️ {groupName}: participante precisa de cuidado", body with participant name, risk reason, CTA "Ver no Radar"
  - `meeting_reminder`: subject "Reunião amanhã: {groupName}", body with date, time, join link
  - `export_ready`: subject "Seu relatório está pronto", body with download link (signed URL, 1h expiry)
  - `content_new`: subject "Nova trilha disponível: {trailName}", body with description, CTA "Começar"
**And** all email templates use the tenant's branding (logo, colors from Epic 6) when available

**Given** a transient failure occurs (network timeout, Resend 5xx)
**When** the EmailChannel catches the error
**Then** it throws a retryable error (BullMQ retries with backoff, NFR-I2)
**And** after 3 failed retries, a fallback in-app notification is created: "📧 Não conseguimos enviar o email — confira aqui: {actionUrl}" (NFR-I1)
**And** the original notification status is updated to `failed` with `metadata.failureReason`

**Given** the email sending rate approaches the Resend free tier limit
**When** the daily counter reaches threshold (checked atomically via Redis Lua script: `if INCR result < threshold then allow else defer`)
**Then** at 80/100 daily emails: non-critical emails (`content_new`) are deferred to the next day
**And** `meeting_reminder` when deferred gets an immediate fallback in-app notification: "📅 Lembrete: Reunião amanhã no grupo {groupName}" — participant CANNOT miss a meeting reminder
**And** critical emails (`pastoral_alert`, `export_ready`, system emails like password reset) always continue to be sent regardless of counter
**And** the admin is notified in-app: "Limite diário de emails se aproximando. {sent}/{limit} enviados hoje."

**Given** the Resend API is completely unavailable for > 5 minutes
**When** the health check (Story 14.4) detects the outage
**Then** all new email notifications automatically fall back to in-app only
**And** a domain event `notifications.email.circuit-open` is emitted
**And** when Resend recovers (health check passes 3 consecutive times), the circuit closes and email delivery resumes
**And** deferred emails from the outage period are NOT retried (to avoid spam burst) — only new events use email

**Teste:** Integration test: send email via Resend (sandbox/test mode). Snapshot tests for each email template with representative data (nome com acentos, URL longa, tenant sem logo). Retry test: mock Resend 500 → verify 3 retries → verify fallback in-app created. Rate limit test: Redis Lua script atomicity — simulate 2 concurrent jobs at 79/100 → verify only 1 succeeds. Deferral test: meeting_reminder deferred → verify fallback in-app created. Circuit breaker test: mock Resend down → verify fallback → mock recovery → verify circuit closes. RLS isolation test.

### Story 14.4: Health Check de Integrações & Dashboard Super Admin (NFR-I5)

As a Super Admin,
I want to see the health status of all external integrations,
So that I can quickly identify and respond to service degradations.

**Acceptance Criteria:**

**Given** a Super Admin accesses `GET /api/v1/admin/health/integrations`
**When** the endpoint runs health checks
**Then** it checks each integration and returns:
  - **Resend** (email): `POST /emails` with dry-run or `GET /domains` — measure latency
  - **Keycloak** (auth): `GET /realms/{realm}/.well-known/openid-configuration` — measure latency
  - **MinIO** (storage): `HEAD` on health endpoint or bucket listing — measure latency
  - **Redis** (cache/jobs): `PING` command — measure latency
  - **PostgreSQL** (database): `SELECT 1` — measure latency
**And** each integration returns: `{ name, status, latencyMs, lastChecked, message? }`
**And** status classification: `healthy` (< 1s), `degraded` (1–5s), `unhealthy` (> 5s or error)
**And** the response includes a `summary: { total, healthy, degraded, unhealthy }` field

**Given** the health check cron runs
**When** it executes every 5 minutes
**Then** it runs as a BullMQ repeatable job (NOT `@nestjs/schedule` `@Cron`) to guarantee single-execution via Redis lock across multiple NestJS instances
**And** results are stored in `integration_health_log` table with `{ integration_name, status, latency_ms, message, checked_at }`

**Given** the Super Admin views the health dashboard at `/app/admin/health`
**When** the page loads
**Then** each integration shows: name, status badge (green/yellow/red), latency, last checked time
**And** a latency sparkline shows the last 24h (288 data points at 5min intervals) using a lightweight chart component (SVG inline or `@nivo/line`), responsive, hover shows exact value
**And** auto-refresh every 60 seconds with visible "Atualizado há X segundos" timestamp (visual warning when stale > 2min)
**And** clicking an integration shows detailed history with error messages (if any)

**Given** an integration's status changes
**When** it transitions from `healthy` to `degraded` or `unhealthy`
**Then** the change is debounced: notification is ONLY sent if the new status persists for 2 consecutive checks (10min) — prevents notification storm from flapping integrations
**And** a domain event `system.integration.status-changed` is emitted
**And** a notification is created for all Super Admins: "⚠️ {integrationName} está {status}" (via Story 14.1 infrastructure)
**And** the event is logged in the audit log with `correlation_id`

**Given** the health check endpoint is called by non-Super-Admin
**When** the guard validates
**Then** it returns 403 — health check data is Super Admin only

**Teste:** Integration test: mock cada integração respondendo healthy/degraded/unhealthy → verify status classification. Latency boundary test: 999ms → healthy, 1001ms → degraded, 5001ms → unhealthy. Flapping test: 5 alternâncias healthy/degraded em sequência → verify máximo 2-3 notificações (debounce). Guard test: non-super-admin → 403. BullMQ repeatable job test: verify single-execution with 2 NestJS instances simulated. E2E: dashboard com sparkline + auto-refresh + stale indicator.

---

