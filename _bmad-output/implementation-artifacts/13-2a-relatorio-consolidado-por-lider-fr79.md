# Story 13.2a: Relatório Consolidado por Líder (FR79)

Status: ready-for-dev

## Story

As a Líder de Grupo,
I want to see an aggregated report across all my groups,
So that I can have a holistic view of my pastoral impact.

## Acceptance Criteria

**Given** a leader has multiple groups
**When** they access `GET /api/v1/reports/leader-summary?period=30d`
**Then** the report includes per-group: attendance average, trail progress average, participants at risk count, active participants count
**And** an overall summary: total groups, total participants, overall attendance %, overall trail completion %
**And** the API supports period filter: `7d`, `30d`, `90d`, `custom` (with `startDate` and `endDate`)

**Given** the leader views the report in the UI at `/app/gestao/reports`
**When** the page loads
**Then** filters are available: período, grupo específico, status do semáforo
**And** each group card shows a summary with drill-down link to individual group details

## Tasks / Subtasks

- [ ] Task 1: Create Zod schemas for leader summary report in `packages/types` (AC: #1)
  - [ ] Define `LeaderSummaryRequestSchema` with period filter (`7d`, `30d`, `90d`, `custom`) and optional `startDate`/`endDate`
  - [ ] Define `LeaderSummaryResponseSchema` with per-group metrics and overall summary
  - [ ] Add snapshot tests for schemas
- [ ] Task 2: Implement `GET /api/v1/reports/leader-summary` endpoint (AC: #1)
  - [ ] Create `ReportService.getLeaderSummary()` in `apps/api/src/modules/reports/`
  - [ ] Aggregate per-group: attendance average, trail progress average, risk count, active participants
  - [ ] Calculate overall summary: total groups, total participants, overall attendance %, overall trail completion %
  - [ ] Support period filtering with date range calculation
  - [ ] Apply `@Roles('leader', 'admin_tenant')` guard
- [ ] Task 3: Build leader reports UI at `/app/gestao/reports` (AC: #2)
  - [ ] Create period filter component (7d, 30d, 90d, custom date range)
  - [ ] Create group filter dropdown
  - [ ] Create semáforo status filter
  - [ ] Build group summary cards with drill-down links
  - [ ] Use TanStack Query for data fetching with filter params
- [ ] Task 4: Write tests (AC: all)
  - [ ] Integration test with leader having 1, 3, 5 groups and varied data
  - [ ] RLS isolation test: leader from tenant A cannot see tenant B data
  - [ ] E2E: period and group filters

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Epic 5 (meetings — attendance data)
- Epic 7 (Pastoral Radar — semáforo data for risk count)
- Epic 8 (trails — progress data)
- Story 13.1 (meeting report — shared ReportService module)

### Project Structure Notes
- Backend: `apps/api/src/modules/reports/report.service.ts`
- Frontend: `apps/web/app/(authenticated)/gestao/reports/page.tsx`
- Shared types: `packages/types/src/reports/leader-summary.ts`
- Analytics is supporting subdomain — service direct with Prisma, no repository pattern

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-13.md` (Story 13.2a)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
