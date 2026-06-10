# RECONCILIAÇÃO EPIC 8 — Wave W1b.3 (Trilhas relatório/busca/UX)

> Pré-flight (PLANO §3) executado em 2026-06-10 sobre `dev @ e767fe8`. Fecha o Epic 8 (hoje 6/10).
> Stories: 8-7 → 8-8 → 8-9 → 8-10. Implementar **só o residual**.

## 0. Veredito por story

| Story | Classificação | Resumo |
|-------|--------------|--------|
| **8-7** Relatório por trilha + export CSV | **NOVA** | Módulo `apps/api/src/reports/` novo. Lê progresso/group_trails/group_members existentes. Fila `queue:reports` (reusa infra BullMQ). |
| **8-8** Busca full-text por conteúdo | **NOVA** | Migration RAW SQL (tsvector+trigger+GIN+unaccent) na tabela `lessons`. Módulo `search/` novo. |
| **8-9** TrailPlaylist + skeletons + performance UX | **NOVA (FE)** | Componente `TrailPlaylist` + skeletons + lazy load + mobile. Sem schema. |
| **8-10** Tela "Minhas Trilhas" (participante) | **NOVA** | FE listagem participante (infinite scroll) + **endpoint backend novo** (listar trilhas do participante). Sem migration. |

## 1. ⚠️ DRIFT de campos — corrigir nos artifacts

**Lesson NÃO tem `title` nem `description`.** Colunas REAIS de `Lesson`: `name` (VarChar 255), `contentType`, `contentUrl`, `contentBody` (Text), `tags` (String[]), `originalName`, `mimeType`, `sizeBytes`, `uploadedBy/At`, `order`, `estimatedDurationMinutes`, timestamps, `deletedAt`.
- `Trail`: `name` + `description` (VarChar 1000) + `status` (draft/published/archived) + (W1b.2) `accessMode`, `version`, `publishedAt`, `publishedBy`, `catalogVisible`.
- `Module`: `name` + `order` + (W1b.2) `lessonAccessMode`.

→ **8-8**: o `to_tsvector('portuguese', ...)` do AC cita `title/description/tags`. MAPEAR para colunas reais: `lessons.name` + `lessons.tags` (Lesson não tem description; opcionalmente incluir `content_body`). Para nome de trilha/módulo no snippet do resultado, fazer JOIN na query de busca (não no tsvector da lesson). Trigger com `WHERE deleted_at IS NULL`.

## 2. Base JÁ ENTREGUE (W1b.1+W1b.2) — NÃO recriar

- Módulo flat `apps/api/src/content/` (Trail/Module/Lesson + repository; progress/ com BullMQ `queue:lesson-progress`; completion/, access/, publishing/, catalog/, versioning/, prerequisites/, config/, upload/, signed-url/).
- Models progresso: `LessonProgress` (status, progressPercent, startedAt, completedAt, lastAccessedAt; @@unique[tenantId,userId,lessonId]), `ModuleProgress` (progressPercent, completedLessons, totalLessons, completedAt), `TrailProgress` (progressPercent, completedModules, totalModules).
- `GroupTrail` (group_trails: tenantId, groupId, trailId, assignedBy, assignedAt; @@unique[groupId,trailId]) + endpoints `groups/:id/trails` (4-4). `GroupMember` (groupId, userId, role 'membro'|'lider'... — SEM updatedAt).
- BullMQ: padrão `bullMqService.createQueue(NAME)`; filas existentes `lesson-progress`, `trail-progress-events`, `RADAR_QUEUE_NAME`. **Reusar esse padrão** para `queue:reports`.
- Zod `packages/types/src/content/*` (registrados em `packages/types/src/index.ts`); snapshot `packages/types/src/__tests__/content.snapshot.spec.ts`.
- **NÃO existem** módulos `apps/api/src/reports/` nem `apps/api/src/search/`; nenhuma extensão `unaccent`/`tsvector` em migrations; nenhum endpoint participant-scoped de listagem de trilhas.

### Rotas FE JÁ EXISTENTES (estender, NÃO recriar)
- `apps/web/app/(authenticated)/app/consumo/trilhas/` → alvo da **8-10** (provável stub/parcial — VERIFICAR conteúdo antes).
- `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/` → alvo da **8-9** (TrailPlaylist).
- `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/progresso/` → "Meu Progresso" (8-3, `trail-progress-view.tsx`) — reusar padrões/hooks.
- `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/trilhas/` → 4-4 (associação).

## 3. Escopo residual por story

### 8-7 (NOVA) — `apps/api/src/reports/`
- `GET /api/v1/reports/trails/:trailId` (líder vê só seus grupos via group_members role=lider + RequestContext.userId; admin vê todos do tenant). Paginação `{ data, meta:{page,perPage,total,totalPages} }`. Filtros status + lastActivityAfter/Before.
- `GET /api/v1/reports/trails` (admin: sumário de todas as trilhas).
- `GET /api/v1/reports/trails/:trailId/export?format=csv` → CSV `text/csv`, `Content-Disposition attachment; filename="trilha-{name}-{date}.csv"`, **UTF-8 com BOM**, headers PT-BR ("Participante","Progresso (%)","Módulos Concluídos","Aulas Concluídas","Última Atividade","Status"). Se >1000 participantes → **202 + jobId** via `queue:reports`; `GET /api/v1/reports/jobs/:jobId` (processing|completed|failed; completed → signed URL 1h). **Status do job em Redis (NÃO criar tabela)** para evitar migration — namespace `queue:*`/`cache:*`. Filtro user-scoped app-level (sem GUC user).
- FE: botão exportar + (opcional) página de relatório do líder. Zod + snapshot.

### 8-8 (NOVA) — `apps/api/src/search/`
- Migration **RAW SQL** (não schema-only), em transação, rollback limpo em ordem reversa: `CREATE EXTENSION IF NOT EXISTS unaccent;` → coluna `search_vector tsvector` em `lessons` → trigger BEFORE INSERT/UPDATE com `to_tsvector('portuguese', coalesce(name,'')||' '||coalesce(array_to_string(tags,' '),''))` e `WHERE deleted_at IS NULL` (não indexar soft-deleted) → GIN `idx_lessons_search_vector`.
- ⚠️ tsvector é coluna gerenciada por trigger; no Prisma schema usar `Unsupported("tsvector")?` + `@@index(..., type: Gin)` OU manter fora do schema (raw). Garantir `prisma generate`+`prisma migrate` consistentes (rode `pnpm exec prisma migrate diff`/`status` p/ não dessincronizar).
- `GET /api/v1/search?q={term}`: resultados de lessons via `ts_query` contra `search_vector`, ranked `ts_rank`; retorna lesson name + trail name + module name (JOIN) + contentType + snippet com highlight. RLS tenant. Draft escondido p/ Participante; Admin/Líder vê com badge "Rascunho". Diacríticos via unaccent; prefix matching; sem match → `{ data:[], meta:{total:0} }`. <500ms p/ 10k lessons. Zod + snapshot + **RLS spec** (`apps/api/test/rls/lessons-search.rls-spec.ts`).
- FE: campo de busca + resultados (opcional, conforme artifact).

### 8-9 (NOVA FE) — `apps/web/.../consumo/trilhas/[trailId]/`
- `TrailPlaylist` (sidebar desktop / bottom-sheet mobile): módulos colapsáveis com %, aulas com ícone de tipo + duração + status (check/in-progress/locked — integra cadeado da 8-5), barra de progresso geral, aula ativa com `brand-teal`. Skeletons `motion-safe:animate-pulse` sem CLS. Lazy load below-the-fold (IntersectionObserver); `next/dynamic` p/ componentes pesados. TanStack Query staleTime 5min (estrutura) / 30s (progresso). a11y jest-axe + navegação por teclado (setas/Enter/Esc). Touch ≥44px. Densidade `Consumo` (padding 20-24px, radius 12px). Sem schema.

### 8-10 (NOVA) — `apps/web/.../consumo/trilhas/` + endpoint
- **Endpoint backend novo** (sem migration): listar trilhas do participante = group_members(userId=RequestContext.userId) → group_trails → trails (`status=published`) + TrailProgress do usuário. Provável `GET /api/v1/trails/my` ou em módulo content participant-scoped. Paginado (cursor p/ infinite scroll). Zod + snapshot.
- FE: cards (name, desc 2 linhas, #módulos/#aulas, barra progresso, badge "Não Iniciada"/"Em Andamento"/"Concluída", última atividade). Ordenação: in-progress (last activity desc) → not-started → completed. Só published. `useInfiniteQuery` 10/página. Empty state pastoral ("Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado."). Skeletons sem CLS. Click → TrailPlaylist (8-9) na última aula acessada. ≤2.5s, Consumo density, touch ≥44px, jest-axe.

## 4. Ordem & paralelismo
SEQUENCIAL 8-7 → 8-8 → 8-9 → 8-10 (padrão provado W1b.1/W1b.2). Só 8-7 (se criasse tabela — EVITAR, usar Redis) e 8-8 (raw SQL) tocam schema; 8-9/8-10 são FE, mas 8-10 cria endpoint e 8-9 consome — manter sequencial evita colisão de lockfile/snapshot e drift Prisma.

## 5. Guardrails / armadilhas CI (repassar a TODO orquestrador)
- **build ≠ lint**: após schema/migration → `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint`. Add dep → `pnpm install` + commit `pnpm-lock.yaml`.
- **8-8 Prisma v7 + tsvector**: raw SQL migration; cuidar p/ `prisma migrate status` não acusar drift (coluna Unsupported ou shadow). RLS spec da busca obrigatório.
- **NULLIF invariante**: qualquer policy RLS nova → `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.
- **RLS spec Prisma v7**: adapter `PrismaPg({connectionString: DATABASE_APP_URL})`; UUIDs fixos hex; users globais (zero-tenant, cols id,email,name,status,updated_at — SEM role); cadeia FK (tenant→trail→module→lesson) no beforeAll, derruba só no afterAll; beforeEach limpa só mutável; ids/emails únicos.
- **useMutation delete no FE**: `useMutation<undefined, Error, T>` + mutationFn `async` que `await`; `return undefined;` (NÃO `<void>` — eslint `no-invalid-void-type`; NÃO `<undefined>` retornando void — TS quebra). Ver padrão `apps/web/src/lib/api/hooks/use-pastoral-admin.ts`.
- **CSV BOM** (8-7): prefixar `﻿` p/ Excel renderizar acentos.
- **reflections.rls-spec.ts** flaky (FK P2003) → `gh run rerun --failed`. `gh pr merge` 401 → retry 3-4x. E2E "registry-1.docker.io deadline" → re-run.
- Multi-tenant: tenantId em toda tabela; nunca como parâmetro (AsyncLocalStorage/withTenantTx); UUID v7 `generateId()`. Datas ISO 8601, nulls explícitos. response `{data,meta?}`/error `{statusCode,error,message}`; Create 201/Delete 204/Async 202; código+log inglês; user-facing PT-BR + vocabulário pastoral; conventional commits PT-BR; ZodValidationPipe custom.

## 6. Fechamento
- 8-7/8-8/8-9/8-10 → done fecha **Epic 8** (10/10). Marcar `epic-8: done` ao mergear a 8-10; checar `epic-8-retrospective`.
