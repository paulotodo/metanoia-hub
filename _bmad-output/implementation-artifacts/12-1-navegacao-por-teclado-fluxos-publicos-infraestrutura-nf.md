# Story 12.1: Navegação por Teclado — Fluxos Públicos & Infraestrutura (NFR-A1)

Status: ready-for-dev

## Story

As a user with motor disabilities or keyboard preference,
I want to navigate public flows and infrastructure components using only the keyboard,
So that I can access the platform from the first interaction without depending on a mouse.

## Acceptance Criteria

**Given** a user accesses the application via keyboard only
**When** they navigate the login flow (email input → password input → submit → error/success)
**Then** tab order follows visual reading order (top-to-bottom, left-to-right)
**And** every interactive element receives visible focus via `:focus-visible`
**And** Enter activates buttons and links, Space toggles checkboxes

**Given** a user accesses the registration flow
**When** they navigate the multi-field form (nome → email → senha → confirmação → submit)
**Then** tab order is sequential through all fields
**And** password visibility toggle is keyboard-accessible (Space/Enter)

**Given** a user navigates any page
**When** they press Tab as the first action
**Then** a "Ir para conteúdo" skip navigation link appears as the first focable element
**And** the skip link is visually hidden by default (`sr-only`) but becomes visible on focus (`focus:not-sr-only`)
**And** when visible, it appears at the top of the viewport with solid background (`surface-elevated`), high contrast text, and `z-50`
**And** activating it moves focus to the `<main>` content area, bypassing sidebar/navbar

**Given** a user opens a modal dialog (any modal across the application)
**When** the modal renders
**Then** focus is trapped inside the modal (Tab cycles through modal elements only)
**And** Escape closes the modal and returns focus to the trigger element
**And** `aria-modal="true"` and `role="dialog"` are present
**And** Radix Dialog handles this natively — this AC validates it works correctly in all modals

**Given** a user navigates dropdown menus (sidebar navigation, action menus)
**When** they press Arrow Down/Up
**Then** focus moves between menu items sequentially
**And** Enter selects the focused item
**And** Escape closes the menu and returns focus to the trigger

**Given** components are loading (skeleton screens, SSR hydration)
**When** the user presses Tab during a loading state
**Then** tab order remains stable — focus does not jump to unexpected elements as content hydrates
**And** skeleton placeholders are not focable (`tabindex="-1"` or `aria-hidden="true"`)

**Sub-task 0 (Baseline):** Antes de qualquer correção, rodar axe-core em todos os fluxos públicos e gerar report baseline. Comparar com report final para medir progresso.

**Fluxos auditados:**
1. Login e registro (Epic 1)
2. Skip navigation (infraestrutura global)
3. Modal focus trap (infraestrutura global — validar em 3+ modais distintos)
4. Dropdown/menu keyboard (sidebar, action menus)

**Teste:** Playwright E2E com `page.keyboard` para cada fluxo. Teste manual cross-browser: Chrome, Firefox, Safari. Checklist de severidade: blocker (focus trap quebrado, skip nav ausente), major (tab order incorreta), minor (focus ring esteticamente inconsistente).

## Tasks / Subtasks

- [ ] Task 0: Generate axe-core baseline report (AC: baseline)
  - [ ] 0.1 Run `@axe-core/playwright` on all public flows before any fixes
  - [ ] 0.2 Save baseline report as artifact for comparison

- [ ] Task 1: Implement skip navigation link (AC: #3)
  - [ ] 1.1 Create `apps/web/src/components/a11y/skip-nav.tsx`
  - [ ] 1.2 "Ir para conteúdo" link as first focable element
  - [ ] 1.3 Visually hidden by default (`sr-only`), visible on focus (`focus:not-sr-only`)
  - [ ] 1.4 Solid background `surface-elevated`, high contrast text, `z-50`
  - [ ] 1.5 Activating moves focus to `<main>` element
  - [ ] 1.6 Add to root layout (`apps/web/src/app/layout.tsx`)

- [ ] Task 2: Audit and fix login flow keyboard navigation (AC: #1)
  - [ ] 2.1 Verify tab order: email → password → submit (top-to-bottom)
  - [ ] 2.2 Ensure all interactive elements have `:focus-visible` ring
  - [ ] 2.3 Verify Enter activates submit button
  - [ ] 2.4 Fix any tab order issues

- [ ] Task 3: Audit and fix registration flow keyboard navigation (AC: #2)
  - [ ] 3.1 Verify tab order: nome → email → senha → confirmação → submit
  - [ ] 3.2 Verify password visibility toggle responds to Space/Enter
  - [ ] 3.3 Fix any sequential navigation issues

- [ ] Task 4: Validate modal focus trap across 3+ modals (AC: #4)
  - [ ] 4.1 Test Radix Dialog focus trap in: confirmation dialog, create group modal, settings modal
  - [ ] 4.2 Verify Tab cycles within modal only
  - [ ] 4.3 Verify Escape closes modal and returns focus to trigger
  - [ ] 4.4 Verify `aria-modal="true"` and `role="dialog"` present
  - [ ] 4.5 Fix any modals not conforming

- [ ] Task 5: Audit and fix dropdown/menu keyboard navigation (AC: #5)
  - [ ] 5.1 Verify Arrow Down/Up navigates sidebar items
  - [ ] 5.2 Verify Enter selects focused item
  - [ ] 5.3 Verify Escape closes menu and returns focus to trigger
  - [ ] 5.4 Fix any action menu keyboard gaps

- [ ] Task 6: Fix skeleton/loading state focus stability (AC: #6)
  - [ ] 6.1 Audit skeleton components for `tabindex="-1"` or `aria-hidden="true"`
  - [ ] 6.2 Verify tab order stability during SSR hydration
  - [ ] 6.3 Fix any focus jump issues

- [ ] Task 7: Write Playwright E2E tests (AC: all)
  - [ ] 7.1 Login flow keyboard test (`page.keyboard.press('Tab')`, etc.)
  - [ ] 7.2 Registration flow keyboard test
  - [ ] 7.3 Skip navigation test: Tab → visible → activate → focus on main
  - [ ] 7.4 Modal focus trap test (3+ modals)
  - [ ] 7.5 Dropdown keyboard test
  - [ ] 7.6 Loading state focus stability test

- [ ] Task 8: Generate final axe-core report and compare (AC: baseline)
  - [ ] 8.1 Run axe-core after all fixes
  - [ ] 8.2 Generate comparison: baseline vs. final
  - [ ] 8.3 Document issues found, fixed, and accepted as tech debt

- [ ] Task 9: Cross-browser manual testing (AC: all)
  - [ ] 9.1 Chrome manual test checklist
  - [ ] 9.2 Firefox manual test checklist
  - [ ] 9.3 Safari manual test checklist
  - [ ] 9.4 Severity classification: blocker / major / minor

## Dev Notes

### File Paths
- `apps/web/src/components/a11y/skip-nav.tsx` — new skip navigation component
- `apps/web/src/app/layout.tsx` — add skip nav to root layout
- `apps/web/e2e/a11y/keyboard-public.e2e-spec.ts` — E2E tests
- Existing components to audit: login page, registration page, sidebar, modals, skeletons

### Libraries & Versions
- Playwright 1.59.1 with `page.keyboard` for E2E tests
- `@axe-core/playwright` for automated accessibility checks
- Radix UI (via shadcn/ui) for modal/dialog focus trap
- Tailwind CSS 4.2.2 for `sr-only`, `focus:not-sr-only`, `focus-visible:ring-*`

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **Baseline → fix → final report** methodology for measurable progress
- **Radix Dialog** handles focus trap natively — validate, don't reimplement
- **Skip navigation** is infrastructure — added to root layout once
- **Skeleton states**: must not be focable (`tabindex="-1"` or `aria-hidden`)
- **Severity classification**: blocker > major > minor

### Dependencies
- Epic 1 — login/registration flows to audit
- Epic 1 (Story 1.8) — sidebar/navigation to audit
- All Epics 1-11 — any modal to validate focus trap

### Project Structure Notes
- A11y components at `apps/web/src/components/a11y/`
- E2E tests at `apps/web/e2e/a11y/`
- Skip nav in root layout

### References
- `_bmad-output/planning-artifacts/epics/epic-12.md` — Epic 12 source
- `docs/project-context.md` — 47 implementation rules (NFR-A1)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
