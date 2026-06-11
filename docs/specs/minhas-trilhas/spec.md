# Spec: minhas-trilhas (Story 8-10)

## Feature
Tela "Minhas Trilhas" — listagem de trilhas do participante + endpoint backend `GET /api/v1/my-trails`.

Fecha Epic 8 (Content): 10/10.

## Status
`specify` — 2026-06-11

## Context
- PRs antecessores: 8-7 (#131), 8-8 (#132), 8-9 (#133) já mergeados em `dev`
- Base W1b.1+W1b.2 entregue: módulo `apps/api/src/content/` flat com TrailProgress, GroupTrail, GroupMember
- SEM migration nova — só leitura de tabelas existentes
- Fontes: `_bmad-output/implementation-artifacts/8-10-tela-minhas-trilhas-listagem-de-trilhas-do-participante.md` + `RECONCILIACAO-EPIC8-W1b3.md §3/§5`

## Requirements

### Backend — GET /api/v1/my-trails

**Query logic** (sem migration):
1. `group_members` WHERE `userId = RequestContext.userId` → lista de `groupId`
2. `group_trails` WHERE `groupId IN (...)` → lista distinta de `trailId`
3. `trails` WHERE `id IN (trailIds)` AND `status = published` AND `deletedAt IS NULL`
4. LEFT JOIN `trail_progress` WHERE `userId = RequestContext.userId`
5. Agregar por trail: `moduleCount`, `lessonCount`, `progressPercent`, `status`, `lastActivity` (= `TrailProgress.updatedAt`)

**Computed status**:
- `not_started` — sem TrailProgress ou progressPercent = 0
- `in_progress` — progressPercent > 0 AND completedAt IS NULL
- `completed` — completedAt IS NOT NULL

**Sort order**: in_progress (lastActivity DESC) → not_started → completed

**Paginação**: cursor-based (cursor = last trailId, limit = 10). Resposta `{ data: MyTrailItem[], meta: { nextCursor: string | null, total: number } }`.

**Auth**: `@UseGuards(KeycloakAuthGuard)` — extrai userId via `RequestContext.getUserId()`.

**Multi-tenancy**: `withTenantTx` — NUNCA tenantId como parâmetro. UUID v7 `generateId()`.

### Zod types (`packages/types/src/content/my-trails.schema.ts`)

```typescript
MyTrailStatusSchema = z.enum(['not_started', 'in_progress', 'completed'])
MyTrailItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  moduleCount: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative(),
  progressPercent: z.number().int().min(0).max(100),
  status: MyTrailStatusSchema,
  lastActivity: z.string().datetime().nullable(),
})
MyTrailsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(10),
})
MyTrailsMetaSchema = z.object({
  nextCursor: z.string().uuid().nullable(),
  total: z.number().int().nonnegative(),
})
MyTrailsResponseSchema = z.object({
  data: z.array(MyTrailItemSchema),
  meta: MyTrailsMetaSchema,
})
```

Snapshot: atualizar `packages/types/src/__tests__/content.snapshot.spec.ts`.

### Frontend

**Rota**: `apps/web/app/(authenticated)/app/consumo/trilhas/page.tsx`
- Client Component (usa useInfiniteQuery)
- Título: "Minhas Trilhas"

**Hook**: `apps/web/src/lib/api/hooks/use-my-trails.ts`
- `useInfiniteQuery` com cursor
- `queryFn` via `envelopeClient.get('/my-trails?cursor=...&limit=10', MyTrailsResponseSchema)`
- `getNextPageParam` = `lastPage.meta.nextCursor ?? undefined`
- staleTime: 60_000

**Componentes** (em `apps/web/src/components/content/`):
- `trail-card.tsx` — nome, desc 2 linhas truncadas, #módulos/#aulas, barra progresso, badge status, última atividade. Densidade Consumo: padding 20-24px, radius 12px. Touch ≥ 44px. Click → `/app/consumo/trilhas/{id}` (TrailPlaylist 8-9) — se lastActivity, usar `useResumeLesson` via query param `?resumeFrom=last`.
- `trail-card-skeleton.tsx` — 3 cards outline, `motion-safe:animate-pulse`, dimensões fixas (sem CLS)
- `trails-empty-state.tsx` — EmptyState pastoral: "Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado."

**i18n** (`apps/web/messages/pt-BR.json` — adicionar chaves em `myTrails`):
```json
"myTrails": {
  "title": "Minhas Trilhas",
  "empty": "Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado.",
  "status": {
    "not_started": "Não Iniciada",
    "in_progress": "Em Andamento",
    "completed": "Concluída"
  },
  "modules": "módulos",
  "lessons": "aulas",
  "lastActivity": "Última atividade",
  "continueTrail": "Continuar",
  "loadMore": "Carregar mais",
  "loadingMore": "Carregando..."
}
```

**MSW handler** (apenas para testes/mock mode): `apps/web/src/lib/msw/handlers/my-trails.ts`

### NFRs
- Page load ≤ 2.5s (NFR-P5)
- jest-axe em todos os componentes
- Keyboard navigation (Tab/Enter)
- Skeleton sem CLS (dimensões fixas)
- Só trilhas `published` — NUNCA exibir drafts

## Acceptance Criteria

1. `GET /api/v1/my-trails` retorna apenas trilhas `published` associadas aos grupos do usuário, com agregação correta (moduleCount, lessonCount, progressPercent, status, lastActivity)
2. Sort: in_progress (lastActivity DESC) → not_started → completed
3. Paginação cursor retorna `nextCursor: null` na última página
4. FE exibe TrailCard com todos os campos (nome, desc, counts, barra, badge, data)
5. Empty state pastoral aparece quando lista vazia
6. Skeleton (3 cards) exibe durante loading sem CLS
7. Click em TrailCard navega para `/app/consumo/trilhas/{id}` (TrailPlaylist)
8. jest-axe sem violações em TrailCard, skeleton e empty state
9. Snapshot Zod atualizado e verde

## Out of Scope
- Migration de banco (SEM migration)
- Recriar módulos existentes (`content/`, `progress/`, etc.)
- Endpoint de detalhe de trilha (já existe via 8-1)
- Edição de trilha pelo participante

## Clarifications
_Nenhuma — artefato ready-for-dev completo, sem ambiguidades._
