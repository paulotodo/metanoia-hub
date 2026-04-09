# Story 15.4: Screen Reader — Trilhas, Progresso & Conteúdo (NFR-A4)

Status: ready-for-dev

## Story

As a participant who uses a screen reader,
I want to navigate trails, track my progress, and consume content using assistive technology,
So that I can fully engage in discipleship content regardless of visual ability.

## Acceptance Criteria

**Given** a participant using a screen reader accesses the trail listing (`/app/trilhas`)
**When** the page loads
**Then** the page title announces "Trilhas disponíveis" (or "Minhas trilhas" if filtered)
**And** each trail card announces: trail name, description summary, progress percentage, and module count
**And** the list uses `role="list"` with semantic `<ul>/<li>` structure

**Given** a participant navigates inside a trail (`/app/trilhas/{trailId}`)
**When** the trail detail page loads
**Then** the trail name is an `<h1>` and is the first meaningful content
**And** the module list shows progression with each module announcing: "Módulo {n} de {total}: {moduleName} — {status}" where status is "Concluído", "Em andamento", or "Bloqueado"
**And** completed modules have `aria-label` including "Concluído" and a visual checkmark (which has `aria-hidden="true"`)
**And** the overall progress bar uses `role="progressbar"` with `aria-valuenow="{percentage}"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label="Progresso na trilha: {percentage}%"`

**Given** a participant accesses a content module (text/document)
**When** the content renders
**Then** the content uses proper heading hierarchy (`<h2>`, `<h3>`, etc.) for navigability via heading shortcuts
**And** images have descriptive `alt` text (content creators must provide alt text; if missing, `alt="Imagem sem descrição"` as fallback)
**And** when a module is published with missing alt text, a flag `has_missing_alt_text: true` is set on the module record and the module appears in a "Conteúdo com acessibilidade incompleta" list visible to admins at `/app/admin/accessibility-gaps` — so fallbacks don't accumulate silently
**And** links within content have descriptive text (never "clique aqui")

**Given** a participant accesses a video module
**When** the video player renders
**Then** the video player uses Plyr (lightweight, ARIA-native) as the standard player — custom `<video>` controls are NOT implemented from scratch
**And** all player controls have accessible labels: "Reproduzir", "Pausar", "Volume: {n}%", "Tela cheia", "Avançar 10 segundos", "Retroceder 10 segundos" (Plyr provides these natively; this AC validates PT-BR localization is correctly configured)
**And** the current playback position is available via `aria-valuenow` on a `role="slider"` for the progress bar
**And** keyboard shortcuts for the player are documented in an accessible help panel (triggered by "?" key when player is focused)
**And** when the video ends, focus returns to the "Próximo módulo" button (if available) with a polite announcement: "Vídeo concluído. Avance para o próximo módulo."

**Given** a participant completes a module
**When** the completion is registered
**Then** a `role="status"` region announces: "Módulo {moduleName} concluído! Progresso: {newPercentage}%"
**And** the trail listing updates the progress bar `aria-valuenow` accordingly

**Given** a participant accesses the "Meu progresso" overview
**When** the page renders
**Then** each trail shows: trail name, progress bar (with `role="progressbar"`), modules completed out of total
**And** the page provides a summary at the top: "Você está participando de {n} trilhas. {completed} concluídas." via a `role="region"` with `aria-label`

## Tasks / Subtasks

- [ ] Task 1: Fix trail listing accessibility (AC: #1)
  - [ ] Set page title "Trilhas disponíveis" / "Minhas trilhas"
  - [ ] Use semantic `<ul>/<li>` for trail list
  - [ ] Each card announces: name, description, progress %, module count
- [ ] Task 2: Fix trail detail page accessibility (AC: #2)
  - [ ] Trail name as `<h1>`, first meaningful content
  - [ ] Module list with "Módulo {n} de {total}: {name} — {status}" announcements
  - [ ] `aria-hidden="true"` on visual checkmarks
  - [ ] Progress bar with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- [ ] Task 3: Fix content module accessibility (AC: #3)
  - [ ] Ensure proper heading hierarchy in rendered content
  - [ ] Add fallback `alt="Imagem sem descrição"` for missing alt text
  - [ ] Implement `has_missing_alt_text` flag on module record
  - [ ] Build admin page `/app/admin/accessibility-gaps` for modules with missing alt text
  - [ ] Audit links for descriptive text
- [ ] Task 4: Configure Plyr video player accessibility (AC: #4)
  - [ ] Configure Plyr with PT-BR localization for all control labels
  - [ ] Verify `aria-valuenow` on playback progress slider
  - [ ] Implement keyboard shortcut help panel ("?" key)
  - [ ] Implement end-of-video focus management → "Próximo módulo" button with announcement
- [ ] Task 5: Implement module completion announcements (AC: #5)
  - [ ] Add `role="status"` region for completion announcement
  - [ ] Update progress bar `aria-valuenow` on completion
- [ ] Task 6: Fix "Meu progresso" overview accessibility (AC: #6)
  - [ ] Add progress bars with `role="progressbar"` per trail
  - [ ] Add summary region with `aria-label` at page top
- [ ] Task 7: Manual and automated testing (AC: all)
  - [ ] Manual testing with VoiceOver, NVDA, TalkBack: trail listing, detail, content, video player, progress
  - [ ] axe-core on `/app/trilhas` and `/app/trilhas/{id}` — zero violations
  - [ ] Verify `role="progressbar"` attributes update after module completion
  - [ ] Video player: verify labels, keyboard shortcuts, end-of-video focus
  - [ ] TalkBack-specific: touch exploration on video controls and progress indicators

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Video Player
- Use Plyr (lightweight, ARIA-native) — do NOT implement custom `<video>` controls
- PT-BR localization must be configured for all control labels
- Plyr docs: https://plyr.io

### Dependencies
- Epic 8 (trails — trail and module components to enhance)
- Epic 12 (base accessibility — axe-core CI, keyboard nav)

### Project Structure Notes
- Frontend trails: `apps/web/app/(authenticated)/trilhas/`
- Video player: `apps/web/components/content/video-player.tsx` (Plyr wrapper)
- Admin gaps page: `apps/web/app/(authenticated)/admin/accessibility-gaps/page.tsx`
- Backend: add `has_missing_alt_text` field to module model in Prisma

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-15.md` (Story 15.4)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
