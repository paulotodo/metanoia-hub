# Plano de Implementação: minhas-trilhas (Story 8-10)

## Visão Geral
Feature última do Epic 8 (Content). Entrega endpoint `GET /api/v1/my-trails` + tela FE "Minhas Trilhas". Sem migration. Fecha Epic 8 (10/10).

## Arquitetura

### Backend
- **Módulo**: adicionar `MyTrailsController` + `MyTrailsService` dentro de `apps/api/src/content/` (flat pattern existente)
- **Auth**: `@UseGuards(KeycloakAuthGuard, RolesGuard)` igual ao `ProgressController`
- **Context**: `getRequestContext()` → `{ userId, tenantId }` via `AsyncLocalStorage`
- **Query**: `withTenantTx` → `groupMembers` → `groupTrails` → `trails(published)` + LEFT JOIN `trailProgress`
- **Sort**: implementado no Prisma via `orderBy` + JavaScript sort para ordenação tri-estado
- **Cursor pagination**: cursor = último `trailId` do batch anterior

### Frontend
- **Hook**: `use-my-trails.ts` com `useInfiniteQuery` — padrão idêntico ao `envelopeClient.get` já usado em `use-trail-reports.ts`
- **Componentes**: `trail-card.tsx`, `trail-card-skeleton.tsx`, `trails-empty-state.tsx` em `apps/web/src/components/content/`
- **Página**: `apps/web/app/(authenticated)/app/consumo/trilhas/page.tsx` (Client Component)
- **i18n**: chaves `myTrails.*` em `apps/web/messages/pt-BR.json`
- **MSW**: handler `/my-trails` em `apps/web/src/mocks/` (se diretório existir)

### Types
- `packages/types/src/content/my-trails.schema.ts` — Zod schemas
- Export em `packages/types/src/index.ts`
- Snapshot em `packages/types/src/__tests__/content.snapshot.spec.ts`

## Sequência de Implementação

### Fase 1: Types (fundação)
1. Criar `packages/types/src/content/my-trails.schema.ts`
2. Exportar de `packages/types/src/index.ts`
3. Atualizar snapshot `content.snapshot.spec.ts`

### Fase 2: Backend
4. Criar `apps/api/src/content/my-trails/my-trails.service.ts`
5. Criar `apps/api/src/content/my-trails/my-trails.controller.ts`
6. Registrar em `apps/api/src/content/content.module.ts`
7. Criar `apps/api/src/content/my-trails/my-trails.service.spec.ts`

### Fase 3: Frontend — Hook
8. Criar `apps/web/src/lib/api/hooks/use-my-trails.ts`
9. Exportar de `apps/web/src/lib/api/hooks/index.ts`

### Fase 4: Frontend — Componentes
10. Criar `apps/web/src/components/content/trail-card.tsx`
11. Criar `apps/web/src/components/content/trail-card-skeleton.tsx`
12. Criar `apps/web/src/components/content/trails-empty-state.tsx`
13. Criar `apps/web/app/(authenticated)/app/consumo/trilhas/page.tsx`

### Fase 5: i18n + MSW + Testes FE
14. Adicionar chaves `myTrails` em `apps/web/messages/pt-BR.json`
15. Criar MSW handler `apps/web/src/mocks/handlers/my-trails.ts` (se aplicável)
16. Criar testes `trail-card.spec.tsx`, `my-trails-page.spec.tsx`

## Decisões Arquiteturais

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Localização do controller | Dentro de `content/` flat | Padrão existente — NÃO criar módulo separado |
| Auth guard | `KeycloakAuthGuard + RolesGuard` | Idêntico ao `ProgressController` |
| Paginação | Cursor-based por trailId | Infinite scroll — req. do artifact |
| Sort tri-estado | JS sort pós-query | Prisma não suporta ORDER BY CASE trivialmente |
| FE client | `envelopeClient.get` | Padrão de todos os hooks de listagem |
| Skeleton | `motion-safe:animate-pulse` | Padrão do projeto (UX-DR27) |

## Guardrails CI
- `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint` após qualquer mudança de schema
- Sem migration — só leitura de modelos existentes
- NULLIF invariante se tocar RLS (não aplicável aqui)
- GroupMember sem `updatedAt` — não usar em queries de sort
- UUID v7 `generateId()` — não usado aqui (só GET)

## Riscos
- `TrailProgress` pode não existir para o usuário (LEFT JOIN implícito via `findFirst`) — tratar null como `not_started`
- Sort tri-estado requer cuidado: `in_progress` + lastActivity DESC, depois `not_started`, depois `completed`
- Cursor deve ser opaco mas determinístico — usar UUID do último item
