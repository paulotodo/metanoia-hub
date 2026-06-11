# Implementation Plan: TrailPlaylist — Navegação de Conteúdo em Trilha

**Feature**: `trilhas-playlist` (Story 8-9, Epic 8, Content)
**Created**: 2026-06-11
**Spec**: `docs/specs/trilhas-playlist/spec.md`
**Type**: Frontend-only (Next.js Client Component). No schema, no migration, no RLS, no backend change.
**Canonical guide**: `_bmad-output/implementation-artifacts/RECONCILIACAO-EPIC8-W1b3.md` §3 (8-9) + §5 (CI guardrails).

---

## 1. Scope & Constraints

### In scope
- New `TrailPlaylist` client component rendered as the primary content of route
  `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/page.tsx`.
- Sidebar layout on desktop (`md:w-80 lg:w-96`, fixed right), bottom-sheet on mobile (`60vh`, slide from bottom edge).
- Collapsible modules with completion %, lessons with content-type icon + duration + status.
- FE-derived lock state, keyboard navigation, skeletons with CLS=0, lazy-load via IntersectionObserver,
  dual staleness windows via TanStack Query.

### Out of scope (hard exclusions)
- No backend endpoints created/modified (uses existing GET endpoints only).
- No Zod schema additions in `packages/types` beyond what already exists.
- No lesson-viewer route — `onLessonSelect(lessonId)` callback only; `page.tsx` does `router.push`
  to `/app/consumo/trilhas/[trailId]/aulas/[lessonId]` (route owned by Story 8-10).
- No `useMutation` in this story (read-only feature). The `useMutation<undefined, Error, T>` guardrail
  is N/A here.

### Project rules honored (CLAUDE.md)
- TanStack Query ONLY in Client Components — `TrailPlaylist` and its hooks are `'use client'`.
  `page.tsx` stays a thin Server Component shell that reads `params` and renders the client component.
- User-facing strings PT-BR + pastoral vocabulary, centralized in `apps/web/messages/pt-BR.json`.
- Code/comments/logs in English. TypeScript `strict: true`, no `any`, explicit `null` (never omit fields).
- Naming: kebab-case files, PascalCase components, camelCase functions.

### DRIFT corrections (from RECONCILIACAO §1 — MUST respect)
- **Lesson uses `name` + `tags`, NOT `title`/`description`.** Render `lesson.name`. Duration is
  `lesson.estimatedDurationMinutes: number | null` — omit when `null` (FR-013, never render "null min").
- Module gate field is `lessonAccessMode: 'sequential' | 'free'` (camelCase in the response type).
- Lesson content type is `lesson.contentType` (`'video' | 'text' | 'quiz' | ...`).
- Progress status enum is `'not_started' | 'in_progress' | 'completed'` (reuse `LessonStatus`).

---

## 2. Component Architecture

All new component files live co-located with the route under
`apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/`. Each is a `'use client'` module.

```
[trailId]/
  page.tsx                         (Server Component — thin shell, reads params, renders <TrailPlaylistRoute>)
  trail-playlist-route.tsx         (Client — owns router.push for onLessonSelect; mounts layout switch)
  trail-playlist.tsx               (Client — core component: orchestrates data, renders header + module list)
  trail-playlist-header.tsx        (Client — overall TrailProgressBar + trail name)
  module-accordion-item.tsx        (Client — one collapsible module; % when collapsed; lessons when expanded)
  lesson-row.tsx                   (Client — one lesson: type icon + name + duration + status + lock)
  trail-playlist-skeleton.tsx      (Client — skeletons sized to match real content; CLS=0)
  trail-playlist-empty.tsx         (Client — pastoral empty state for trail with no modules)
  trail-playlist-error.tsx         (Client — inline error with "Tentar novamente" → query refetch)
  lazy-module-mount.tsx            (Client — IntersectionObserver wrapper for below-the-fold modules)
  use-locked-lessons.ts            (pure helper — derives lock state per FR-005, no React)
```

### Layout switch (FR-002, dec-008)
- A single CSS-driven responsive switch in `trail-playlist-route.tsx`:
  - Desktop (`md`+): render `<TrailPlaylist>` inside an `<aside class="md:w-80 lg:w-96 ...">` fixed to the right.
  - Each module is a collapsible accordion item showing its completion % even when collapsed (FR-004).
  - Mobile (`< md`): render `<TrailPlaylist>` inside a bottom-sheet built on the existing
    `Dialog` primitive from `@workspace/ui` (radix `@radix-ui/react-dialog`, already a dep — NO new package).
    Sheet positioned bottom, `h-[60vh]`, slide-up transition, `motion-safe` only.
  - Prefer pure CSS (`hidden md:block` / `md:hidden`) to avoid a layout-shift hydration flash; both branches
    share the same `<TrailPlaylist>` subtree (data hooks dedupe via TanStack Query cache, so dual mount is free).
- Escape closes the bottom-sheet (radix Dialog handles `onEscapeKeyDown` natively — FR-011 Escape).

### Overall progress (FR-006)
- `trail-playlist-header.tsx` renders the consolidated trail completion via `TrailProgressBar`
  (`progressPercent` from `useTrailProgress(trailId).data.progressPercent`) at the top of the panel.

### Active lesson highlight (FR-003)
- The "active" lesson = first lesson with `status === 'in_progress'`, else the resume target from
  `useResumeLesson(trailId).data.lessonId`. Rendered with brand teal accent (`bg-brand-teal/…`, border).

### Density (SC-007)
- Module/lesson cards: padding `p-5` (20px) to `p-6` (24px), `rounded-xl` (12px radius). Codified once in a
  shared `cardClass` const to keep the gate-checked invariant in one place.

---

## 3. Data Fetch / Cache Strategy (FR-010, dec-006)

Parallel fetch, NO aggregator endpoint. All queries are independent TanStack Query hooks in a Client Component.

New hook file: `apps/web/src/lib/api/hooks/use-trail-structure.ts` (FE-only; wraps existing GET endpoints).

| Query | Endpoint | staleTime | Reuse / new |
|-------|----------|-----------|-------------|
| Trail metadata | `GET /trails/:trailId` | 5 min (`300_000`) | new `useTrail(trailId)` |
| Module list | `GET /trails/:trailId/modules` | 5 min | new `useTrailModules(trailId)` |
| Lessons per module | `GET /trails/:trailId/modules/:moduleId/lessons` | 5 min | new `useModuleLessons` (one query per module, parallel) |
| Trail progress | `GET /progress/trails/:trailId` | 30 s (`30_000`) | REUSE `useTrailProgress` (already 30s) |
| Resume target | `GET /progress/trails/:trailId/resume` | 60 s | REUSE `useResumeLesson` |

- **Lessons fan-out**: after modules resolve, mount one `useModuleLessons(trailId, moduleId)` per module.
  Implement as a child hook inside `ModuleAccordionItem` so each module's lessons query is independent and
  gets deduped/cached. This realizes the "Promise.all parallel" intent without a custom Promise.all — TanStack
  runs them concurrently and gives per-module loading state (drives per-module skeleton).
- **Query keys** (follow existing convention, e.g. `progressKeys`):
  - `trailStructureKeys.trail(trailId)` = `['trail-structure','trail',trailId]`
  - `trailStructureKeys.modules(trailId)` = `['trail-structure','modules',trailId]`
  - `trailStructureKeys.lessons(trailId,moduleId)` = `['trail-structure','lessons',trailId,moduleId]`
- **Client**: reuse the same `envelopeClient`/`apiClient.get(path, Schema)` pattern as `use-progress.ts` /
  `use-search.ts`, validating responses against existing `packages/types` schemas
  (`TrailResponseSchema`, `ModuleResponse`/list schema, `LessonResponse`/list schema). No new schemas.
- **Staleness windows (FR-010, SC-006)**: structure 5min (rarely changes), progress 30s (revalidates in
  background on next interaction → updated state within 30s without manual reload).

### Retry / error (dec-010, FR error edge case)
- Inherits the global QueryClient retry policy (3 attempts, exponential backoff 1–4s, retries 5xx + 408/425/429)
  from `apps/web/src/lib/query/retry-policy.ts` — no per-query override needed.
- On exhausted failure of any structure query: render inline `<TrailPlaylistError>` with the PT-BR pastoral
  message "Não foi possível carregar a trilha. Verifique sua conexão e tente novamente." + "Tentar novamente"
  button that calls the failed queries' `refetch()`. (Inline error preferred over throwing to the segment
  `error.tsx`, so the rest of the page stays usable — but the route-level `(authenticated)/error.tsx`
  BoundaryFallback remains the last-resort net.)

---

## 4. Derived Lock State (FR-005, dec-009)

Pure helper `use-locked-lessons.ts` (no hooks; just a function for testability):

```
deriveLockedLessons(module, progressByLessonId):
  if module.lessonAccessMode === 'free'  -> all lessons unlocked
  if 'sequential':
    lessons sorted by `order`
    lesson[0] -> never locked by sequence
    lesson[i] (i>0) -> locked when lesson[i-1].status !== 'completed'
```

- Status per lesson comes from the trail-progress detail (`LessonStatusItem.status`), keyed by `lessonId`.
- Locked lessons: render the existing `LockIndicator` (from `components/content/lock-indicator.tsx`) with a
  pastoral `reason`; clicking a locked lesson does NOT call `onLessonSelect` (no navigation — FR-005).
- `aria-label` on a locked row communicates the reason for screen readers (FR US2 scenario 3).

---

## 5. Lazy Load + Skeletons (FR-007, FR-008, FR-009, US3)

- **Skeletons** (`trail-playlist-skeleton.tsx`): fixed dimensions matching the real header + N module rows so
  swapping skeleton→content causes zero layout shift (SC-002, CLS=0). Animation `motion-safe:animate-pulse`
  (FR-008 — no pulse under `prefers-reduced-motion`).
- **Lazy mount** (`lazy-module-mount.tsx`): `IntersectionObserver` wrapper. Modules below the fold render a
  skeleton placeholder of the correct height and only mount their `useModuleLessons` query + real content when
  they scroll into the panel's viewport (FR-009). Placeholder reserves height to keep CLS=0.
- Optionally wrap heavy lesson viewers via `next/dynamic` — N/A here since this story has no inline viewer,
  but `LazyModuleMount` is the seam if needed later.

---

## 6. Accessibility (FR-011, FR-012, SC-003/004/005, US2)

- Module list as an accessible disclosure pattern: each module header is a `<button aria-expanded>`
  controlling its lesson region (`aria-controls` + region `role`). Arrow keys move focus between module
  headers and (when expanded) lesson rows; Enter toggles a module or activates an unlocked lesson; Escape
  closes the mobile bottom-sheet (radix Dialog).
- Roving-tabindex or a simple keydown handler on the list container for ArrowUp/ArrowDown/Enter. Do NOT put
  `role="article"` on an `<a>`/`<button>` (past a11y bug from Cenário 06 Session 5 — invalid role on anchor).
- Touch targets ≥ 44×44px (SC-003) — enforce `min-h-11 min-w-11` (44px) on every interactive row/header/button.
- Visible focus ring on all focusable items (FR US2 scenario 1).
- Every state (loading / loaded / empty / error / locked lessons) must pass `jest-axe` with zero violations (SC-004).

---

## 7. i18n (FR-013, FR-014)

- Add a `trailPlaylist.*` namespace to `apps/web/messages/pt-BR.json` (pastoral vocabulary):
  - `trailPlaylist.overallProgress` (e.g. "Seu caminho na trilha")
  - `trailPlaylist.empty.title` / `trailPlaylist.empty.body` (FR-014 — pastoral empty state)
  - `trailPlaylist.error` = "Não foi possível carregar a trilha. Verifique sua conexão e tente novamente."
  - `trailPlaylist.retry` = "Tentar novamente"
  - `trailPlaylist.locked.reason` = "Bloqueado: complete o conteúdo anterior para desbloquear."
  - `trailPlaylist.status.{notStarted,inProgress,completed}` labels (for aria + visible).
  - `trailPlaylist.duration` = "{minutes} min" (only rendered when `estimatedDurationMinutes != null`).
- Consume via `useTranslations('trailPlaylist')` (next-intl pattern already used by `search`/`error.boundary`).

---

## 8. Test Plan

Co-located `*.test.tsx` / `*.test.ts` (Vitest + Testing Library + jest-axe; MSW for hook fetches).

| # | Target | Asserts | Maps to |
|---|--------|---------|---------|
| T1 | `use-locked-lessons.ts` (pure) | free → all unlocked; sequential → first unlocked, lesson[i] locked iff lesson[i-1] not completed | FR-005, dec-009 |
| T2 | `TrailPlaylist` loaded | renders all modules collapsed w/ % ; expand shows lessons w/ type icon + duration + status | FR-001/004, US1 |
| T3 | active lesson highlight | in_progress lesson (or resume target) gets brand-teal accent | FR-003 |
| T4 | duration null | lesson with `estimatedDurationMinutes: null` renders NO "null min" | FR-013 |
| T5 | locked lesson | shows `LockIndicator`; click does NOT call `onLessonSelect`; aria-label has reason | FR-005, US2-3 |
| T6 | keyboard nav | Arrow moves focus; Enter toggles module / selects unlocked lesson; Escape closes sheet | FR-011, US2-1/2/4 |
| T7 | jest-axe all states | loading, loaded, empty, error, locked → zero violations | FR-012, SC-004 |
| T8 | touch targets | every interactive el has min 44×44 (class assertion) | FR-012, SC-003 |
| T9 | skeleton CLS | skeleton dims equal loaded dims (snapshot/measured); `animate-pulse` gated `motion-safe` | FR-007/008, SC-002 |
| T10 | empty state | trail with zero modules → pastoral PT-BR empty message | FR-014 |
| T11 | error + retry | all retries fail → pastoral error + "Tentar novamente" calls refetch | dec-010 |
| T12 | staleness | structure query staleTime 300_000; progress reuse 30_000 (config assertion / MSW call count) | FR-010, SC-006 |
| T13 | lazy mount | below-fold module not mounted until IntersectionObserver fires (mock IO) | FR-009, US3-2 |
| T14 | onLessonSelect routing | unlocked lesson Enter/click → callback w/ lessonId → router.push to aulas route | dec-007 |

- Manual / Playwright deferred to Story 8-10 closeout E2E; this story ships unit + a11y coverage.

---

## 9. CI / Validation Guardrails (RECONCILIACAO §5)

Run before commit (build ≠ lint — both required):

```bash
pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint
```

- `prisma generate` first even on FE-only change (turbo build depends on generated client across the monorepo).
- No migration in this story → no `prisma migrate status` / NULLIF concern (FE-pure).
- No `useMutation` → the `useMutation<undefined, Error, T>` + `return undefined` delete guardrail is N/A
  (recorded so a reviewer doesn't flag its absence).
- Vitest suite + jest-axe must be green.

---

## 10. Reuse Inventory (do NOT reinvent)

| Need | Reuse | Path |
|------|-------|------|
| Overall progress bar | `TrailProgressBar` | `apps/web/src/components/content/trail-progress-bar.tsx` |
| Lesson status icon | `LessonStatusIcon` | same file |
| Lock UI | `LockIndicator` (+ `LockedModuleCard` if useful) | `apps/web/src/components/content/lock-indicator.tsx` |
| Trail progress data | `useTrailProgress` (30s) | `apps/web/src/lib/api/hooks/use-progress.ts` |
| Resume target | `useResumeLesson` | same file |
| Client Component fetch + states pattern | `trail-progress-view.tsx` | `…/[trailId]/progresso/trail-progress-view.tsx` |
| Infinite/parallel TanStack pattern reference | `useSearch` | `apps/web/src/lib/api/hooks/use-search.ts` |
| Bottom-sheet base | `Dialog` (radix) from UI pkg | `packages/ui/src/index.ts` (`@radix-ui/react-dialog`, existing dep) |
| Contract types | existing schemas | `packages/types/src/content/{trail,module,lesson,lesson-progress}.schema.ts` |
| Retry policy / error boundary | global | `apps/web/src/lib/query/retry-policy.ts`, `(authenticated)/error.tsx` |
| i18n | next-intl | `apps/web/messages/pt-BR.json` |

---

## 11. Build Order (for create-tasks)

1. `use-trail-structure.ts` hook (3 queries, query keys, existing schema validation).
2. `use-locked-lessons.ts` pure helper + T1 test.
3. `lesson-row.tsx` + `module-accordion-item.tsx` (status icon, duration omit, lock, density, touch targets).
4. `trail-playlist-header.tsx` (TrailProgressBar) + `trail-playlist.tsx` orchestration.
5. Skeleton + empty + error + lazy-mount components.
6. `trail-playlist-route.tsx` (responsive desktop sidebar / mobile bottom-sheet) + `page.tsx` shell + router.push.
7. i18n keys.
8. Tests T2–T14 + jest-axe.
9. CI validation sequence.
