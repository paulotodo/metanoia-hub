# Story 12.2: Navegação por Teclado — Fluxos Autenticados (NFR-A1)

Status: ready-for-dev

## Story

As a user with motor disabilities or keyboard preference,
I want to navigate all authenticated flows using only the keyboard,
So that I can manage groups, trails, config, and plans without a mouse.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 0: Generate axe-core baseline report for authenticated flows (AC: baseline)
  - [ ] 0.1 Run `@axe-core/playwright` on all authenticated flows before fixes
  - [ ] 0.2 Save baseline report as artifact

- [ ] Task 1: Audit and fix dashboard keyboard navigation (AC: #1)
  - [ ] 1.1 Verify focus order: skip link → sidebar → main content → action buttons
  - [ ] 1.2 Verify sidebar Arrow Up/Down navigation
  - [ ] 1.3 Verify experience switching keyboard access
  - [ ] 1.4 Fix any focus order issues

- [ ] Task 2: Audit and fix group CRUD keyboard navigation (AC: #2)
  - [ ] 2.1 Create group form: all fields navigable by Tab
  - [ ] 2.2 Edit group: all fields and save/cancel buttons accessible
  - [ ] 2.3 Delete group: confirmation dialog keyboard accessible
  - [ ] 2.4 Member invitation: email input and CSV upload button navigable

- [ ] Task 3: Audit and fix trail builder keyboard navigation (AC: #3)
  - [ ] 3.1 Add keyboard alternative for drag-and-drop reordering
  - [ ] 3.2 Create `MoveUpButton` and `MoveDownButton` with `aria-label` (e.g., "Mover módulo para cima")
  - [ ] 3.3 Verify all content editing fields navigable by Tab
  - [ ] 3.4 Verify module/lesson CRUD forms accessible

- [ ] Task 4: Audit and fix trail catalog keyboard navigation (AC: #4)
  - [ ] 4.1 Search input focable and functional
  - [ ] 4.2 Filter dropdowns keyboard-navigable
  - [ ] 4.3 Result cards activable with Enter
  - [ ] 4.4 Pagination controls accessible

- [ ] Task 5: Audit and fix tenant settings keyboard navigation (AC: #5)
  - [ ] 5.1 Settings form fields navigable by Tab
  - [ ] 5.2 Color picker keyboard alternative (hex input or arrow keys)
  - [ ] 5.3 File upload button focable and activable via Enter/Space
  - [ ] 5.4 Logo preview accessible

- [ ] Task 6: Audit and fix plans/upgrade keyboard navigation (AC: #6)
  - [ ] 6.1 Plan comparison cards navigable with Tab
  - [ ] 6.2 Plan details expandable with Enter
  - [ ] 6.3 "Assinar Pro" and "Falar com vendas" CTAs focable and activable
  - [ ] 6.4 Upgrade request flow fully navigable

- [ ] Task 7: Write Playwright E2E tests (AC: all)
  - [ ] 7.1 Dashboard keyboard navigation test
  - [ ] 7.2 Group CRUD keyboard test
  - [ ] 7.3 Trail builder keyboard test (including reorder alternative)
  - [ ] 7.4 Trail catalog search/filter keyboard test
  - [ ] 7.5 Settings keyboard test
  - [ ] 7.6 Plans/upgrade keyboard test

- [ ] Task 8: Generate final axe-core report and compare (AC: baseline)
  - [ ] 8.1 Run axe-core after all fixes
  - [ ] 8.2 Generate comparison: baseline vs. final
  - [ ] 8.3 Document issues found, fixed, and tech debt

- [ ] Task 9: Cross-browser manual testing (AC: all)
  - [ ] 9.1 Chrome manual test checklist
  - [ ] 9.2 Firefox manual test checklist
  - [ ] 9.3 Safari manual test checklist

## Dev Notes

### File Paths
- Various existing components across `apps/web/src/` to audit and fix
- `apps/web/e2e/a11y/keyboard-authenticated.e2e-spec.ts` — E2E tests
- Trail builder reorder buttons: `apps/web/src/components/trails/` (new move buttons)

### Libraries & Versions
- Playwright 1.59.1 with `page.keyboard` for E2E tests
- `@axe-core/playwright` for automated accessibility checks
- shadcn/ui components (Radix-based — generally accessible by default)
- Tailwind CSS 4.2.2 for focus utilities

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **Drag-and-drop alternative**: move up/down buttons with `aria-label` for keyboard users
- **Baseline → fix → final** methodology (same as Story 12.1)
- **Severity classification**: blocker > major > minor
- **Color picker alternative**: hex input field as keyboard-accessible fallback

### Dependencies
- Story 12.1 — skip navigation and infrastructure (must be done first)
- Epic 1 — dashboard layout
- Epic 3 — group CRUD flows (must exist)
- Epic 4 — trail builder (must exist)
- Epic 8 — trail catalog (must exist)
- Epic 11 — plans/upgrade UI (must exist)

### Project Structure Notes
- Audit touches components across multiple feature areas
- New keyboard alternatives added inline to existing components
- E2E tests in dedicated a11y directory

### References
- `_bmad-output/planning-artifacts/epics/epic-12.md` — Epic 12 source
- `docs/project-context.md` — 47 implementation rules (NFR-A1)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
