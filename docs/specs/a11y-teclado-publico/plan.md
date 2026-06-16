# Technical Plan: Keyboard Navigation — Public Flows & Infrastructure

**Feature**: `a11y-teclado-publico`
**Plan Date**: 2026-06-16
**Status**: Draft
**Spec**: docs/specs/a11y-teclado-publico/spec.md
**Story**: _bmad-output/implementation-artifacts/12-1-navegacao-por-teclado-fluxos-publicos-infraestrutura-nf.md

---

## Architecture Overview

This feature is **UI-only and stateless**. No database changes, no API changes,
no server-side logic. All changes are confined to:

- `apps/web/` — Next.js 16.2 App Router (App Router lives at `apps/web/app/`)
- `apps/web/src/components/a11y/` — new accessibility components
- `apps/web/e2e/` — Playwright E2E tests (keyboard navigation scenarios)
- `_bmad-output/implementation-artifacts/a11y/` — axe-core audit reports

**No tenant/DB involvement** — feature is purely client-side UI behavior.

---

## Implementation Approach by User Story

### Sub-task 0 — axe-core Baseline Audit (US7, FR-012)

Run BEFORE any code change.

```
Package: @axe-core/playwright (already installed per RECONCILIACAO-EPIC12.md)
Script: apps/web/e2e/a11y/axe-baseline.spec.ts
Output: _bmad-output/implementation-artifacts/a11y/axe-baseline-public.json
Flows audited: /, /login, /cadastro, /sobre (all public routes)
```

The baseline is the reference for SC-006 (zero regressions introduced).

---

### Task 1 — Skip Navigation Link (US1, FR-001, SC-001)

**Component**: `apps/web/src/components/a11y/skip-nav.tsx`

Structure:
```tsx
// SkipNav — renders as first DOM element inside <body>
// Visually hidden at rest (sr-only pattern), visible on :focus-visible
// Target: <main id="conteudo"> (Portuguese: "content" in pastoral vocabulary)
export function SkipNav() {
  return (
    <a
      href="#conteudo"
      className="skip-nav"
    >
      Ir para o conteúdo
    </a>
  )
}
```

CSS (Tailwind utility class or global CSS):
```css
.skip-nav {
  position: absolute;
  transform: translateY(-100%);
  /* visible on focus */
}
.skip-nav:focus-visible {
  transform: translateY(0);
  z-index: 9999;
  background: white; /* solid opaque — WCAG contrast >= 4.5:1 */
}
```

**Integration points** — add `<SkipNav />` as first child of `<body>` and
`id="conteudo"` to `<main>` in ALL public layouts:

| Layout | Path |
|--------|------|
| Public layout | `apps/web/app/(public)/layout.tsx` |
| Marketing layout | `apps/web/app/(marketing)/layout.tsx` |
| Authenticated layout | `apps/web/app/(authenticated)/layout.tsx` |
| Root layout | `apps/web/app/layout.tsx` |

If a layout does not have a `<main>` element yet, wrap the `{children}` in
`<main id="conteudo">`.

---

### Task 2 — Login Flow Keyboard Navigation (US2, FR-002, FR-004, FR-005)

**Files to audit/fix**:
- `apps/web/app/(public)/login/page.tsx` (or equivalent path)
- Login form component (locate via `grep -r "LoginForm\|login-form" apps/web/src`)

**Checklist**:
- [ ] Tab order matches visual top-to-bottom order (email → password → submit)
- [ ] No tabindex values that disrupt natural DOM order
- [ ] :focus-visible ring on all interactive elements (not suppressed globally)
- [ ] Password visibility toggle: focusable, responds to Space/Enter
- [ ] Submit button responds to Enter

**Focus-visible ring approach**: Do NOT add a global focus-ring standardization
— that is Story 12.3 scope. Only ensure no `outline: none` suppression exists
on login form elements.

---

### Task 3 — Registration Flow Keyboard Navigation (US3, FR-003, FR-004, FR-005)

**Files to audit/fix**:
- `apps/web/app/(public)/cadastro/page.tsx` (or equivalent)
- Registration form component

**Checklist**:
- [ ] Tab order: name → email → password → password-confirm → submit
- [ ] Password visibility toggle(s) on both password fields
- [ ] :focus-visible ring on all fields

Same approach as Task 2.

---

### Task 4 — Modal Dialog Focus Trap Validation (US4, FR-006, FR-007, FR-008, SC-004)

**Architecture**: Radix Dialog provides native focus trap — validate, do NOT reimplement.

**Three modals to validate** (FR-013 minimum):
1. Confirmation dialog (generic — locate via `grep -r "AlertDialog\|ConfirmDialog" apps/web/src`)
2. Create group modal
3. Settings modal (or any third distinct modal)

**Validation per modal**:
- Tab cycles only within modal (focus does not escape)
- Escape closes modal + focus returns to trigger
- `role="dialog"` and `aria-modal="true"` present in DOM

**Fix if Radix Dialog is not being used**: Replace custom modal implementation
with Radix Dialog (`@radix-ui/react-dialog` via shadcn Dialog component).

---

### Task 5 — Dropdown & Menu Keyboard Navigation (US5, FR-009, Q3 decision dec-009)

**Architecture**: Radix UI via shadcn — DropdownMenu, NavigationMenu, Select.
These implement ARIA keyboard patterns natively (Arrow keys, Enter, Escape).

**Approach**: Validate existing Radix components, fix gaps only.

**Components to test**:
- Header/navbar dropdowns (user menu, etc.)
- Sidebar navigation items
- Action menus in data tables (if any in public flows)

**Gaps to fix**: If any Radix component is wrapped in a custom element that
intercepts keyboard events (e.g., `onKeyDown` with `e.preventDefault()`),
remove or adjust the override.

---

### Task 6 — Loading States Focus Stability (US6, FR-010, FR-011)

**Skeleton components audit**:
- Locate all skeleton/loading components: `grep -r "Skeleton\|skeleton\|loading-placeholder" apps/web/src`
- Ensure each carries `aria-hidden="true"` OR `tabindex="-1"`
- Ensure they do NOT render focusable children (buttons, links, inputs)

**SSR hydration stability**:
- Avoid `autoFocus` on elements that change during hydration
- Use `suppressHydrationWarning` only where semantically correct
- Validate: navigate to a SSR page with skeleton → Tab immediately → focus should stay stable

---

### Task 7 — axe-core Final Audit & Report (US7, FR-012, SC-006)

After all fixes:
```
Script: apps/web/e2e/a11y/axe-final.spec.ts
Output: _bmad-output/implementation-artifacts/a11y/axe-final-public.json
```

Comparison artifact: `_bmad-output/implementation-artifacts/a11y/axe-delta-report.md`
Documents: violations resolved, violations new (must = 0), tech debt accepted (TD-001).

---

### Task 8 — E2E Playwright Tests (SC-007)

**Location**: `apps/web/e2e/keyboard/`

Test files:
- `skip-nav.spec.ts` — US1 (Tab → skip link visible → Enter → focus on #conteudo)
- `login-keyboard.spec.ts` — US2 (Tab order, password toggle, Enter submit)
- `register-keyboard.spec.ts` — US3 (Tab order, all fields, toggles)
- `modal-focus-trap.spec.ts` — US4 (3 modals: focus trap + Escape)
- `dropdown-keyboard.spec.ts` — US5 (Arrow nav, Enter activate, Escape close)
- `skeleton-focus.spec.ts` — US6 (Tab during loading, no skeleton focus)

**Playwright config**: Chromium only (Q1 decision dec-012). Do NOT add
Firefox or WebKit projects to `playwright.config.ts`.

**Key patterns**:
```ts
// Navigate by keyboard only
await page.keyboard.press('Tab');
await expect(page.locator('.skip-nav')).toBeFocused();

// Verify focus is on main content
await page.keyboard.press('Enter');
await expect(page.locator('#conteudo')).toBeFocused();
```

---

### Task 9 — Manual Cross-Browser Checklist (SC-008, Q1 decision dec-012)

Manual verification in Chrome, Firefox, Safari. NOT automated CI.

Checklist to document in `_bmad-output/implementation-artifacts/a11y/cross-browser-checklist.md`:

For each browser × each US (US1–US6):
- [ ] Skip nav appears on Tab, activates on Enter
- [ ] Login Tab order correct
- [ ] Registration Tab order correct
- [ ] Modal focus trap works
- [ ] Dropdown Arrow nav works
- [ ] No skeleton receives focus

Severity classification for any finding: **blocker** (prevents use) / **major** (significant friction) / **minor** (cosmetic).

---

## File Inventory

| File | Action | US |
|------|--------|----|
| `apps/web/src/components/a11y/skip-nav.tsx` | CREATE new | US1 |
| `apps/web/app/(public)/layout.tsx` | MODIFY: add SkipNav + id="conteudo" on main | US1 |
| `apps/web/app/(marketing)/layout.tsx` | MODIFY: add SkipNav + id="conteudo" on main | US1 |
| `apps/web/app/(authenticated)/layout.tsx` | MODIFY: add SkipNav + id="conteudo" on main | US1 |
| `apps/web/app/layout.tsx` | MODIFY: add SkipNav as first child of body | US1 |
| `apps/web/app/(public)/login/page.tsx` | AUDIT/FIX: tab order, focus-visible | US2 |
| `apps/web/app/(public)/cadastro/page.tsx` | AUDIT/FIX: tab order, toggles | US3 |
| Skeleton components (multiple) | AUDIT/FIX: aria-hidden or tabindex=-1 | US6 |
| `apps/web/e2e/a11y/axe-baseline.spec.ts` | CREATE new | US7 |
| `apps/web/e2e/a11y/axe-final.spec.ts` | CREATE new | US7 |
| `apps/web/e2e/keyboard/skip-nav.spec.ts` | CREATE new | US1 |
| `apps/web/e2e/keyboard/login-keyboard.spec.ts` | CREATE new | US2 |
| `apps/web/e2e/keyboard/register-keyboard.spec.ts` | CREATE new | US3 |
| `apps/web/e2e/keyboard/modal-focus-trap.spec.ts` | CREATE new | US4 |
| `apps/web/e2e/keyboard/dropdown-keyboard.spec.ts` | CREATE new | US5 |
| `apps/web/e2e/keyboard/skeleton-focus.spec.ts` | CREATE new | US6 |
| `_bmad-output/implementation-artifacts/a11y/axe-baseline-public.json` | GENERATED by test | US7 |
| `_bmad-output/implementation-artifacts/a11y/axe-final-public.json` | GENERATED by test | US7 |
| `_bmad-output/implementation-artifacts/a11y/axe-delta-report.md` | GENERATED | US7 |
| `_bmad-output/implementation-artifacts/a11y/cross-browser-checklist.md` | CREATE template | Task9 |

---

## Tech Stack Constraints

- **Next.js 16.2 App Router** — Server Components by default; skip-nav is a
  Client Component only if it needs useState (it does not — pure anchor).
  Can be a Server Component.
- **Tailwind CSS 4.2.2** — use utility classes for skip-nav styling.
- **Radix UI via shadcn** — US4 and US5 rely on native Radix focus management.
  Do not add custom keyboard event handlers on top of Radix.
- **Playwright 1.59.1** — E2E tests; `@axe-core/playwright` already installed.
- **TypeScript strict** — all new files must compile with `strict: true`.
- **No new dependencies** — all required packages are already installed.
- **No DB / API changes** — feature is purely UI/stateless.

---

## Validation Before Done

```bash
# TypeScript: no new type errors
pnpm turbo build --filter @metanoia/web

# Lint: zero warnings
pnpm turbo lint --filter @metanoia/web -- --max-warnings 0

# E2E: all keyboard tests pass (Chromium)
pnpm --filter @metanoia/web exec playwright test apps/web/e2e/keyboard/
pnpm --filter @metanoia/web exec playwright test apps/web/e2e/a11y/
```

---

## Out of Scope (this story)

- Focus-ring global standardization → Story 12.3
- Authenticated-area keyboard navigation → Story 12.2
- Focus management after post-login redirect (TD-001) → Story 12.2
- Screen reader announcements (aria-live, aria-label audit) → Story 12.4
- Color contrast audit → Story 12.5
- Mobile touch accessibility → Story 12.6
- Adding Firefox/WebKit to CI playwright.config.ts → not in this story (Q1=A)
