# Story 15.2: Screen Reader — Dashboard Líder, Radar Pastoral & Listas (NFR-A4)

Status: ready-for-dev

## Story

As a Líder who uses a screen reader,
I want to navigate the pastoral dashboard, participant lists, and care actions using assistive technology,
So that I can fulfill my pastoral care responsibilities regardless of visual ability.

## Acceptance Criteria

**Given** a Líder using a screen reader accesses the dashboard (`/app/gestao/dashboard`)
**When** the page loads
**Then** the page title announces "Radar Pastoral — {groupName}"
**And** the page has a descriptive `<h1>` that is the first content landmark
**And** summary cards (total participantes, atenção necessária, reuniões agendadas) each have `role="region"` with `aria-label` describing the metric (e.g., "Participantes que precisam de atenção: 3")
**And** each summary card value is not just a number — it includes context (e.g., `aria-label="3 de 12 participantes precisam de atenção"`)

**Given** a Líder navigates the participant list
**When** the list renders
**Then** it uses `role="list"` with `role="listitem"` for each participant (or semantic `<ul>/<li>`)
**And** each participant item announces: name, semáforo status as text (e.g., "Maria Silva — Atenção necessária"), and available actions
**And** the list supports `aria-sort` if sortable, announcing sort direction when changed

**Given** a Líder expands a participant card (ParticipantCard, UX-DR05)
**When** the card expands
**Then** the trigger has `aria-expanded="false"` → `"true"` transition announced
**And** the expanded content includes: pastoral context, timeline, and action buttons
**And** each action button (e.g., "Registrar cuidado", "Ver histórico") has a descriptive `aria-label` if the visible text alone is ambiguous
**And** `aria-controls` links the trigger to the expanded panel

**Given** a Líder uses the participant filter/search
**When** they type in the search field
**Then** the field has `role="searchbox"` with `aria-label="Buscar participantes"`
**And** results count is announced via `aria-live="polite"`: "{n} participantes encontrados"
**And** if no results, "Nenhum participante encontrado" is announced

**Given** the dashboard shows data tables (e.g., attendance history, care timeline)
**When** a screen reader navigates the table
**Then** the table has `<caption>` describing its content (e.g., "Histórico de presença — últimas 4 reuniões")
**And** row/column headers use `<th scope="col">` and `<th scope="row">` correctly
**And** the screen reader can navigate cell-by-cell using table navigation shortcuts

**Given** real-time updates arrive on the dashboard (SSE from Epic 14)
**When** a participant's status changes
**Then** the change is announced via `aria-live="polite"` (UX-DR20): "{participantName} mudou para {newStatus}"
**And** the announcement is debounced: if multiple changes arrive within 3 seconds, they are batched into a single announcement: "{n} participantes atualizados"
**And** when the "silenciar notificações" toggle (Epic 14, localStorage) is active, `aria-live` announcements are ALSO suppressed — the toggle controls both visual notifications and screen reader announcements

**Given** the SSE connection drops (network issue, server restart)
**When** the dashboard detects the disconnection
**Then** a `role="status"` region announces: "Conexão em tempo real interrompida. Os dados podem estar desatualizados."
**And** a visual indicator (icon + text, not color-only) appears near the dashboard header
**And** when the SSE reconnects automatically, the first batch of updates waits 5 seconds before announcing (to accumulate represadas updates into a single batch instead of flooding)
**And** after the 5s grace period, the status announces: "Conexão restaurada. {n} participantes atualizados."
**And** the visual indicator disappears after successful reconnection

## Tasks / Subtasks

- [ ] Task 1: Fix dashboard page landmark structure (AC: #1)
  - [ ] Set page title "Radar Pastoral — {groupName}"
  - [ ] Ensure `<h1>` is first content landmark
  - [ ] Add `role="region"` with descriptive `aria-label` to summary cards
  - [ ] Include contextual values in `aria-label` (not just numbers)
- [ ] Task 2: Fix participant list accessibility (AC: #2)
  - [ ] Use semantic `<ul>/<li>` or `role="list"`/`role="listitem"`
  - [ ] Each item announces: name, semáforo status as text, available actions
  - [ ] Add `aria-sort` for sortable lists
- [ ] Task 3: Fix participant card expansion (AC: #3)
  - [ ] Add `aria-expanded` toggle on trigger
  - [ ] Add `aria-controls` linking trigger to expanded panel
  - [ ] Add descriptive `aria-label` to ambiguous action buttons
- [ ] Task 4: Fix search/filter accessibility (AC: #4)
  - [ ] Add `role="searchbox"` with `aria-label="Buscar participantes"`
  - [ ] Add `aria-live="polite"` for results count announcement
  - [ ] Announce "Nenhum participante encontrado" for empty results
- [ ] Task 5: Fix data table accessibility (AC: #5)
  - [ ] Add `<caption>` to all data tables
  - [ ] Use `<th scope="col">` and `<th scope="row">` correctly
  - [ ] Verify cell-by-cell navigation works
- [ ] Task 6: Implement SSE real-time update announcements (AC: #6)
  - [ ] Add `aria-live="polite"` region for status changes
  - [ ] Implement 3-second debounce for batch announcements
  - [ ] Respect "silenciar" toggle — suppress `aria-live` when active (set to `aria-live="off"`)
- [ ] Task 7: Implement SSE disconnect/reconnect announcements (AC: #7)
  - [ ] Add `role="status"` for connection status announcements
  - [ ] Show visual indicator (icon + text) on disconnect
  - [ ] 5-second grace period on reconnect before announcing
  - [ ] Remove visual indicator after reconnection
- [ ] Task 8: Manual and automated testing (AC: all)
  - [ ] Manual testing with VoiceOver, NVDA, TalkBack on all dashboard features
  - [ ] axe-core on `/app/gestao/dashboard` — zero violations
  - [ ] Verify `aria-live` batching for rapid SSE updates (5 changes in 2s → 1 announcement)
  - [ ] SSE disconnect test: network drop → announcement + visual indicator → restore → 5s grace → batched recovery
  - [ ] Silenciar toggle test: activate → verify `aria-live="off"` → no announcements

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### UX Design References
- UX-DR05: ParticipantCard expansion pattern
- UX-DR15: GroupCard aggregated view
- UX-DR20: `aria-live` for real-time changes

### Dependencies
- Epic 7 (Pastoral Radar — dashboard, participant cards, semáforo)
- Epic 12 (base accessibility — keyboard nav, contrast, axe-core CI)
- Epic 14 (SSE notifications — real-time updates, silenciar toggle)

### Project Structure Notes
- Frontend: `apps/web/app/(authenticated)/gestao/dashboard/page.tsx`
- Components: `apps/web/components/pastoral/` (participant cards, radar)
- Accessibility utilities: `apps/web/lib/accessibility/`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-15.md` (Story 15.2)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
