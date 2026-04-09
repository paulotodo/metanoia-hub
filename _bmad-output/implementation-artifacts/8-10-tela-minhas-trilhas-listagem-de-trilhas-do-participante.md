# Story 8.10: Tela "Minhas Trilhas" — Listagem de Trilhas do Participante

Status: ready-for-dev

## Story

As a Participante,
I want to see a listing of all trails available to me with my progress on each,
so that I can discover content assigned to my groups and choose what to study next.

## Acceptance Criteria

**Given** I am a participant with group memberships that have trails associated
**When** I navigate to the "Trilhas" tab (from NavigationConfig — Epic 1, Story 1.8)
**Then** I see a listing page with trail cards, each showing:
  - Trail name and description (truncated to 2 lines)
  - Number of modules and total lessons
  - My progress bar with completion percentage
  - Status badge: "Não Iniciada", "Em Andamento", or "Concluída"
  - Last activity date (if started)
**And** trails are sorted by: in-progress first (by last activity, descending), then not-started, then completed
**And** only `published` trails are shown (draft trails are hidden from participants)
**And** the listing is paginated with infinite scroll (10 trails per page, TanStack Query with `useInfiniteQuery`)

**Given** I click on a trail card
**When** the trail page loads
**Then** I am taken to the TrailPlaylist view (Story 8.9) for that trail
**And** if I have progress, the playlist opens on my last accessed lesson ("Continuar de onde parei" from Story 8.3)

**Given** I have no trails assigned (empty state)
**When** the listing page loads
**Then** an empty state is displayed with pastoral vocabulary: "Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado."
**And** the empty state uses the `EmptyState` component pattern (consistent with Epic 7 onboarding patterns)

**Given** the listing page is loading
**When** the API response is pending
**Then** skeleton placeholders show 3 trail card outlines with pulse animation (UX-DR27)
**And** no CLS when real cards replace skeletons

**Given** the listing page renders
**When** all content is loaded
**Then** the page load is ≤ 2.5 seconds (NFR-P5)
**And** the page uses `Consumo` experience density (padding 20-24px, radius 12px) per UX-DR03
**And** all trail cards have touch targets ≥ 44px on mobile
**And** the listing page passes jest-axe accessibility tests

## Tasks / Subtasks

- [ ] Task 1: Implementar endpoint de listagem de trilhas do participante (AC: #1)
  - [ ] `GET /api/v1/my-trails` — trilhas associadas aos meus grupos
  - [ ] Agregar: trail name, description, module count, lesson count, my progress %, status, last activity
  - [ ] Filtrar: apenas trails published
  - [ ] Sort: in-progress (desc by last activity) → not-started → completed
  - [ ] Paginação: cursor-based para infinite scroll
- [ ] Task 2: Criar componente TrailCard (AC: #1)
  - [ ] Criar `apps/web/src/components/content/trail-card.tsx`
  - [ ] Trail name + description (truncated 2 lines)
  - [ ] Module/lesson counts
  - [ ] Progress bar com % completion
  - [ ] Status badge: "Não Iniciada" / "Em Andamento" / "Concluída"
  - [ ] Last activity date
  - [ ] `Consumo` density: padding 20-24px, radius 12px
- [ ] Task 3: Criar página "Minhas Trilhas" (AC: #1, #4)
  - [ ] Criar `apps/web/src/app/(authenticated)/trails/page.tsx`
  - [ ] TanStack Query `useInfiniteQuery` para infinite scroll
  - [ ] 10 trails per page
  - [ ] Click → navigate to TrailPlaylist (Story 8.9)
  - [ ] Se progress existe: abrir na última lesson acessada
- [ ] Task 4: Implementar empty state (AC: #3)
  - [ ] Mensagem pastoral: "Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado."
  - [ ] Usar EmptyState component pattern (consistente com Epic 7)
  - [ ] Strings via vocabulary.ts ou pt-BR.json
- [ ] Task 5: Implementar skeleton loading (AC: #4)
  - [ ] 3 trail card outlines com pulse animation (UX-DR27)
  - [ ] `motion-safe:animate-pulse`
  - [ ] Fixed dimensions para zero CLS
- [ ] Task 6: Implementar responsive e accessibility (AC: #5)
  - [ ] Touch targets ≥ 44px em mobile
  - [ ] jest-axe accessibility tests
  - [ ] Keyboard navigation
  - [ ] Page load ≤ 2.5s (NFR-P5)
- [ ] Task 7: Testes (AC: #1, #2, #3, #4, #5)
  - [ ] Teste: listagem retorna apenas published trails
  - [ ] Teste: sort order correto (in-progress → not-started → completed)
  - [ ] Teste: infinite scroll carrega próxima página
  - [ ] Teste: click navega para TrailPlaylist
  - [ ] Teste: empty state com mensagem pastoral
  - [ ] Teste: skeleton → content sem CLS
  - [ ] jest-axe accessibility tests
  - [ ] Performance: page load ≤ 2.5s
  - [ ] E2E: fluxo completo de navegação

## Dev Notes

- Infinite scroll via TanStack Query `useInfiniteQuery` — cursor-based pagination
- Sorting: in-progress (ordenado por last activity DESC) vem primeiro para engagement
- Apenas trails published — NUNCA exibir drafts para participantes
- "Continuar de onde parei" reutiliza lógica da Story 8.3 (lastAccessedAt)
- Empty state com tom pastoral — consistente com Epic 7 patterns
- UX-DR27: skeleton com 3 cards placeholder
- UX-DR03: Consumo density (padding 20-24px, radius 12px)

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
- Stories 8.1-8.9: TODAS as stories anteriores do Epic 8
- Epic 1, Story 1.8: NavigationConfig (tab "Trilhas")
- Epic 4: Grupos e membros (group membership para listar trails)
- Story 8.3: Progresso Individual (progress data, "Continuar de onde parei")
- Story 8.6: Publicação (draft/published filter)
- Story 8.9: TrailPlaylist (destino do click)

### Project Structure Notes
```
apps/web/src/app/(authenticated)/trails/
  └── page.tsx                    ("Minhas Trilhas")
apps/web/src/components/content/
  ├── trail-card.tsx
  ├── trail-card-skeleton.tsx
  └── trails-empty-state.tsx
apps/api/src/modules/content/
  └── my-trails/
      ├── my-trails.controller.ts
      └── my-trails.service.ts
packages/types/src/content/
  └── my-trails.schema.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.10
- UX-DR03: Consumo experience density
- UX-DR27: Skeleton loading pattern
- `docs/project-context.md` — NFR-P5 (page load ≤ 2.5s)
- `docs/architecture.md` — Content bounded context, frontend patterns
