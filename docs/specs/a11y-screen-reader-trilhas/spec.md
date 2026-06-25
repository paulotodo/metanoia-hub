# Feature Specification: Screen Reader — Trilhas, Progresso & Conteúdo (NFR-A4)

**Feature**: `a11y-screen-reader-trilhas`
**Created**: 2026-06-25
**Status**: Draft
**Epic**: 15 — Story 15.4
**Scope decision**: LOCKED by operator (Paulo) — FE-only a11y hardening of existing trail screens. No backend/Prisma/migration changes. Zero changes to metanoia-prod-*.

---

## Scope Boundaries

### IN SCOPE (this story — a11y FE hardening on existing screens)

Existing frontend files only:

| File | Work |
|------|------|
| `apps/web/src/components/content/trail-card.tsx` | Consolidated aria-label |
| `apps/web/src/components/catalog/trail-card.tsx` | Consolidated aria-label (catalog variant) |
| `apps/web/app/(authenticated)/app/consumo/trilhas/page.tsx` | Page title metadata |
| `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/page.tsx` + `trail-playlist.tsx` | Trail name h1, module ordering |
| `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/module-accordion-item.tsx` | Module aria-label pattern + checkmark aria-hidden |
| `apps/web/src/components/content/trail-progress-bar.tsx` | Contextual aria-label |
| `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/progresso/trail-progress-view.tsx` | Summary region + lesson aria-labels |
| `apps/web/src/components/content/video-player.tsx` | Contextual aria-label, end-of-video focus, keyboard + polite announcement |
| New: `apps/web/src/components/content/module-completion-announce.tsx` | Lightweight `role=status` announcement component |

### OUT OF SCOPE — Follow-up Story 15.5 (document, do not implement)

- Installing / migrating to Plyr video player
- Prisma migration `has_missing_alt_text` field on module
- Admin page `/app/admin/accessibility-gaps`
- Backend endpoint `GET /api/v1/admin/accessibility-gaps`, alt-text-validator service
- Route `/aulas/[lessonId]` (does not exist; rich-text/image content renderer is outside current screens)
- Content heading hierarchy and image alt-text management (no `<img>` renderer in trail screens — confirmed by code audit)
- Any backend, Prisma schema, or migration change

> Decisoes de infraestrutura: N/A — feature is purely frontend, stateless UI changes with no scheduling, persistence, or key management.

---

## User Scenarios & Testing

### User Story 1 — Trail Listing Screen Reader Navigation (Priority: P1)

As a participant who uses a screen reader to navigate the app, I need the trail listing page to announce each trail's complete status at a glance, so I can decide which trail to open without visual scanning.

**Why this priority**: The trail listing is the entry point to all discipleship content. Without clear announcements, a screen reader user cannot know the name, status, or progress of any trail.

**Independent Test**: Open `/app/consumo/trilhas` with a screen reader or axe-core. Verify each trail card announces a composite label and the page has a document title.

**Acceptance Scenarios**:

1. **Given** a participant using a screen reader loads the trail listing page, **When** the page title is read, **Then** it announces "Trilhas disponíveis" (or "Minhas Trilhas" if that is the heading used by the page).
2. **Given** a trail card is focused, **When** the screen reader announces the element, **Then** it reads: "Trilha: {trail name}, {status label}, {progress}% concluída, {n} módulos" — combining all key data in one announcement.
3. **Given** a trail is not started, **When** the card is announced, **Then** the status reads "Não Iniciada" (not a raw value like `not_started`).

---

### User Story 2 — Module Accordion Accessibility (Priority: P1)

As a participant using a screen reader on the trail detail screen, I need each module header to announce its position, name, and completion state, so I can navigate the curriculum efficiently via heading shortcuts or list navigation.

**Why this priority**: The module accordion is the primary structure of the trail detail page. Unclear module announcements force a screen reader user to explore each item manually.

**Independent Test**: Open `/app/consumo/trilhas/{trailId}` and navigate the module list with a screen reader. Each accordion button must announce module position, name, and status.

**Acceptance Scenarios**:

1. **Given** the trail detail page is loaded, **When** the screen reader announces a module accordion button, **Then** it reads: "Módulo {n} de {total}: {module name} — {status}" where status is one of "Concluído", "Em andamento", or "Bloqueado".
2. **Given** a module has a visual checkmark icon for completion, **When** the screen reader encounters the icon, **Then** it is hidden from the accessibility tree (`aria-hidden="true"`) and only the text label carries the meaning.
3. **Given** the progress bar inside the module accordion button is announced, **When** the screen reader reads it, **Then** it announces "Progresso no módulo: {n}%" (contextual, not generic).

---

### User Story 3 — Trail Progress Bar Contextual Labels (Priority: P2)

As a participant using a screen reader, I need every progress bar to announce what it measures — trail or specific module — so I can understand my progress without needing to infer context from surrounding elements.

**Why this priority**: The same `TrailProgressBar` component is used in multiple contexts (trail overall, per-module). The current generic label is insufficient when multiple bars are present on screen.

**Independent Test**: Render the trail detail and progress view pages, inspect the `role="progressbar"` elements; each must have a distinct contextual `aria-label`.

**Acceptance Scenarios**:

1. **Given** the overall trail progress bar is on screen, **When** the screen reader focuses it, **Then** it announces "Progresso na trilha: {x}%".
2. **Given** a per-module progress bar is on screen, **When** the screen reader focuses it, **Then** it announces "Progresso no módulo {module name}: {x}%".
3. **Given** `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` are already present, **When** any progress bar is announced, **Then** the percentage is consistent between the label and `aria-valuenow`.

---

### User Story 4 — "Meu Progresso" Summary Region (Priority: P2)

As a participant using a screen reader viewing the "Meu Progresso" page for a trail, I need a summary at the top of the page announcing how many modules are completed, so I get an overview before navigating into the detail.

**Why this priority**: The progress overview page has multiple sections; without a summary region, a screen reader user must traverse all items to form a global picture.

**Independent Test**: Open `/app/consumo/trilhas/{trailId}/progresso` and verify a `role="region"` with an `aria-label` summarizing overall progress is the first meaningful content.

**Acceptance Scenarios**:

1. **Given** the progress page loads, **When** the screen reader reaches the summary region, **Then** it announces: "Você tem {n} módulos concluídos de {total}." via a `role="region"` with a matching `aria-label`.
2. **Given** each lesson in the module list is shown, **When** the screen reader announces a lesson item, **Then** it includes the lesson name and its status ("Concluída", "Em andamento", or "Não iniciada").

---

### User Story 5 — Module Completion Announcement (Priority: P2)

As a participant using a screen reader who just completed a module, I need an immediate polite announcement confirming completion and updated progress, so I receive the same feedback that sighted users get visually.

**Why this priority**: Completion feedback is a pastoral reinforcement moment. Without it, a screen reader user does not know the action was registered.

**Independent Test**: Trigger module completion (video ends + progress threshold crossed) and verify a `role="status"` region announces the completion text without redirecting focus.

**Acceptance Scenarios**:

1. **Given** a participant completes a module (video ends and progress is reported), **When** the completion mutation succeeds, **Then** a `role="status"` region announces: "Módulo {module name} concluído! Progresso na trilha: {new percentage}%".
2. **Given** the announcement fires, **When** it appears, **Then** focus is not moved (announcement is polite, non-intrusive).
3. **Given** there is no completion hook yet wired in the video player, **When** the component is delivered, **Then** it is ready to receive a `message` prop and can be integrated by calling `setAnnouncementMessage(...)` at the point where `useReportProgress` succeeds.

---

### User Story 6 — Video Player Keyboard and Screen Reader Access (Priority: P3)

As a participant using a keyboard or screen reader to watch a video lesson, I need the native video player to have a descriptive label and to return focus to the correct target when the video ends, so I can continue my discipleship journey without disorientation.

**Why this priority**: Video is the primary content delivery medium. Players with missing labels or focus traps are a hard blocker for keyboard-only and screen reader users.

**Independent Test**: Tab to the video player, verify `aria-label` includes the lesson name. Play the video to the end; verify focus lands on "Próximo módulo" button (if present) and a polite announcement fires.

**Acceptance Scenarios**:

1. **Given** the video player is rendered, **When** the screen reader focuses the `<video>` element, **Then** it announces the lesson title in PT-BR (e.g., "Vídeo: {lesson title}") rather than a generic label.
2. **Given** the video ends, **When** the `ended` event fires, **Then** focus moves to the "Próximo módulo" button (if it exists in the DOM) and a polite announcement says: "Vídeo concluído. Avance para o próximo módulo."
3. **Given** there is no "Próximo módulo" button, **When** the video ends, **Then** focus returns to the `<video>` element itself (no focus loss) and the polite announcement still fires.
4. **Given** a keyboard user wants to know available shortcuts, **When** they access the player manual-test checklist, **Then** native browser keyboard controls (Space = play/pause, arrow keys = seek, M = mute, F = fullscreen) are documented in `manual-test-checklist.md`.

---

### Edge Cases

- What happens when `progressPercent` is 0 or 100? Progress bar aria-label must remain well-formed ("Progresso na trilha: 0%" and "Progresso na trilha: 100%").
- What happens when a module has 0 lessons? Module aria-label must not divide by zero; status defaults to "Não iniciado" and position "Módulo {n} de {total}".
- What happens when the trail name contains special characters? `aria-label` interpolation must preserve the name verbatim (no HTML escaping artifacts).
- What happens if `useReportProgress` mutation is pending when video ends? The announcement component must handle the async gap (no announcement until the mutation resolves or the threshold is crossed server-side).
- What happens with the catalog variant of `trail-card.tsx`? It must receive the same consolidated aria-label as the content variant.

---

## Requirements

### Functional Requirements

- **FR-001**: The trail listing page MUST have a document `<title>` and/or visible `<h1>` that announces "Trilhas disponíveis" or "Minhas Trilhas" to assistive technology.
- **FR-002**: Each trail card button MUST expose a single consolidated `aria-label` in the format "Trilha: {name}, {status label}, {progress}% concluída, {n} módulos".
- **FR-003**: Each module accordion button in the trail detail screen MUST have an `aria-label` in the format "Módulo {n} de {total}: {name} — {status}" where status is "Concluído", "Em andamento", or "Bloqueado".
- **FR-004**: Visual-only checkmark icons MUST carry `aria-hidden="true"` so screen readers do not read Unicode symbols.
- **FR-005**: Every `<TrailProgressBar>` instance MUST receive a contextual `label` prop that identifies both the entity (trail or module name) and the percentage — generic or blank labels are not acceptable.
- **FR-006**: The "Meu Progresso" view MUST have a `role="region"` with an `aria-label` summarizing overall module completion count at the top of the content area.
- **FR-007**: Each lesson item in the "Meu Progresso" module breakdown MUST announce the lesson name and its status label via `aria-label` or visible text accessible to screen readers.
- **FR-008**: A new lightweight `ModuleCompletionAnnounce` component MUST be delivered with `role="status"` and `aria-live="polite"`, accepting a `message` string prop. It MUST be rendered (hidden when `message` is empty) at a position that does not cause layout shift.
- **FR-009**: The video player MUST have a dynamic `aria-label` incorporating the lesson title in PT-BR (e.g., "Vídeo: {title}") when `title` prop is provided; falling back to "Vídeo da aula" only when the title is unavailable.
- **FR-010**: The video player MUST handle the `ended` event by: (a) moving focus to the "Próximo módulo" button if it is present in the DOM, (b) triggering a polite announcement "Vídeo concluído. Avance para o próximo módulo.", and (c) returning focus to the `<video>` element if no next-module button exists.
- **FR-011**: A `manual-test-checklist.md` MUST be created in `docs/specs/a11y-screen-reader-trilhas/` documenting: screen reader test steps for trail listing, trail detail, progress view, module completion announcement, and video player keyboard/focus behaviors.
- **FR-012**: All modified components MUST pass the three existing a11y hard gates after each change: `focus-ring`, `contrast`, and `motion-safe` (no `transition-*` or `animate-*` without `motion-safe:` prefix).
- **FR-013**: No `aria-label` MUST be placed on a `<div>` or `<span>` with `role="generic"` (the default) — announcements must use interactive elements, `role="status"`, `role="region"`, `role="img"`, or `role="progressbar"`.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All modified screens produce zero axe-core violations when scanned via the existing E2E a11y gate (`axe-quality-gate`) on `/app/consumo/trilhas` and `/app/consumo/trilhas/{trailId}`.
- **SC-002**: Every `role="progressbar"` element on trail screens has a non-generic `aria-label` (verified by a targeted axe rule check or automated test assertion).
- **SC-003**: The manual test checklist (`manual-test-checklist.md`) is completed and signed off by the operator (Paulo) as the human gate for actual screen reader behavior — covering VoiceOver/NVDA on trail listing, trail detail, progress view, module completion announcement, and video player end-of-video focus.
- **SC-004**: `pnpm turbo lint`, `pnpm --filter @metanoia/web test`, and `pnpm turbo build --filter=@metanoia/web` all pass with zero errors after all changes are applied.
- **SC-005**: No new `transition-*` or `animate-*` CSS utility classes are introduced without a `motion-safe:` prefix in any modified file.
