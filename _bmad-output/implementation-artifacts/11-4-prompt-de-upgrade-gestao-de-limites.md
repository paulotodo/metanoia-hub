# Story 11.4: Prompt de Upgrade & Gestão de Limites

Status: ready-for-dev

## Story

As a Admin Tenant,
I want to see contextual upgrade prompts when my tenant approaches or hits plan limits,
So that I can understand my usage and make informed decisions about upgrading.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Enhance Guard error response with plan limit details (AC: #1)
  - [ ] 1.1 Modify existing Guard to return structured 403 with `PlanLimitExceeded` error
  - [ ] 1.2 Include `details: { resource, current, limit, currentPlan, suggestedPlan }`
  - [ ] 1.3 Use pastoral vocabulary in message strings

- [ ] Task 2: Create UpgradeRequest Prisma schema (AC: #4, #5)
  - [ ] 2.1 Add `UpgradeRequest` model: `id` (UUID v7), `tenantId`, `currentPlan`, `targetPlan`, `requestedBy`, `status` (enum: `pending`, `approved`, `rejected`), `reviewedBy`, `reviewedAt`, `createdAt`, `updatedAt`
  - [ ] 2.2 Create migration with RLS policies

- [ ] Task 3: Define Zod schemas (AC: all)
  - [ ] 3.1 Create `packages/types/src/plans/upgrade.ts`
  - [ ] 3.2 `PlanLimitExceededSchema` for 403 error response
  - [ ] 3.3 `UpgradeRequestSchema` for request/response
  - [ ] 3.4 `PlanComparisonSchema` for comparison table data
  - [ ] 3.5 Add snapshot tests

- [ ] Task 4: Implement usage check service (AC: #2)
  - [ ] 4.1 Create `apps/api/src/modules/plans/usage.service.ts`
  - [ ] 4.2 `getUsageSummary(tenantId)`: return current usage per resource vs limits
  - [ ] 4.3 Include percentage calculation and ≥80% threshold flag
  - [ ] 4.4 `PLAN_WARNING_THRESHOLD` configurable via env var (default: 0.8)

- [ ] Task 5: Implement `GET /api/v1/tenants/current/usage` endpoint (AC: #2)
  - [ ] 5.1 Return usage summary with current/limit/percentage per resource
  - [ ] 5.2 Include warning flags for resources ≥ threshold

- [ ] Task 6: Implement `POST /api/v1/tenants/current/upgrade` endpoint (AC: #4)
  - [ ] 6.1 Create upgrade request with status `pending`
  - [ ] 6.2 Return 202 with request details
  - [ ] 6.3 Record in audit log
  - [ ] 6.4 Emit domain event `tenant.upgrade.requested`

- [ ] Task 7: Implement Super Admin upgrade management endpoints (AC: #5, #6)
  - [ ] 7.1 `GET /api/v1/admin/upgrade-requests?status=pending` — paginated list with filtering
  - [ ] 7.2 `PATCH /api/v1/admin/upgrade-requests/:requestId` with `{ status: "approved" | "rejected" }`
  - [ ] 7.3 On approval: update tenant plan immediately, write-through Redis cache
  - [ ] 7.4 On approval: generate in-app toast notification for admin

- [ ] Task 8: Build upgrade prompt card component (AC: #1)
  - [ ] 8.1 Create `apps/web/src/components/plans/upgrade-prompt-card.tsx`
  - [ ] 8.2 Display current usage, plan limit, "Conhecer plano Pro" CTA
  - [ ] 8.3 Pastoral vocabulary messaging
  - [ ] 8.4 Triggered on 403 PlanLimitExceeded response

- [ ] Task 9: Build warning banner component (AC: #2)
  - [ ] 9.1 Create `apps/web/src/components/plans/usage-warning-banner.tsx`
  - [ ] 9.2 Non-blocking banner with usage stats
  - [ ] 9.3 Dismissable (localStorage, re-show after 7 days)
  - [ ] 9.4 Displayed on dashboard and management pages

- [ ] Task 10: Build plan comparison page (AC: #3)
  - [ ] 10.1 Create `apps/web/src/app/(authenticated)/admin/settings/plans/page.tsx`
  - [ ] 10.2 Comparison table: Free/Pro/Enterprise with limits and prices
  - [ ] 10.3 Current plan highlighted with usage per resource
  - [ ] 10.4 "Assinar Pro" button (triggers upgrade request)
  - [ ] 10.5 "Falar com vendas" button for Enterprise (email/contact form)

- [ ] Task 11: Build Super Admin upgrade request management UI (AC: #5, #6)
  - [ ] 11.1 Pending requests list in Super Admin dashboard
  - [ ] 11.2 Badge with pending count
  - [ ] 11.3 Approve/reject actions

- [ ] Task 12: Write tests (AC: all)
  - [ ] 12.1 Guard test: limit exceeded → 403 with structured details
  - [ ] 12.2 Pastoral vocabulary test: message uses correct vocabulary
  - [ ] 12.3 Warning threshold test: 80% usage → warning shown
  - [ ] 12.4 Threshold config test: custom env var changes threshold
  - [ ] 12.5 Dismissable banner test: dismiss → localStorage → re-show after 7 days
  - [ ] 12.6 Upgrade request test: POST → 202 → audit log → domain event
  - [ ] 12.7 Approval test: approve → plan updated → Redis cache → toast notification
  - [ ] 12.8 No data loss test: upgrade preserves existing resources
  - [ ] 12.9 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/plans/usage.service.ts`
- `apps/api/src/modules/plans/plans.controller.ts` — add upgrade endpoints
- `apps/web/src/components/plans/upgrade-prompt-card.tsx`
- `apps/web/src/components/plans/usage-warning-banner.tsx`
- `apps/web/src/app/(authenticated)/admin/settings/plans/page.tsx`
- `packages/types/src/plans/upgrade.ts`
- `apps/api/src/common/guards/` — enhance Guard response
- `prisma/schema.prisma` — UpgradeRequest model

### Libraries & Versions
- Zod 4.3.6 for schema validation
- Redis for cache write-through on plan changes
- TanStack Query 5.96.2 for usage polling and comparison table
- shadcn/ui Card, Badge, Table, Button components
- Zustand 5.0.12 for localStorage dismissal state (or raw localStorage)

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **Pastoral vocabulary**: "acolher mais pessoas" not "increase capacity"
- **Upgrade is manual**: request → Super Admin approval → plan change (no self-service billing yet)
- **Write-through cache**: on approval, new limits written to Redis immediately
- **Non-destructive**: upgrade/downgrade never deletes existing resources
- **Configurable threshold**: `PLAN_WARNING_THRESHOLD` env var

### Dependencies
- Story 11.1 — plan service, SubscriptionPlan table, Guard refactoring
- Story 9.3 — audit log integration
- Epic 3 — existing Guard to enhance

### Project Structure Notes
- Upgrade components at `apps/web/src/components/plans/`
- Plans page under admin settings route
- Reuses plans module from Story 11.1

### References
- `_bmad-output/planning-artifacts/epics/epic-11.md` — Epic 11 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
