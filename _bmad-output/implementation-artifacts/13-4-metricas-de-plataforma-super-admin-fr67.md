# Story 13.4: Métricas de Plataforma — Super Admin (FR67)

Status: ready-for-dev

## Story

As a Super Admin,
I want to see platform-wide metrics across all tenants,
So that I can monitor platform health, adoption, and resource utilization.

## Acceptance Criteria

**Given** a Super Admin accesses `GET /api/v1/admin/platform-metrics/summary`
**When** the endpoint processes the request
**Then** it returns aggregate totals (cached in Redis, TTL 5min, key `cache:platform-metrics:summary`):
  - `totalTenants`, `activeTenants` (at least 1 login in last 30d), `totalUsers`, `activeUsers` (last 30d)
  - `totalGroups`, `totalMeetings` (last 30d), `totalTrails`
  - `averageAttendance` (platform-wide), `averageTrailCompletion`
  - `storageUsed` (total across tenants) — valor vem da tabela `tenant_storage_usage` (atualizada via hook de upload/delete no MinIO, não via query ao MinIO em tempo real)
  - `churnedTenants` (tenants ativos no mês anterior mas inativos agora), `netGrowth` (novos tenants - churned no período)
**And** the response format is `{ data: { ...metrics }, meta: { generatedAt, cacheTTL: 300 } }`

**Given** a Super Admin accesses `GET /api/v1/admin/platform-metrics/tenants?page=1&limit=20&sort=activeUsers:desc`
**When** the endpoint processes the request
**Then** it returns a paginated list of tenants with per-tenant metrics:
  - `tenantId`, `tenantName`, `plan`, `activeUsers`, `totalGroups`, `totalMeetings`, `storageUsed`, `createdAt`
**And** supports sorting by any metric column
**And** supports filtering by `plan` (`free`, `pro`, `enterprise`) and `status` (`active`, `inactive`)
**And** pagination follows standard `{ data: [...], meta: { total, page, limit, totalPages } }`

**Given** the Super Admin endpoint is called
**When** the guard validates the request
**Then** `@Roles('super_admin')` guard is enforced — no RLS (Super Admin sees cross-tenant data)
**And** the endpoint is under `/api/v1/admin/` namespace (separate from tenant-scoped `/api/v1/`)

**Given** the platform has 500+ tenants
**When** the summary endpoint is called without cache
**Then** the query completes in < 3s (materialized view `mv_platform_metrics` refreshed every 15min as child job of `refresh-tenant-views` — see Epic overview orchestration)
**And** on cache hit, response time is < 100ms

## Tasks / Subtasks

- [ ] Task 1: Create materialized view `mv_platform_metrics` via Prisma migration (AC: #4)
  - [ ] Define SQL for cross-tenant aggregation (totalTenants, activeTenants, users, groups, meetings, trails, attendance, completion)
  - [ ] Include `churnedTenants` and `netGrowth` calculations
  - [ ] Add `UNIQUE INDEX` for concurrent refresh support
- [ ] Task 2: Create BullMQ child job `refresh-platform-views` (AC: #4)
  - [ ] Implement as child job of `refresh-tenant-views` (Story 13.2b) using BullMQ parent/child flow
  - [ ] Use `REFRESH MATERIALIZED VIEW CONCURRENTLY`
  - [ ] 15min cron, 10min timeout
  - [ ] Emit alert if duration > 5min
- [ ] Task 3: Create Zod schemas in `packages/types` (AC: #1, #2)
  - [ ] Define `PlatformMetricsSummarySchema`
  - [ ] Define `PlatformMetricsTenantListSchema` with pagination
  - [ ] Add snapshot tests
- [ ] Task 4: Implement `GET /api/v1/admin/platform-metrics/summary` (AC: #1)
  - [ ] Query `mv_platform_metrics` or Redis cache
  - [ ] Redis caching: key `cache:platform-metrics:summary`, TTL 5min
  - [ ] Include `storageUsed` from `tenant_storage_usage` table
  - [ ] Apply `@Roles('super_admin')` guard
- [ ] Task 5: Implement `GET /api/v1/admin/platform-metrics/tenants` (AC: #2)
  - [ ] Paginated per-tenant metrics list
  - [ ] Support sorting by any metric column
  - [ ] Support filtering by `plan` and `status`
  - [ ] Apply `@Roles('super_admin')` guard — no RLS
- [ ] Task 6: Write tests (AC: all)
  - [ ] Integration test with 10+ tenants and varied data
  - [ ] Load test: 500 tenants x 10 groups x 50 participants — verify query < 3s
  - [ ] Validate non-super-admin receives 403
  - [ ] Validate `churnedTenants` and `netGrowth` calculation
  - [ ] Validate `storageUsed` comes from `tenant_storage_usage`, not MinIO query

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Super Admin Note
- Super Admin endpoints under `/api/v1/admin/` namespace — NO RLS (cross-tenant access)
- `@Roles('super_admin')` guard enforced on all endpoints

### Materialized View Orchestration
- `refresh-platform-views` runs as child job AFTER `refresh-tenant-views` (Story 13.2b) completes
- BullMQ parent/child flow ensures ordering
- Both use `REFRESH MATERIALIZED VIEW CONCURRENTLY`

### Dependencies
- Story 13.2b (materialized view refresh job — parent job that triggers this child job)
- MinIO upload/delete hooks for `tenant_storage_usage` table

### Project Structure Notes
- Backend: `apps/api/src/modules/admin/platform-metrics/`
- Migration: `apps/api/prisma/migrations/YYYYMMDD_add_mv_platform_metrics/`
- BullMQ processor: `apps/api/src/modules/reports/jobs/refresh-platform-views.processor.ts`
- Redis key: `cache:platform-metrics:summary` (TTL 5min)

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-13.md` (Story 13.4)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
