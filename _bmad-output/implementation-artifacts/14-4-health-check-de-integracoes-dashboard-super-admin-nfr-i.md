# Story 14.4: Health Check de Integrações & Dashboard Super Admin (NFR-I5)

Status: ready-for-dev

## Story

As a Super Admin,
I want to see the health status of all external integrations,
So that I can quickly identify and respond to service degradations.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Create `integration_health_log` table via Prisma migration (AC: #2)
  - [ ] Define model: `id`, `integration_name`, `status`, `latency_ms`, `message`, `checked_at`
  - [ ] Map with `@@map("integration_health_log")`
  - [ ] Add index on `(integration_name, checked_at DESC)` for sparkline queries
- [ ] Task 2: Implement health check probes for each integration (AC: #1)
  - [ ] Resend probe: `GET /domains` or dry-run
  - [ ] Keycloak probe: `GET /realms/{realm}/.well-known/openid-configuration`
  - [ ] MinIO probe: `HEAD` on health endpoint
  - [ ] Redis probe: `PING` command
  - [ ] PostgreSQL probe: `SELECT 1`
  - [ ] Status classification: healthy (< 1s), degraded (1–5s), unhealthy (> 5s or error)
- [ ] Task 3: Create BullMQ repeatable job for health checks (AC: #2)
  - [ ] Schedule every 5 minutes via BullMQ repeatable (NOT @Cron)
  - [ ] Guarantee single-execution via Redis lock
  - [ ] Store results in `integration_health_log`
- [ ] Task 4: Implement `GET /api/v1/admin/health/integrations` endpoint (AC: #1)
  - [ ] Return current status of all integrations with summary
  - [ ] Apply `@Roles('super_admin')` guard — return 403 for others
- [ ] Task 5: Implement status change notification with debounce (AC: #4)
  - [ ] Track previous status per integration
  - [ ] Only notify if new status persists for 2 consecutive checks (10min)
  - [ ] Emit `system.integration.status-changed` domain event
  - [ ] Create notification for all Super Admins via Story 14.1
  - [ ] Log in audit log with `correlation_id`
- [ ] Task 6: Build health dashboard UI at `/app/admin/health` (AC: #3)
  - [ ] Per-integration panel: name, status badge, latency, last checked time
  - [ ] Latency sparkline: last 24h (288 data points), SVG inline or `@nivo/line`, hover tooltip
  - [ ] Auto-refresh every 60s with "Atualizado há X segundos" timestamp
  - [ ] Visual warning when stale > 2min
  - [ ] Click integration → detailed history with error messages
- [ ] Task 7: Write tests (AC: all)
  - [ ] Integration test: mock each integration responding healthy/degraded/unhealthy → verify status classification
  - [ ] Latency boundary test: 999ms → healthy, 1001ms → degraded, 5001ms → unhealthy
  - [ ] Flapping test: 5 alternations healthy/degraded → verify max 2-3 notifications (debounce)
  - [ ] Guard test: non-super-admin → 403
  - [ ] BullMQ repeatable job test: verify single-execution with 2 NestJS instances simulated
  - [ ] E2E: dashboard with sparkline + auto-refresh + stale indicator

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Implementation Order Note
- Epic 14 order: 14.1 → 14.4 → 14.3 → 14.2a → 14.2b → 14.2c
- This story (14.4) is implemented early because 14.3 depends on it for circuit breaker

### Dependencies
- Story 14.1 (notification infrastructure — for alerting Super Admins)
- Epic 1 (infra base — Redis, PostgreSQL connections)

### Project Structure Notes
- Backend: `apps/api/src/modules/admin/health/`
  - `health-check.service.ts` — probe implementations
  - `health-check.controller.ts` — API endpoint
  - `health-check.processor.ts` — BullMQ repeatable job
- Migration: `apps/api/prisma/migrations/YYYYMMDD_add_integration_health_log/`
- Frontend: `apps/web/app/(authenticated)/admin/health/page.tsx`
- Chart: SVG inline or `@nivo/line` for sparkline

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-14.md` (Story 14.4)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
