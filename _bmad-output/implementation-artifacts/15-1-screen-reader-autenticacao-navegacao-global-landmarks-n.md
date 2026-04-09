# Story 15.1: Screen Reader — Autenticação, Navegação Global & Landmarks (NFR-A4)

Status: ready-for-dev

## Story

As a user who relies on a screen reader,
I want to navigate authentication flows and global navigation using VoiceOver, NVDA, or JAWS,
So that I can access the platform independently from the very first interaction.

## Acceptance Criteria

**Given** a screen reader user accesses the login page
**When** the page loads
**Then** the page has proper landmark structure: `<header role="banner">`, `<nav role="navigation">`, `<main role="main">`, `<footer role="contentinfo">`
**And** the page title (`<title>`) announces "Entrar — {tenantName}" (or platform name if no tenant context)
**And** the login form has `aria-labelledby` pointing to a visible heading "Entrar"

**Given** a screen reader user navigates the login form
**When** they tab through the fields
**Then** each field announces: label text, field type, and required state (e.g., "E-mail, campo de texto, obrigatório")
**And** the password field has a visibility toggle that announces "Mostrar senha" / "Ocultar senha" with `aria-pressed` state
**And** the submit button announces "Entrar" with `role="button"`

**Given** a login attempt fails (invalid credentials)
**When** the error is displayed
**Then** the error message container has `role="alert"` (implicit `aria-live="assertive"`) so it is announced immediately
**And** the error text is descriptive: "E-mail ou senha incorretos" (not just "Erro")
**And** focus moves to the error message or to the first invalid field

**Given** a screen reader user navigates the registration flow
**When** they complete the multi-step form
**Then** each step announces its position: "Passo {n} de {total}: {stepName}" via `aria-label` on the form section
**And** validation errors are announced in real time via `aria-live="polite"` as the user leaves each field
**And** success feedback ("Conta criada com sucesso") uses `role="status"` for polite announcement

**Given** a screen reader user navigates the password reset flow
**When** they request a reset and enter the new password
**Then** all form fields, success messages, and error states follow the same patterns as login (landmarks, `role="alert"`, descriptive labels)

**Given** a screen reader user navigates any page in the platform
**When** they press Tab as the first action
**Then** the skip navigation link "Ir para conteúdo" (already implemented in Epic 12) is the first focusable element and is announced by the screen reader
**And** the sidebar navigation items announce their label and expanded/collapsed state (`aria-expanded`)
**And** the current page in the sidebar is announced as "atual" via `aria-current="page"`
**And** when multiple `<nav>` landmarks exist on the same page (e.g., sidebar + breadcrumbs), each has a distinct `aria-label`: `aria-label="Navegação principal"` vs `aria-label="Breadcrumbs"` — so screen readers can distinguish them

**Given** the page contains text in a language different from PT-BR (e.g., technical terms, feature names)
**When** the screen reader encounters these terms
**Then** inline `lang="en"` (or appropriate language) attributes wrap foreign-language terms so screen readers pronounce them correctly
**And** this applies globally across all pages, not just authentication flows

**Given** the onboarding flow (Epic 10) is accessed by a screen reader user
**When** the user goes through the first-time experience
**Then** all onboarding steps, tooltips, and guided tours are fully accessible (landmarks, focus management, `aria-live` for step transitions)
**And** if any onboarding component is NOT screen-reader accessible, it is documented as a gap and tracked as tech debt for remediation before this epic is considered complete

## Tasks / Subtasks

- [ ] Task 1: Audit and fix login page landmarks and ARIA (AC: #1, #2)
  - [ ] Ensure proper landmark structure: header, nav, main, footer with correct roles
  - [ ] Set dynamic page title "Entrar — {tenantName}"
  - [ ] Add `aria-labelledby` to login form pointing to heading
  - [ ] Ensure all form fields announce: label, type, required state
  - [ ] Add `aria-pressed` to password visibility toggle
- [ ] Task 2: Implement error handling accessibility (AC: #3)
  - [ ] Add `role="alert"` to error message containers
  - [ ] Ensure descriptive error text (not generic)
  - [ ] Implement focus management: move focus to error message or first invalid field
- [ ] Task 3: Fix registration flow accessibility (AC: #4)
  - [ ] Add `aria-label` with step position: "Passo {n} de {total}: {stepName}"
  - [ ] Add `aria-live="polite"` for real-time validation errors
  - [ ] Add `role="status"` for success feedback
- [ ] Task 4: Fix password reset flow accessibility (AC: #5)
  - [ ] Apply same patterns as login: landmarks, role="alert", descriptive labels
- [ ] Task 5: Fix global navigation accessibility (AC: #6)
  - [ ] Verify skip navigation link "Ir para conteúdo" is first focusable element
  - [ ] Add `aria-expanded` to sidebar navigation items
  - [ ] Add `aria-current="page"` to current page in sidebar
  - [ ] Add distinct `aria-label` to each `<nav>` landmark
- [ ] Task 6: Add language attributes for foreign terms (AC: #7)
  - [ ] Audit pages for foreign-language terms
  - [ ] Wrap with inline `lang="en"` (or appropriate) attributes
  - [ ] Apply globally across all pages
- [ ] Task 7: Audit onboarding flow accessibility (AC: #8)
  - [ ] Test all onboarding steps with screen readers
  - [ ] Fix landmarks, focus management, aria-live for step transitions
  - [ ] Document any remaining gaps as tracked tech debt
- [ ] Task 8: Manual testing with screen readers (AC: all)
  - [ ] Test with VoiceOver (macOS/Safari)
  - [ ] Test with NVDA (Windows/Chrome)
  - [ ] Test with TalkBack (Android/Chrome)
  - [ ] Document test results covering: login, registration, password reset, global navigation, onboarding
- [ ] Task 9: Automated testing (AC: all)
  - [ ] Run axe-core regression (CI from Epic 12) — zero new violations
  - [ ] Verify all `role="alert"` announce immediately
  - [ ] Verify all `aria-live="polite"` announce without interrupting
  - [ ] Verify all landmarks present and correctly nested
  - [ ] Verify every `<nav>` has distinct `aria-label`
  - [ ] Language test: verify `lang` attribute on foreign terms (3+ pages)

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### WCAG Compliance
- Target: WCAG 2.1 AA
- Screen readers: VoiceOver (macOS/iOS), NVDA (Windows), TalkBack (Android)
- axe-core in CI (from Epic 12) must pass with zero new violations

### Epic 15 DoD (Transversal)
- Generate axe-core baseline snapshot BEFORE starting this epic
- After completion, compare: violation count must be equal or less
- Any increase indicates regression and blocks DoD

### Dependencies
- Epic 12 (base accessibility infrastructure — keyboard nav, contrast, skip link, axe-core CI)
- Epic 10 (onboarding flow — must be accessible)

### Project Structure Notes
- Frontend auth pages: `apps/web/app/(public)/auth/`
- Layout components: `apps/web/app/(authenticated)/layout.tsx`
- Sidebar: `apps/web/components/navigation/sidebar.tsx`
- i18n: `apps/web/messages/pt-BR.json`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-15.md` (Story 15.1)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
