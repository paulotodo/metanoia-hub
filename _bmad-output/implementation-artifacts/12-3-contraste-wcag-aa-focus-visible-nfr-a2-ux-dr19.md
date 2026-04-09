# Story 12.3: Contraste WCAG AA & Focus Visible (NFR-A2, UX-DR19)

Status: ready-for-dev

## Story

As a user with low vision,
I want all text, icons, and interactive elements to meet WCAG AA contrast ratios with visible focus indicators,
So that I can read and interact with the platform comfortably.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Audit design token contrast ratios (AC: #1)
  - [ ] 1.1 Extract all color tokens from `packages/config/tailwind.preset.ts`
  - [ ] 1.2 Calculate contrast ratios for all text × surface combinations
  - [ ] 1.3 Identify pairs below 4.5:1 (normal text) or 3:1 (large text/graphics)
  - [ ] 1.4 Document findings and required adjustments

- [ ] Task 2: Fix failing contrast ratios in design tokens (AC: #1)
  - [ ] 2.1 Adjust token values in `packages/config/tailwind.preset.ts` where needed
  - [ ] 2.2 Ensure all text × surface combinations meet WCAG AA
  - [ ] 2.3 Graphical elements and icons meet 3:1 minimum
  - [ ] 2.4 Verify fixes don't break visual design intent

- [ ] Task 3: Configure consistent focus ring across all interactive elements (AC: #2)
  - [ ] 3.1 Set `--ring` CSS variable in shadcn theme to match `brand-teal`
  - [ ] 3.2 Apply `focus-visible:ring-2 ring-brand-teal/30 ring-offset-2` as default for all interactive elements
  - [ ] 3.3 Use `:focus-visible` (not `:focus`) throughout
  - [ ] 3.4 Update `packages/ui/` base component styles if needed
  - [ ] 3.5 Verify consistency across Chrome, Firefox, Safari

- [ ] Task 4: Audit and fix semáforo indicators (AC: #3)
  - [ ] 4.1 Verify care-urgent uses icon (⚠️) + text ("precisa de cuidado") alongside color
  - [ ] 4.2 Verify care-attention uses icon (👀) + text ("merece atenção") alongside color
  - [ ] 4.3 Verify care-ok uses icon (✓) + text ("está bem") alongside color
  - [ ] 4.4 Ensure color is NEVER the sole indicator
  - [ ] 4.5 Note: only validatable after Epic 7 is done

- [ ] Task 5: Add jest-axe tests to components (AC: all)
  - [ ] 5.1 Add jest-axe to Button, Input, Select, Checkbox, Radio, Tab components
  - [ ] 5.2 Add jest-axe to Link and navigation components
  - [ ] 5.3 Add jest-axe to semáforo/status indicator components
  - [ ] 5.4 Verify all pass with zero violations

- [ ] Task 6: Add Playwright axe-core E2E tests (AC: all)
  - [ ] 6.1 Create `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts`
  - [ ] 6.2 Run axe-core on key pages: login, dashboard, groups list, trail detail
  - [ ] 6.3 Verify focus ring visibility on interactive elements

- [ ] Task 7: Cross-browser manual testing (AC: #2)
  - [ ] 7.1 Chrome: verify focus ring on all interactive element types
  - [ ] 7.2 Firefox: verify focus ring on all interactive element types
  - [ ] 7.3 Safari: verify focus ring on all interactive element types
  - [ ] 7.4 Document any browser-specific inconsistencies

## Dev Notes

### File Paths
- `packages/config/tailwind.preset.ts` — design tokens to audit/fix
- `packages/ui/src/` — base component styles for focus ring
- `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts` — E2E tests
- Component files across `packages/ui/` and `apps/web/` for jest-axe tests

### Libraries & Versions
- `jest-axe` for unit-level accessibility testing
- `@axe-core/playwright` (Playwright 1.59.1) for E2E a11y checks
- `color2k` for contrast ratio calculations (if creating automated checks)
- Tailwind CSS 4.2.2 for `focus-visible:ring-*` utilities
- shadcn/ui components (Radix-based)

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **WCAG AA thresholds**: 4.5:1 normal text, 3:1 large text/graphics
- **`:focus-visible`** not `:focus` — avoids mouse-click ring
- **Color is never the sole indicator** — always icon + text companion
- **Design token audit first**, then component fixes

### Dependencies
- Epic 1 (Story 1.7) — design tokens in `tailwind.preset.ts`
- Epic 7 — semáforo indicators (AC #3 only validatable after Epic 7)
- Story 12.1 — infrastructure (skip nav, focus trap) should be done first

### Project Structure Notes
- Token fixes in `packages/config/`
- Component style fixes in `packages/ui/`
- E2E tests at `apps/web/e2e/a11y/`

### References
- `_bmad-output/planning-artifacts/epics/epic-12.md` — Epic 12 source
- `docs/project-context.md` — 47 implementation rules (NFR-A2, UX-DR19)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
