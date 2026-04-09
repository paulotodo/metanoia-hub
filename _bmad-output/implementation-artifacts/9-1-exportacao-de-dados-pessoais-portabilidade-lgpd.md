# Story 9.1: Exportação de Dados Pessoais (Portabilidade LGPD)

Status: ready-for-dev

## Story

As a Participante,
I want to request an export of all my personal data held by the platform,
So that I can exercise my LGPD right to data portability and review what information is stored about me.

## Acceptance Criteria

**Given** I am authenticated as any user (Participante, Líder, Admin)
**When** I navigate to my profile settings and click "Exportar meus dados"
**Then** I can choose the export format: JSON (machine-readable) or PDF (human-readable)
**And** the request is submitted via `POST /api/v1/privacy/export` with payload `{ format: "json" | "pdf" }`
**And** the API returns 202 with `{ "data": { "jobId": "<uuid>", "status": "accepted", "estimatedCompletionHours": 24 } }`
**And** a BullMQ job is enqueued in `queue:privacy-export` with payload: `{ userId, allTenantIds, format, requestedAt }` — note: `allTenantIds` includes ALL tenants the user belongs to (FR03 multi-tenant), not just the active tenant. LGPD portability requires ALL personal data regardless of tenant context

**Given** the export job is processing
**When** the BullMQ worker executes
**Then** it iterates over ALL tenants the user belongs to (`allTenantIds`) and collects personal data per tenant: profile info, group memberships, trail progress, meeting attendance, lesson progress, pastoral care actions (about me), consent records, audit events (by me)
**And** the worker uses a privileged mode that temporarily overrides RLS to iterate across tenants — each tenant's data is collected in a separate section of the export file, clearly labeled
**And** data from each module is collected via dedicated `exportUserData(userId, tenantId)` methods on each service — NOT by querying tables directly (respects module boundaries)
**And** a data completeness integration test validates: create a user with data in ALL tables (profile, groups, trails, meetings, progress, pastoral, consents) → export → verify ALL data is present. If a new table is added without updating `exportUserData()`, this test FAILS
**And** boundary test: a new user with zero activity generates a valid export file (empty sections, not an error)
**And** the export file is stored in MinIO under `exports/global/{userId}/{timestamp}.{format}` with storage policy `temporary` (auto-deleted after 30 days — enough time for user to download multiple times)
**And** a signed download URL (valid 48 hours, renewable) is generated via `storage.service.getSignedUrl()`

**Given** the export is complete
**When** the file is ready
**Then** the user is notified via in-app toast on next page load (polling `GET /api/v1/privacy/export/:jobId` — same pattern as Story 8.7 report jobs)
**And** an e-mail notification is sent when the export is ready — using BullMQ job in `queue:notifications` with stub implementation (console.log in dev, same pattern as Epic 4 Story 4.3 convites). E-mail includes a link to the download page (NOT the signed URL directly, for security)
**And** the download link is available in the profile settings page under "Meus Exports"
**And** the export is completed within 72 hours of the request (NFR-L1) — the job has a deadline check; if not completed in 48h, it is escalated to a high-priority queue

**Given** the export job fails
**When** the worker encounters an error
**Then** the job retries 3x with exponential backoff (1m, 5m, 30m)
**And** after 3 failures, the job is moved to `queue:privacy-export:failed` and an alert is sent to Sentry with `{ userId, tenantId, error }`
**And** the user sees status "Erro na exportação — tente novamente ou entre em contato com o suporte"

**Given** a user requests multiple exports
**When** an export is already in progress
**Then** the API returns 409 with message: "Já existe uma exportação em andamento. Aguarde a conclusão antes de solicitar outra."

## Tasks / Subtasks

- [ ] Task 1: Create Privacy module structure in NestJS (AC: all)
  - [ ] 1.1 Create `apps/api/src/modules/privacy/privacy.module.ts` with NestJS module definition
  - [ ] 1.2 Create `apps/api/src/modules/privacy/privacy.controller.ts` with REST endpoints
  - [ ] 1.3 Create `apps/api/src/modules/privacy/privacy.service.ts` (supporting subdomain — direct Prisma, no repository)
  - [ ] 1.4 Register module in `app.module.ts`

- [ ] Task 2: Define Zod schemas for privacy export (AC: #1)
  - [ ] 2.1 Create `packages/types/src/privacy/export.ts` with `PrivacyExportRequestSchema` (`{ format: z.enum(["json", "pdf"]) }`)
  - [ ] 2.2 Create `PrivacyExportResponseSchema` with jobId, status, estimatedCompletionHours
  - [ ] 2.3 Add snapshot tests for schemas

- [ ] Task 3: Implement `POST /api/v1/privacy/export` endpoint (AC: #1)
  - [ ] 3.1 Validate request body via `ZodValidationPipe`
  - [ ] 3.2 Check for existing in-progress export (return 409 if exists)
  - [ ] 3.3 Create export job record in DB with status `accepted`
  - [ ] 3.4 Enqueue BullMQ job in `queue:privacy-export` with `{ userId, allTenantIds, format, requestedAt }`
  - [ ] 3.5 Return 202 with job metadata

- [ ] Task 4: Implement BullMQ export worker (AC: #2)
  - [ ] 4.1 Create `apps/api/src/modules/privacy/workers/privacy-export.processor.ts`
  - [ ] 4.2 Implement privileged mode to iterate across all user tenants (bypass RLS temporarily)
  - [ ] 4.3 Collect data via dedicated `exportUserData(userId, tenantId)` methods per module service
  - [ ] 4.4 Generate JSON export with per-tenant sections
  - [ ] 4.5 Generate PDF export (use `pdfkit` or similar)
  - [ ] 4.6 Upload to MinIO under `exports/global/{userId}/{timestamp}.{format}` with `temporary` storage policy
  - [ ] 4.7 Generate signed download URL (48h validity) via `storage.service.getSignedUrl()`
  - [ ] 4.8 Configure retry: 3x with exponential backoff (1m, 5m, 30m)
  - [ ] 4.9 On failure after retries, move to `queue:privacy-export:failed` and alert Sentry

- [ ] Task 5: Implement `exportUserData()` methods on each module service (AC: #2)
  - [ ] 5.1 `users.service.exportUserData(userId, tenantId)` — profile info
  - [ ] 5.2 `groups.service.exportUserData(userId, tenantId)` — group memberships
  - [ ] 5.3 `trails.service.exportUserData(userId, tenantId)` — trail progress
  - [ ] 5.4 `meetings.service.exportUserData(userId, tenantId)` — meeting attendance
  - [ ] 5.5 `pastoral.service.exportUserData(userId, tenantId)` — pastoral care actions
  - [ ] 5.6 `privacy.service.exportConsentData(userId, tenantId)` — consent records
  - [ ] 5.7 `audit.service.exportUserData(userId, tenantId)` — audit events by user

- [ ] Task 6: Implement `GET /api/v1/privacy/export/:jobId` polling endpoint (AC: #3)
  - [ ] 6.1 Return job status: `accepted`, `processing`, `completed`, `failed`
  - [ ] 6.2 Include download URL when status is `completed`

- [ ] Task 7: Implement notification on export completion (AC: #3)
  - [ ] 7.1 Enqueue email notification in `queue:notifications` (stub: console.log in dev)
  - [ ] 7.2 Email links to download page, not signed URL directly

- [ ] Task 8: Implement deadline escalation (AC: #3)
  - [ ] 8.1 Add deadline check: if not completed in 48h, escalate to high-priority queue
  - [ ] 8.2 Ensure completion within 72h (NFR-L1)

- [ ] Task 9: Build frontend UI for export request (AC: #1, #3)
  - [ ] 9.1 Add "Exportar meus dados" button in profile settings (`apps/web/src/app/(authenticated)/settings/privacy/page.tsx`)
  - [ ] 9.2 Format selection dialog (JSON/PDF)
  - [ ] 9.3 "Meus Exports" section showing export history with status and download links
  - [ ] 9.4 Polling mechanism for in-progress exports (TanStack Query with refetchInterval)

- [ ] Task 10: Write tests (AC: all)
  - [ ] 10.1 Unit tests for privacy.service (`*.spec.ts` co-located)
  - [ ] 10.2 Unit tests for export worker processor
  - [ ] 10.3 Data completeness integration test: user with data in ALL tables → export → verify ALL present
  - [ ] 10.4 Boundary test: new user with zero activity → valid export (empty sections)
  - [ ] 10.5 409 conflict test: duplicate export request
  - [ ] 10.6 Retry/failure test: simulate worker error → verify 3 retries → Sentry alert
  - [ ] 10.7 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/privacy/` — new module directory
- `apps/api/src/modules/privacy/privacy.module.ts`
- `apps/api/src/modules/privacy/privacy.controller.ts`
- `apps/api/src/modules/privacy/privacy.service.ts`
- `apps/api/src/modules/privacy/workers/privacy-export.processor.ts`
- `packages/types/src/privacy/export.ts` — Zod schemas
- `apps/web/src/app/(authenticated)/settings/privacy/page.tsx` — UI

### Libraries & Versions
- BullMQ (already in stack) for job queue `queue:privacy-export`
- MinIO client for file storage
- `pdfkit` or equivalent for PDF generation
- Zod 4.3.6 for validation schemas
- TanStack Query 5.96.2 for polling on frontend

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Pattern
- Privacy is a **supporting subdomain** — uses Prisma directly, no repository pattern
- Export worker must use **privileged mode** to bypass RLS and iterate across tenants
- Data collection must respect **module boundaries** via `exportUserData()` methods
- Async job pattern follows Story 8.7 (BullMQ → polling → signed URL)
- Email notification follows Epic 4 Story 4.3 stub pattern

### Dependencies
- Epic 4 (groups), Epic 5 (meetings), Epic 7 (pastoral), Epic 8 (trails) — for `exportUserData()` methods
- Story 8.7 — async job/polling pattern reference
- Story 4.3 — email notification stub pattern
- MinIO storage service must be available

### Project Structure Notes
- Module at `apps/api/src/modules/privacy/` following bounded context organization
- Shared types at `packages/types/src/privacy/`
- Frontend pages under `apps/web/src/app/(authenticated)/settings/privacy/`

### References
- `_bmad-output/planning-artifacts/epics/epic-09.md` — Epic 9 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
