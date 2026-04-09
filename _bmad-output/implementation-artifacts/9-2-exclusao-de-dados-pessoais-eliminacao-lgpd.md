# Story 9.2: Exclusão de Dados Pessoais (Eliminação LGPD)

Status: ready-for-dev

## Story

As a Participante,
I want to request the deletion of all my personal data from the platform,
So that I can exercise my LGPD right to data elimination.

## Acceptance Criteria

**Given** I am authenticated as a user with `Líder` role and I lead active groups
**When** I attempt to request account deletion
**Then** the system blocks the request and displays: "Você lidera {N} grupo(s) ativos. Transfira a liderança de todos os grupos antes de solicitar a exclusão da conta."
**And** a list of groups with "Transferir Liderança" links is shown
**And** deletion is only allowed after all leadership roles are transferred or groups are archived

**Given** I am authenticated as any user (with no blocking leadership roles)
**When** I navigate to my profile settings and click "Solicitar exclusão da minha conta"
**Then** an AlertDialog (destructive variant) is displayed explaining:
  - "Ao confirmar, seus dados pessoais serão removidos em até 15 dias úteis"
  - "Dados que não podem ser removidos: registros de auditoria (exigência legal) e dados agregados anonimizados"
  - "Esta ação é irreversível após o período de cancelamento de 7 dias"
**And** I must type "EXCLUIR" to confirm (preventing accidental deletion)

**Given** I confirm the deletion request
**When** the request is submitted via `POST /api/v1/privacy/deletion`
**Then** the API returns 202 with `{ "data": { "requestId": "<uuid>", "status": "pending", "cancellableUntil": "<ISO8601 date +7 days>", "deletionDeadline": "<ISO8601 date +30 days>" } }`
**And** if a deletion request already exists for this user, the API returns the existing request status (idempotent — no duplicate requests created)
**And** my account is immediately flagged as `deletion_pending` — I can still log in during the 7-day grace period
**And** a banner is shown on every page: "Sua conta será excluída em {days} dias. [Cancelar solicitação]"

**Given** the 7-day grace period has passed
**When** the scheduled BullMQ job in `queue:privacy-deletion` executes
**Then** personal data is soft-deleted across all modules: profile, group memberships, trail progress, meeting attendance, lesson progress, pastoral care notes (about me)
**And** any data created by the user DURING the grace period (after the deletion request) is included in the soft-delete scope — the job captures all records with `userId` regardless of creation date
**And** the user's account status changes to `deleted` and all active sessions/tokens are revoked (Keycloak session invalidation + Redis session keys cleanup)
**And** all Redis keys matching `*:{userId}:*` across all namespaces (`cache:*`, `rt:*`, `queue:*`, `rate:*`, `session:*`) are scanned and deleted to ensure no personal data remains in cache
**And** the user can no longer log in
**And** audit log entries are RETAINED but the user reference is anonymized: `userId` replaced with `anonymous-<hash>` (legal requirement — audit immutability)
**And** aggregated analytics data is RETAINED in anonymized form (no personal identifiers)

**Given** the hard-delete deadline approaches (30 days from request per NFR-L2)
**When** the final cleanup job runs
**Then** the hard-delete is executed within a database transaction — if ANY delete fails due to FK constraints or unexpected errors, the entire transaction rolls back and the data remains in `soft_deleted` state
**And** on rollback, a Sentry alert with high severity is triggered including the failing table/constraint name, and the DPO is notified for manual resolution
**And** on success, all soft-deleted personal data is permanently purged from PostgreSQL
**And** all user files in MinIO under the user's path are permanently deleted
**And** a cascade integration test validates: create user with data in ALL modules → execute full deletion pipeline → verify EACH table: personal data removed, audit entries anonymized, aggregated data preserved, Redis keys cleaned, MinIO files deleted
**And** a completion record is stored in the audit log: `{ eventType: "privacy.deletion.completed", anonymizedUserId, tenantId, completedAt }`
**And** the entire process completes within 30 days of the confirmed request (NFR-L2)

**Given** I want to cancel my deletion request during the grace period
**When** I click "Cancelar solicitação" and confirm
**Then** the request is cancelled via `DELETE /api/v1/privacy/deletion/:requestId`
**And** my account returns to normal status immediately
**And** the cancellation is recorded in the audit log

**Given** the deletion job fails
**When** the worker encounters an error during data removal
**Then** the job retries 3x with exponential backoff (1h, 4h, 12h) — longer intervals because deletion is destructive
**And** after 3 failures, Sentry alert is triggered with high severity and the DPO (Data Protection Officer) is notified
**And** the user's data remains in `deletion_pending` state (not partially deleted)

## Tasks / Subtasks

- [ ] Task 1: Create Prisma schema for deletion requests (AC: #3)
  - [ ] 1.1 Add `DeletionRequest` model: `id` (UUID v7), `userId`, `tenantId`, `status` (enum: `pending`, `grace_period`, `soft_deleted`, `hard_deleted`, `cancelled`), `cancellableUntil`, `deletionDeadline`, `createdAt`, `updatedAt`
  - [ ] 1.2 Add `deletionStatus` field on users table (`active`, `deletion_pending`, `deleted`)
  - [ ] 1.3 Create migration with RLS policies (tenant_id scoped)
  - [ ] 1.4 Write RLS isolation tests

- [ ] Task 2: Define Zod schemas (AC: #3)
  - [ ] 2.1 Create `packages/types/src/privacy/deletion.ts` with request/response schemas
  - [ ] 2.2 Add snapshot tests for schemas

- [ ] Task 3: Implement leadership check endpoint (AC: #1)
  - [ ] 3.1 Add `GET /api/v1/privacy/deletion/preflight` that checks for blocking leadership roles
  - [ ] 3.2 Return list of active groups the user leads with transfer links

- [ ] Task 4: Implement `POST /api/v1/privacy/deletion` endpoint (AC: #2, #3)
  - [ ] 4.1 Validate no blocking leadership roles (reuse preflight logic)
  - [ ] 4.2 Check for existing deletion request (idempotent return)
  - [ ] 4.3 Create DeletionRequest record with 7-day grace period
  - [ ] 4.4 Flag user account as `deletion_pending`
  - [ ] 4.5 Schedule BullMQ job in `queue:privacy-deletion` for after grace period
  - [ ] 4.6 Return 202 with request metadata

- [ ] Task 5: Implement `DELETE /api/v1/privacy/deletion/:requestId` cancellation (AC: #6)
  - [ ] 5.1 Validate request is within grace period
  - [ ] 5.2 Cancel deletion request, restore user status to `active`
  - [ ] 5.3 Remove scheduled BullMQ job
  - [ ] 5.4 Record cancellation in audit log

- [ ] Task 6: Implement soft-delete BullMQ worker (AC: #4)
  - [ ] 6.1 Create `apps/api/src/modules/privacy/workers/privacy-deletion.processor.ts`
  - [ ] 6.2 Soft-delete personal data across all modules (profile, groups, trails, meetings, pastoral)
  - [ ] 6.3 Revoke Keycloak sessions and clean Redis keys (`*:{userId}:*` across all namespaces)
  - [ ] 6.4 Anonymize audit log entries: replace `userId` with `anonymous-<hash>`
  - [ ] 6.5 Preserve anonymized aggregated analytics
  - [ ] 6.6 Configure retry: 3x with exponential backoff (1h, 4h, 12h)
  - [ ] 6.7 On failure, alert Sentry with high severity, notify DPO

- [ ] Task 7: Implement hard-delete scheduled job (AC: #5)
  - [ ] 7.1 Create scheduled job that runs for records past 30-day deadline
  - [ ] 7.2 Execute hard-delete within database transaction (rollback on any failure)
  - [ ] 7.3 On rollback: Sentry alert + DPO notification with failing table/constraint
  - [ ] 7.4 On success: purge from PostgreSQL, delete MinIO files
  - [ ] 7.5 Store completion audit record: `privacy.deletion.completed`

- [ ] Task 8: Build frontend UI (AC: #1, #2, #3, #6)
  - [ ] 8.1 Leadership check screen with group transfer links
  - [ ] 8.2 AlertDialog (destructive variant) with LGPD explanation and "EXCLUIR" confirmation
  - [ ] 8.3 Global banner for `deletion_pending` users with cancel link and countdown
  - [ ] 8.4 Cancel confirmation dialog

- [ ] Task 9: Write tests (AC: all)
  - [ ] 9.1 Unit tests for privacy deletion service
  - [ ] 9.2 Leadership blocking test: user leads groups → deletion blocked
  - [ ] 9.3 Idempotent request test: duplicate requests return same response
  - [ ] 9.4 Grace period cancellation test
  - [ ] 9.5 Cascade integration test: full pipeline (create user → delete → verify all tables)
  - [ ] 9.6 Audit anonymization test: userId replaced with anonymous hash
  - [ ] 9.7 Redis cleanup test: verify all user keys removed
  - [ ] 9.8 Hard-delete transaction rollback test
  - [ ] 9.9 RLS isolation tests for DeletionRequest table

## Dev Notes

### File Paths
- `apps/api/src/modules/privacy/privacy.controller.ts` — add deletion endpoints
- `apps/api/src/modules/privacy/privacy.service.ts` — deletion logic
- `apps/api/src/modules/privacy/workers/privacy-deletion.processor.ts` — deletion worker
- `packages/types/src/privacy/deletion.ts` — Zod schemas
- `apps/web/src/app/(authenticated)/settings/privacy/page.tsx` — deletion UI
- `apps/web/src/components/banners/deletion-pending-banner.tsx` — global banner
- `prisma/migrations/` — DeletionRequest model migration

### Libraries & Versions
- BullMQ for `queue:privacy-deletion` jobs
- Keycloak Admin Client for session invalidation
- Redis client for key scanning/deletion
- MinIO client for file deletion
- Zod 4.3.6, shadcn/ui AlertDialog component

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- Deletion is a **multi-phase process**: grace period (7d) → soft-delete → hard-delete (30d)
- Hard-delete MUST be transactional — partial deletion is unacceptable
- Audit log entries are NEVER deleted — only anonymized (legal requirement)
- Redis cleanup must cover ALL namespaces: `cache:*`, `rt:*`, `queue:*`, `rate:*`, `session:*`

### Dependencies
- Story 9.1 — shares privacy module structure
- Story 9.3 — audit log for recording deletion events
- Epic 4 (groups) — leadership transfer check
- Keycloak — session invalidation
- MinIO — file deletion

### Project Structure Notes
- Reuses privacy module from Story 9.1
- Global banner component at `apps/web/src/components/banners/`
- Deletion worker co-located with export worker in `workers/` directory

### References
- `_bmad-output/planning-artifacts/epics/epic-09.md` — Epic 9 source
- `docs/project-context.md` — 47 implementation rules (esp. LGPD NFR-L2)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
