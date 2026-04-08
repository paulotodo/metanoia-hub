## Epic 9: Privacidade, LGPD & Compliance

Exportação de dados pessoais (portabilidade LGPD), solicitação de exclusão (eliminação LGPD), base legal documentada por operação de tratamento, e log de auditoria imutável de ações administrativas. Audit é cross-cutting concern via NestJS interceptor — append-only, nem Super Admin pode deletar registros.

### Story 9.1: Exportação de Dados Pessoais (Portabilidade LGPD)

As a Participante,
I want to request an export of all my personal data held by the platform,
So that I can exercise my LGPD right to data portability and review what information is stored about me.

**Acceptance Criteria:**

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

### Story 9.2: Exclusão de Dados Pessoais (Eliminação LGPD)

As a Participante,
I want to request the deletion of all my personal data from the platform,
So that I can exercise my LGPD right to data elimination.

**Acceptance Criteria:**

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

### Story 9.3: Log de Auditoria Imutável

As a Super Admin,
I want an immutable audit log of all administrative actions across the platform,
So that I can trace who did what, when, and from where for compliance and security investigations.

**Acceptance Criteria:**

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

### Story 9.4: Base Legal & Histórico de Consentimento

As a Participante,
I want to see which legal bases justify the processing of my personal data and review my consent history,
So that I can understand how my data is used and exercise informed control over it.

**Acceptance Criteria:**

**Given** the platform processes personal data
**When** any data processing operation is defined in the system
**Then** each operation has a documented legal basis stored in a `DataProcessingRegistry` table with:
  - `id` (UUID v7), `operationName` (e.g., "trail_progress_tracking", "meeting_attendance", "pastoral_care_notes"), `legalBasis` (enum: `consent`, `legitimate_interest`, `legal_obligation`, `contract_execution`), `purpose` (human-readable PT-BR description), `dataCategories` (array: e.g., ["attendance", "engagement", "personal_profile"]), `retentionPeriod`, `thirdPartySharing` (array of third parties with whom data is shared, e.g., ["Keycloak (autenticação)", "LiveKit (vídeo)", "MinIO/S3 (armazenamento)", "Sentry (erros)"] — LGPD Art. 9 transparency requirement), `createdAt`, `updatedAt`
**And** this registry is seeded via migration with all current data processing operations (NFR-L5)
**And** the registry is accessible via `GET /api/v1/privacy/data-processing` (public endpoint, no auth required — transparency)

**Given** I am authenticated as any user
**When** I navigate to my profile settings under "Privacidade & Consentimento"
**Then** I see a consent history section with:
  - List of consent records: "Termos de Uso" (date accepted), "Política de Privacidade" (date accepted), feature-specific consents (e.g., "Monitoramento de foco em reuniões")
  - Status badge per item: ✅ Aceito (with date) or ⏳ Pendente
  - Link to the full text of each document
**And** I can withdraw optional consents (e.g., focus monitoring) via a toggle — mandatory consents (terms of use) cannot be withdrawn without account deletion

**Given** a consent is withdrawn
**When** I toggle off an optional consent
**Then** the system records the withdrawal in `ConsentRecord` table: `{ userId, tenantId, consentType, action: "withdrawn", timestamp }`
**And** the corresponding feature is immediately disabled for my account (e.g., focus monitoring stops being collected in my meetings)
**And** the withdrawal is recorded in the audit log
**And** historical data collected under the previous consent is NOT retroactively deleted (but stops being actively used for new calculations)
**And** a consent withdrawal integration test validates: withdraw focus monitoring consent → simulate a meeting (Epic 5) → verify focus data is NOT collected for this user during the meeting, while other participants' focus data IS collected normally

---

