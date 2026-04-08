## Epic 12: Hardening de Acessibilidade & Qualidade UX

Auditoria completa de acessibilidade sobre todos os fluxos implementados nos Epics 1-11. Foco em navegação por teclado, contraste WCAG AA, formulários acessíveis e teste automatizado no CI. Componentes base já usam Radix (acessíveis por padrão); este épico cobre gaps de integração, validação manual e quality gates.

**Nota de escopo:** Screen reader testing (NFR-A4: compatibilidade com VoiceOver/NVDA/JAWS) é escopo de Release 2, não deste épico. Este épico cobre keyboard nav, contraste visual, formulários e CI gates. Stakeholders devem estar cientes de que acessibilidade "completa" inclui R2.

**NFRs cobertos:** NFR-A1, NFR-A2, NFR-A3
**UX-DRs cobertos:** UX-DR19, UX-DR21
**Pré-requisito:** Epics 1-11 (fluxos a auditar devem existir)

**Definition of Done (transversal):** Relatório de auditoria documentado com: issues encontradas, issues corrigidas, e issues aceitas como tech debt para R2 (se houver). axe-core report baseline (antes) vs. report final (depois) para medir progresso.

### Story 12.1: Navegação por Teclado — Fluxos Públicos & Infraestrutura (NFR-A1)

As a user with motor disabilities or keyboard preference,
I want to navigate public flows and infrastructure components using only the keyboard,
So that I can access the platform from the first interaction without depending on a mouse.

**Acceptance Criteria:**

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

### Story 12.2: Navegação por Teclado — Fluxos Autenticados (NFR-A1)

As a user with motor disabilities or keyboard preference,
I want to navigate all authenticated flows using only the keyboard,
So that I can manage groups, trails, config, and plans without a mouse.

**Acceptance Criteria:**

**Given** a user navigates the dashboard (3 experiências: Consumo, Gestão, Admin)
**When** they use Tab through the main layout
**Then** focus follows: skip link → sidebar nav → main content area → action buttons
**And** sidebar items are navigable with Arrow Up/Down, Enter to select
**And** experience switching (if applicable) is keyboard-accessible

**Given** a user navigates CRUD de grupos (Epic 3)
**When** they create, edit, or delete a group
**Then** all form fields, buttons, and confirmation dialogs are keyboard-accessible
**And** the member invitation flow (email input, CSV upload button) is fully navigable

**Given** a user navigates CRUD de trilhas, módulos e lições (Epic 4)
**When** they interact with the trail builder
**Then** drag-and-drop reordering has a keyboard alternative (move up/down buttons with `aria-label`)
**And** all content editing fields are navigable by Tab

**Given** a user navigates the catálogo de trilhas e busca (Epic 8)
**When** they search and filter trails
**Then** search input, filter dropdowns, and result cards are all keyboard-navigable
**And** result cards can be activated with Enter

**Given** a user navigates configuração do tenant e branding (Epic 6)
**When** they edit settings and upload logo
**Then** color picker (if present) has keyboard alternative
**And** file upload button is focable and activable via Enter/Space

**Given** a user navigates gestão de planos e upgrade (Epic 11)
**When** they view the comparison table and initiate upgrade
**Then** plan cards are navigable with Tab, details expandable with Enter
**And** "Assinar Pro" and "Falar com vendas" CTAs are focable

**Fluxos auditados:**
1. Dashboard — 3 experiências (Epic 1)
2. CRUD de grupos e convite de membros (Epic 3)
3. CRUD de trilhas, módulos e lições (Epic 4)
4. Catálogo de trilhas e busca (Epic 8)
5. Configuração do tenant e branding (Epic 6)
6. Gestão de planos e upgrade (Epic 11)

**Teste:** Playwright E2E com `page.keyboard` para cada fluxo. Teste manual cross-browser: Chrome, Firefox, Safari. Mesmo checklist de severidade da Story 12.1.

### Story 12.3: Contraste WCAG AA & Focus Visible (NFR-A2, UX-DR19)

As a user with low vision,
I want all text, icons, and interactive elements to meet WCAG AA contrast ratios with visible focus indicators,
So that I can read and interact with the platform comfortably.

**Acceptance Criteria:**

**Given** the design token palette defined in `tailwind.preset.ts`
**When** text is rendered on any surface
**Then** the contrast ratio meets the minimum: 4.5:1 for normal text (< 18px), 3:1 for large text (≥ 18px bold or ≥ 24px regular)
**And** graphical elements and icons meet 3:1 minimum against their background

**Given** any interactive element (button, link, input, select, checkbox, radio, tab)
**When** the element receives keyboard focus
**Then** a visible focus ring is displayed using Tailwind/shadcn utilities: `focus-visible:ring-2 ring-brand-teal/30 ring-offset-2`
**And** the `--ring` CSS variable from shadcn theme is configured to match `brand-teal`
**And** `:focus-visible` is used (not `:focus`) to avoid showing ring on mouse clicks
**And** behavior is consistent across Chrome, Firefox, and Safari

**Given** the pastoral status indicators (semáforo colors) — *validável somente após Epic 7 estar done*
**When** displaying care status
**Then** color is NEVER the only indicator — always accompanied by icon + descriptive text
**And** care-urgent (#C1666B) + ⚠️ + "precisa de cuidado"
**And** care-attention (#D4A24C) + 👀 + "merece atenção"
**And** care-ok (#7BA38A) + ✓ + "está bem"

**Teste:** jest-axe (unit) para cada componente. Playwright com `@axe-core/playwright` para E2E. Teste manual cross-browser (Chrome, Firefox, Safari) com foco em focus ring visibility.

### Story 12.4: Touch Targets, Reduced Motion & Mobile Feedback (NFR-A2, UX-DR19)

As a user on mobile or with motion sensitivity,
I want touch-friendly targets and respect for motion preferences,
So that I can interact comfortably on any device.

**Acceptance Criteria:**

**Given** any interactive element on mobile or touch devices
**When** rendered
**Then** touch targets are ≥ 44×44px with ≥ 8px gap between adjacent targets
**And** this applies to: buttons, links, inputs, checkboxes, tabs, sidebar items, cards with CTA

**Given** a user touches an interactive element on mobile
**When** the touch begins (`:active` state)
**Then** visual feedback is provided: opacity reduction (`active:opacity-80`) or subtle scale (`active:scale-[0.98]`)
**And** the feedback is immediate (no delay) to confirm the touch was registered
**And** this is especially important for users with cognitive disabilities who need confirmation

**Given** the user has `prefers-reduced-motion: reduce` in OS settings
**When** any animation or transition would play
**Then** it is disabled or reduced to opacity-only (no motion)
**And** this applies to: page transitions, toast entrance/exit, skeleton shimmer, dropdown open/close
**And** verified via Playwright `page.emulateMedia({ reducedMotion: 'reduce' })` (supported since Playwright 1.12+)

**Teste:** Playwright E2E com `emulateMedia({ reducedMotion: 'reduce' })` para motion. Teste manual em dispositivo móvel real para touch targets e feedback. jest-axe para validar touch target sizing.

### Story 12.5: Formulários Acessíveis (NFR-A3)

As a user relying on assistive technology,
I want all forms to have proper labels, instructions, and error messages,
So that I can fill out forms correctly without visual context.

**Acceptance Criteria:**

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

### Story 12.6: Teste Automatizado de Contraste & axe-core Quality Gate no CI (UX-DR21)

As a developer,
I want automated accessibility checks running in CI,
So that contrast regressions and a11y violations are caught before merge and never reach production.

**Acceptance Criteria:**

**Given** the project's design tokens
**When** the CI contrast script (`scripts/check-contrast.ts`) runs
**Then** it receives the token file path as parameter (`--tokens-path`), defaulting to `packages/config/tailwind.preset.ts` — never hardcoded
**And** it extracts all color tokens: text colors (`brand-*`, `care-*`, `neutral-*`) and surface colors (`surface-*`, `white`, `brand-*-dark`)
**And** it generates a matrix of all text × surface combinations
**And** it calculates WCAG contrast ratio for each pair using `color2k` (tree-shakeable, actively maintained — preferido sobre `wcag-contrast` que tem manutenção questionável)
**And** it flags any pair below 4.5:1 (normal text) or 3:1 (large text/graphics)

**Given** the script finds contrast violations
**When** it outputs the report
**Then** each violation shows: `[FAIL] text: brand-teal (#3AAFA9) on surface: surface-base (#FAFAF8) → ratio: 3.2:1 (min: 4.5:1)`
**And** it suggests a fix: `Suggestion: use brand-teal-dark (#17252A) instead (ratio: 14.1:1)`
**And** the script exits with code 1, blocking the PR merge

**Given** all token pairs pass contrast checks
**When** the script completes
**Then** it outputs a summary: `✓ {N} color pairs checked. All pass WCAG AA.`
**And** the script exits with code 0
**And** a `--verbose` flag shows ALL pairs (pass + fail) for full audit

**Given** a developer pushes a PR that modifies any file in `packages/config/`, `packages/ui/`, or `scripts/check-contrast.ts`
**When** the GitHub Actions workflow (`.github/workflows/a11y-checks.yml`) runs
**Then** the contrast script runs as one step
**And** `@axe-core/playwright` runs as a second step against the key pages (login, dashboard, groups list, trail detail) — this is a **permanent quality gate**, not limited to Epic 12
**And** both steps must pass for the PR check to succeed
**And** the workflow path filter covers `packages/config/**`, `packages/ui/**`, `apps/web/src/**`, and `scripts/check-contrast.ts`

**Given** a developer needs to understand a failure
**When** they read the CI output
**Then** the contrast script includes a legend explaining WCAG AA thresholds and how to fix
**And** the axe-core step generates an HTML report artifact attached to the workflow run

**Given** the axe-core quality gate runs on E2E
**When** new pages or components are added in future epics
**Then** the page list in the workflow config (`a11y-pages.json`) is extensible — devs add new pages to audit
**And** the workflow README documents how to add pages

**Teste:** Unit test do script com tokens de teste (pares que passam e pares que falham). Integration test do workflow via `act` (GitHub Actions local runner). Verificar que axe-core report é gerado como artifact.

---

