## Epic 11: Planos, Limites & Feature Gating

Configuração dinâmica de planos de assinatura (Free/Pro/Enterprise) com limites numéricos configuráveis, branding customizado por tenant, políticas e feature toggles, e prompt de upgrade contextual. Evolui os limites hardcoded do Epic 3 (Story 3.3) para configuração em banco. Feature gating duplo: Subscription Tiers (disponível) + Feature Toggles por tenant (ativo).

### Story 11.1: Planos de Assinatura & Limites Dinâmicos

As a Super Admin,
I want to manage subscription plans with configurable numeric limits per tier,
So that each tenant operates within the resource boundaries of their plan and I can adjust limits as the business evolves.

**Acceptance Criteria:**

**Given** the platform supports 3 subscription tiers
**When** the plan configuration is initialized
**Then** a `SubscriptionPlan` table is seeded with 3 plans:
  - **Free:** max 3 groups, 15 participants/group, 30 simultaneous users, 1 GB storage, no recording, standard branding, standard feature flags
  - **Pro:** max 20 groups, 50 participants/group, 100 simultaneous users, 50 GB storage, 90 days/10 GB recording, logo + colors branding, configurable feature flags
  - **Enterprise:** unlimited groups (configurable), custom participants/group, custom simultaneous users, custom storage, custom recording, white-label branding, fully custom feature flags
**And** each plan row stores: `id` (UUID v7), `name`, `tier` (enum: `free`, `pro`, `enterprise`), `limits` (JSONB: `{ maxGroups, maxParticipantsPerGroup, maxSimultaneousUsers, maxStorageGB, maxRecordingDaysRetention, maxRecordingGB }`), `features` (JSONB: available feature set), `isActive`, `createdAt`, `updatedAt`

**Given** a tenant has `plan: free` with hardcoded limits from Epic 3 (Story 3.3)
**When** Epic 11 is deployed
**Then** the existing hardcoded `PLAN_LIMITS` constants in the Guard are replaced by a dynamic lookup: `planService.getLimits(tenantId)` which reads from `SubscriptionPlan` table joined with `tenants.plan`
**And** the `plan_limits_override` JSONB field on `tenants` table (already created in Epic 3) allows per-tenant overrides of any limit — overrides take precedence over plan defaults. Override payload validated via `PlanLimitsOverrideSchema` (Zod): all numeric fields must be positive integers or `null` (null = use plan default). Invalid payloads return 422
**And** the Redis atomic counting (`INCR` with 5-min TTL) from Epic 3 continues to work — only the source of truth for max values changes from constant to database
**And** if Redis is unavailable, the PostgreSQL pessimistic lock fallback from Epic 3 is preserved
**And** if `SubscriptionPlan` table is empty or the query fails (e.g., seed didn't run), the Guard falls back to hardcoded defaults (`PLAN_LIMITS_FALLBACK` constant) — never returns 500 to the user. A warning is logged via Pino: "SubscriptionPlan table empty, using fallback defaults"
**And** a contract test validates: Guard behavior is IDENTICAL before (hardcoded) and after (dynamic) migration — create tenant on Free plan → verify same limits enforced in both modes
**And** a fallback test validates: delete all SubscriptionPlan rows → verify Guard uses fallback defaults → no 500 errors
**And** an override precedence test validates: plan says max 3 groups, override says max 10 → verify 10 is used. Override has `maxGroups: null` → verify plan default (3) is used

**Given** I am a Super Admin
**When** I access `GET /api/v1/admin/plans`
**Then** I see all subscription plans with their limits and active tenant counts per plan
**And** I can update plan limits via `PATCH /api/v1/admin/plans/:planId` — changes apply to ALL tenants on that plan (unless overridden by `plan_limits_override`)
**And** plan changes use write-through cache: the new limits are WRITTEN to Redis (`SET cache:plan-limits:{tenantId}`) immediately, not just invalidated (`DEL`) — this eliminates the race condition window between invalidation and the next cold-cache read

**Given** I want to override limits for a specific tenant
**When** I update `PATCH /api/v1/admin/tenants/:tenantId` with `planLimitsOverride` payload
**Then** the override is stored in `plan_limits_override` JSONB and takes precedence
**And** the override is recorded in the audit log (Epic 9)

**Given** a tenant's plan is downgraded (e.g., Pro → Free)
**When** the tenant has resources exceeding the new plan's limits (e.g., 10 groups but Free allows 3)
**Then** existing resources are NOT deleted — the tenant retains access to all existing groups, members, trails, etc.
**And** the tenant cannot CREATE new resources beyond the new plan's limits (read-only for excess resources)
**And** a banner is displayed: "Seu plano atual permite até {limit} {resource}. Você possui {current}. Para criar novos, faça upgrade ou remova os excedentes."

### Story 11.2: Branding Customizado do Tenant

As a Admin Tenant,
I want to customize the branding of my platform instance with my church's logo, colors, and display name,
So that participants see a familiar, branded experience when accessing our discipleship platform.

**Acceptance Criteria:**

**Given** I am an Admin Tenant on a Pro or Enterprise plan
**When** I navigate to Settings > "Identidade Visual"
**Then** I can configure:
  - **Logo:** Upload via MinIO (storage policy `permanent`, max 2MB, formats: PNG/JPG/SVG) — displayed in the sidebar/navigation and login page
  - **Colors:** Override `brand-teal` primary color and `brand-teal-light` secondary color via CSS custom properties — input: hex color picker with live preview. A contrast validation check runs on selection: if the chosen color has contrast ratio < 4.5:1 against `surface-base` (#FAFAF8) or `surface-elevated` (#FFFFFF), a warning is displayed: "Esta cor pode dificultar a leitura. Considere uma tonalidade mais escura." (warning only, not blocking — admin has final say)
  - **Display name:** Custom tenant name shown in the header and page titles
**And** changes are saved via `PATCH /api/v1/tenants/current/branding`
**And** branding is applied via CSS custom properties injected at the root layout level — `--color-brand-primary` and `--color-brand-secondary` override the defaults from `tailwind.preset.ts` (Epic 1, Story 1.7)

**Given** I am an Admin Tenant on the Free plan
**When** I navigate to Settings > "Identidade Visual"
**Then** the branding section shows "Disponível no plano Pro" with an upgrade prompt (Story 11.4 pattern)
**And** only the display name field is editable (Free plan includes standard branding with name customization)

**Given** branding is configured
**When** any user in my tenant loads the app
**Then** the custom logo replaces the default metanoia logo in the navigation
**And** the custom colors are applied via CSS custom properties without page reload
**And** the branding is cached in the browser (TanStack Query, staleTime: 30 minutes) and refreshed on next visit after changes

**Given** the logo upload
**When** the image is processed
**Then** the server validates dimensions (min 64x64, max 512x512) and file size (max 2MB)
**And** the image is resized synchronously on upload using `sharp` library (lightweight, native): 128x128 for navigation and 64x64 for favicon (if applicable). Sync processing is acceptable for ≤2MB images
**And** the signed URL for the logo is cached in Redis (`cache:branding:{tenantId}`, TTL 1 hour) to avoid MinIO calls on every page load

### Story 11.3: Políticas & Feature Toggles por Tenant

As a Admin Tenant,
I want to configure tenant-specific policies and feature toggles,
So that I can enable or disable features like focus monitoring and mandatory camera according to my church's pastoral approach.

**Acceptance Criteria:**

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

### Story 11.4: Prompt de Upgrade & Gestão de Limites

As a Admin Tenant,
I want to see contextual upgrade prompts when my tenant approaches or hits plan limits,
So that I can understand my usage and make informed decisions about upgrading.

**Acceptance Criteria:**

**Given** a tenant is on the Free plan with a limit of 3 groups
**When** the admin has 3 groups and tries to create a 4th via `POST /api/v1/groups`
**Then** the Guard (evolved from Epic 3) blocks the creation and returns 403 with:
  - `{ "statusCode": 403, "error": "PlanLimitExceeded", "message": "Limite do plano atingido (3/3 grupos). Seu plano permite até 3 grupos — considere fazer upgrade para acolher mais pessoas.", "details": { "resource": "groups", "current": 3, "limit": 3, "currentPlan": "free", "suggestedPlan": "pro" } }`
**And** the frontend displays an upgrade prompt card with: current usage, plan limit, and "Conhecer plano Pro" CTA button
**And** the prompt uses pastoral vocabulary: "acolher mais pessoas" instead of "increase capacity"

**Given** a tenant is approaching a limit (≥ 80% usage)
**When** the admin views the dashboard or the relevant management page
**Then** a non-blocking warning banner is displayed: "Você está usando {current}/{limit} {resource}. Conheça o plano {suggestedPlan} para expandir."
**And** the warning is dismissable (stored in localStorage, re-shown after 7 days)
**And** the 80% threshold is configurable via environment variable `PLAN_WARNING_THRESHOLD` (default: 0.8)

**Given** the admin clicks "Conhecer plano Pro" or "Ver planos"
**When** the upgrade page loads at `/app/admin/settings/plans`
**Then** a comparison table shows:
  - Current plan highlighted, with current usage per resource
  - Pro and Enterprise plans with their limits
  - Preços realistas no seed: Free (R$ 0), Pro (R$ 99/mês), Enterprise ("Sob consulta") — armazenados em `SubscriptionPlan.metadata` JSONB
  - "Assinar Pro" button (self-service checkout — stub/placeholder in this story, real payment integration is out of scope)
  - "Falar com vendas" button for Enterprise (opens email template or contact form)
**And** o seed (`prisma/seed.ts`) inclui os 3 planos com preços placeholder realistas para que a tabela comparativa funcione visualmente desde o MVP

**Given** the admin initiates a plan change
**When** self-service upgrade from Free → Pro is selected
**Then** for now, the system records the upgrade request via `POST /api/v1/tenants/current/upgrade` with `{ targetPlan: "pro" }`
**And** the API returns 202 with status "pending" — actual plan activation requires manual approval by Super Admin (full self-service billing is a future epic)
**And** the upgrade request is recorded in the audit log
**And** a domain event `tenant.upgrade.requested` is emitted with `{ tenantId, currentPlan, targetPlan, requestedBy, timestamp }`

**Given** a Super Admin needs to manage upgrade requests
**When** they access `GET /api/v1/admin/upgrade-requests?status=pending`
**Then** a paginated list is returned with: `tenantId`, `tenantName`, `currentPlan`, `targetPlan`, `requestedBy`, `requestedAt`, `status`
**And** the list supports filtering by `status` (`pending`, `approved`, `rejected`)
**And** the Super Admin dashboard shows a badge with the count of pending requests

**Given** a Super Admin approves the upgrade
**When** the plan is changed via `PATCH /api/v1/admin/tenants/:tenantId` with `{ plan: "pro" }`
**Then** the tenant's plan is updated immediately
**And** new limits take effect immediately (Redis cache invalidated via write-through: new limits written to Redis, not just deleted)
**And** existing resources are NOT affected (no data loss on upgrade)
**And** the admin is notified via in-app toast on next login: "Parabéns! Seu plano foi atualizado para Pro."

---

