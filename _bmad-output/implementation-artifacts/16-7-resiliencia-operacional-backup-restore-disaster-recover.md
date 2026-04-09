# Story 16.7: Resiliência Operacional — Backup, Restore & Disaster Recovery (NFR-C3, NFR-C5-C7)

Status: ready-for-dev

## Story

As a Super Admin or operations engineer,
I want documented and tested backup, restore, and disaster recovery procedures,
So that the platform can recover from data loss or infrastructure failures within acceptable RPO/RTO targets.

## Acceptance Criteria

**Given** a post-mortem process is needed (NFR-C3)
**When** an incident causes downtime > 30 minutes
**Then** a post-mortem template exists at `docs/operations/post-mortem-template.md` with sections:
  - Incident summary (what happened, duration, impact scope)
  - Timeline (detection → response → mitigation → resolution)
  - Root cause analysis (5 Whys or Fishbone)
  - Action items with owners and deadlines
  - Lessons learned
**And** the template is pre-filled with metadata fields: `incident_id`, `date`, `duration`, `severity` (P1-P4), `affected_tenants`
**And** completed post-mortems are stored in `docs/operations/post-mortems/` with naming convention `YYYY-MM-DD-incident-slug.md`

**Given** MinIO/S3 storage is configured (NFR-C5)
**When** objects are stored
**Then** bucket versioning is enabled for buckets containing: user uploads, content media, subtitle files, exported reports
**And** a lifecycle policy retains versions for 90 days, then deletes non-current versions
**And** versioning is NOT enabled for temporary/cache buckets (e.g., `tmp-exports`) to avoid unnecessary storage costs
**And** the versioning configuration is defined in IaC (Terraform/Pulumi or Docker Compose for dev) — not manual bucket settings

**Given** a database restore needs to be performed (NFR-C6)
**When** the restore procedure is executed
**Then** a restore script exists at `scripts/db-restore.sh` that:
  - Takes parameters: `backup_file`, `target_db`, `--dry-run` (validates without executing)
  - Validates backup integrity (checksum verification)
  - Restores to a temporary database first (not directly to production)
  - Runs a verification query set (`scripts/db-verify-restore.sql`): row counts for critical tables, latest timestamp sanity check, RLS policies present
  - Only swaps to production after verification passes
**And** a restore test is executed and documented at least once before Release 1b gate, using a seed database of at least 1GB (representative volume: ~5 tenants, ~1000 users, ~50 groups, ~200 trails with content) to validate performance under realistic data volume
**And** the restore script checks available disk space before starting (requires 2x backup size free) and fails with a clear error if insufficient: "Espaço em disco insuficiente. Necessário: {required}GB, disponível: {available}GB"
**And** the test results are stored in `docs/operations/restore-test-results/YYYY-MM-DD-restore-test.md` including: backup size, restore duration, verification results, disk usage

**Given** a disaster recovery scenario occurs (NFR-C7)
**When** the operations team needs to recover the platform
**Then** a DR runbook exists at `docs/operations/disaster-recovery-runbook.md` covering:
  - **Scenario 1: Database corruption/loss** — restore from backup (RPO ≤ 1h R1, ≤ 15min R2, RTO ≤ 4h)
  - **Scenario 2: Object storage loss** — restore from versioned objects + backups (RPO ≤ 24h, RTO ≤ 8h)
  - **Scenario 3: Full infrastructure failure** — rebuild from IaC + restore data (RTO ≤ 8h)
  - **Scenario 4: Keycloak corruption** — realm export/import procedure
  - **Scenario 5: Redis data loss** — cache rebuild strategy (ephemeral data, no backup needed, but document warm-up procedure)
**And** each scenario includes: step-by-step commands, expected duration, verification steps, rollback procedure
**And** the runbook is tested at least once before Release 1b gate (tabletop exercise or actual DR drill)
**And** test results are documented in `docs/operations/dr-test-results/YYYY-MM-DD-dr-drill.md`

**Given** a BullMQ scheduled job monitors backup health
**When** it runs daily at 03:00 UTC
**Then** it first checks if a backup is currently in progress (via a `backup_status` key in Redis: `{ status: 'running' | 'completed' | 'failed', started_at, completed_at }`)
**And** if a backup is in progress, it reports "backup em andamento" (NOT failure) and skips the age check
**And** if no backup is in progress, it verifies: latest PostgreSQL backup exists and is < 25h old, latest MinIO backup exists, backup file size is within expected range (not empty/truncated)
**And** if any check fails, a `system.backup.health-failed` domain event is emitted and Super Admins are notified: "⚠️ Verificação de backup falhou: {details}"
**And** the job runs as a BullMQ repeatable job (consistent with Epic 14 health check pattern)

**Given** the restore script needs ongoing validation (not just a one-time gate)
**When** CI runs monthly (or on any migration that alters schema)
**Then** a CI job executes `scripts/db-restore.sh --dry-run` against a fresh backup to validate the script still works with the current schema
**And** if the dry-run fails, the CI pipeline reports a warning (not blocking, but visible) and creates a notification for the operations team
**And** full restore tests (non-dry-run) are executed quarterly and documented

## Tasks / Subtasks

- [ ] Task 1: Create post-mortem template (AC: #1)
  - [ ] Write `docs/operations/post-mortem-template.md` with all sections
  - [ ] Pre-fill metadata fields: incident_id, date, duration, severity, affected_tenants
  - [ ] Create `docs/operations/post-mortems/` directory with `.gitkeep`
- [ ] Task 2: Configure MinIO bucket versioning (AC: #2)
  - [ ] Enable versioning for: user uploads, content media, subtitles, exported reports buckets
  - [ ] Configure 90-day lifecycle policy for non-current versions
  - [ ] Exclude temporary/cache buckets from versioning
  - [ ] Define in IaC (Terraform/Docker Compose)
- [ ] Task 3: Create database restore script (AC: #3)
  - [ ] Write `scripts/db-restore.sh` with parameters: backup_file, target_db, --dry-run
  - [ ] Implement checksum verification
  - [ ] Restore to temporary database first
  - [ ] Create `scripts/db-verify-restore.sql`: row counts, timestamp checks, RLS policy verification
  - [ ] Swap to production only after verification
  - [ ] Add disk space check (require 2x backup size)
- [ ] Task 4: Create DR runbook (AC: #4)
  - [ ] Write `docs/operations/disaster-recovery-runbook.md`
  - [ ] Document all 5 scenarios with step-by-step commands
  - [ ] Include RPO/RTO targets per scenario
  - [ ] Include verification steps and rollback procedures
- [ ] Task 5: Implement BullMQ backup health monitoring job (AC: #5)
  - [ ] Create repeatable job: daily at 03:00 UTC
  - [ ] Check `backup_status` Redis key for in-progress backups
  - [ ] Verify: latest PG backup < 25h, MinIO backup exists, file size in range
  - [ ] Emit `system.backup.health-failed` domain event on failure
  - [ ] Notify Super Admins via Epic 14 notification system
- [ ] Task 6: Set up CI restore validation (AC: #6)
  - [ ] Create CI job for monthly `scripts/db-restore.sh --dry-run`
  - [ ] Trigger on schema-altering migrations
  - [ ] Report warning (not blocking) on failure
  - [ ] Notify operations team
- [ ] Task 7: Execute and document restore test (AC: #3)
  - [ ] Create seed database >= 1GB (~5 tenants, ~1000 users, ~50 groups, ~200 trails)
  - [ ] Execute restore test
  - [ ] Document in `docs/operations/restore-test-results/`
- [ ] Task 8: Write tests (AC: all)
  - [ ] Post-mortem template test: verify renders with all sections
  - [ ] Versioning test: upload → new version → verify both exist → lifecycle deletes after 90 days (mock)
  - [ ] Restore script test: create backup (≥ 1GB seed) → corrupt DB → dry-run → actual restore → verify integrity → verify disk space check
  - [ ] DR runbook test: tabletop walkthrough of each scenario
  - [ ] Backup health job: mock backup present → success; backup missing → alert; backup in progress → "em andamento" (not false alarm)
  - [ ] CI dry-run test: verify against current schema
  - [ ] Security: restore script requires Super Admin credentials

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### RPO/RTO Targets
| Scenario | RPO | RTO |
|----------|-----|-----|
| DB corruption (R1) | ≤ 1h | ≤ 4h |
| DB corruption (R2) | ≤ 15min | ≤ 4h |
| Object storage loss | ≤ 24h | ≤ 8h |
| Full infra failure | — | ≤ 8h |

### Epic 16 DoD (Transversal)
- Each story must include operational documentation (runbook or section in existing docs)
- Describe: how to monitor, how to diagnose failures, how to revert

### Dependencies
- Epic 14 (notification system — for Super Admin alerts)
- Epic 1 (infra base — Docker Compose, PostgreSQL, MinIO, Redis)

### Project Structure Notes
- Scripts: `scripts/db-restore.sh`, `scripts/db-verify-restore.sql`
- Docs: `docs/operations/post-mortem-template.md`
- Docs: `docs/operations/disaster-recovery-runbook.md`
- Docs: `docs/operations/post-mortems/` (incident records)
- Docs: `docs/operations/restore-test-results/`
- Docs: `docs/operations/dr-test-results/`
- IaC: `infra/terraform/` or `docker-compose.yml` (bucket versioning)
- BullMQ: `apps/api/src/modules/admin/backup/backup-health.processor.ts`
- CI: `.github/workflows/restore-validation.yml`
- Redis key: `backup_status`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-16.md` (Story 16.7)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
