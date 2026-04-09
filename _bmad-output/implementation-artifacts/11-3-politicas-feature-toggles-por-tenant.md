# Story 11.3: Políticas & Feature Toggles por Tenant

Status: ready-for-dev

## Story

As a Admin Tenant,
I want to configure tenant-specific policies and feature toggles,
So that I can enable or disable features like focus monitoring and mandatory camera according to my church's pastoral approach.

## Acceptance Criteria

**Given** I am an Admin Tenant
**When** I navigate to Settings > "Políticas e Funcionalidades"
**Then** I see a list of configurable feature toggles, each with:
  - Toggle name (pastoral vocabulary from `vocabulary.ts`), description, current state (on/off)
  - Tier availability badge: if a feature requires Pro/Enterprise, the toggle shows "Requer plano Pro" and is disabled on Free

**Given** the following feature toggles exist
**When** the configuration page loads
**Then** the toggles include (but are not limited to):
  - `focusMonitoring` — "Indicador de foco em reuniões" (default: OFF for new tenants — NFR-L4). Tracks tab visibility during meetings
  - `mandatoryCamera` — "Câmera obrigatória em reuniões" (default: OFF). Requires participants to have camera on
  - `sequentialTrailAccess` — "Acesso sequencial padrão em trilhas" (default: OFF). New trails default to sequential mode
  - `autoPresenceTracking` — "Registro automático de presença" (default: ON). Tracks meeting attendance automatically
  - `expressMode` — "Modo Express" (default: ON for new tenants). Simplifies UI by hiding advanced features. Transition to Advanced Mode via this toggle — system suggests but never auto-transitions (per PRD decision)
**And** toggles are stored in a `TenantPolicies` table: `tenantId` (unique FK), `policies` (JSONB with all toggle values)
**And** default values are defined in code and applied when no tenant-specific config exists (convention over configuration)

**Given** I toggle a feature
**When** I change `focusMonitoring` from OFF to ON
**Then** the change is saved via `PATCH /api/v1/tenants/current/policies`
**And** the change takes effect immediately for all users in my tenant (no restart required)
**And** the Redis cache uses write-through: new policies are WRITTEN to `cache:policies:{tenantId}` with an incremented `policyVersion` counter. The frontend compares `policyVersion` (returned in API response header `X-Policy-Version`) against its cached version — on mismatch, TanStack Query invalidates the policies cache and refetches
**And** the change is recorded in the audit log (Epic 9) with `previousState` and `newState`
**And** if the feature requires a higher plan tier, the API returns 403 with: "Esta funcionalidade requer o plano {planName}. [Ver upgrade]"

**Given** a feature toggle affects user privacy (e.g., `focusMonitoring`)
**When** the toggle is enabled
**Then** participants are notified via the transparency banner mechanism from Epic 5 (FR50): "Seu líder ativou o indicador de foco nas reuniões"
**And** participants who have withdrawn consent for this feature (Epic 9, Story 9.4) are exempt — the feature is NOT activated for them regardless of the toggle
**And** a consent interaction test validates: enable `focusMonitoring` toggle → user who withdrew consent → verify feature stays OFF for that specific user while active for others in the same tenant

## Tasks / Subtasks

- [ ] Task 1: Create TenantPolicies Prisma schema (AC: #1, #2)
  - [ ] 1.1 Add `TenantPolicies` model: `id` (UUID v7), `tenantId` (unique FK), `policies` (JSONB), `policyVersion` (integer, default: 1), `createdAt`, `updatedAt`
  - [ ] 1.2 Add `@@map("tenant_policies")` and column mappings
  - [ ] 1.3 Create migration with RLS policies (tenant_id scoped)
  - [ ] 1.4 Write RLS isolation tests

- [ ] Task 2: Define default policies in code (AC: #2)
  - [ ] 2.1 Create `apps/api/src/modules/policies/defaults/policy-defaults.ts`
  - [ ] 2.2 Define all toggles with default values:
    - `focusMonitoring: false` (NFR-L4)
    - `mandatoryCamera: false`
    - `sequentialTrailAccess: false`
    - `autoPresenceTracking: true`
    - `expressMode: true`
  - [ ] 2.3 Define tier requirements per toggle (which require Pro/Enterprise)

- [ ] Task 3: Define Zod schemas (AC: all)
  - [ ] 3.1 Create `packages/types/src/policies/tenant-policies.ts`
  - [ ] 3.2 `TenantPoliciesSchema` with all toggle fields as booleans
  - [ ] 3.3 `PolicyUpdateSchema` for partial updates
  - [ ] 3.4 Add snapshot tests

- [ ] Task 4: Create Policies module in NestJS (AC: #3)
  - [ ] 4.1 Create `apps/api/src/modules/policies/policies.module.ts`
  - [ ] 4.2 Create `apps/api/src/modules/policies/policies.service.ts` (supporting subdomain — direct Prisma)
  - [ ] 4.3 Implement `getPolicies(tenantId)`: read from DB → merge with defaults → return
  - [ ] 4.4 Create `apps/api/src/modules/policies/policies.controller.ts`

- [ ] Task 5: Implement `GET /api/v1/tenants/current/policies` (AC: #1)
  - [ ] 5.1 Return merged policies (DB + defaults)
  - [ ] 5.2 Include tier availability badge info per toggle
  - [ ] 5.3 Include `policyVersion` in response header `X-Policy-Version`
  - [ ] 5.4 Read from Redis cache first (`cache:policies:{tenantId}`)

- [ ] Task 6: Implement `PATCH /api/v1/tenants/current/policies` (AC: #3)
  - [ ] 6.1 Validate partial update payload via Zod
  - [ ] 6.2 Check plan tier for gated features → 403 if insufficient
  - [ ] 6.3 Save to DB, increment `policyVersion`
  - [ ] 6.4 Write-through to Redis: SET `cache:policies:{tenantId}` with new version
  - [ ] 6.5 Record in audit log with previousState/newState (Story 9.3)

- [ ] Task 7: Implement privacy notification for sensitive toggles (AC: #4)
  - [ ] 7.1 When `focusMonitoring` or similar privacy toggle is enabled, trigger transparency notification
  - [ ] 7.2 Use Epic 5 banner mechanism (FR50)
  - [ ] 7.3 Check consent status per user (Story 9.4): exempt users who withdrew consent

- [ ] Task 8: Build policies settings UI (AC: #1, #2, #3)
  - [ ] 8.1 Create `apps/web/src/app/(authenticated)/admin/settings/policies/page.tsx`
  - [ ] 8.2 Toggle list with pastoral vocabulary names and descriptions
  - [ ] 8.3 Tier availability badges (disabled toggles for plan-gated features)
  - [ ] 8.4 On/off switch for each toggle
  - [ ] 8.5 Confirmation dialog for privacy-affecting toggles
  - [ ] 8.6 Auto-reload on policyVersion mismatch (TanStack Query)

- [ ] Task 9: Implement policyVersion cache invalidation on frontend (AC: #3)
  - [ ] 9.1 Read `X-Policy-Version` header from API responses
  - [ ] 9.2 Compare with cached version in TanStack Query
  - [ ] 9.3 On mismatch, invalidate policies cache and refetch

- [ ] Task 10: Write tests (AC: all)
  - [ ] 10.1 Default policies test: no DB record → defaults applied
  - [ ] 10.2 Plan gating test: Free plan → enable Pro feature → 403
  - [ ] 10.3 Write-through cache test: update policy → Redis updated with new version
  - [ ] 10.4 Audit log test: previousState and newState recorded
  - [ ] 10.5 Consent interaction test: enable focusMonitoring → user withdrew consent → feature OFF for that user
  - [ ] 10.6 Privacy notification test: enable privacy toggle → participants notified
  - [ ] 10.7 policyVersion test: update → version incremented → frontend refetches
  - [ ] 10.8 RLS isolation tests
  - [ ] 10.9 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/policies/policies.module.ts`
- `apps/api/src/modules/policies/policies.service.ts`
- `apps/api/src/modules/policies/policies.controller.ts`
- `apps/api/src/modules/policies/defaults/policy-defaults.ts`
- `packages/types/src/policies/tenant-policies.ts`
- `apps/web/src/app/(authenticated)/admin/settings/policies/page.tsx`
- `prisma/schema.prisma` — TenantPolicies model

### Libraries & Versions
- Prisma v7 for database access (supporting subdomain — direct)
- Redis for write-through cache (`cache:policies:{tenantId}`)
- Zod 4.3.6 for schema validation
- shadcn/ui Switch, Badge components
- TanStack Query 5.96.2 for data fetching + policyVersion invalidation

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **Convention over configuration**: defaults in code, DB overrides optional
- **Write-through cache** with `policyVersion` counter for invalidation
- **Plan gating**: some toggles require higher tier → 403 with upgrade message
- **Privacy toggles**: consent exemption per user (Story 9.4 interaction)
- **Pastoral vocabulary**: toggle names from `vocabulary.ts` (UX-DR16)

### Dependencies
- Story 11.1 — plan service for tier gating
- Story 9.3 — audit log for recording changes
- Story 9.4 — consent records for privacy toggle exemptions
- Epic 5 — transparency banner mechanism (FR50)

### Project Structure Notes
- Policies module at `apps/api/src/modules/policies/`
- Defaults defined in code, not DB (convention over configuration)
- Frontend under admin settings route

### References
- `_bmad-output/planning-artifacts/epics/epic-11.md` — Epic 11 source
- `docs/project-context.md` — 47 implementation rules (esp. NFR-L4)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
