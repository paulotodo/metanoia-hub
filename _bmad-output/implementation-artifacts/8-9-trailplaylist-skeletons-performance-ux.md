# Story 8.9: TrailPlaylist, Skeletons & Performance UX

Status: ready-for-dev

## Story

As a Participante,
I want a playlist-style view of trail content with smooth loading states,
so that I can navigate lessons intuitively and never see blank screens while content loads.

## Acceptance Criteria

**Given** I navigate to a trail page
**When** the page renders
**Then** a `TrailPlaylist` component displays the trail structure as a playlist sidebar:
  - Modules as collapsible sections with title and completion percentage
  - Lessons within each module as list items with: title, content type icon (video/doc/link), duration estimate, completion status (checkmark / in-progress / locked)
  - Overall trail progress bar at the top
**And** the currently active lesson is highlighted with `brand-teal` background
**And** clicking a lesson loads it in the main content area (right panel on desktop, full-screen on mobile)
**And** the component uses the `Consumo` experience density (padding 20-24px, radius 12px) per UX-DR03

**Given** the trail page is loading
**When** the API response is pending
**Then** skeleton placeholders are shown for: playlist sidebar (3 module blocks with 3 lesson lines each), main content area (video/document placeholder), and progress bar
**And** skeletons animate with a subtle pulse (using `motion-safe:animate-pulse`)
**And** no Cumulative Layout Shift (CLS) occurs when real content replaces skeletons

**Given** the trail page has modules below the fold
**When** the page loads
**Then** only above-the-fold modules load their lesson details immediately
**And** below-the-fold modules use lazy loading (Intersection Observer) to defer lesson data fetching
**And** heavy components (`TimelineCuidado`, `TelaReentry` from other epics) use `next/dynamic` for dynamic imports

**Given** I am on a mobile device (< lg breakpoint)
**When** I view the trail
**Then** the playlist shows as a collapsible bottom sheet or top accordion (not sidebar)
**And** tapping a lesson opens the content full-screen with a "back to playlist" button
**And** touch targets are ≥ 44px for all interactive elements

**Given** all performance optimizations are in place
**When** the trail page loads
**Then** total page load is ≤ 2.5 seconds (NFR-P5)
**And** TanStack Query is used for data fetching in Client Components with stale-while-revalidate (staleTime: 5 minutes for trail structure, 30 seconds for progress data)
**And** the `TrailPlaylist` component passes jest-axe accessibility tests
**And** keyboard navigation works: arrow keys to navigate lessons, Enter to select, Escape to collapse module

## Tasks / Subtasks

- [ ] Task 1: Criar componente TrailPlaylist (AC: #1)
  - [ ] Criar `apps/web/src/components/content/trail-playlist.tsx`
  - [ ] Modules como seções collapsible com título e % completion
  - [ ] Lessons como list items: título, ícone de content type, duração, status
  - [ ] Progress bar geral no topo
  - [ ] Active lesson highlighted com brand-teal background
  - [ ] Click em lesson → carregar no main content area
  - [ ] `Consumo` density: padding 20-24px, radius 12px (UX-DR03)
- [ ] Task 2: Implementar skeleton loading states (AC: #2)
  - [ ] Skeleton para playlist sidebar: 3 module blocks, 3 lesson lines each
  - [ ] Skeleton para main content area
  - [ ] Skeleton para progress bar
  - [ ] `motion-safe:animate-pulse` para animação
  - [ ] Zero CLS quando content substitui skeletons (fixed dimensions)
- [ ] Task 3: Implementar lazy loading below-the-fold (AC: #3)
  - [ ] Intersection Observer para modules abaixo do fold
  - [ ] Defer lesson data fetching para below-fold modules
  - [ ] `next/dynamic` para heavy components (TimelineCuidado, TelaReentry)
- [ ] Task 4: Implementar responsive mobile layout (AC: #4)
  - [ ] Breakpoint < lg: playlist como bottom sheet ou top accordion
  - [ ] Tap lesson → full-screen content com "back to playlist" button
  - [ ] Touch targets ≥ 44px para todos interactive elements
- [ ] Task 5: Configurar TanStack Query com stale-while-revalidate (AC: #5)
  - [ ] staleTime: 5min para trail structure
  - [ ] staleTime: 30s para progress data
  - [ ] Separate query keys para structure vs progress
- [ ] Task 6: Implementar keyboard navigation (AC: #5)
  - [ ] Arrow keys: navegar entre lessons
  - [ ] Enter: selecionar lesson
  - [ ] Escape: collapse module
  - [ ] Focus management adequado
- [ ] Task 7: Testes (AC: #1, #2, #3, #4, #5)
  - [ ] jest-axe accessibility tests para TrailPlaylist
  - [ ] Teste: skeleton → content sem CLS
  - [ ] Teste: lazy loading com Intersection Observer
  - [ ] Teste: mobile layout em breakpoint < lg
  - [ ] Teste: touch targets ≥ 44px
  - [ ] Teste: keyboard navigation (arrows, enter, escape)
  - [ ] Performance: page load ≤ 2.5s (NFR-P5)
  - [ ] E2E Playwright: trail page load time

## Dev Notes

- **Prerequisite**: Stories 8.1-8.8 devem estar completas — esta story integra CRUD, content viewing, progress, completion, sequential locking, draft/published
- Skeleton dimensions devem ser fixas para prevenir CLS
- Intersection Observer para lazy loading — não carregar tudo de uma vez
- `next/dynamic` para code splitting de componentes pesados
- TanStack Query staleTime diferente para structure (estável) vs progress (dinâmico)
- Mobile: bottom sheet ou accordion — NUNCA sidebar em mobile

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Core domains (Pastoral, Meetings, Content): Repository pattern
- Supporting subdomains: Service direto com Prisma
- Events: { eventId, eventType, version, tenantId, timestamp, data, metadata }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Stories 8.1-8.8: TODAS as stories anteriores do Epic 8
  - 8.1: CRUD (trail structure)
  - 8.2: Content viewing (video, PDF, rich text, link)
  - 8.3: Progress tracking
  - 8.4: Completion rules
  - 8.5: Sequential locking
  - 8.6: Draft/published filtering

### Project Structure Notes
```
apps/web/src/components/content/
  ├── trail-playlist.tsx
  ├── trail-playlist-skeleton.tsx
  ├── playlist-module.tsx
  ├── playlist-lesson-item.tsx
  └── content-viewer.tsx          (wrapper para video/pdf/richtext/link)
apps/web/src/app/(authenticated)/trails/
  └── [trailId]/
      └── page.tsx
apps/web/e2e/
  └── trail-playlist.e2e-spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.9
- UX-DR03: Consumo experience density
- `docs/project-context.md` — NFR-P5 (page load ≤ 2.5s)
- `docs/architecture.md` — Frontend patterns, TanStack Query config
