# Story 10.4: Importação CSV — Confirmação & Processamento

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to confirm and execute the CSV import with a clear summary of results,
So that I know exactly how many participants were imported, which ones failed, and can take action on failures.

## Acceptance Criteria

**Given** all critical errors are resolved in Step 3
**When** I advance to Step 4 (Confirmation)
**Then** a summary is displayed:
  - Total rows: {N}
  - To be imported: {M} (valid rows)
  - Ignored: {K} (rows marked as ignore)
  - Group assignment: which group(s) will receive the new participants
**And** a "Confirmar Importação" button submits the data

**Given** I click "Confirmar Importação"
**When** the import is submitted via `POST /api/v1/groups/:groupId/members/import` with the validated data
**Then** for datasets ≤ 100 rows, the import is processed synchronously and the result is returned immediately (status 201)
**And** for datasets > 100 rows, the import is processed asynchronously via BullMQ job in `queue:csv-import` and the API returns 202 with `{ "jobId": "<uuid>" }` — client polls `GET /api/v1/import/jobs/:jobId` for status (same pattern as Story 8.7)

**Given** the import completes (sync or async)
**When** results are available
**Then** an `ImportResultSummary` component displays:
  - "✅ {N} importados com sucesso"
  - "⚠️ {M} ignorados" (with reason per row, expandable)
  - "❌ {K} falharam" (with error per row, e.g., "e-mail já cadastrado em outro tenant")
**And** for each successfully imported participant:
  - If the email is new to the platform: a user account is created and added as `participante` to the specified group
  - If the email already exists in ANOTHER tenant (FR03 multi-tenant): the user is NOT auto-linked. Instead, an invite is sent and the user must ACCEPT before being added to this tenant (consent requirement — cannot silently add someone to a new tenant)
  - If the email already exists in THIS tenant: the row is marked as "já existente" (not error, not re-imported)
  - An invite email is enqueued via BullMQ (stub in dev, same pattern as Epic 4 Story 4.3)

**Given** the import includes participants for multiple groups
**When** the CSV has a `grupo` column with different group names
**Then** participants are distributed to their respective groups (groups must already exist in the tenant)
**And** if a group name doesn't match any existing group, those rows are marked as ❌ failed with message: "Grupo '{name}' não encontrado no tenant"

**Given** the import is complete
**When** I want to review what was imported
**Then** a "Baixar relatório" link downloads a CSV with import results: original data + status column (imported/ignored/failed) + error detail
**And** the import event is recorded in the audit log (Epic 9, Story 9.3) with: action `import`, resource `members`, resourceId `groupId`, metadata `{ totalRows, imported, ignored, failed }`
**And** a domain event `onboarding.csv_import.completed` is emitted with `{ tenantId, groupId, totalRows, imported, ignored, failed, timestamp }` for future adoption analytics (Epic 13)

**Given** edge cases
**When** the CSV has no valid rows after error resolution
**Then** the "Confirmar Importação" button is disabled with message: "Nenhuma linha válida para importar"
**And** when all rows are duplicates of existing members, the result shows "0 importados, {N} já existentes" (not treated as error)

## Tasks / Subtasks

- [ ] Task 1: Implement `POST /api/v1/groups/:groupId/members/import` endpoint (AC: #2)
  - [ ] 1.1 Create endpoint in groups controller or onboarding controller
  - [ ] 1.2 Accept validated CSV data as JSON payload
  - [ ] 1.3 For ≤100 rows: process synchronously, return 201
  - [ ] 1.4 For >100 rows: enqueue BullMQ job in `queue:csv-import`, return 202 with jobId
  - [ ] 1.5 Validate group exists and belongs to tenant

- [ ] Task 2: Implement CSV import processing logic (AC: #2, #3)
  - [ ] 2.1 Create `apps/api/src/modules/onboarding/services/csv-import.service.ts`
  - [ ] 2.2 For each row, determine action:
    - New email → create user account + add to group as participante
    - Email exists in ANOTHER tenant → send invite (consent required)
    - Email exists in THIS tenant → mark as "já existente"
  - [ ] 2.3 Enqueue invite emails via BullMQ `queue:notifications` (stub in dev)
  - [ ] 2.4 Track results: imported, ignored, failed with per-row details

- [ ] Task 3: Implement BullMQ worker for async import (AC: #2)
  - [ ] 3.1 Create `apps/api/src/modules/onboarding/workers/csv-import.processor.ts`
  - [ ] 3.2 Process rows in batches (e.g., 50 at a time)
  - [ ] 3.3 Update job progress for polling
  - [ ] 3.4 Store results on completion

- [ ] Task 4: Implement `GET /api/v1/import/jobs/:jobId` polling endpoint (AC: #2)
  - [ ] 4.1 Return job status: `processing`, `completed`, `failed`
  - [ ] 4.2 Include progress percentage for in-progress jobs
  - [ ] 4.3 Include results when completed

- [ ] Task 5: Implement multi-group distribution (AC: #4)
  - [ ] 5.1 Parse `grupo` column from CSV data
  - [ ] 5.2 Resolve group names to IDs within tenant
  - [ ] 5.3 Mark rows with unknown group names as failed

- [ ] Task 6: Implement result report generation (AC: #5)
  - [ ] 6.1 Generate CSV report: original data + status + error detail columns
  - [ ] 6.2 Store in MinIO, provide signed download URL
  - [ ] 6.3 Record import in audit log (Story 9.3)
  - [ ] 6.4 Emit domain event `onboarding.csv_import.completed`

- [ ] Task 7: Build confirmation UI (AC: #1)
  - [ ] 7.1 Create `apps/web/src/components/import/import-confirmation.tsx`
  - [ ] 7.2 Summary display: total, to-import, ignored, group assignments
  - [ ] 7.3 "Confirmar Importação" button
  - [ ] 7.4 Disable button when no valid rows

- [ ] Task 8: Build ImportResultSummary component (AC: #3)
  - [ ] 8.1 Create `apps/web/src/components/import/import-result-summary.tsx`
  - [ ] 8.2 Success/ignored/failed counts with icons
  - [ ] 8.3 Expandable sections showing per-row details
  - [ ] 8.4 "Baixar relatório" download link
  - [ ] 8.5 Polling UI for async imports (progress bar + auto-refresh)

- [ ] Task 9: Define Zod schemas (AC: all)
  - [ ] 9.1 Create `packages/types/src/onboarding/csv-import-result.ts`
  - [ ] 9.2 `ImportRequestSchema`, `ImportResultSchema`, `ImportJobStatusSchema`
  - [ ] 9.3 Add snapshot tests

- [ ] Task 10: Write tests (AC: all)
  - [ ] 10.1 Sync import test: ≤100 rows → 201 response with results
  - [ ] 10.2 Async import test: >100 rows → 202 with jobId → poll → results
  - [ ] 10.3 New user creation test: email not in platform → account created
  - [ ] 10.4 Cross-tenant test: email in another tenant → invite sent, not auto-linked
  - [ ] 10.5 Same-tenant duplicate test: email in this tenant → "já existente"
  - [ ] 10.6 Multi-group test: different grupo values → distributed correctly
  - [ ] 10.7 Unknown group test: invalid group name → row marked failed
  - [ ] 10.8 No valid rows test: button disabled
  - [ ] 10.9 All duplicates test: 0 imported, N já existentes
  - [ ] 10.10 Audit log test: import recorded with correct metadata
  - [ ] 10.11 Domain event test: event emitted with correct payload
  - [ ] 10.12 Report generation test: CSV with status column
  - [ ] 10.13 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/onboarding/services/csv-import.service.ts`
- `apps/api/src/modules/onboarding/workers/csv-import.processor.ts`
- `apps/api/src/modules/onboarding/onboarding.controller.ts` — add import endpoints
- `apps/web/src/components/import/import-confirmation.tsx`
- `apps/web/src/components/import/import-result-summary.tsx`
- `packages/types/src/onboarding/csv-import-result.ts`

### Libraries & Versions
- BullMQ for async import jobs (`queue:csv-import`)
- Prisma v7 for user creation and group member assignment
- MinIO for result report storage
- Zod 4.3.6 for payload validation
- TanStack Query 5.96.2 for polling
- shadcn/ui Progress, Badge, Accordion components

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **Sync/async split**: ≤100 rows sync (201), >100 rows async via BullMQ (202)
- **Consent requirement**: cross-tenant users get invite, NOT auto-linked
- **Audit trail**: every import recorded in audit log (Story 9.3)
- **Domain events**: `onboarding.csv_import.completed` for analytics

### Dependencies
- Story 10.3 — provides validated CSV data
- Epic 4 — groups API, member management, invite mechanism (Story 4.3)
- Story 9.3 — audit log integration
- Story 8.7 — async job/polling pattern reference

### Project Structure Notes
- Import service and worker in onboarding module
- Shares import components directory with Story 10.3
- Reuses onboarding module from Story 10.1

### References
- `_bmad-output/planning-artifacts/epics/epic-10.md` — Epic 10 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
