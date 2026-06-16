# axe-baseline Notes — a11y-teclado-publico FASE 0

**Date**: 2026-06-16
**Feature**: a11y-teclado-publico (Epic 12, Story 12.1)
**Ref**: CHK032, US7, FR-012, SC-006, tasks.md §FASE 0

## Summary

Baseline axe scan executed PRE-code-change on public flows.
All 5 pre-existing violations are accepted as tech debt per CHK032.
They serve as the "before" reference for the FASE 7 delta-report.

| Page | Critical | Serious | Moderate | Minor | Total |
|------|----------|---------|----------|-------|-------|
| `/` (home-marketing) | 0 | 1 | 0 | 0 | 1 |
| `/login` | 0 | 1 | 0 | 0 | 1 |
| `/register` | 0 | 0 | 0 | 0 | 0 |
| `/recuperar-senha` | 0 | 0 | 3 | 0 | 3 |
| **TOTAL** | **0** | **2** | **3** | **0** | **5** |

## Pre-existing Violations (Tech Debt)

### `/` — home-marketing
- **color-contrast** (serious, 25 nodes): Marketing page text contrast below WCAG AA ratio.
  Scope: Epic 12.3 (not this story). Deferred.

### `/login`
- **link-in-text-block** (serious, 1 node): "Esqueceu a senha?" link not distinguishable
  from surrounding text without color. Scope: Epic 12.3 (focus-ring/contrast). Deferred.

### `/recuperar-senha`
- **landmark-main-is-top-level** (moderate): `<main>` is nested inside another landmark.
  Root cause: `(public)/layout.tsx` wraps children in `<main>`, and the recovery form
  also renders a `<main>`. Fix: change layout.tsx wrapper to `<div>` — addressed in FASE 1/5.
- **landmark-no-duplicate-main** (moderate): Same root cause as above.
- **landmark-unique** (moderate): Same root cause as above.

  > NOTE: The landmark issues on `/recuperar-senha` overlap with FASE 1 skip-nav work
  > (which adds skip links referencing `#main-content`). The public layout refactor in
  > FASE 1 should resolve all 3 landmark violations as a side effect.

## Delta Expectations

After FASE 1-6 implementation, FASE 7 delta-report should show:
- `/login`: 0 violations (link-in-text-block fixed if focus-visible treatment added)
- `/recuperar-senha`: 0 landmark violations (fixed by layout refactor)
- `/`: color-contrast MAY persist (Epic 12.3 scope)

## Scan Configuration

- Tool: @axe-core/playwright ^4.11.3
- Tags: wcag2a, wcag2aa, wcag21aa, best-practice
- Browser: Chromium headless (playwright ^1.59.1)
- App: Next.js 16.2 dev mode, http://localhost:3000
- No auth required (public pages only)
