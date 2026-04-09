# Story 13.2b: Relatório por Tenant com Materialized Views (FR65)

Status: ready-for-dev

## Story

As an Admin Tenant,
I want to see aggregated metrics for the entire tenant,
So that I can monitor overall health and make strategic decisions.

## Acceptance Criteria

**Given** an admin accesses `GET /api/v1/reports/tenant-summary?period=30d`
**When** the tenant has multiple groups and leaders
**Then** the report includes per-group: leader name, attendance average, trail progress, risk count
**And** a tenant-wide summary: total groups, total leaders, total participants, overall metrics
**And** the data comes from a materialized view (`mv_tenant_report`) refreshed every 15 minutes via BullMQ job (`queue:reports`, job `refresh-tenant-views`)
**And** the `REFRESH MATERIALIZED VIEW CONCURRENTLY` command is used to avoid locking reads during refresh

**Given** the UI renders the report
**When** the page loads
**Then** a "Dados atualizados em: {timestamp}" label is displayed (timestamp from materialized view `last_refresh_at`)
**And** a "Atualizar agora" button triggers on-demand refresh (rate-limited: max 1 per 5min per tenant)
**And** during refresh, the button shows a spinner and is disabled
**And** if rate-limited, a toast is shown: "Atualização disponível em X minutos"
**And** on completion, the timestamp updates and a success toast confirms: "Dados atualizados com sucesso"
**And** filters are available: período, grupo específico, status do semáforo

**Given** the materialized view refresh job fails
**When** the next scheduled run executes
**Then** it retries with exponential backoff (3 attempts, 30s/60s/120s)
**And** stale data is still served with a warning banner: "Dados podem estar desatualizados"
**And** failure is logged with `correlation_id` for debugging
**And** if refresh duration > 5min, an alert metric is emitted via Pino for monitoring

## Tasks / Subtasks

- [ ] Task 1: Create materialized view `mv_tenant_report` via Prisma migration (AC: #1)
  - [ ] Define SQL for `mv_tenant_report` aggregating per-group metrics (leader, attendance, progress, risk)
  - [ ] Add `UNIQUE INDEX` required for `REFRESH MATERIALIZED VIEW CONCURRENTLY`
  - [ ] Add `last_refresh_at` tracking table/column
  - [ ] Write RLS isolation tests for the materialized view
- [ ] Task 2: Create BullMQ job `refresh-tenant-views` in `queue:reports` (AC: #1, #3)
  - [ ] Implement repeatable job with 15min cron interval
  - [ ] Use `REFRESH MATERIALIZED VIEW CONCURRENTLY`
  - [ ] Implement retry with exponential backoff (3 attempts, 30s/60s/120s)
  - [ ] Add 10min timeout per job
  - [ ] Emit alert via Pino if refresh duration > 5min
  - [ ] Log failures with `correlation_id`
- [ ] Task 3: Create Zod schemas for tenant summary in `packages/types` (AC: #1)
  - [ ] Define `TenantSummaryResponseSchema` with per-group and tenant-wide metrics
  - [ ] Define on-demand refresh request/response schemas
  - [ ] Add snapshot tests
- [ ] Task 4: Implement `GET /api/v1/reports/tenant-summary` endpoint (AC: #1)
  - [ ] Query `mv_tenant_report` materialized view
  - [ ] Return `last_refresh_at` in meta
  - [ ] Apply `@Roles('admin_tenant')` guard
- [ ] Task 5: Implement on-demand refresh endpoint `POST /api/v1/reports/tenant-summary/refresh` (AC: #2)
  - [ ] Rate limit: max 1 per 5min per tenant (Redis counter with TTL)
  - [ ] Return 429 with `retryAfter` seconds if rate-limited
  - [ ] Trigger BullMQ job and return 202
- [ ] Task 6: Build tenant report UI (AC: #2, #3)
  - [ ] Create report page at `/app/admin/reports/tenant-summary`
  - [ ] Display "Dados atualizados em: {timestamp}" label
  - [ ] Implement "Atualizar agora" button with spinner, disabled state, rate-limit toast
  - [ ] Build period, group, and semáforo status filters
  - [ ] Show stale data warning banner when refresh fails
  - [ ] Use TanStack Query with polling for refresh status
- [ ] Task 7: Write tests (AC: all)
  - [ ] Integration test with materialized view refresh (verify data freshness)
  - [ ] Load test: 500 tenants x 10 groups x 50 participants = 250k participants — query < 2s
  - [ ] RLS isolation test: admin from tenant A cannot see tenant B data
  - [ ] E2E: filters, "Atualizar agora" button with states (loading, rate-limited, success)

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Materialized View Orchestration
- `refresh-tenant-views` runs first in `queue:reports` (tenant-scoped)
- `refresh-platform-views` (Story 13.4) runs as child job after #1 completes (BullMQ parent/child flow)
- Both use `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- Cron: every 15min. Timeout: 10min per job.

### Dependencies
- Epic 5 (meetings — attendance data)
- Epic 7 (Pastoral Radar — semáforo risk data)
- Epic 8 (trails — progress data)
- Story 13.4 depends on this story's refresh job completing first (parent/child BullMQ flow)

### Project Structure Notes
- Backend: `apps/api/src/modules/reports/`
- Migration: `apps/api/prisma/migrations/YYYYMMDD_add_mv_tenant_report/`
- BullMQ processor: `apps/api/src/modules/reports/jobs/refresh-tenant-views.processor.ts`
- Frontend: `apps/web/app/(authenticated)/admin/reports/tenant-summary/page.tsx`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-13.md` (Story 13.2b)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
