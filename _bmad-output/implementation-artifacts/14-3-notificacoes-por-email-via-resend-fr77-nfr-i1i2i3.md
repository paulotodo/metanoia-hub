# Story 14.3: Notificações por Email via Resend (FR77, NFR-I1/I2/I3)

Status: ready-for-dev

## Story

As a user,
I want to receive important notifications by email,
So that I'm informed even when I'm not using the platform.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Implement `EmailChannel` processor (AC: #1)
  - [ ] Create `EmailChannel` implementing `NotificationChannel` interface
  - [ ] Integrate Resend SDK with `EmailService` abstraction
  - [ ] Configure timeouts: connect ≤ 3s, read ≤ 10s
  - [ ] Implement template selection based on notification type
  - [ ] Apply tenant branding (logo, colors) to email templates
- [ ] Task 2: Create email templates (AC: #1)
  - [ ] `pastoral_alert` template: subject, body with participant name, risk reason, CTA
  - [ ] `meeting_reminder` template: subject, body with date, time, join link
  - [ ] `export_ready` template: subject, body with download link
  - [ ] `content_new` template: subject, body with description, CTA
- [ ] Task 3: Implement retry and fallback logic (AC: #2)
  - [ ] Throw retryable errors for transient failures (BullMQ handles backoff)
  - [ ] After 3 failed retries: create fallback in-app notification
  - [ ] Update original notification status to `failed` with `metadata.failureReason`
- [ ] Task 4: Implement rate limiting with Redis Lua script (AC: #3)
  - [ ] Create atomic Redis Lua script for daily email counter
  - [ ] At 80/100: defer non-critical emails (`content_new`) to next day
  - [ ] `meeting_reminder` deferred → immediate fallback in-app notification
  - [ ] Critical emails (`pastoral_alert`, `export_ready`) always sent
  - [ ] Notify admin in-app when approaching limit
- [ ] Task 5: Implement circuit breaker for Resend outage (AC: #4)
  - [ ] Integrate with health check (Story 14.4) for outage detection
  - [ ] Auto-fallback to in-app when Resend unavailable > 5min
  - [ ] Emit `notifications.email.circuit-open` domain event
  - [ ] Close circuit after 3 consecutive healthy checks
  - [ ] Do NOT retry deferred emails from outage period
- [ ] Task 6: Write tests (AC: all)
  - [ ] Integration test: send email via Resend (sandbox/test mode)
  - [ ] Snapshot tests for each email template with representative data (name with accents, long URL, tenant without logo)
  - [ ] Retry test: mock Resend 500 → verify 3 retries → verify fallback in-app created
  - [ ] Rate limit test: Redis Lua script atomicity — simulate 2 concurrent jobs at 79/100 → verify only 1 succeeds
  - [ ] Deferral test: meeting_reminder deferred → verify fallback in-app created
  - [ ] Circuit breaker test: mock Resend down → verify fallback → mock recovery → verify circuit closes
  - [ ] RLS isolation test

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### NFR Compliance
- NFR-I1: Operation continues 30min without provider (fallback to in-app)
- NFR-I2: Automatic retry with exponential backoff
- NFR-I3: Explicit timeouts (connect ≤ 3s, read ≤ 10s)
- NFR-I4: Failed jobs retained for investigation

### Implementation Order Note
- Epic 14 order: 14.1 → 14.4 → 14.3 → 14.2a → 14.2b → 14.2c
- This story (14.3) depends on 14.4 for circuit breaker

### Dependencies
- Story 14.1 (notification infrastructure — Channel Router, BullMQ queue)
- Story 14.4 (health check — circuit breaker for Resend outage detection)
- Epic 6 (tenant branding — logo, colors for email templates)

### Project Structure Notes
- Backend: `apps/api/src/modules/notifications/channels/email.channel.ts`
- Backend: `apps/api/src/modules/notifications/channels/email.service.ts` (abstraction)
- Email templates: `apps/api/src/modules/notifications/templates/`
- Redis Lua script: `apps/api/src/modules/notifications/scripts/rate-limit.lua`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-14.md` (Story 14.3)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
