# RECONCILIAÇÃO EPIC 8 — Wave W1b.2 (Trilhas regras)

> Pré-flight obrigatório (PLANO §3) executado em 2026-06-10 sobre `dev @ fc48d28`.
> Audita o código REAL antes de codar 8-4 → 8-5 → 8-6 → 4-4. Implementar **só o residual**.

## 0. Veredito por story

| Story | Classificação | Resumo do residual |
|-------|--------------|--------------------|
| **8-4** Regras de conclusão por tipo de conteúdo | **PARCIAL** | Infra de progresso (processor BullMQ, `queue:lesson-progress`, ModuleProgress/TrailProgress) já existe. Falta: `TenantContentConfig`, `completedBy` em LessonProgress, `completion-rules` service, endpoints de config, hooks FE de vídeo/documento. |
| **8-5** Acesso sequencial & pré-requisitos | **PARCIAL** | Models Trail/Module existem. Falta: `accessMode` (Trail), `lessonAccessMode` (Module), tabela `ModulePrerequisite`, access-control service+guard, validador de ciclos, lock UI. |
| **8-6** Publicação, versionamento & catálogo | **PARCIAL** | Trail tem `status` (draft/published/archived) mas sem `version/publishedAt/publishedBy/catalogVisible`. Falta esses campos + tabela `TrailVersion` + tabela **`group_trails`** + endpoints publish/catalog + evento `content.trail.published`. |
| **4-4** Associar trilhas a grupo | **PARCIAL** (não NOVA) | ⚠️ **`group_trails` é criada pela 8-6, que roda ANTES.** 4-4 NÃO recria a tabela/migration. 4-4 implementa só: endpoints `groups/:id/trails` (bulk + 422 invalid-ids + 204), seed de trails fictícias, página FE. |

## 1. Base JÁ ENTREGUE (W1b.1) — NÃO recriar

- **Módulo flat** `apps/api/src/content/` (⚠️ artifacts dizem `src/modules/content/` — **ERRADO**, seguir flat real):
  - `content.controller.ts` (`@Controller('api/v1/trails')`, `@Roles(ADMIN_TENANT, LIDER)`; create/list/get/update/delete trail + reorder modules)
  - `modules/module.controller.ts` (`api/v1/trails/:trailId/modules`)
  - `lessons/lesson.controller.ts` (`api/v1/trails/:trailId/modules/:moduleId/lessons`)
  - `progress/` → `progress.controller.ts` (`@Controller('progress')`: POST `lessons/:lessonId`, GET `trails/:trailId`, GET `trails/:trailId/resume`), `progress.service.ts`, `progress.processor.ts` (BullMQ), specs
  - `content.service.ts` + `content.repository.ts` (repository pattern; soft-delete cascade; reorder)
  - `upload/` (MinIO) + `signed-url/`
- **Prisma models existentes** (`apps/api/prisma/schema.prisma`):
  - `Trail` { id, tenantId, name, description, status `TrailStatus`(draft/published/archived) @default(draft), createdBy, createdAt, updatedAt, deletedAt; rel modules } — **SEM** version/publishedAt/publishedBy/catalogVisible/accessMode
  - `Module` { id, tenantId, trailId, name, order, timestamps, deletedAt; rel trail (Cascade), lessons } — **SEM** lessonAccessMode
  - `Lesson` { id, tenantId, moduleId, name, contentType `LessonContentType`(video/rich_text/pdf_doc/external_link), contentUrl, contentBody, tags[], originalName, mimeType, sizeBytes, uploadedBy, uploadedAt, order, **estimatedDurationMinutes** (já existe!), timestamps, deletedAt }
  - `LessonProgress` { id, tenantId, userId, lessonId, status `LessonStatus`(not_started/in_progress/completed), progressPercent, startedAt, completedAt, lastAccessedAt, timestamps; @@unique([tenantId,userId,lessonId]) } — **SEM** `completedBy`
  - `ModuleProgress` { id, tenantId, userId, moduleId, progressPercent, completedLessons, totalLessons, completedAt, updatedAt; @@unique([tenantId,userId,moduleId]) }
  - `TrailProgress` { id, tenantId, userId, trailId, progressPercent, completedModules, totalModules, ... }
- **Zod** `packages/types/src/content/` (todos registrados em `packages/types/src/index.ts` linhas ~498-577):
  - `content-type.enum.ts` (TrailStatusSchema, LessonContentTypeSchema)
  - `trail.schema.ts`, `module.schema.ts`, `lesson.schema.ts`, `lesson-status.schema.ts`, `lesson-progress.schema.ts`, `upload.schema.ts`
  - `content-events.schema.ts` → `TrailProgressUpdatedEventSchema` (`content.trail.progress_updated`), consts `LESSON_PROGRESS_QUEUE_NAME='lesson-progress'`, `TRAIL_PROGRESS_EVENTS_QUEUE_NAME='trail-progress-events'`
- **FE**: viewers em `apps/web/src/components/content/`; página "Meu Progresso".
- **Modules Groups** (`apps/api/src/groups/` + `apps/api/src/group-members/`): repository pattern; `Group` { id, tenantId, name, dayOfWeek, time, recurrence, notes, createdAt, updatedAt }, `GroupMember` { id, tenantId, groupId, userId, role @default('membro'), createdAt — **SEM updatedAt**; @@unique([groupId,userId]) }.

## 2. Ausências confirmadas (`grep` = 0 ocorrências)

`GroupTrail`/`group_trails`, `TrailVersion`/`trail_versions`, `ModulePrerequisite`/`module_prerequisites`, `TenantContentConfig`/`tenant_content_config`, `completedBy`, `accessMode`, `lessonAccessMode`, `catalogVisible` — **nada existe**. Toda a wave adiciona schema novo → migrations SEQUENCIAIS (1 story = 1 branch = 1 migration), conforme exige a colisão Prisma.

## 3. ⚠️ CONFLITO CRÍTICO 8-6 ↔ 4-4 (resolver na execução)

Ambas as stories descrevem `group_trails` + endpoints de associação. Resolução de propriedade:

- **8-6 É DONA de `group_trails`**: cria o model `GroupTrail`, a migration, a RLS policy e o RLS spec.
  - **Obrigatório (constitution multi-tenant):** `GroupTrail` DEVE ter `tenantId` (o artifact 8-6 lista só groupId/trailId/assignedAt/assignedBy — incompleto). Campos finais: `id` (uuid v7), `tenantId`, `groupId`, `trailId`, `assignedBy`, `assignedAt`, `@@unique([groupId, trailId])`, `@@index([tenantId])`.
  - 8-6 implementa: publish + versioning (`TrailVersion`) + catálogo (`POST/DELETE /api/v1/trails/:id/catalog`, `GET /api/v1/trails/catalog`) + evento `content.trail.published`.
  - **8-6 NÃO implementa os endpoints `groups/:groupId/trails`** (Task 8 do artifact) → **DEFERIR para 4-4** para evitar rota duplicada/retrabalho.
- **4-4 NÃO cria migration de `group_trails`** (já existe pós-8-6). 4-4 implementa só:
  - `apps/api/src/groups/trails/` controller+service: `POST /api/v1/groups/:groupId/trails` (aceita array `trailIds`, bulk; se algum trailId não existe → **422** com lista de inválidos, NÃO 404), `DELETE /api/v1/groups/:groupId/trails/:trailId` → **204**, `GET /api/v1/groups/:groupId/trails`.
  - Reusa a RLS já posta pela 8-6 (sem migration nova; se precisar índice extra, adiciona via migration aditiva mínima).
  - Seed de trails fictícias (`apps/api/prisma/seed/`) + página FE `apps/web/app/(authenticated)/.../groups/[id]/trails/`.

> Se 4-4 detectar que a tabela NÃO existe (ex.: 8-6 abortou), aí sim 4-4 cria a migration. Em execução normal sequencial, 8-6 já entregou.

## 4. Estrutura REAL (ignorar "Project Structure Notes" dos artifacts)

- API: módulos **flat** `apps/api/src/content/...` e `apps/api/src/groups/...` (NÃO `src/modules/`).
- Novos sub-recursos de content → subpastas dentro de `apps/api/src/content/` (ex.: `content/completion/`, `content/access/`, `content/publishing/`, `content/catalog/`).
- Zod: `packages/types/src/content/*.schema.ts` + **registrar export em `packages/types/src/index.ts`**.
- Snapshot: `packages/types/src/__tests__/<dominio>.snapshot.spec.ts` (rodar `vitest run -u` ao add/alterar schema).
- RLS specs: `apps/api/test/rls/*.rls-spec.ts` (hífen) com helper `rls-test.helper.ts`.
- FE: páginas `apps/web/app/(authenticated)/app/...`; componentes/hooks/lib em `apps/web/src/components|hooks|lib/`.

## 5. Guardrails / armadilhas CI a repassar a TODO orquestrador

- **build ≠ lint**: após mudar schema, `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint` antes de confiar na PR. Nova dep → `pnpm install` + commit `pnpm-lock.yaml`.
- **NULLIF invariante** (`nullif-isolation.spec`): toda policy RLS nova com `current_setting` no USING usa `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.
- **RLS spec cadeia FK**: semeie `tenant→trail→module→lesson→...` no `beforeAll`, derrube só no `afterAll`; `beforeEach` limpa só dado mutável. Cleanup que apaga a cadeia entre testes → FK violation / `prisma=undefined`.
- **RLS Prisma v7**: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_APP_URL }) })`; UUIDs FIXOS hex; users GLOBAIS (zero-tenant, colunas id,email,name,status,updated_at — SEM `role`); groups INSERT raw NOT NULL (id,tenant_id,name,day_of_week,time,recurrence,updated_at); `group_members` **sem** updated_at; emails/ids únicos entre specs.
- **Dado user-scoped**: NÃO há GUC `app.current_user_id`. Padrão = RLS tenant-only + filtro app-level por `RequestContext.userId` no service. Não criar policies `*_user_isolation` PERMISSIVE.
- **Multi-tenancy**: `tenantId` em toda tabela nova; nunca como parâmetro (AsyncLocalStorage / `withTenantTx`). UUID v7 via `generateId()`.
- **Completion imutável** (8-4): conclusão já registrada NÃO muda retroativamente ao alterar regras do tenant.
- **Progresso estável** (8-6): `LessonProgress` referencia `lessonId` (UUID v7), não trail version; lesson removida em nova versão → progress soft-archived, nunca deletado. Regression test obrigatório.
- **PT-BR + vocabulário pastoral** no user-facing (vocabulary.ts); código/log em inglês; conventional commits PT-BR; response `{ data, meta? }` / error `{ statusCode, error, message }`.

## 6. Fechamento de épicos

- **epic-8**: permanece `in-progress` após 8-4/8-5/8-6 (faltam 8-7..8-10).
- **epic-4**: 4-1/4-2/4-3/4-5 = done; **ao mergear 4-4 → marcar 4-4: done E epic-4: done** (fecha o épico). Verificar `epic-4-retrospective`.
