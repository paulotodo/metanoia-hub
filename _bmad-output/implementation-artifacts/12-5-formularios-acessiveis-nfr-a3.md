# Story 12.5: Formulários Acessíveis (NFR-A3)

Status: ready-for-dev

## Story

As a user relying on assistive technology,
I want all forms to have proper labels, instructions, and error messages,
So that I can fill out forms correctly without visual context.

## Acceptance Criteria

**Given** any form in the application
**When** it renders
**Then** every input has an explicit `<label>` with `htmlFor` matching the input `id`
**And** required fields are marked with `aria-required="true"` and a visual indicator (*)
**And** optional fields are explicitly labeled "(opcional)"
**And** group-related inputs use `<fieldset>` + `<legend>` (e.g., radio groups, checkbox groups)

**Given** a form field has additional instructions or constraints
**When** the field renders
**Then** instructions are linked via `aria-describedby` (e.g., "Mínimo 8 caracteres" for password)
**And** the instruction text has sufficient contrast (4.5:1)

**Given** a user submits a form with validation errors
**When** errors are detected (Zod validation)
**Then** each error message is associated to its field via `aria-describedby`
**And** the error message uses `role="alert"` for immediate screen reader announcement (não combinar com `aria-live` — `role="alert"` já implica `aria-live="assertive"` + `aria-atomic="true"`)
**And** the invalid field has `aria-invalid="true"`
**And** the first field with error is scrolled into view (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) and then receives focus
**And** all error messages are extracted from `apps/web/messages/pt-BR.json` (i18n), never hardcoded — using pastoral vocabulary where appropriate (e.g., key `form.group.name.required` → "Por favor, preencha o nome do grupo")

**Given** a form is submitting (loading state)
**When** the submit button is processing
**Then** the button shows a spinner with `aria-busy="true"` and `aria-label` from i18n (key `form.submitting`)
**And** the button is disabled to prevent double submission

**Formulários auditados (prioridade por complexidade):**

*Must-have (críticos):*
1. Login (email + senha)
2. Registro (nome + email + senha + confirmação)
3. Wizard onboarding (5 steps: perfil, igreja, grupo, líder, radar) — mais complexo

*Should-have:*
4. Criar/editar grupo (nome, descrição, tipo)
5. Convidar membro (email ou CSV)
6. Criar/editar trilha (título, descrição, categoria)
7. Criar/editar módulo e lição
8. Configuração tenant (nome, logo, cores)
9. Branding (palette, logo upload)
10. Upgrade request

**Teste:** jest-axe para cada formulário. Playwright E2E validando `aria-invalid`, `aria-describedby`, `scrollIntoView` + focus management após submit com erro. Verificar que mensagens vêm do i18n (não hardcoded).

## Tasks / Subtasks

- [ ] Task 1: Create accessible form helper components (AC: #1, #2, #3)
  - [ ] 1.1 Create `apps/web/src/components/forms/form-field.tsx` — wraps label + input + description + error
  - [ ] 1.2 Auto-generate `id` and wire `htmlFor`, `aria-describedby`, `aria-invalid`, `aria-required`
  - [ ] 1.3 Required indicator (*) and "(opcional)" label handled automatically
  - [ ] 1.4 Error message with `role="alert"`
  - [ ] 1.5 `<fieldset>` + `<legend>` wrapper for grouped inputs

- [ ] Task 2: Create form submission helpers (AC: #4)
  - [ ] 2.1 Create `apps/web/src/lib/form-utils.ts`
  - [ ] 2.2 `scrollToFirstError()`: find first `aria-invalid="true"` → scrollIntoView → focus
  - [ ] 2.3 Submit button component with `aria-busy="true"`, spinner, disabled state
  - [ ] 2.4 `aria-label` from i18n key `form.submitting`

- [ ] Task 3: Add i18n keys for form messages (AC: #3)
  - [ ] 3.1 Add form error message keys to `apps/web/messages/pt-BR.json`
  - [ ] 3.2 Use pastoral vocabulary where appropriate
  - [ ] 3.3 Keys for: required fields, email format, password constraints, group name, etc.
  - [ ] 3.4 Add `form.submitting` key for loading state

- [ ] Task 4: Audit and fix Login form (AC: all — must-have #1)
  - [ ] 4.1 Add labels with `htmlFor` to email and password inputs
  - [ ] 4.2 Add `aria-required="true"` to both fields
  - [ ] 4.3 Add error messages with `aria-describedby` and `role="alert"`
  - [ ] 4.4 Add `aria-invalid="true"` on validation failure
  - [ ] 4.5 scrollIntoView + focus on first error
  - [ ] 4.6 Submit button with `aria-busy` loading state

- [ ] Task 5: Audit and fix Registration form (AC: all — must-have #2)
  - [ ] 5.1 Labels for: nome, email, senha, confirmação
  - [ ] 5.2 `aria-describedby` for password constraints ("Mínimo 8 caracteres")
  - [ ] 5.3 Error messages from i18n
  - [ ] 5.4 `aria-invalid` on validation errors
  - [ ] 5.5 scrollIntoView + focus management

- [ ] Task 6: Audit and fix Onboarding Wizard forms (AC: all — must-have #3)
  - [ ] 6.1 Step 1 (profile): labels, required indicators, photo upload a11y
  - [ ] 6.2 Step 2 (community): labels, required church name indicator
  - [ ] 6.3 Step 3 (group): labels, radio group with fieldset/legend
  - [ ] 6.4 Step 4 (invite): labels, optional field indicators
  - [ ] 6.5 Step 5 (radar): interactive elements accessible

- [ ] Task 7: Audit and fix should-have forms (AC: all — forms #4-10)
  - [ ] 7.1 Create/edit group form
  - [ ] 7.2 Invite member form
  - [ ] 7.3 Create/edit trail form
  - [ ] 7.4 Create/edit module and lesson forms
  - [ ] 7.5 Tenant configuration form
  - [ ] 7.6 Branding form (color picker, logo upload)
  - [ ] 7.7 Upgrade request form

- [ ] Task 8: Write jest-axe unit tests (AC: all)
  - [ ] 8.1 jest-axe for each must-have form (login, registration, onboarding wizard)
  - [ ] 8.2 jest-axe for each should-have form
  - [ ] 8.3 jest-axe for form-field helper component
  - [ ] 8.4 jest-axe for submit button component

- [ ] Task 9: Write Playwright E2E tests (AC: all)
  - [ ] 9.1 Create `apps/web/e2e/a11y/accessible-forms.e2e-spec.ts`
  - [ ] 9.2 Test `aria-invalid` appears on validation error
  - [ ] 9.3 Test `aria-describedby` links error to field
  - [ ] 9.4 Test scrollIntoView + focus on first error after submit
  - [ ] 9.5 Test error messages come from i18n (not hardcoded)
  - [ ] 9.6 Test `aria-busy` on submit button during loading

## Dev Notes

### File Paths
- `apps/web/src/components/forms/form-field.tsx` — new accessible form helper
- `apps/web/src/lib/form-utils.ts` — scrollToFirstError utility
- `apps/web/messages/pt-BR.json` — i18n form error messages
- `apps/web/e2e/a11y/accessible-forms.e2e-spec.ts` — E2E tests
- Existing form components across all feature areas to audit/fix

### Libraries & Versions
- `jest-axe` for unit-level accessibility testing
- `@axe-core/playwright` (Playwright 1.59.1) for E2E
- Zod 4.3.6 (validation errors trigger a11y patterns)
- shadcn/ui Form components (Radix-based)
- next-intl or similar for i18n message extraction

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **`role="alert"`** for error messages — NOT combined with `aria-live` (redundant)
- **`aria-describedby`** links instructions and errors to their fields
- **`scrollIntoView` + focus** on first error after form submission
- **i18n messages only** — no hardcoded error strings
- **Pastoral vocabulary** in user-facing error messages
- **Reusable form-field component** to enforce a11y patterns consistently

### Dependencies
- Story 12.3 — contrast requirements for instruction text
- Epic 2 — login/registration forms
- Story 10.1 — onboarding wizard forms
- All Epics with forms — forms must exist to audit

### Project Structure Notes
- Form helpers at `apps/web/src/components/forms/`
- Form utilities at `apps/web/src/lib/`
- i18n messages centralized in `apps/web/messages/pt-BR.json`
- E2E tests at `apps/web/e2e/a11y/`

### References
- `_bmad-output/planning-artifacts/epics/epic-12.md` — Epic 12 source
- `docs/project-context.md` — 47 implementation rules (NFR-A3)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
