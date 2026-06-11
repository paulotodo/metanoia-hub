# PLANO DE CONTINUAÇÃO — Epic 8 (Wave W1b.3), sessão fresca

> Criado 2026-06-10 após merge da Story 8-7 (PR #131). Fecha o **Epic 8 (Content)**.
> Fonte canônica de escopo: `RECONCILIACAO-EPIC8-W1b3.md` (ler junto com este plano).
> Este plano **corrige e atualiza** aquele reconciliação com o que foi descoberto no disco.

---

## 0. Estado atual (ponto de partida)

- Branch `dev` em **`4adbace`** (8-7 mergeada via PR #131, squash).
- **Epic 8: 7/10** stories feitas (8-1…8-7). Restam **8-8 → 8-9 → 8-10**.
- Working tree limpo. Nenhuma branch de feature aberta.
- O `state.json` da pipeline `feature-00c` em `.claude/feature-00c-state/trilhas-relatorio/` é **órfão/obsoleto** (ficou parado em "specify"; a 8-7 foi feita por implementação direta, não pela pipeline). **Ignorar / não confiar nele.**

### Método recomendado (provado em W1b.1/W1b.2/8-7)
Implementação **direta e sequencial** numa sessão fresca, story a story, cada uma com seu próprio PR squash para `dev` e CI verde antes do merge. **Não** reativar a pipeline `feature-00c` para estas (state dessincronizado; o overhead não compensou). O "autônomo" aqui = uma sessão executa as 3 stories de ponta a ponta seguindo este plano, validando e commitando, com checkpoints de merge.

---

## 1. Correções ao RECONCILIACAO-EPIC8-W1b3 (verificado no disco 2026-06-10)

1. **NÃO há stub de rotas FE de trilhas do participante.** Em `apps/web/app/(authenticated)/app/consumo/trilhas/` existe **apenas** `[trailId]/progresso/` (page.tsx + `trail-progress-view.tsx`, 114 linhas, padrão 8-3). **Não existe** `consumo/trilhas/page.tsx` (alvo 8-10) nem `consumo/trilhas/[trailId]/page.tsx` (alvo 8-9). → **8-9 e 8-10 criam essas páginas do zero.**
2. **Divergência de path artifact × real.** Os artifacts citam `apps/web/src/app/(authenticated)/trails/…` e `apps/api/src/modules/content/…`. O **real** é `apps/web/app/(authenticated)/app/consumo/trilhas/…` e `apps/api/src/content/…` (módulo flat, sem `modules/`). Seguir SEMPRE a estrutura real.
3. **Sem precedente de migration raw SQL com `CREATE EXTENSION`/`TRIGGER`/`tsvector`/GIN** no projeto — a 8-8 será a **primeira**. Risco elevado de drift Prisma v7; ver §4 (8-8).
4. **Drift de campos da Lesson** (confirmado): `Lesson` tem `name` + `tags` (NÃO tem `title`/`description`). `Trail` tem `name`+`description`. `Module` tem `name`. Mapear o `to_tsvector` para `lessons.name` + `lessons.tags` (+ opcional `content_body`).
5. Migrations seguem `apps/api/prisma/migrations/YYYYMMDDHHMMSS_8-N-slug/migration.sql`. Próximas livres: `20260616000000_8-8-fulltext-search` (ajustar timestamp se necessário p/ manter ordem crescente após `20260615000000_8-6-…`).
6. Módulos NestJS são registrados em `apps/api/src/app.module.ts` (import + entrada no array `imports`). Padrão já usado por `ContentModule`/`ReportsModule`.

---

## 2. Aprendizados da 8-7 a aplicar nas próximas (validação importa)

A implementação inicial da 8-7 tinha 4 desvios silenciosos da AC, corrigidos depois. **Aplicar a mesma disciplina de validação** em 8-8/8-9/8-10:

- **Universo de dados ≠ tabela de progresso.** Participante "sem progresso" não tem linha em `TrailProgress`/`ModuleProgress`. Para 8-10 (listar trilhas do participante) o universo é **`group_members(userId) → group_trails → trails(published)`**, com LEFT JOIN no progresso; não-iniciadas aparecem com status `not_started`. Nunca derivar a lista a partir da tabela de progresso.
- **`ModuleProgress` não é trail-scoped por si só** — filtrar por `moduleId IN (módulos da trilha)` ao agregar aulas, senão soma aulas de outras trilhas.
- **Filtros derivados + paginação:** se o status é derivado em memória, filtrar antes de contar `total`/`totalPages`.
- **Sempre rodar o build de produção** (`nest build` / `next build`) além de `tsc` — o `tsc -p tsconfig.json` do api acusa erros só em specs (globals vitest), que são ruído. O build é a checagem real.

---

## 3. Guardrails de CI / armadilhas (repassar a toda execução)

- **build ≠ lint.** Após mexer em schema/migration: `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint`. Ao adicionar dependência: `pnpm install` + commitar `pnpm-lock.yaml`.
- **Multi-tenant:** `tenant_id` em toda tabela; nunca passar tenantId como parâmetro (usar `withTenantTx`/AsyncLocalStorage); UUID v7 via `generateId()`. Datas ISO 8601, nulls explícitos.
- **Contratos:** response `{data, meta?}` / error `{statusCode, error, message}`; Create 201 / Delete 204 / Async 202; código+logs em inglês; user-facing PT-BR com vocabulário pastoral; `ZodValidationPipe` custom; Zod em `packages/types` + **snapshot** em `packages/types/src/__tests__/`.
- **RLS spec Prisma v7** (template provado): adapter `PrismaPg({connectionString: DATABASE_APP_URL})`; UUIDs fixos hex; users globais (zero-tenant; cols `id,email,name,status,updated_at` — SEM `role`); cadeia FK `tenant→trail→module→lesson` criada no `beforeAll` e derrubada só no `afterAll`; `beforeEach` limpa só o mutável; ids/emails únicos. Policy nova → `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.
- **useMutation delete no FE:** `useMutation<undefined, Error, T>` + `mutationFn` async que `await` e `return undefined;` (não `<void>` → eslint `no-invalid-void-type`). Referência: `apps/web/src/lib/api/hooks/use-pastoral-admin.ts`.
- **Flakes conhecidos:** `reflections.rls-spec.ts` (FK P2003) → `gh run rerun --failed`; `gh pr merge` 401 → retry 3-4×; E2E "registry-1.docker.io deadline" → re-run.
- **Commits** conventional em PT-BR; PR squash para `dev`; rodar/aguardar CI verde (Setup/Lint/Build/Test/E2E) antes do merge; `--delete-branch`.

---

## 4. Plano por story

### Story 8-8 — Busca full-text por conteúdo  ⚠️ MAIOR RISCO (migration raw SQL)
**Artifact:** `8-8-busca-full-text-por-conteudo.md` · **Classificação:** NOVA (backend + migration + FE opcional)

**Backend novo:** `apps/api/src/content/search/` (`search.controller.ts`, `search.service.ts`) — submódulo dentro de `content/` (flat). Registrar no `ContentModule` (ou novo `SearchModule` importado no `AppModule`).

**Migration raw SQL** `apps/api/prisma/migrations/20260616000000_8-8-fulltext-search/migration.sql`:
1. `CREATE EXTENSION IF NOT EXISTS unaccent;`
2. `ALTER TABLE lessons ADD COLUMN search_vector tsvector;`
3. Função + trigger `BEFORE INSERT OR UPDATE` que seta `search_vector = to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(array_to_string(tags,' '),''))` **e** zera/ignora quando `deleted_at IS NOT NULL` (não indexar soft-deleted → sem "ghost results"). Opcional incluir `content_body`.
4. `CREATE INDEX idx_lessons_search_vector ON lessons USING GIN (search_vector);`
5. Backfill das lessons já existentes (UPDATE para disparar o trigger).
6. **Rollback** (em `down`/migração reversa, ordem inversa): drop index → drop trigger → drop function → drop column → (extension: deixar ou drop com cuidado).

⚠️ **Prisma v7 + tsvector — evitar drift:** declarar a coluna no `schema.prisma` como `Unsupported("tsvector")?` na model `Lesson` (+ `@@index([search_vector], type: Gin)` se suportado) **ou** mantê-la fora do schema e gerida 100% por raw SQL. Depois: `pnpm exec prisma generate && pnpm exec prisma migrate status` (NÃO pode acusar drift). Testar a migration de baixo p/ cima num banco limpo.

**Endpoint** `GET /api/v1/search?q={term}`:
- `plainto_tsquery`/`to_tsquery('portuguese', term)` com **prefix matching** (`disc:*`) e **unaccent** (oração = oracao).
- JOIN `lessons → modules → trails` para devolver: lesson `name`, trail `name`, module `name`, `contentType`, **snippet** com highlight (`ts_headline`), `ts_rank` para ordenar, e `isDraft`.
- **RLS** por tenant. **Draft filtering por role:** Participante NÃO vê lessons de trilha `draft`; Admin/Líder vê com `isDraft:true` (badge "Rascunho"). Filtragem server-side (nunca confiar no FE).
- Sem match → `{ data: [], meta: { total: 0 } }` (não erro). Alvo ≤500ms p/ 10k lessons.
- Contratos Zod `packages/types/src/content/search.schema.ts` (registrar no index) + snapshot.

**Testes obrigatórios:** unit do service; **RLS spec** `apps/api/test/rls/lessons-search.rls-spec.ts` (sem cross-tenant); casos: ranked, diacríticos, prefix, vazio, soft-deleted excluído, draft invisível p/ participante / visível p/ admin.

**FE (conforme artifact, pode ser enxuto):** `apps/web/src/components/content/search-bar.tsx` (debounce 300ms) + `search-results.tsx` (snippet highlight, badge Rascunho, empty state) + hook TanStack + i18n.

**Validação:** `pnpm exec prisma migrate status` · `pnpm --filter @metanoia/api build` · `pnpm --filter @metanoia/api exec vitest run src/content/search` · RLS spec · `pnpm --filter @metanoia/types test` · `next build`.

**Done:** migration aplica/reverte limpa sem drift; busca funcional com RLS + draft filtering; testes verdes. → PR `feat(content): busca full-text por conteúdo (Story 8-8)`.

---

### Story 8-9 — TrailPlaylist, skeletons & performance UX  (FE puro, sem schema)
**Artifact:** `8-9-trailplaylist-skeletons-performance-ux.md` · **Classificação:** NOVA (FE)

**Cria do zero** `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/page.tsx` + componentes em `apps/web/src/components/content/`:
- `trail-playlist.tsx`: módulos colapsáveis (título + % completion), aulas (título, ícone por `contentType` vídeo/doc/link, duração `estimatedDurationMinutes`, status check/in-progress/**locked** — integra cadeado sequencial da 8-5), barra de progresso geral no topo, aula ativa com fundo `brand-teal`. Click → carrega no painel principal (direita desktop / full-screen mobile).
- `trail-playlist-skeleton.tsx`: 3 blocos de módulo × 3 linhas de aula + placeholder de conteúdo + barra; `motion-safe:animate-pulse`; **dimensões fixas (zero CLS)**.
- Lazy load below-the-fold via **IntersectionObserver**; `next/dynamic` p/ componentes pesados.
- Mobile (< lg): playlist como bottom-sheet/accordion (não sidebar); aula → full-screen com "voltar à playlist"; touch ≥44px.
- **TanStack Query** com query keys separadas: estrutura `staleTime 5min`, progresso `staleTime 30s`.
- a11y: **jest-axe** + navegação por teclado (setas/Enter/Esc). Densidade `Consumo` (padding 20-24px, radius 12px).

**Reuso:** dados de estrutura/progresso já existem (hooks de 8-3 em `[trailId]/progresso/`; contratos `packages/types/src/content/*`). Verificar hooks existentes antes de criar novos.

**Validação:** `pnpm --filter @metanoia/web build` · lint · jest-axe nos testes do componente.

**Done:** página da trilha renderiza playlist + skeletons sem CLS, responsiva e acessível. → PR `feat(content): TrailPlaylist + skeletons + performance UX (Story 8-9)`.

---

### Story 8-10 — Tela "Minhas Trilhas" (participante)  (endpoint novo + FE)
**Artifact:** `8-10-tela-minhas-trilhas-listagem-de-trilhas-do-participante.md` · **Classificação:** NOVA · **Sem migration**

**Backend novo** `apps/api/src/content/my-trails/` (`my-trails.controller.ts`, `my-trails.service.ts`):
- `GET /api/v1/my-trails` (paginação **cursor-based** p/ infinite scroll, 10/página).
- Universo: `group_members(userId = RequestContext.userId)` → `group_trails` → `trails` **com `status=published`** + `TrailProgress` do usuário (LEFT JOIN → não iniciadas contam). Agregar: name, description, #módulos, #aulas, progress %, status (`not_started`/`in_progress`/`completed`), última atividade.
- **Ordenação:** in-progress (last activity DESC) → not-started → completed.
- Contratos Zod `packages/types/src/content/my-trails.schema.ts` + snapshot. Unit test + (recomendado) RLS.

**FE — cria do zero** `apps/web/app/(authenticated)/app/consumo/trilhas/page.tsx` + componentes:
- `trail-card.tsx` (name, desc truncada 2 linhas, #módulos/#aulas, barra de progresso, badge "Não Iniciada"/"Em Andamento"/"Concluída", última atividade; `Consumo` density; touch ≥44px).
- `trail-card-skeleton.tsx` (3 cards, pulse, zero CLS) + `trails-empty-state.tsx` (EmptyState pattern; mensagem pastoral exata: *"Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado."*).
- `useInfiniteQuery` 10/página; click → TrailPlaylist (8-9), abrindo na última aula acessada (`lastAccessedAt`, lógica 8-3). jest-axe; ≤2.5s.

**Validação:** `pnpm --filter @metanoia/api build` + vitest do módulo · `pnpm --filter @metanoia/types test` · `next build` + lint + jest-axe.

**Done:** lista só published, ordenada, infinite scroll, empty state pastoral, click → playlist. → PR `feat(content): tela Minhas Trilhas do participante (Story 8-10)`.

---

## 5. Ordem, fechamento e pós-merge

1. **Sequencial 8-8 → 8-9 → 8-10** (8-8 toca schema; 8-9 consome o que 8-10 lista; sequencial evita colisão de lockfile/snapshot e drift Prisma). Um PR por story, CI verde, merge squash, `dev` atualizado entre stories.
2. Ao mergear a **8-10**: Epic 8 = **10/10**. Marcar `epic-8: done` no planning e checar/rodar `epic-8-retrospective` (skill `bmad-retrospective`).
3. Atualizar memória: criar/ajustar nota de checkpoint W1b.3 fechada + handoff da próxima wave.

---

## 6. PROMPT DE ARRANQUE (colar numa sessão fresca)

```
Continuar o desenvolvimento autônomo do Epic 8 (Content) do metanoia-hub.

Contexto: dev está em 4adbace; Stories 8-1…8-7 feitas (Epic 8 = 7/10). Faltam 8-8, 8-9, 8-10 para fechar o Epic 8.

Leia primeiro, na íntegra:
- _bmad-output/implementation-artifacts/PLANO-CONTINUACAO-EPIC8-W1b3.md  (plano detalhado — SIGA-O)
- _bmad-output/implementation-artifacts/RECONCILIACAO-EPIC8-W1b3.md     (escopo residual canônico)
- e o artifact da story em foco (8-8, depois 8-9, depois 8-10).

Implemente SEQUENCIALMENTE 8-8 → 8-9 → 8-10. Para cada story:
1. Confirme o escopo residual contra o código real antes de codar (a 8-7 tinha 4 desvios de AC silenciosos — valide universo de dados, filtros e contratos, não só compilação).
2. Implemente backend + types(Zod+snapshot) + FE + testes (incl. RLS quando houver policy nova).
3. Valide: prisma generate/migrate status (8-8), nest build, next build, lint, vitest, jest-axe.
4. Commit conventional PT-BR, abra PR squash para dev, AGUARDE CI verde (Setup/Lint/Build/Test/E2E) e só então mergeie com --delete-branch.
5. Atualize a memória entre stories.

Atenção especial à 8-8: primeira migration RAW SQL do projeto (unaccent + tsvector + trigger com WHERE deleted_at IS NULL + GIN). Cuidar drift Prisma v7 (coluna Unsupported("tsvector") ou fora do schema; migrate status sem drift). Drift de campos: Lesson tem name+tags (NÃO title/description) — mapear o to_tsvector para name+tags.

Paths reais (não os dos artifacts): backend apps/api/src/content/<sub>/; FE apps/web/app/(authenticated)/app/consumo/trilhas/. As páginas consumo/trilhas/page.tsx (8-10) e consumo/trilhas/[trailId]/page.tsx (8-9) NÃO existem ainda — criar do zero.

Ao fechar a 8-10: Epic 8 = 10/10 → marcar epic-8 done + rodar bmad-retrospective.
```
