# Story 13.1: Relatório por Reunião (FR63)

Status: ready-for-dev

## Story

As a Líder de Grupo,
I want to see a detailed report for each meeting with attendance and engagement metrics,
So that I can understand group dynamics and follow up on absent participants.

## Acceptance Criteria

**Given** a meeting has been completed (status `completed` from Epic 5)
**When** the leader accesses `GET /api/v1/meetings/:id/report`
**Then** the report includes:
  - Total participants invited vs. present vs. absent
  - Attendance percentage
  - Per-participant: present (yes/no), join time, leave time, duration in meeting
  - Engagement score: `participantDuration / meetingDuration` (0.0 a 1.0) — classificação: ≥ 0.75 alto, 0.50–0.74 médio, < 0.50 baixo
**And** the response follows the standard format `{ data: { meetingId, date, groupName, metrics: {...}, participants: [...] }, meta: { generatedAt } }`

**Given** the leader views the report in the UI at `/app/gestao/meetings/:id/report`
**When** the report page renders
**Then** a summary card shows: total participants, attendance %, average engagement score com badge de classificação (alto/médio/baixo)
**And** a mini-chart of attendance trend shows the last 5 meetings of this group (sparkline: attendance % over time) — *nice-to-have, pode ser implementado como sub-task*
**And** a participant list shows each member with status icon (present ✓ / absent ✗), duration, and engagement score
**And** absent participants are highlighted with a "Cuidar" CTA linking to pastoral action (if Epic 7 Radar is available)

**Given** the leader wants to export the report
**When** they click "Exportar CSV"
**Then** a CSV file is generated with columns: name, email, status, joinTime, leaveTime, duration, engagementScore
**And** the export follows the same BullMQ async pattern from Epic 8 (`queue:reports`), returning 202 with download link via polling

**Given** a meeting has no attendance data (edge case — meeting created but never started)
**When** the leader accesses the report
**Then** the report shows "Nenhum dado de presença registrado para esta reunião" with empty state illustration
**And** the API returns 200 with empty `participants: []` and `metrics: { attendance: 0, total: N }`

## Tasks / Subtasks

- [ ] Task 1: Create Zod schemas for meeting report response in `packages/types` (AC: #1)
  - [ ] Define `MeetingReportResponseSchema` with `data` (meetingId, date, groupName, metrics, participants) and `meta` (generatedAt)
  - [ ] Define `MeetingReportParticipantSchema` (name, email, present, joinTime, leaveTime, duration, engagementScore, classification)
  - [ ] Add snapshot tests for schemas
- [ ] Task 2: Implement `GET /api/v1/meetings/:id/report` endpoint in `apps/api/src/modules/reports/` (AC: #1, #4)
  - [ ] Create `ReportService.getMeetingReport()` — service direct with Prisma (supporting subdomain, no repository pattern)
  - [ ] Implement engagement score calculation: `participantDuration / meetingDuration` with classification thresholds
  - [ ] Handle edge case: meeting with no attendance data → return empty participants array with zero metrics
  - [ ] Apply `@Roles('leader', 'admin_tenant')` guard
  - [ ] Validate tenant_id via RLS
- [ ] Task 3: Implement CSV export via BullMQ async pattern (AC: #3)
  - [ ] Create `POST /api/v1/meetings/:id/report/export` endpoint returning 202
  - [ ] Create BullMQ job processor in `queue:reports` for CSV generation
  - [ ] Generate CSV with columns: name, email, status, joinTime, leaveTime, duration, engagementScore
  - [ ] Upload CSV to MinIO with signed URL (1h expiry)
  - [ ] Implement polling endpoint `GET /api/v1/exports/:exportId` for download link
- [ ] Task 4: Build meeting report UI page at `/app/gestao/meetings/:id/report` (AC: #2)
  - [ ] Create summary card component with total participants, attendance %, avg engagement with badge
  - [ ] Create participant list component with status icons, duration, engagement score
  - [ ] Highlight absent participants with "Cuidar" CTA (link to pastoral action if Epic 7 available)
  - [ ] Build attendance trend sparkline for last 5 meetings (nice-to-have sub-task)
  - [ ] Implement empty state with illustration for no attendance data
  - [ ] Use TanStack Query for data fetching (Client Component, authenticated area)
- [ ] Task 5: Write tests (AC: all)
  - [ ] Integration tests with meeting fixtures (0 participants, partial, full attendance)
  - [ ] Validate engagement score calculation and classification
  - [ ] RLS isolation test: leader from tenant A cannot see tenant B meetings
  - [ ] E2E Playwright: complete flow report → export CSV

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Epic 5 (meetings — attendance data, meeting status `completed`)
- Epic 7 (Pastoral Radar — for "Cuidar" CTA linking)
- Epic 8 (trails — BullMQ async export pattern reference)

### Project Structure Notes
- Backend: `apps/api/src/modules/reports/` (analytics is supporting subdomain — service direct with Prisma)
- Frontend: `apps/web/app/(authenticated)/gestao/meetings/[id]/report/page.tsx`
- Shared types: `packages/types/src/reports/meeting-report.ts`
- BullMQ queue: `queue:reports`
- CSV exports stored in MinIO bucket

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-13.md` (Story 13.1)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
