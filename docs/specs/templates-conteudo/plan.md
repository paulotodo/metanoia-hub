# Plano Técnico — Templates de Conteúdo Reutilizáveis (FR42 / Story 13.5)

> Feature: `templates-conteudo` · short_name `templates-conteudo`
> Spec: [`spec.md`](./spec.md) · Artefato autoritativo: `_bmad-output/implementation-artifacts/13-5-templates-de-conteudo-reutilizaveis-fr42.md`
> Bounded context: **content** (core domain → repository pattern)

## 1. Visão Geral

Um **template** é um *snapshot imutável da estrutura* de uma trilha (módulos + lições),
contendo apenas metadados estruturais (`name`, `order`, `contentType`,
`estimatedDurationMinutes`, `lessonAccessMode`) — **nunca** conteúdo real
(`contentUrl`, `contentBody`, `originalName`, `mimeType`, `sizeBytes`, `uploadedBy`,
`uploadedAt`, `tags`).

Dois escopos:
- **platform** (`tenant_id IS NULL`): 3 templates pré-carregados via seed, legíveis por
  todos os tenants, **read-only** (PATCH/DELETE → 403).
- **tenant** (`tenant_id = <tenant>`): criados a partir de trilhas próprias,
  versionados automaticamente, editáveis e soft-deletáveis pelo próprio tenant.

Materializar (usar) um template estende `POST /api/v1/trails` com `templateId?` opcional:
cria `Trail + Module[] + Lesson[]` espelhando a `structure`, com **conteúdo vazio**
e **sem referência ao template** (cópia independente — FR-15).

## 2. Decisões Arquiteturais (herdadas do clarify — NÃO reabrir)

| # | Decisão | Fundamento (read-back) |
|---|---------|------------------------|
| A1 | `ContentTemplate` é um novo model Prisma no schema, `@@map("content_templates")`. | Paridade com Trail/Module/Lesson (`schema.prisma:615+`). |
| A2 | RLS **split read/write** (dec-015, owasp): READ `FOR SELECT USING (tenant_id IS NULL OR tenant_id = NULLIF(...))` (platform visível a todos); WRITE `FOR INSERT/UPDATE/DELETE WITH CHECK (tenant_id = NULLIF(...))` — nunca NULL, para tenant não forjar template platform. | `mv_refresh_log` (USING-simples) é seguro só porque escrito fora do request-path; `content_templates` é escrito pelo tenant. Espelha `meeting_events_tenant_insert` (consolidate_rls_nullif). |
| A3 | `tenant_id NULLABLE`; platform = NULL. Prisma extension auto-injeta tenant_id em writes; leituras de platform passam pela cláusula `IS NULL` da policy. | `RequestContext` via `getRequestContext()`; nunca tenant_id como parâmetro (CLAUDE.md regra absoluta). |
| A4 | `structure` JSONB sem conteúdo: `{ modules: [{ name, order, lessonAccessMode, lessons: [{ name, order, contentType, estimatedDurationMinutes }] }] }`. | FR-07; minimiza superfície de vazamento (owasp). |
| A5 | Endpoints num **novo controller** `@Controller('api/v1/templates')`; usar template estende o controller `api/v1/trails` existente. | Controller atual `api/v1/trails` é `@Roles(ADMIN_TENANT, LIDER)`; templates exigem `@Roles(ADMIN_TENANT)` puro → controller dedicado mais limpo. |
| A6 | Lógica em `TemplateService` + `TemplateRepository` (repository pattern, core domain). Materialização em `ContentService.createTrail` reusa `TemplateRepository.findByIdForMaterialization`. | `content` é core domain → repository pattern (CLAUDE.md backend patterns). `ContentRepository` já usa `withTenantTx`. |
| A7 | Versionamento: `MAX(version)+1` por `source_trail_id` calculado dentro de `withTenantTx` antes do insert; UNIQUE `(source_trail_id, version)` é o backstop. | FR-04, FR-08. |
| A8 | `created_by = ctx.userId` (RequestContext). IDs via `uuidv7()`. | FR-17; idêntico a `createTrail` (`content.service:38`). |
| A9 | Soft-delete (`deleted_at`) sem cascade. Materialização NÃO referencia template → DELETE de template não afeta trilhas geradas. | FR-12, FR-15. |
| A10 | Seed idempotente de 3 templates platform (upsert por chave natural). | FR-06; padrão `subscription-plans-seed.ts`. |
| A11 | UI `/app/admin/templates` — área autenticada, **fora** do gate axe público (Epic 12). | spec US5. |

## 3. Modelo de Dados

Detalhe completo em [`data-model.md`](./data-model.md). Resumo:

- **Novo model `ContentTemplate`** → tabela `content_templates`.
- **FK** `source_trail_id → trails(id)` com `ON DELETE SET NULL` (trilha-fonte pode ser
  removida sem destruir o template já capturado; evita cascade indesejado).
- **Sem** novas colunas em `trails`/`modules`/`lessons` — materialização usa os models
  existentes com conteúdo NULL.
- **Migration** `apps/api/prisma/migrations/20260628000000_13-5-content-templates/migration.sql`
  (timestamp ≥ 20260628; o último em árvore é 20260627 — confirmado).

## 4. Camadas e Arquivos a Tocar

### 4.1 Banco (Prisma + migration)
- `apps/api/prisma/schema.prisma` — model `ContentTemplate` + enum `TemplateScope`.
  Relação inversa opcional em `Trail` (`contentTemplates ContentTemplate[]`) — avaliar se
  necessária; FK `SET NULL` permite manter relação sem cascade.
- `apps/api/prisma/migrations/20260628000000_13-5-content-templates/migration.sql`:
  - `CREATE TYPE template_scope AS ENUM ('platform','tenant');` (ou VARCHAR + CHECK —
    seguir convenção existente: enums Prisma viram tipos PG; ver `LessonContentType`).
  - `CREATE TABLE content_templates (...)`.
  - `CREATE UNIQUE INDEX content_templates_source_trail_version_idx ON content_templates (source_trail_id, version);`
  - Índices: `(tenant_id)`, `(tenant_id, scope)`, `(tenant_id, deleted_at)`, `(source_trail_id)`.
  - `ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY;` + **4 policies** (padrão A2): `content_templates_read` (SELECT, USING aceita NULL), `_insert` (WITH CHECK own tenant), `_update` (USING+WITH CHECK own tenant), `_delete` (USING own tenant). Ver `data-model.md §2`.

### 4.2 Contratos (`packages/types/src/content/`)
Novo arquivo `template.schema.ts` (segue o split por arquivo do diretório):
- `TemplateScopeSchema` (`z.enum(['platform','tenant'])`).
- `TemplateStructureSchema` (modules→lessons, sem conteúdo).
- `ContentTemplateSchema` (resposta — datas ISO 8601, nulls explícitos).
- `CreateTemplateRequestSchema` (`sourceTrailId`, `name`, `description?`).
- `UpdateTemplateRequestSchema` (`name?`, `description?`).
- `TemplateListQuerySchema` (`scope` default `all`, `search?`, `sort?`, `page`, `pageSize` — padrão `z.coerce.number()` de `TrailsListQuerySchema`).
- `TemplateVersionItemSchema` / lista de versões.
- Estender `CreateTrailRequestSchema` (`content/trail.schema.ts`) com `templateId?: z.string().uuid().optional()` e `groupId?: z.string().uuid().optional()`.
- Re-exports em `packages/types/src/index.ts`.
- **Snapshot tests** para todos os novos schemas (gate contra breaking changes — CLAUDE.md).

### 4.3 Backend (`apps/api/src/content/templates/`)
- `template.repository.ts` — `createTemplate`, `findById`, `list`, `update`, `softDelete`,
  `listVersions`, `nextVersion(sourceTrailId)`, `findByIdForMaterialization`. Tudo via `withTenantTx`.
- `template.service.ts` — orquestra snapshot (lê Trail+Modules+Lessons da trilha-fonte,
  monta `structure` sem conteúdo), versionamento, guards de escopo platform (403).
- `template.controller.ts` — `@Controller('api/v1/templates')`, `@UseGuards(KeycloakAuthGuard, RolesGuard)`, `@Roles(Role.ADMIN_TENANT)`, `ZodValidationPipe`.
- `ContentService.createTrail` — aceitar `body.templateId?`; se presente, materializar via
  `TemplateRepository.findByIdForMaterialization(templateId)` dentro do mesmo `withTenantTx`,
  criando Trail+Modules+Lessons com conteúdo NULL.
- `content.module.ts` — registrar `TemplateController`, `TemplateRepository`, `TemplateService`.

### 4.4 Seed
- `apps/api/prisma/seeds/content-templates-seed.ts` — 3 templates platform
  (`tenant_id NULL`, `scope platform`, `source_trail_id NULL`, `version 1`), idempotente
  (upsert por `name` + `scope=platform` OU por id fixo UUIDv7 determinístico).
  - Discipulado Básico (4 módulos / 12 lições)
  - Estudo Bíblico Temático (3 / 9)
  - Acolhimento de Novos Membros (2 / 6)
- **Regra 13-2b**: inserts raw em tabela com `@updatedAt NOT NULL` precisam `updated_at=now()`.
  `content_templates` **não** terá `updated_at` (spec lista só `created_at`), então N/A — mas
  confirmar no schema final.

### 4.5 Frontend (`apps/web`)
- `/app/admin/templates` — biblioteca (lista por scope, busca, preview da árvore).
- Client Component + TanStack Query (área autenticada/CSR). Mensagens PT-BR em `pt-BR.json`.
- Fora do gate axe público; segue tech-debt R2 (a11y autenticado) do Epic 12.

### 4.6 Testes
- **RLS** `apps/api/test/rls/content-templates.rls-spec.ts` (idempotente, roda 2× no CI):
  - platform (NULL) visível a TENANT_A e TENANT_B;
  - template de TENANT_A invisível a TENANT_B;
  - seed idempotente.
- **Service/unit** `template.service.spec.ts` — snapshot sem conteúdo, versionamento, 403 platform.
- **Snapshot** dos Zod schemas em `packages/types`.
- Materialização: `content.service.spec.ts` — Trail criado de template com lições `contentUrl/contentBody NULL`.

## 5. Sequência de Implementação (tasks preview → create-tasks)

1. Migration + model Prisma + RLS (gate: Postgres local, `prisma generate`).
2. Zod schemas + snapshot tests (`packages/types`).
3. `TemplateRepository` + `TemplateService` + `TemplateController` (CRUD + versions).
4. Estender `createTrail` (materialização) + `CreateTrailRequestSchema`.
5. Seed idempotente 3 platform + RLS spec idempotente.
6. UI `/app/admin/templates`.

## 6. Gates de Validação (execute-task)

- `pnpm --filter @metanoia/api exec prisma generate` após editar schema.
- Migration validada com Postgres local **antes** de fechar a task (lição 13-3).
- RLS spec roda 2× (idempotência).
- Snapshot tests Zod atualizados conscientemente.
- `tenant_id` nunca passado como parâmetro; nunca `@default(uuid())`.

## 7. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| **Write cross-tenant via RLS USING-sem-WITH-CHECK** (forjar template platform) | **CORRIGIDO (dec-015):** policies de escrita com `WITH CHECK (tenant_id = current_tenant)` separadas da de leitura; RLS spec testa que tenant NÃO insere/atualiza linha com `tenant_id=NULL` nem de outro tenant. |
| Snapshot capturar conteúdo sensível | `structure` JSONB whitelista campos estruturais; service NUNCA copia `contentUrl/contentBody/...`. owasp gate confirma. |
| Platform template mutável por engano | Guard de escopo no service (403) + RLS não concede UPDATE/DELETE implícito; teste de 403. |
| BigInt `sizeBytes` em JSON | Não aplicável — `sizeBytes` jamais entra na structure nem na materialização (sempre NULL). |
| Migration timestamp colidir/regressar | `20260628000000` > último em árvore (`20260627`). |
| FK cascade apagar templates ao remover trilha-fonte | `ON DELETE SET NULL` em `source_trail_id`. |
