# Story 10.1: Wizard de Onboarding para Admin Tenant

Status: ready-for-dev

## Story

As a Admin Tenant (novo),
I want a guided 5-step wizard on my first login that walks me through initial platform setup,
So that I can configure my church, create my first group, assign a leader, and understand the pastoral radar in under 10 minutes.

## Acceptance Criteria

**Given** a new Admin Tenant logs in for the first time (no groups, no trails exist in the tenant)
**When** the dashboard loads
**Then** the `OnboardingWizard` component is displayed full-screen with 5 steps and a visual progress indicator (step dots + progress bar)
**And** the wizard cannot be dismissed on first login — it must be completed or explicitly skipped (skip records `onboardingSkippedAt` on tenant config)

**Given** Step 1: "Seu Perfil Pastoral"
**When** the admin fills in their profile
**Then** fields are: display name, photo (optional upload via MinIO), role title (e.g., "Pastor", "Coordenador")
**And** the profile is saved via `PATCH /api/v1/users/me`
**And** all labels and micro-copy use pastoral vocabulary from `vocabulary.ts` (UX-DR16) — e.g., "Como seus discípulos te conhecem?" instead of "Display name"

**Given** Step 2: "Sua Comunidade"
**When** the admin configures the church/organization
**Then** fields are: church name (required), denomination (optional), city/state (optional), logo upload (optional via MinIO with storage policy `permanent`)
**And** the tenant's display name, branding logo, and metadata are updated via `PATCH /api/v1/tenants/current`

**Given** Step 3: "Seu Primeiro Grupo de Discipulado"
**When** the admin reaches the group creation step
**Then** two options are presented: "Criar meu primeiro grupo" (form: group name + description) OR "Explorar com dados de demonstração" (skips to Step 5 using demo data from Story 10.2)
**And** if the admin chooses to create a group, it is created via `POST /api/v1/groups` (Epic 4 API) and the admin is automatically assigned as leader
**And** this step is skippable — choosing demo exploration still counts as completing Step 3

**Given** Step 4: "Convide um Líder"
**When** the admin optionally invites a leader
**Then** fields are: leader name, leader email
**And** if provided, an invite is sent via the same mechanism as Epic 4 Story 4.3 (BullMQ job, stub email)
**And** this step is skippable — "Fazer depois" button available
**And** if Step 3 was skipped (demo mode), Step 4 is also skipped automatically

**Given** Step 5: "Conheça o Radar Pastoral"
**When** the admin reaches the final step
**Then** an interactive explanation of the Pastoral Radar is displayed:
  - Visual of the traffic-light semáforo (green/yellow/red) with descriptions
  - Explanation that it's based on participation signals (meetings + trails)
  - Preview using demo data (Story 10.2) if available: "Veja como o radar funciona com dados de exemplo"
**And** a "Concluir Setup" button completes the wizard

**Given** the wizard is completed
**When** the admin clicks "Concluir Setup"
**Then** `onboardingCompletedAt` is recorded on the tenant config
**And** the admin is redirected to the main dashboard
**And** the wizard is NOT shown again on subsequent logins
**And** a "Rever tutorial" link is available in settings to replay the wizard in read-only mode

**Given** the wizard is rendered
**When** the component loads
**Then** the `OnboardingWizard` component uses `Administração` experience density (padding 12-16px, radius 6-8px) per UX-DR03
**And** each step supports keyboard navigation (Tab between fields, Enter to advance, Escape to go back)
**And** the wizard passes jest-axe accessibility tests
**And** state is persisted server-side per step via `onboardingProgress` JSON field on tenant config: `{ currentStep: 3, completedSteps: [1,2], stepData: {...} }` — saved via `PATCH /api/v1/tenants/current` after each step completion. If the browser closes mid-wizard, the admin resumes from the last completed step on next login
**And** each step completion emits a domain event `onboarding.wizard.step_completed` with `{ tenantId, step, stepName, timestamp }` for future adoption analytics (Epic 13)

## Tasks / Subtasks

- [ ] Task 1: Add onboarding fields to tenant config schema (AC: #1, #6, #7)
  - [ ] 1.1 Add `onboardingProgress` (JSONB), `onboardingCompletedAt` (DateTime?), `onboardingSkippedAt` (DateTime?) to tenants table
  - [ ] 1.2 Create migration
  - [ ] 1.3 Define `OnboardingProgressSchema` in `packages/types/src/onboarding/progress.ts` (Zod)
  - [ ] 1.4 Add snapshot tests for schema

- [ ] Task 2: Create Onboarding module in NestJS (AC: all)
  - [ ] 2.1 Create `apps/api/src/modules/onboarding/onboarding.module.ts`
  - [ ] 2.2 Create `apps/api/src/modules/onboarding/onboarding.service.ts` (supporting subdomain — direct Prisma)
  - [ ] 2.3 Create `apps/api/src/modules/onboarding/onboarding.controller.ts`
  - [ ] 2.4 Endpoint to get current onboarding state: `GET /api/v1/onboarding/status`
  - [ ] 2.5 Endpoint to update step progress: `PATCH /api/v1/tenants/current` (reuse existing)

- [ ] Task 3: Build OnboardingWizard component shell (AC: #1, #7)
  - [ ] 3.1 Create `apps/web/src/components/onboarding/onboarding-wizard.tsx` — full-screen wizard container
  - [ ] 3.2 Step progress indicator (dots + progress bar)
  - [ ] 3.3 Step navigation (next/back/skip) with keyboard support (Tab, Enter, Escape)
  - [ ] 3.4 Server-side state persistence after each step completion
  - [ ] 3.5 Resume from last completed step on page reload
  - [ ] 3.6 `Administração` density (padding 12-16px, radius 6-8px)

- [ ] Task 4: Build Step 1 — "Seu Perfil Pastoral" (AC: #2)
  - [ ] 4.1 Create `apps/web/src/components/onboarding/steps/step-profile.tsx`
  - [ ] 4.2 Fields: display name, photo upload (MinIO), role title
  - [ ] 4.3 Pastoral vocabulary labels from `vocabulary.ts`
  - [ ] 4.4 Save via `PATCH /api/v1/users/me`

- [ ] Task 5: Build Step 2 — "Sua Comunidade" (AC: #3)
  - [ ] 5.1 Create `apps/web/src/components/onboarding/steps/step-community.tsx`
  - [ ] 5.2 Fields: church name (required), denomination, city/state, logo upload
  - [ ] 5.3 Save via `PATCH /api/v1/tenants/current`

- [ ] Task 6: Build Step 3 — "Seu Primeiro Grupo" (AC: #4)
  - [ ] 6.1 Create `apps/web/src/components/onboarding/steps/step-group.tsx`
  - [ ] 6.2 Two options: create group form OR explore demo data
  - [ ] 6.3 Group creation via `POST /api/v1/groups` (Epic 4 API)
  - [ ] 6.4 Auto-assign admin as leader on group creation

- [ ] Task 7: Build Step 4 — "Convide um Líder" (AC: #5)
  - [ ] 7.1 Create `apps/web/src/components/onboarding/steps/step-invite.tsx`
  - [ ] 7.2 Fields: leader name, leader email
  - [ ] 7.3 Send invite via Epic 4 Story 4.3 mechanism
  - [ ] 7.4 "Fazer depois" skip button
  - [ ] 7.5 Auto-skip if Step 3 was skipped (demo mode)

- [ ] Task 8: Build Step 5 — "Conheça o Radar Pastoral" (AC: #5)
  - [ ] 8.1 Create `apps/web/src/components/onboarding/steps/step-radar.tsx`
  - [ ] 8.2 Interactive semáforo visualization (green/yellow/red)
  - [ ] 8.3 Explanation text about participation signals
  - [ ] 8.4 Demo data preview if available (Story 10.2)
  - [ ] 8.5 "Concluir Setup" button

- [ ] Task 9: Implement completion and replay logic (AC: #6)
  - [ ] 9.1 Record `onboardingCompletedAt` on completion
  - [ ] 9.2 Redirect to main dashboard
  - [ ] 9.3 Guard: don't show wizard on subsequent logins
  - [ ] 9.4 "Rever tutorial" link in settings (read-only replay mode)

- [ ] Task 10: Emit domain events (AC: #7)
  - [ ] 10.1 Emit `onboarding.wizard.step_completed` per step
  - [ ] 10.2 Include `{ tenantId, step, stepName, timestamp }`

- [ ] Task 11: Write tests (AC: all)
  - [ ] 11.1 jest-axe accessibility tests for wizard and each step
  - [ ] 11.2 Keyboard navigation tests (Tab, Enter, Escape)
  - [ ] 11.3 State persistence test: close browser mid-wizard → resume
  - [ ] 11.4 Skip flow test: skip wizard → onboardingSkippedAt recorded
  - [ ] 11.5 Completion flow test: all steps → onboardingCompletedAt recorded
  - [ ] 11.6 Demo mode test: choose demo in Step 3 → Step 4 auto-skipped
  - [ ] 11.7 Domain event emission tests
  - [ ] 11.8 Zod schema snapshot tests

## Dev Notes

### File Paths
- `apps/api/src/modules/onboarding/onboarding.module.ts`
- `apps/api/src/modules/onboarding/onboarding.service.ts`
- `apps/api/src/modules/onboarding/onboarding.controller.ts`
- `apps/web/src/components/onboarding/onboarding-wizard.tsx`
- `apps/web/src/components/onboarding/steps/step-profile.tsx`
- `apps/web/src/components/onboarding/steps/step-community.tsx`
- `apps/web/src/components/onboarding/steps/step-group.tsx`
- `apps/web/src/components/onboarding/steps/step-invite.tsx`
- `apps/web/src/components/onboarding/steps/step-radar.tsx`
- `packages/types/src/onboarding/progress.ts`

### Libraries & Versions
- Next.js 16.2 (App Router) for wizard pages
- shadcn/ui components: Progress, Button, Input, FileUpload
- Zustand 5.0.12 for local wizard state (if needed alongside server persistence)
- TanStack Query 5.96.2 for API calls
- Zod 4.3.6 for form validation
- MinIO client for photo/logo uploads

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- Onboarding is a **supporting subdomain** — direct Prisma, no repository pattern
- Wizard state persisted **server-side** in tenant config (not localStorage)
- Pastoral vocabulary from `vocabulary.ts` (UX-DR16)
- `Administração` experience density (UX-DR03)
- Domain events for future analytics (Epic 13)

### Dependencies
- Epic 3 — tenant provisioning (tenant config fields)
- Epic 4 — group creation API and invite mechanism (Story 4.3)
- Story 10.2 — demo data for radar preview
- Epic 7 — pastoral radar visualization

### Project Structure Notes
- Onboarding module at `apps/api/src/modules/onboarding/`
- Wizard components under `apps/web/src/components/onboarding/`
- Step components in `steps/` subdirectory

### References
- `_bmad-output/planning-artifacts/epics/epic-10.md` — Epic 10 source
- `docs/project-context.md` — 47 implementation rules
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
