# Story 12.4: Touch Targets, Reduced Motion & Mobile Feedback (NFR-A2, UX-DR19)

Status: ready-for-dev

## Story

As a user on mobile or with motion sensitivity,
I want touch-friendly targets and respect for motion preferences,
So that I can interact comfortably on any device.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Audit touch target sizes across all interactive elements (AC: #1)
  - [ ] 1.1 Audit buttons: verify ≥ 44×44px on mobile
  - [ ] 1.2 Audit links: verify ≥ 44×44px touch area (padding if needed)
  - [ ] 1.3 Audit inputs, checkboxes, radio buttons
  - [ ] 1.4 Audit tabs, sidebar items
  - [ ] 1.5 Audit cards with CTA areas
  - [ ] 1.6 Verify ≥ 8px gap between adjacent targets

- [ ] Task 2: Fix undersized touch targets (AC: #1)
  - [ ] 2.1 Add `min-h-[44px] min-w-[44px]` to undersized interactive elements on mobile
  - [ ] 2.2 Add padding to links/text buttons to meet 44px target
  - [ ] 2.3 Adjust spacing between adjacent targets to ≥ 8px gap
  - [ ] 2.4 Use responsive classes: apply on `md:` breakpoint down only if desktop targets are intentionally smaller

- [ ] Task 3: Implement touch feedback (AC: #2)
  - [ ] 3.1 Add `active:opacity-80` or `active:scale-[0.98]` to interactive elements
  - [ ] 3.2 Apply to: buttons, links, cards with CTA, sidebar items, tabs
  - [ ] 3.3 Ensure feedback is immediate (no transition delay on `:active`)
  - [ ] 3.4 Create shared Tailwind utility or class for consistent touch feedback

- [ ] Task 4: Implement reduced motion support (AC: #3)
  - [ ] 4.1 Audit all animations/transitions in the codebase
  - [ ] 4.2 Wrap with `motion-safe:` prefix or `prefers-reduced-motion` media query
  - [ ] 4.3 Page transitions: disable or opacity-only
  - [ ] 4.4 Toast entrance/exit: disable animation, instant show/hide
  - [ ] 4.5 Skeleton shimmer: disable animation
  - [ ] 4.6 Dropdown open/close: instant, no slide/fade
  - [ ] 4.7 Add global CSS: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` as safety net

- [ ] Task 5: Write Playwright E2E tests for reduced motion (AC: #3)
  - [ ] 5.1 Create `apps/web/e2e/a11y/reduced-motion.e2e-spec.ts`
  - [ ] 5.2 Use `page.emulateMedia({ reducedMotion: 'reduce' })`
  - [ ] 5.3 Verify toast appears without animation
  - [ ] 5.4 Verify dropdown opens without animation
  - [ ] 5.5 Verify skeleton has no shimmer

- [ ] Task 6: Write touch target validation tests (AC: #1)
  - [ ] 6.1 jest-axe tests for touch target sizing
  - [ ] 6.2 Playwright tests with mobile viewport for target size verification

- [ ] Task 7: Manual mobile device testing (AC: #1, #2)
  - [ ] 7.1 Test on real mobile device (iOS Safari, Android Chrome)
  - [ ] 7.2 Verify touch targets are easily tappable
  - [ ] 7.3 Verify touch feedback is visible and immediate
  - [ ] 7.4 Document any device-specific issues

## Dev Notes

### File Paths
- `packages/ui/src/` — base component styles for touch targets and feedback
- `apps/web/src/app/globals.css` — reduced motion safety net CSS
- `apps/web/e2e/a11y/reduced-motion.e2e-spec.ts` — E2E tests
- Various component files for touch target fixes

### Libraries & Versions
- Playwright 1.59.1 with `page.emulateMedia({ reducedMotion: 'reduce' })`
- Tailwind CSS 4.2.2 for `active:`, `motion-safe:`, responsive utilities
- `jest-axe` for unit tests
- shadcn/ui components

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Key Patterns
- **44×44px minimum** touch targets with **8px gap** between adjacent
- **`active:opacity-80`** for immediate touch feedback
- **`motion-safe:` prefix** for Tailwind animations
- **Global reduced-motion safety net** as fallback CSS
- **Real device testing** required (emulators not sufficient for touch)

### Dependencies
- Story 12.1, 12.2 — keyboard navigation done first
- Story 12.3 — contrast/focus visible done first
- All Epics 1-11 — components to audit must exist

### Project Structure Notes
- Changes span across multiple component files
- Reduced motion CSS in global stylesheet
- E2E tests in a11y directory

### References
- `_bmad-output/planning-artifacts/epics/epic-12.md` — Epic 12 source
- `docs/project-context.md` — 47 implementation rules (NFR-A2, UX-DR19)
- `_bmad-output/planning-artifacts/architecture.md` — Architecture decisions
