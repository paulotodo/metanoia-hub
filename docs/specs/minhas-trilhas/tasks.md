# Tasks: minhas-trilhas (Story 8-10)

## Legenda
- `[crit]` = crítico (bloqueia CI se falhar)
- `[imp]` = importante (deve passar antes do merge)
- `[opc]` = opcional (melhoria, não bloqueia)

## Resumo
- Total tasks: 4 fases, 16 subtasks
- Escopo coberto: endpoint GET /api/v1/my-trails + tipos Zod + TrailCard FE + página + testes
- Escopo excluído: migration, módulo admin, edição de trilha pelo participante

## Matriz de Dependências
```
FASE 1 (types) → FASE 2 (backend) → FASE 4 (FE componentes)
FASE 1 (types) → FASE 3 (hook) → FASE 4 (FE componentes)
FASE 4 → FASE 5 (testes/i18n)
```

---

## FASE 1: Types

### 1.1 Criar my-trails.schema.ts [crit]
- [ ] Criar `packages/types/src/content/my-trails.schema.ts` com schemas: `MyTrailStatusSchema`, `MyTrailItemSchema`, `MyTrailsQuerySchema`, `MyTrailsMetaSchema`, `MyTrailsResponseSchema`
- [ ] Exportar todos os schemas e types do arquivo

### 1.2 Exportar de index.ts [crit]
- [ ] Adicionar exports em `packages/types/src/index.ts` para todos os schemas/types de `./content/my-trails.schema`

### 1.3 Atualizar snapshot [crit]
- [ ] Adicionar testes de snapshot para `MyTrailStatusSchema` e `MyTrailItemSchema` em `packages/types/src/__tests__/content.snapshot.spec.ts`
- [ ] Rodar `pnpm turbo test --filter=@metanoia/types` e confirmar verde

---

## FASE 2: Backend

### 2.1 Criar MyTrailsService [crit]
- [ ] Criar `apps/api/src/content/my-trails/my-trails.service.ts`
- [ ] Injetar `PrismaService`
- [ ] Método `listMyTrails(cursor?, limit=10)`: usa `getRequestContext()` → `withTenantTx` → query chain group_members→group_trails→trails(published)→trailProgress
- [ ] Sort: in_progress (lastActivity DESC) → not_started → completed
- [ ] Retornar `{ data: MyTrailItem[], meta: { nextCursor: string | null, total: number } }`

### 2.2 Criar MyTrailsController [crit]
- [ ] Criar `apps/api/src/content/my-trails/my-trails.controller.ts`
- [ ] `@Controller('my-trails')`, `@UseGuards(KeycloakAuthGuard, RolesGuard)`
- [ ] `GET /` com `@Query(new ZodValidationPipe(MyTrailsQuerySchema))`
- [ ] Retornar `{ data, meta }` via service

### 2.3 Registrar em content.module.ts [crit]
- [ ] Adicionar `MyTrailsController` em `controllers[]`
- [ ] Adicionar `MyTrailsService` em `providers[]`

### 2.4 Testes backend [imp]
- [ ] Criar `apps/api/src/content/my-trails/my-trails.service.spec.ts`
- [ ] Testar: apenas published, sort correto, cursor funcional, sem trails quando sem grupos
- [ ] Mock `PrismaService` e `requestContext`

---

## FASE 3: Hook FE

### 3.1 Criar use-my-trails.ts [crit]
- [ ] Criar `apps/web/src/lib/api/hooks/use-my-trails.ts`
- [ ] `useInfiniteQuery` com `envelopeClient.get('/my-trails?...', MyTrailsResponseSchema)`
- [ ] `getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined`
- [ ] `initialPageParam: undefined`
- [ ] staleTime: 60_000

### 3.2 Exportar de hooks/index.ts [imp]
- [ ] Adicionar export `myTrailsKeys`, `useMyTrails` em `apps/web/src/lib/api/hooks/index.ts`

---

## FASE 4: Componentes FE

### 4.1 Criar TrailCard [crit]
- [ ] Criar `apps/web/src/components/content/trail-card.tsx`
- [ ] Props: `MyTrailItem` + `onClick?: () => void`
- [ ] Name + description (line-clamp-2), moduleCount/lessonCount, ProgressBar, badge status, lastActivity formatada
- [ ] Consumo density: p-5 (20px), rounded-xl (radius 12px), touch min-h-[44px]
- [ ] Badge: "Não Iniciada" (muted), "Em Andamento" (primary), "Concluída" (success)
- [ ] Reusar `TrailProgressBar` de `apps/web/src/components/content/trail-progress-bar.tsx`

### 4.2 Criar TrailCardSkeleton [imp]
- [ ] Criar `apps/web/src/components/content/trail-card-skeleton.tsx`
- [ ] 3 skeletons com dimensões fixas (height fixo para evitar CLS)
- [ ] `motion-safe:animate-pulse`, Consumo density

### 4.3 Criar TrailsEmptyState [crit]
- [ ] Criar `apps/web/src/components/content/trails-empty-state.tsx`
- [ ] Mensagem pastoral: "Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado."
- [ ] Ícone pastoral (BookOpen ou similar do lucide)

### 4.4 Criar página consumo/trilhas/page.tsx [crit]
- [ ] Criar `apps/web/app/(authenticated)/app/consumo/trilhas/page.tsx`
- [ ] `'use client'`, `useMyTrails` hook
- [ ] Loading → 3x `TrailCardSkeleton`
- [ ] Empty → `TrailsEmptyState`
- [ ] Lista → cards com IntersectionObserver para carregar próxima página
- [ ] Click em card → `router.push('/app/consumo/trilhas/' + trail.id)`
- [ ] Título "Minhas Trilhas" (h1)

---

## FASE 5: i18n + MSW + Testes FE

### 5.1 Adicionar i18n [imp]
- [ ] Adicionar chave `myTrails` em `apps/web/messages/pt-BR.json` com todas as strings PT-BR

### 5.2 MSW handler [opc]
- [ ] Verificar se existe `apps/web/src/mocks/handlers/` e adicionar `my-trails.ts`
- [ ] Registrar no handler principal se aplicável

### 5.3 Testes FE [imp]
- [ ] `trail-card.spec.tsx`: renderiza todos os campos, badge correto por status, jest-axe
- [ ] `trail-card-skeleton.spec.tsx`: jest-axe
- [ ] `trails-empty-state.spec.tsx`: mensagem pastoral, jest-axe
- [ ] `page.spec.tsx` (consumo/trilhas): loading→skeleton, empty state, lista renderizada, click navega
