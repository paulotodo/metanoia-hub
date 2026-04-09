# Story 10.2: Dados de Demonstração (Seed)

Status: ready-for-dev

## Story

As a Admin Tenant (novo),
I want pre-populated demo data available in my tenant when I first access the platform,
So that I can explore features like groups, trails, meetings, and the pastoral radar with realistic (fictional) data before adding real members.

## Acceptance Criteria

**Given** a new tenant is provisioned (Epic 3)
**When** the provisioning process completes
**Then** an idempotent seed function `seedDemoData(tenantId)` is called automatically
**And** the seed creates fictional demo data scoped to this tenant:
  - 1 group: "Grupo Alpha"
  - 1 leader: "Marcos Silva" (fictional, with `isDemoData: true` flag)
  - 3 participants with distinct semáforo states:
    - "Ana Costa" — green (100% meeting attendance, 80% trail progress)
    - "Pedro Santos" — yellow (60% attendance, 40% trail progress, declining trend)
    - "Maria Oliveira" — red (20% attendance, 10% trail progress, 2 missed meetings)
  - 1 trail: "Fundamentos da Fé" with 2 modules, 4 lessons (mix of video stubs and rich text)
  - Trail progress records for each demo participant matching their semáforo state
  - 1 past meeting with presence data in PostgreSQL (`meeting_telemetry` table from Epic 5) simulating 2/3 participants present — NOT in Redis (Redis is for live data only and would be lost on restart)
  - 3 pastoral care actions: 1 completed (Ana), 1 pending (Pedro), 1 urgent (Maria)

**Prerequisite:** Epics 4 (groups), 5 (meetings), 8 (trails) must be complete — seed creates records in tables from all three epics.

**Given** demo data exists in the tenant
**When** the admin navigates to any feature area (groups, trails, radar)
**Then** demo data is displayed with a subtle `DemoOverlay` badge: "Dados de demonstração" with a dismiss button
**And** demo records are visually distinguished (e.g., faded opacity or dotted border) from real data

**Given** the admin starts adding real data
**When** the admin creates their first REAL group (not demo)
**Then** a nudge is displayed: "Você já tem dados reais! Deseja remover os dados de demonstração?" with "Remover agora" and "Manter por enquanto" options
**And** the admin can also remove all demo data at any time via "Limpar dados de demonstração" button in Settings
**And** this button calls `DELETE /api/v1/onboarding/demo-data` which removes all records with `isDemoData: true` for this tenant
**And** a confirmation dialog warns: "Isso removerá todos os dados de exemplo. Seus dados reais não serão afetados."

**Given** the seed function runs
**When** it is called multiple times (e.g., re-provisioning, testing)
**Then** it is idempotent — uses `upsert` to prevent duplicate demo records
**And** all demo records use UUID v7 with `isDemoData: true` flag for easy bulk cleanup
**And** the seed is also available as a Turborepo pipeline command: `pnpm turbo db:seed` (for dev/testing environments)

## Tasks / Subtasks

- [ ] Task 1: Add `isDemoData` flag to relevant tables (AC: #1, #3)
  - [ ] 1.1 Add `isDemoData` boolean field (default: false) to: users, groups, group_members, trails, trail_modules, lessons, trail_progress, meeting_telemetry, pastoral_actions
  - [ ] 1.2 Create migration
  - [ ] 1.3 Add index on `(tenant_id, is_demo_data)` for efficient cleanup queries

- [ ] Task 2: Implement `seedDemoData(tenantId)` function (AC: #1)
  - [ ] 2.1 Create `apps/api/src/modules/onboarding/seed/demo-data.seed.ts`
  - [ ] 2.2 Create demo group "Grupo Alpha" with `isDemoData: true`
  - [ ] 2.3 Create leader "Marcos Silva" with `isDemoData: true`
  - [ ] 2.4 Create 3 participants with distinct states (Ana/green, Pedro/yellow, Maria/red)
  - [ ] 2.5 Create trail "Fundamentos da Fé" with 2 modules, 4 lessons (video stubs + rich text)
  - [ ] 2.6 Create trail progress records matching each participant's semáforo state
  - [ ] 2.7 Create past meeting with presence data in PostgreSQL (NOT Redis)
  - [ ] 2.8 Create 3 pastoral care actions (completed, pending, urgent)
  - [ ] 2.9 All IDs via `uuidv7()`
  - [ ] 2.10 Use `upsert` for idempotency

- [ ] Task 3: Integrate seed with tenant provisioning (AC: #1)
  - [ ] 3.1 Call `seedDemoData(tenantId)` at end of Epic 3 provisioning flow
  - [ ] 3.2 Ensure seed runs within provisioning transaction or handles failures gracefully

- [ ] Task 4: Add Turborepo seed command (AC: #3)
  - [ ] 4.1 Add `db:seed` script to `apps/api/package.json`
  - [ ] 4.2 Configure in `turbo.json` pipeline
  - [ ] 4.3 Seed should accept optional `--tenant-id` parameter

- [ ] Task 5: Implement `DELETE /api/v1/onboarding/demo-data` endpoint (AC: #2)
  - [ ] 5.1 Remove all records with `isDemoData: true` for the current tenant
  - [ ] 5.2 Cascade delete across all related tables
  - [ ] 5.3 Return 204 on success

- [ ] Task 6: Build DemoOverlay badge component (AC: #2)
  - [ ] 6.1 Create `apps/web/src/components/onboarding/demo-overlay.tsx`
  - [ ] 6.2 Subtle badge: "Dados de demonstração" with dismiss button
  - [ ] 6.3 Apply faded opacity or dotted border to demo records

- [ ] Task 7: Build demo data nudge and cleanup UI (AC: #2)
  - [ ] 7.1 Nudge component triggered when first real group is created
  - [ ] 7.2 "Limpar dados de demonstração" button in Settings
  - [ ] 7.3 Confirmation dialog before cleanup

- [ ] Task 8: Write tests (AC: all)
  - [ ] 8.1 Idempotency test: run seed 2x → no duplicates
  - [ ] 8.2 Data completeness test: verify all expected records created
  - [ ] 8.3 Semáforo state test: verify Ana=green, Pedro=yellow, Maria=red
  - [ ] 8.4 Cleanup test: DELETE endpoint removes all demo data, preserves real data
  - [ ] 8.5 Tenant isolation test: demo data scoped to correct tenant
  - [ ] 8.6 Nudge trigger test: first real group → nudge displayed

## Dev Notes

### File Paths
- `apps/api/src/modules/onboarding/seed/demo-data.seed.ts` — seed function
- `apps/api/src/modules/onboarding/onboarding.controller.ts` — add cleanup endpoint
- `apps/web/src/components/onboarding/demo-overlay.tsx` — overlay badge
- `prisma/migrations/` — isDemoData field migration
- `turbo.json` — db:seed pipeline

### Libraries & Versions
- Prisma v7 for database operations (upsert for idempotency)
- uuidv7 for all demo record IDs
- Zod 4.3.6 for any validation needed
- shadcn/ui Badge, AlertDialog components

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- `isDemoData: true` flag on all demo records for easy bulk cleanup
- Seed is **idempotent** — uses upsert
- Meeting telemetry in **PostgreSQL only** (not Redis — Redis is live data only)
- Demo users are fictional — they don't have Keycloak accounts

### Dependencies
- Epic 3 — tenant provisioning (seed called at end of provisioning)
- Epic 4 — groups tables and API
- Epic 5 — meetings/telemetry tables
- Epic 7 — pastoral radar (demo data visualizes here)
- Epic 8 — trails tables

### Project Structure Notes
- Seed function in onboarding module `seed/` subdirectory
- Reuses onboarding module from Story 10.1

### References
- `_bmad-output/planning-artifacts/epics/epic-10.md` — Epic 10 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
