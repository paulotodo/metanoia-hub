# Story 11.1: Planos de Assinatura & Limites Dinâmicos

Status: ready-for-dev

## Story

As a Super Admin,
I want to manage subscription plans with configurable numeric limits per tier,
So that each tenant operates within the resource boundaries of their plan and I can adjust limits as the business evolves.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Create SubscriptionPlan Prisma schema (AC: #1)
  - [ ] 1.1 Add `SubscriptionPlan` model: `id` (UUID v7), `name`, `tier` (enum: `free`, `pro`, `enterprise`), `limits` (JSONB), `features` (JSONB), `isActive`, `metadata` (JSONB for prices), `createdAt`, `updatedAt`
  - [ ] 1.2 Add `@@map("subscription_plans")` and column mappings
  - [ ] 1.3 Create migration
  - [ ] 1.4 Note: this is a global table (no tenant_id) — plans are platform-wide

- [ ] Task 2: Seed subscription plans (AC: #1)
  - [ ] 2.1 Add seed data in `prisma/seed.ts` for Free, Pro, Enterprise plans
  - [ ] 2.2 Include all limit values as specified
  - [ ] 2.3 Include metadata with prices: Free (R$ 0), Pro (R$ 99/mês), Enterprise ("Sob consulta")
  - [ ] 2.4 Ensure seed is idempotent (upsert)

- [ ] Task 3: Create Plan service (AC: #2, #3)
  - [ ] 3.1 Create `apps/api/src/modules/plans/plans.module.ts`
  - [ ] 3.2 Create `apps/api/src/modules/plans/plans.service.ts`
  - [ ] 3.3 Implement `getLimits(tenantId)`: read from SubscriptionPlan + tenant override → merge
  - [ ] 3.4 Override precedence: tenant override > plan default > fallback constant
  - [ ] 3.5 Fallback to `PLAN_LIMITS_FALLBACK` if table empty/query fails, log warning via Pino

- [ ] Task 4: Define Zod schemas (AC: #2)
  - [ ] 4.1 Create `packages/types/src/plans/subscription.ts`
  - [ ] 4.2 `PlanLimitsSchema`: all numeric fields as positive integers
  - [ ] 4.3 `PlanLimitsOverrideSchema`: all numeric fields as positive integers or null
  - [ ] 4.4 `SubscriptionPlanSchema` for plan CRUD
  - [ ] 4.5 Add snapshot tests

- [ ] Task 5: Refactor Guard from hardcoded to dynamic limits (AC: #2)
  - [ ] 5.1 Replace `PLAN_LIMITS` constant usage with `planService.getLimits(tenantId)` call
  - [ ] 5.2 Keep `PLAN_LIMITS_FALLBACK` constant as safety net
  - [ ] 5.3 Preserve Redis atomic counting (INCR with 5-min TTL)
  - [ ] 5.4 Preserve PostgreSQL pessimistic lock fallback when Redis unavailable

- [ ] Task 6: Implement write-through Redis cache (AC: #3)
  - [ ] 6.1 On plan limit update: SET `cache:plan-limits:{tenantId}` immediately (write-through)
  - [ ] 6.2 On tenant override update: SET `cache:plan-limits:{tenantId}` with merged limits
  - [ ] 6.3 Read path: check Redis first → fallback to DB → fallback to constant

- [ ] Task 7: Implement Super Admin plan management endpoints (AC: #3)
  - [ ] 7.1 `GET /api/v1/admin/plans` — list all plans with active tenant counts
  - [ ] 7.2 `PATCH /api/v1/admin/plans/:planId` — update plan limits (triggers write-through cache for all affected tenants)
  - [ ] 7.3 Create `apps/api/src/modules/plans/plans.controller.ts`

- [ ] Task 8: Implement tenant override endpoint (AC: #4)
  - [ ] 8.1 `PATCH /api/v1/admin/tenants/:tenantId` with `planLimitsOverride` payload
  - [ ] 8.2 Validate via `PlanLimitsOverrideSchema` (422 on invalid)
  - [ ] 8.3 Record in audit log (Story 9.3)
  - [ ] 8.4 Update Redis cache immediately

- [ ] Task 9: Implement downgrade logic (AC: #5)
  - [ ] 9.1 On plan change: check if current resources exceed new limits
  - [ ] 9.2 Do NOT delete excess resources — keep read access
  - [ ] 9.3 Block creation of new resources beyond limits
  - [ ] 9.4 Generate banner message with current/limit comparison

- [ ] Task 10: Write tests (AC: all)
  - [ ] 10.1 Contract test: Guard identical behavior before/after migration
  - [ ] 10.2 Fallback test: empty SubscriptionPlan → fallback defaults, no 500
  - [ ] 10.3 Override precedence test: plan=3, override=10 → 10 used; override=null → plan default
  - [ ] 10.4 Write-through cache test: update plan → Redis updated immediately
  - [ ] 10.5 Downgrade test: excess resources preserved, creation blocked
  - [ ] 10.6 Redis unavailable test: PostgreSQL fallback works
  - [ ] 10.7 Invalid override payload test: 422 response
  - [ ] 10.8 Audit log test: overrides recorded
  - [ ] 10.9 Seed idempotency test
  - [ ] 10.10 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/plans/plans.module.ts`
- `apps/api/src/modules/plans/plans.service.ts`
- `apps/api/src/modules/plans/plans.controller.ts`
- `packages/types/src/plans/subscription.ts`
- `prisma/schema.prisma` — SubscriptionPlan model
- `prisma/seed.ts` — plan seed data
- Existing Guard in `apps/api/src/common/guards/` — refactor to dynamic

### Libraries & Versions
- Prisma v7 for database access
- Redis (ioredis) for write-through cache
- Pino for structured logging (fallback warnings)
- Zod 4.3.6 for schema validation
- BullMQ patterns preserved from Epic 3

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **Write-through cache**: SET on write, not just DEL (eliminates race condition)
- **Triple fallback**: Redis → DB → hardcoded constant (never 500)
- **Override precedence**: tenant override > plan default > fallback
- **Downgrade is non-destructive**: excess resources kept, creation blocked
- SubscriptionPlan is **global** (no tenant_id)

### Dependencies
- Epic 3 (Story 3.3) — existing Guard and PLAN_LIMITS to refactor
- Story 9.3 — audit log for recording overrides
- Redis infrastructure from Epic 1

### Project Structure Notes
- Plans module at `apps/api/src/modules/plans/`
- Global table (no tenant scoping on SubscriptionPlan itself)
- Guard refactored in-place

### References
- `_bmad-output/planning-artifacts/epics/epic-11.md` — Epic 11 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
