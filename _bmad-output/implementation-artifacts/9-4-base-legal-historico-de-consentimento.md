# Story 9.4: Base Legal & Histórico de Consentimento

Status: ready-for-dev

## Story

As a Participante,
I want to see which legal bases justify the processing of my personal data and review my consent history,
So that I can understand how my data is used and exercise informed control over it.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Create Prisma schema for DataProcessingRegistry (AC: #1)
  - [ ] 1.1 Add `DataProcessingRegistry` model: `id` (UUID v7), `operationName`, `legalBasis` (enum), `purpose` (PT-BR), `dataCategories` (String[]), `retentionPeriod`, `thirdPartySharing` (String[]), `createdAt`, `updatedAt`
  - [ ] 1.2 Add `@@map("data_processing_registry")` and column mappings
  - [ ] 1.3 Create migration
  - [ ] 1.4 Note: this table is global (no tenant_id) — it's a platform-wide registry

- [ ] Task 2: Create Prisma schema for ConsentRecord (AC: #2, #3)
  - [ ] 2.1 Add `ConsentRecord` model: `id` (UUID v7), `userId`, `tenantId`, `consentType` (enum: `terms_of_use`, `privacy_policy`, `focus_monitoring`, etc.), `action` (enum: `accepted`, `withdrawn`), `documentVersion`, `timestamp`
  - [ ] 2.2 Add `@@map("consent_records")` and column mappings
  - [ ] 2.3 Create migration with RLS policies (tenant_id scoped)
  - [ ] 2.4 Write RLS isolation tests

- [ ] Task 3: Seed DataProcessingRegistry (AC: #1)
  - [ ] 3.1 Create seed data in `prisma/seed.ts` for all current operations:
    - `trail_progress_tracking` — legitimate_interest
    - `meeting_attendance` — contract_execution
    - `pastoral_care_notes` — legitimate_interest
    - `focus_monitoring` — consent
    - `user_profile` — contract_execution
    - `group_membership` — contract_execution
    - `audit_logging` — legal_obligation
  - [ ] 3.2 Include third-party sharing for each: Keycloak, LiveKit, MinIO/S3, Sentry
  - [ ] 3.3 Ensure seed is idempotent (upsert)

- [ ] Task 4: Define Zod schemas (AC: all)
  - [ ] 4.1 Create `packages/types/src/privacy/consent.ts` with schemas
  - [ ] 4.2 `DataProcessingRegistrySchema` for registry items
  - [ ] 4.3 `ConsentRecordSchema` for consent history
  - [ ] 4.4 `ConsentWithdrawalSchema` for toggle action
  - [ ] 4.5 Add snapshot tests

- [ ] Task 5: Implement `GET /api/v1/privacy/data-processing` (AC: #1)
  - [ ] 5.1 Public endpoint (no auth required — LGPD transparency)
  - [ ] 5.2 Return all active data processing operations with legal bases
  - [ ] 5.3 Response: `{ data: DataProcessingRegistryItem[] }`

- [ ] Task 6: Implement consent history endpoints (AC: #2)
  - [ ] 6.1 `GET /api/v1/privacy/consents` — user's consent history (auth required)
  - [ ] 6.2 Return consent records with status badges and document links
  - [ ] 6.3 Group by consentType, show latest action per type

- [ ] Task 7: Implement consent withdrawal (AC: #3)
  - [ ] 7.1 `PATCH /api/v1/privacy/consents/:consentType` with `{ action: "withdrawn" | "accepted" }`
  - [ ] 7.2 Block withdrawal of mandatory consents (terms_of_use, privacy_policy) — return 422
  - [ ] 7.3 Record withdrawal in ConsentRecord table
  - [ ] 7.4 Immediately disable corresponding feature for user
  - [ ] 7.5 Record in audit log (Story 9.3)
  - [ ] 7.6 Do NOT retroactively delete historical data

- [ ] Task 8: Build frontend UI (AC: #2, #3)
  - [ ] 8.1 Create "Privacidade & Consentimento" section in profile settings
  - [ ] 8.2 Consent history list with status badges (✅ Aceito / ⏳ Pendente)
  - [ ] 8.3 Document links for terms/policies
  - [ ] 8.4 Toggle switches for optional consents (disabled for mandatory)
  - [ ] 8.5 Confirmation dialog on consent withdrawal
  - [ ] 8.6 Data processing registry viewer (accessible from privacy section)

- [ ] Task 9: Write tests (AC: all)
  - [ ] 9.1 Unit tests for consent service
  - [ ] 9.2 Public endpoint test: data-processing accessible without auth
  - [ ] 9.3 Consent withdrawal integration test: withdraw focus monitoring → meeting simulation → verify no focus data collected
  - [ ] 9.4 Mandatory consent test: cannot withdraw terms_of_use → 422
  - [ ] 9.5 Historical data preservation test: withdrawal does not delete old data
  - [ ] 9.6 RLS isolation tests for ConsentRecord
  - [ ] 9.7 Seed idempotency test
  - [ ] 9.8 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/privacy/privacy.controller.ts` — add consent endpoints
- `apps/api/src/modules/privacy/privacy.service.ts` — consent logic
- `packages/types/src/privacy/consent.ts` — Zod schemas
- `apps/web/src/app/(authenticated)/settings/privacy/page.tsx` — consent UI
- `prisma/schema.prisma` — DataProcessingRegistry, ConsentRecord models
- `prisma/seed.ts` — registry seed data

### Libraries & Versions
- Prisma v7 for direct database access
- Zod 4.3.6 for schema validation
- shadcn/ui Toggle, Badge, AlertDialog components
- TanStack Query 5.96.2 for data fetching

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- DataProcessingRegistry is **global** (no tenant_id) — platform-wide transparency
- ConsentRecord is **tenant-scoped** with RLS
- Consent withdrawal is **forward-only** — historical data preserved
- `GET /api/v1/privacy/data-processing` is **public** (no auth) per LGPD Art. 9
- Feature disabling on consent withdrawal must be **immediate** (no cache delay)

### Dependencies
- Story 9.3 — audit log for recording consent changes
- Epic 5 — focus monitoring feature (consent withdrawal disables it)
- Epic 11 (Story 11.3) — feature toggles interact with consent (toggle enabled but user withdrew consent = feature OFF for that user)

### Project Structure Notes
- Reuses privacy module from Stories 9.1/9.2
- DataProcessingRegistry seed in `prisma/seed.ts`
- Consent types should be extensible for future features

### References
- `_bmad-output/planning-artifacts/epics/epic-09.md` — Epic 9 source
- `docs/project-context.md` — 47 implementation rules (esp. NFR-L4, NFR-L5)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
