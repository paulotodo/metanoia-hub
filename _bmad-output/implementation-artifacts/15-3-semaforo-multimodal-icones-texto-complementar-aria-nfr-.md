# Story 15.3: Semáforo Multimodal — Ícones, Texto Complementar & ARIA (NFR-A5)

Status: ready-for-dev

## Story

As a user with color vision deficiency or using a screen reader,
I want the pastoral semáforo to communicate status through icons and text (not color alone),
So that I can understand participant engagement status regardless of how I perceive the interface.

## Acceptance Criteria

**Given** the semáforo component renders a participant's status
**When** the status is displayed
**Then** each status level includes THREE complementary channels:
  - **Color**: Verde (#22c55e), Amarelo (#eab308), Vermelho (#ef4444) — with dark mode variants maintaining 3:1 contrast against background
  - **Icon**: Distinct icon per status — ✅ (check-circle) for verde, ⚠️ (alert-triangle) for amarelo, 🔴 (alert-circle) for vermelho — using Lucide icons for consistency
  - **Text label**: "Ativo", "Atenção", "Crítico" — always visible (not tooltip-only)
**And** the combination of icon + text is sufficient to distinguish all states without any color perception

**Given** a screen reader encounters the semáforo
**When** it reads the component
**Then** the `aria-label` announces the full context: "{statusLabel} — {participantName}" (e.g., "Atenção — Maria Silva")
**And** the color indicator has `aria-hidden="true"` (since color is redundant with icon + text for AT users)
**And** the icon has `role="img"` with `aria-hidden="true"` (since the text label carries the meaning)
**And** Lucide SVG icons have `focusable="false"` to prevent SVGs from receiving spurious focus in any browser

**Given** a participant's semáforo status changes in real time (SSE)
**When** the transition occurs
**Then** `aria-live="polite"` announces: "{participantName}: status mudou para {newStatusLabel}" (UX-DR20)
**And** the visual transition includes a brief highlight animation (pulse border) that respects `prefers-reduced-motion`:
  - Motion enabled: 1s pulse animation on the status badge
  - Motion reduced: instant swap with no animation, only a subtle opacity transition (0.15s)
**And** the `prefers-reduced-motion` check uses CSS media query (NOT JavaScript) for performance

**Given** the semáforo appears in different contexts (ParticipantCard, dashboard summary, group list)
**When** rendered in compact mode (e.g., GroupCard aggregated view, UX-DR15)
**Then** the icon is always present even in compact view (minimum 16x16px)
**And** the text label may be truncated to initial letter ("A", "At", "C") in compact mode but full text is available via `aria-label` (NOT `title` — `title` is inconsistent across screen readers and inaccessible on mobile/touch)
**And** `aria-label` always contains the full status text regardless of visual truncation

**Given** the platform is in dark mode
**When** semáforo colors render
**Then** verde uses `#4ade80` (lighter), amarelo uses `#facc15`, vermelho uses `#f87171` — all maintaining >= 3:1 contrast ratio against dark surface (`#1e1e2e` or equivalent)
**And** contrast ratios are validated using `color2k` (per Epic 12 decision) in a unit test that fails if any combination drops below 3:1

## Tasks / Subtasks

- [ ] Task 1: Refactor semáforo component for multimodal output (AC: #1)
  - [ ] Add Lucide icons: check-circle (verde), alert-triangle (amarelo), alert-circle (vermelho)
  - [ ] Add always-visible text labels: "Ativo", "Atenção", "Crítico"
  - [ ] Ensure icon + text sufficient to distinguish states without color
  - [ ] Define light mode colors: #22c55e, #eab308, #ef4444
  - [ ] Define dark mode colors: #4ade80, #facc15, #f87171
- [ ] Task 2: Implement screen reader ARIA attributes (AC: #2)
  - [ ] Add `aria-label="{statusLabel} — {participantName}"` to component
  - [ ] Add `aria-hidden="true"` to color indicator
  - [ ] Add `aria-hidden="true"` and `role="img"` to icons
  - [ ] Add `focusable="false"` to Lucide SVG icons
- [ ] Task 3: Implement real-time transition accessibility (AC: #3)
  - [ ] Add `aria-live="polite"` announcement on status change
  - [ ] Implement pulse border animation (1s) for status transitions
  - [ ] Add `prefers-reduced-motion` CSS media query: motion reduced → opacity transition only (0.15s)
- [ ] Task 4: Implement compact mode variant (AC: #4)
  - [ ] Ensure icon always present at minimum 16x16px
  - [ ] Truncate text label in compact mode (initial letter)
  - [ ] Full text always in `aria-label` (never use `title`)
- [ ] Task 5: Implement dark mode color variants (AC: #5)
  - [ ] Apply dark mode colors via Tailwind dark: variants
  - [ ] Create `color2k` unit test validating >= 3:1 contrast for all color/background combinations
- [ ] Task 6: Write tests (AC: all)
  - [ ] Visual regression: screenshot comparison of semáforo in all 3 states x 2 themes x 2 sizes
  - [ ] Unit test: `color2k` contrast check for all combinations >= 3:1 (WCAG AA non-text)
  - [ ] Manual screen reader test: VoiceOver + NVDA verify `aria-label` and `aria-live`
  - [ ] `prefers-reduced-motion` test: enable reduced motion → verify no pulse, only opacity
  - [ ] axe-core scan of pages with semáforo — zero color-only violations

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Color Reference
| Status | Light Mode | Dark Mode | Text Label | Icon |
|--------|-----------|-----------|-----------|------|
| Verde | #22c55e | #4ade80 | Ativo | check-circle (Lucide) |
| Amarelo | #eab308 | #facc15 | Atenção | alert-triangle (Lucide) |
| Vermelho | #ef4444 | #f87171 | Crítico | alert-circle (Lucide) |

### Dependencies
- Epic 7 (Pastoral Radar — semáforo component to refactor)
- Epic 12 (base accessibility — `color2k` library, axe-core CI)
- Epic 14 (SSE — real-time status changes)

### Project Structure Notes
- Component: `apps/web/components/pastoral/semaforo-badge.tsx` (or similar)
- Tailwind: dark mode variants in component styles
- Icons: Lucide React (`lucide-react` package)
- Tests: co-located `semaforo-badge.spec.tsx`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-15.md` (Story 15.3)
- UX-DR15: GroupCard aggregated view
- UX-DR20: aria-live for real-time changes
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
