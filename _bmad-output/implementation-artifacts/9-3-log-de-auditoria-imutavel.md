# Story 9.3: Log de Auditoria Imutável

Status: ready-for-dev

## Story

As a Super Admin,
I want an immutable audit log of all administrative actions across the platform,
So that I can trace who did what, when, and from where for compliance and security investigations.

## Acceptance Criteria

**Given** any authenticated user performs a mutative action (POST, PUT, PATCH, DELETE on: users, groups, trails, tenants, roles, configurations)
**When** the action is processed by the API
**Then** a NestJS `AuditInterceptor` (global, applied only to mutative HTTP methods — NOT GET/HEAD/OPTIONS) automatically captures and persists an audit event with:
  - `id` (UUID v7), `tenantId`, `userId`, `action` (enum: `create`, `update`, `delete`, `login`, `export`, `config_change`), `resource` (entity type), `resourceId`, `ipAddress`, `userAgent`
  - `previousState` (JSON — for updates, snapshot before change), `newState` (JSON — snapshot after change)
  - `timestamp` (ISO 8601), `severity` (enum: `info`, `warning`, `critical`)
**And** the audit event is persisted in the `audit_events` table via `audit.service.ts` (NOT repository pattern — audit is a supporting subdomain, uses Prisma directly)
**And** the `audit_events` table has NO `UPDATE` or `DELETE` RLS policies — only `INSERT` and `SELECT` (append-only, immutable)
**And** `tenantId` scoping via RLS ensures each tenant only sees their own audit events (Super Admin sees cross-tenant via privileged query)
**And** an immutability test validates: attempt `UPDATE` and `DELETE` directly on `audit_events` via raw SQL → confirm RLS blocks both operations. Attempt via Prisma → confirm `audit.service.ts` exposes NO update/delete methods
**And** a load test validates: simulate 10,000 audit events/hour → confirm viewer query responds in <2s with server-side pagination (50 items/page) and index on `(tenant_id, timestamp DESC)`

**Given** I am authenticated as Super Admin
**When** I navigate to the Audit Log viewer at `/app/admin/super/audit`
**Then** I see a table of audit events with columns: timestamp, user, action, resource, severity badge (✅/⚠️/❌)
**And** each row is expandable to show full details: previous/new state as formatted JSON, IP address, user agent
**And** the table supports server-side pagination (50 items per page)

**Given** I want to filter audit events
**When** I use the sticky filter bar at the top
**Then** I can filter by: event type (action), user, date range (date picker), severity level
**And** I can search by free-text on event description/resource
**And** filters are applied server-side — the API endpoint is `GET /api/v1/audit/events?action=&userId=&from=&to=&severity=&q=&page=&perPage=50`

**Given** I want to export audit events
**When** I click "Exportar" and choose CSV or JSON
**Then** the export follows the same async pattern as Story 8.7 (BullMQ job → polling → signed download URL)
**And** exported data includes all fields (not just visible columns)

**Given** the audit viewer is accessed
**When** the page renders
**Then** the UI is optimized for desktop (audit is an admin operation — not mobile-optimized per UX spec)
**And** auto-refresh occurs every 30 seconds for recent events

**Given** audit log retention
**When** events age beyond the retention period
**Then** audit events are NEVER auto-deleted — retention is permanent (legal compliance requirement)
**And** old events may be archived to cold storage (future optimization, not in scope for this story)

## Tasks / Subtasks

- [ ] Task 1: Create Prisma schema for audit_events (AC: #1)
  - [ ] 1.1 Add `AuditEvent` model: `id` (UUID v7), `tenantId`, `userId`, `action` (enum), `resource`, `resourceId`, `ipAddress`, `userAgent`, `previousState` (JSON), `newState` (JSON), `timestamp` (ISO 8601), `severity` (enum)
  - [ ] 1.2 Add `@@map("audit_events")` and column `@map` for snake_case
  - [ ] 1.3 Create index on `(tenant_id, timestamp DESC)` for query performance
  - [ ] 1.4 Create migration with RLS: only `INSERT` and `SELECT` policies (NO `UPDATE`/`DELETE`)
  - [ ] 1.5 Write RLS immutability tests (attempt UPDATE/DELETE via raw SQL → blocked)

- [ ] Task 2: Create Audit module in NestJS (AC: #1)
  - [ ] 2.1 Create `apps/api/src/modules/audit/audit.module.ts`
  - [ ] 2.2 Create `apps/api/src/modules/audit/audit.service.ts` (supporting subdomain — direct Prisma, NO update/delete methods)
  - [ ] 2.3 Create `apps/api/src/modules/audit/audit.controller.ts` with query/export endpoints
  - [ ] 2.4 Register module globally in `app.module.ts`

- [ ] Task 3: Implement AuditInterceptor (AC: #1)
  - [ ] 3.1 Create `apps/api/src/modules/audit/interceptors/audit.interceptor.ts`
  - [ ] 3.2 Apply globally via `APP_INTERCEPTOR` for mutative methods only (POST, PUT, PATCH, DELETE)
  - [ ] 3.3 Capture: userId from RequestContext (AsyncLocalStorage), tenantId, ipAddress, userAgent from request
  - [ ] 3.4 Capture previousState (before mutation) and newState (after mutation)
  - [ ] 3.5 Determine severity based on action type and resource
  - [ ] 3.6 Persist audit event asynchronously (non-blocking — do not slow down the request)

- [ ] Task 4: Define Zod schemas (AC: #1, #3)
  - [ ] 4.1 Create `packages/types/src/audit/event.ts` with `AuditEventSchema`, `AuditEventFilterSchema`
  - [ ] 4.2 Define action enum: `create`, `update`, `delete`, `login`, `export`, `config_change`
  - [ ] 4.3 Define severity enum: `info`, `warning`, `critical`
  - [ ] 4.4 Add snapshot tests

- [ ] Task 5: Implement `GET /api/v1/audit/events` query endpoint (AC: #3)
  - [ ] 5.1 Server-side pagination (50 items/page, `{ data, meta: { page, perPage, total } }`)
  - [ ] 5.2 Filters: action, userId, from/to date range, severity, free-text search (q)
  - [ ] 5.3 Super Admin: cross-tenant query via privileged mode
  - [ ] 5.4 Other roles: tenant-scoped via RLS

- [ ] Task 6: Implement audit export (AC: #4)
  - [ ] 6.1 Add export endpoint following Story 8.7 async pattern
  - [ ] 6.2 Support CSV and JSON formats
  - [ ] 6.3 BullMQ job → polling → signed download URL from MinIO

- [ ] Task 7: Build Audit Log viewer frontend (AC: #2, #3, #4, #5)
  - [ ] 7.1 Create page at `apps/web/src/app/(authenticated)/admin/super/audit/page.tsx`
  - [ ] 7.2 DataTable with columns: timestamp, user, action, resource, severity badge
  - [ ] 7.3 Expandable rows showing previousState/newState as formatted JSON, IP, user agent
  - [ ] 7.4 Sticky filter bar: action type, user search, date range picker, severity select
  - [ ] 7.5 Free-text search input
  - [ ] 7.6 Server-side pagination controls
  - [ ] 7.7 Auto-refresh every 30 seconds (TanStack Query refetchInterval)
  - [ ] 7.8 Export button with format selection (CSV/JSON)
  - [ ] 7.9 Desktop-optimized layout (admin density per UX-DR03)

- [ ] Task 8: Write tests (AC: all)
  - [ ] 8.1 Unit tests for audit.service (co-located `*.spec.ts`)
  - [ ] 8.2 Unit tests for AuditInterceptor
  - [ ] 8.3 Immutability test: UPDATE/DELETE blocked via raw SQL and via Prisma
  - [ ] 8.4 RLS isolation test: tenant A cannot see tenant B's audit events
  - [ ] 8.5 Load test: 10,000 events/hour → viewer query <2s with pagination
  - [ ] 8.6 Filter/pagination integration tests
  - [ ] 8.7 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/audit/audit.module.ts`
- `apps/api/src/modules/audit/audit.service.ts`
- `apps/api/src/modules/audit/audit.controller.ts`
- `apps/api/src/modules/audit/interceptors/audit.interceptor.ts`
- `packages/types/src/audit/event.ts` — Zod schemas
- `apps/web/src/app/(authenticated)/admin/super/audit/page.tsx`
- `prisma/migrations/` — audit_events table

### Libraries & Versions
- NestJS 11.1 interceptors for global audit capture
- Prisma v7 for direct database access (supporting subdomain)
- BullMQ for async export jobs
- TanStack Query 5.96.2 for auto-refresh and pagination
- shadcn/ui DataTable, DatePicker, Select components
- Zod 4.3.6 for schema validation

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- Audit is a **cross-cutting concern** implemented via NestJS global interceptor
- `audit_events` table is **append-only**: NO UPDATE or DELETE RLS policies
- `audit.service.ts` exposes NO update/delete methods (immutability enforced at code level too)
- Audit is a **supporting subdomain** — direct Prisma, no repository pattern
- Performance: index on `(tenant_id, timestamp DESC)` for query optimization
- Retention: **permanent** — events are NEVER auto-deleted

### Dependencies
- Epic 1 (Story 1.5) — RequestContext / AsyncLocalStorage for userId extraction
- Story 8.7 — async export pattern (BullMQ → polling → signed URL)
- All Epics that produce mutative actions will be automatically captured

### Project Structure Notes
- Module at `apps/api/src/modules/audit/` following bounded context organization
- Interceptor is global but only applies to mutative HTTP methods
- Shared types at `packages/types/src/audit/`
- Frontend page under super admin route

### References
- `_bmad-output/planning-artifacts/epics/epic-09.md` — Epic 9 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
