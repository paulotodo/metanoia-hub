# Backlog — Templates de Conteúdo Reutilizáveis (FR42 / Story 13.5)

**Feature**: `templates-conteudo`
**Sprint**: Epic 13 / Story 13.5
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data model**: [data-model.md](./data-model.md)
**Artefato autoritativo**: `_bmad-output/implementation-artifacts/13-5-templates-de-conteudo-reutilizaveis-fr42.md`

---

## Legenda de Criticidade

- `[crit]` — crítico: falha bloqueia a story ou viola contrato de segurança/RLS
- `[imp]` — importante: cobertura funcional significativa, sem ser bloqueador de merge
- `[opt]` — opcional/melhoria: valor agregado, pode ser diferido para tech debt

---

## Escopo Coberto

- Migração Prisma + SQL com tabela `content_templates` e 4 políticas RLS separadas
- Seed de 3 templates de plataforma (FR-21, role privilegiado)
- Contratos Zod em `packages/types` com snapshot tests
- Backend NestJS: controller, service, repository (repository pattern, core domain)
- Endpoints: CRUD de templates + GET /versions + POST /trails com templateId
- Frontend: página `/app/admin/templates` (biblioteca + preview + CRUD tenant)
- Testes: RLS isolation spec (idempotente, roda 2x no CI), unit/service, snapshot Zod

## Escopo Excluído

- Migração de dados históricos de trilhas existentes para templates (fora do MVP)
- Interface de gerenciamento de templates de plataforma (apenas seed + read-only via UI)
- Notificações/webhooks em eventos de template (tech debt futuro)
- Exportação/importação de templates entre tenants

---

## Matriz de Dependências

```
FASE 1 (DB + Contratos)
  1.1 Migration SQL (BLOQUEANTE para tudo)
  1.2 Prisma schema/generate → depende de 1.1
  1.3 Zod schemas → depende de 1.2 (usa enums gerados)
  1.4 Seed plataforma → depende de 1.1

FASE 2 (Backend)
  2.1 Repository → depende de 1.2 + 1.3
  2.2 Service → depende de 2.1
  2.3 Controller + endpoints CRUD → depende de 2.2
  2.4 POST /trails com templateId → depende de 2.2 + controller existente trails

FASE 3 (Testes)
  3.1 RLS isolation spec → depende de 1.1
  3.2 Unit/service tests → depende de 2.2
  3.3 Snapshot Zod → depende de 1.3
  3.4 Teste materialização → depende de 2.4

FASE 4 (Frontend)
  4.1 Página lista + busca → depende de 2.3
  4.2 Preview + Usar Template → depende de 4.1 + 2.4
  4.3 CRUD tenant + histórico versões → depende de 4.1

FASE 5 (Revisão + Gate)
  5.1 Gate CI (RLS roda 2x) → depende de 3.1
  5.2 Smoke test E2E básico → depende de 4.1 + 2.3
  5.3 Revisão de segurança final (CHK001-CHK042) → depende de todas
```

---

## FASE 1 — Banco de Dados e Contratos

### 1.1 Migration SQL: tabela content_templates + RLS [crit]

**Descrição**: Criar a migration `20260628000000_13-5-content-templates` com SQL completo: enum `TemplateScope`, tabela `content_templates`, índices e **4 políticas RLS separadas** (finding HIGH de segurança).

**Arquivos**:
- `apps/api/prisma/migrations/20260628000000_13-5-content-templates/migration.sql` (criar)

**Critérios de aceite**:
- [ ] Enum `CREATE TYPE "TemplateScope" AS ENUM ('platform', 'tenant')` criado antes da tabela
- [ ] Tabela `content_templates` com colunas exatas: `id UUID NOT NULL PRIMARY KEY`, `tenant_id UUID` (NULLABLE — NULL = platform), `scope "TemplateScope" NOT NULL`, `source_trail_id UUID REFERENCES trails(id) ON DELETE SET NULL ON UPDATE CASCADE`, `name VARCHAR(500) NOT NULL`, `description VARCHAR(1000)`, `version INTEGER NOT NULL DEFAULT 1`, `structure JSONB NOT NULL`, `created_by UUID NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `deleted_at TIMESTAMPTZ`
- [ ] `UNIQUE INDEX content_templates_source_trail_version_idx ON content_templates (source_trail_id, version)`
- [ ] Índices de query: `(tenant_id)`, `(tenant_id, scope)`, `(tenant_id, deleted_at)`, `(source_trail_id)`
- [ ] `ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] **Policy READ** (`content_templates_read`): `FOR SELECT USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)` — única policy que permite NULL (platform visível a todos)
- [ ] **Policy INSERT** (`content_templates_insert`): `FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)` — NUNCA permite NULL via app
- [ ] **Policy UPDATE** (`content_templates_update`): `FOR UPDATE USING (tenant_id = NULLIF(...)) WITH CHECK (tenant_id = NULLIF(...))` — AMBAS cláusulas presentes, impede re-associação cross-tenant
- [ ] **Policy DELETE** (`content_templates_delete`): `FOR DELETE USING (tenant_id = NULLIF(...))` — apenas linhas do próprio tenant
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON content_templates TO metanoia_app`
- [ ] Comentário SQL explicando risco A01/API3 BOPLA (dec-015) nas policies de escrita
- [ ] Migration usa `--create-only` (não executada automaticamente pelo Prisma em dev — seed separado)
- [ ] Timestamp `20260628000000` (posterior à última migration `20260627*` confirmada)

**Referências**: data-model.md §2, security-rls.md CHK001-CHK009, plan §A2

---

### 1.2 Prisma schema: model ContentTemplate + enum TemplateScope [crit]

**Descrição**: Adicionar o model `ContentTemplate` e enum `TemplateScope` ao `schema.prisma`, garantindo paridade com a migration SQL. Rodar `prisma generate` após.

**Arquivos**:
- `apps/api/prisma/schema.prisma` (editar — adicionar model + enum)

**Critérios de aceite**:
- [ ] Enum `TemplateScope { platform tenant }` adicionado ao schema
- [ ] Model `ContentTemplate` com campo `id` sem `@default(uuid())` — ID gerado via `uuidv7()` no service (regra absoluta CLAUDE.md)
- [ ] `tenantId String? @map("tenant_id") @db.Uuid` (nullable, plataforma = null)
- [ ] `scope TemplateScope`
- [ ] `sourceTrailId String? @map("source_trail_id") @db.Uuid` (nullable)
- [ ] Relação `trail Trail? @relation(fields: [sourceTrailId], references: [id])` com `onDelete: SetNull`
- [ ] `name String @db.VarChar(500)`
- [ ] `description String? @db.VarChar(1000)`
- [ ] `version Int @default(1)`
- [ ] `structure Json`
- [ ] `createdBy String @map("created_by") @db.Uuid`
- [ ] `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)`
- [ ] `deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)`
- [ ] `@@map("content_templates")`
- [ ] Relação inversa `contentTemplates ContentTemplate[]` em `Trail` somente se necessária para queries
- [ ] `pnpm --filter @metanoia/api exec prisma generate` executado sem erros de tipo

**Referências**: data-model.md §1, plan §A1, CLAUDE.md (UUID v7)

---

### 1.3 Zod schemas: packages/types [crit]

**Descrição**: Criar schemas Zod em `packages/types/src/content/template.schema.ts` cobrindo todos os contratos da feature. Snapshot tests obrigatórios.

**Arquivos**:
- `packages/types/src/content/template.schema.ts` (criar)
- `packages/types/src/content/template.schema.spec.ts` (criar — snapshot tests)
- `packages/types/src/content/index.ts` (editar — re-exportar)
- `packages/types/src/index.ts` (editar — re-exportar content/)
- `packages/types/src/trail/trail.schema.ts` (editar — estender CreateTrailRequestSchema com templateId? e groupId?)

**Critérios de aceite**:
- [ ] `TemplateScopeSchema = z.enum(['platform', 'tenant'])`
- [ ] `TemplateStructureLessonSchema`: campos name, order, contentType, estimatedDurationMinutes — sem campos de conteúdo (snapshot estrutural apenas)
- [ ] `TemplateStructureModuleSchema`: name, order, lessonAccessMode, lessons
- [ ] `TemplateStructureSchema`: `{ modules: z.array(...).min(1) }`
- [ ] `ContentTemplateSchema` (response): todos os campos com nulls explícitos (tenantId, sourceTrailId, description nullable — CLAUDE.md)
- [ ] `CreateTemplateRequestSchema`: sourceTrailId UUID, name (min 1, max 500), description opcional
- [ ] `UpdateTemplateRequestSchema`: name e/ou description opcionais, refine que ao menos um presente
- [ ] `UseTemplateRequestSchema`: templateId UUID, groupId UUID opcional
- [ ] `TemplateListQuerySchema`: scope default 'all', sort enum('name','-name','createdAt','-createdAt'), page e pageSize com coerce
- [ ] `TemplateVersionItemSchema`: id, version, sourceTrailId, name, createdAt, createdBy
- [ ] `CreateTrailRequestSchema` estendido com `templateId?: z.string().uuid().optional()` e `groupId?: z.string().uuid().optional()`
- [ ] Snapshot tests para cada schema exportado
- [ ] `pnpm --filter @metanoia/types build` sem erros

**Referências**: security-rls.md CHK035-CHK038, contracts/template-schemas.md, plan §4.2

---

### 1.4 Seed: 3 templates de plataforma (FR-21) [crit]

**Descrição**: Criar seed idempotente para os 3 templates de plataforma (`tenant_id NULL`, `scope=platform`). O seed DEVE rodar via role privilegiado (owner/superuser) que bypassa a RLS, pois o role de aplicação `metanoia_app` não pode inserir `tenant_id=NULL` pela policy INSERT.

**Arquivos**:
- `apps/api/prisma/seeds/content-templates-seed.ts` (criar)
- `apps/api/prisma/seed.ts` (editar — importar e chamar `seedContentTemplates()`)

**Critérios de aceite**:
- [ ] 3 templates com dados exatos:
  - `Discipulado Básico`: 4 módulos / 12 lições, scope=platform, tenant_id=null
  - `Estudo Bíblico Temático`: 3 módulos / 9 lições, scope=platform, tenant_id=null
  - `Acolhimento de Novos Membros`: 2 módulos / 6 lições, scope=platform, tenant_id=null
- [ ] IDs UUIDv7 determinísticos fixos (idempotência reproduzível)
- [ ] Seed usa `prisma.$executeRaw('SET LOCAL row_security = off')` dentro de `$transaction` OU conecta via DATABASE_URL com role owner/superuser — mecanismo documentado em comentário
- [ ] Lógica de upsert por id fixo: `upsert({ where: { id: FIXED_UUID }, create: {...}, update: {} })` — idempotente
- [ ] `structure` JSONB preenchido com estrutura real de módulos e lições (sem contentUrl/contentBody)
- [ ] `createdBy` usa UUID de sistema (constante SYSTEM_USER_ID)
- [ ] `version = 1`, `sourceTrailId = null`
- [ ] Seed roda 2x sem erro nem duplicata
- [ ] Padrão segue `subscription-plans-seed.ts` (convenção do projeto)

**Referências**: security-rls.md CHK008-CHK009, spec FR-21, plan §A10, §4.4

---

## FASE 2 — Backend NestJS

### 2.1 Repository: TemplateRepository [crit]

**Descrição**: Criar `TemplateRepository` em `apps/api/src/content/templates/template.repository.ts` seguindo o repository pattern do core domain (igual a `ContentRepository`).

**Arquivos**:
- `apps/api/src/content/templates/template.repository.ts` (criar)
- `apps/api/src/content/content.module.ts` (editar — registrar provider)

**Critérios de aceite**:
- [ ] Classe `TemplateRepository` com `@Injectable()`
- [ ] Injeção de `PrismaService` (não PrismaClient direto)
- [ ] Usa `getRequestContext()` para tenantId — NUNCA passa tenantId como parâmetro
- [ ] Método `findAll(query)` — filtra deletedAt IS NULL, aplica scope, search (ILIKE), sort, paginação
- [ ] Método `findById(id)` — filtra deletedAt IS NULL; null se não encontrado
- [ ] Método `findByIdForMaterialization(id)` — sem filtro de deletedAt (detecta deletado para 404)
- [ ] Método `findVersionsBySourceTrailId(sourceTrailId)` — ordenado version ASC
- [ ] Método `create(data)` — calcula version = MAX(version)+1 dentro de transação; id = uuidv7(); createdBy = ctx.userId
- [ ] Método `update(id, data)` — apenas name/description
- [ ] Método `softDelete(id)` — deletedAt = now()
- [ ] Transação atômica no create para MAX(version)+1 sem race condition
- [ ] findAll para scope=all inclui tenantId IS NULL (platform) e tenantId = currentTenant

**Referências**: plan §A3, §A6, §A7, §A8, CLAUDE.md (multi-tenancy, repository pattern)

---

### 2.2 Service: TemplateService [crit]

**Descrição**: Criar `TemplateService` em `apps/api/src/content/templates/template.service.ts` com lógica de negócio, validações e snapshot de structure.

**Arquivos**:
- `apps/api/src/content/templates/template.service.ts` (criar)
- `apps/api/src/content/templates/template.service.spec.ts` (criar — testes unitários)

**Critérios de aceite**:
- [ ] `createTemplate(dto)`: busca trail-fonte, gera snapshot JSONB sem conteúdo, chama repository.create
- [ ] Snapshot JSONB: remove contentUrl, contentBody, videoUrl, audioUrl, attachments da estrutura
- [ ] `getTemplates(query)`: delega ao repository com paginação
- [ ] `getTemplateById(id)`: lança NotFoundException se null; 404 para deletado
- [ ] `getVersionsBySourceTrail(sourceTrailId)`: para platform retorna { data: [] }
- [ ] `updateTemplate(id, dto)`: 404 se inexistente/deletado; 403 ForbiddenException se scope=platform (FR-11)
- [ ] `deleteTemplate(id)`: 404 se inexistente/já deletado; 403 ForbiddenException se scope=platform (FR-12)
- [ ] `materializeFromTemplate(templateId, dto)`: busca com findByIdForMaterialization; deletedAt NOT NULL → NotFoundException; cria Trail+Module+Lesson com conteúdo null; cópia independente (sem FK trail→template)
- [ ] Unit tests: snapshot-sem-conteúdo, versionamento v2, 403 platform, 404 deletado, materialização independente, 404 templateId deletado

**Referências**: plan §A4, §A6, §A9, data-model.md §4 §5, security-rls.md CHK020-CHK027

---

### 2.3 Controller: TemplateController + endpoints CRUD [crit]

**Descrição**: Criar `TemplateController` dedicado com todos os endpoints de templates.

**Arquivos**:
- `apps/api/src/content/templates/template.controller.ts` (criar)
- `apps/api/src/content/templates/dto/` (criar DTOs: create, update, list-query, response)
- `apps/api/src/content/content.module.ts` (editar — registrar controller)

**Critérios de aceite**:
- [ ] `@Controller('api/v1/templates')` com `@Roles('admin_tenant')` na classe inteira
- [ ] `POST /api/v1/templates` → 201 com `{ data: ContentTemplateResponseDto }`, body validado por ZodValidationPipe
- [ ] `GET /api/v1/templates` → `{ data: ContentTemplate[], meta: { total, page, pageSize } }`, filtra deletedAt IS NULL (FR-22)
- [ ] `GET /api/v1/templates/:id` → `{ data }` com structure completo; 404 se deletado (FR-22)
- [ ] `GET /api/v1/templates/:id/versions` → `{ data: TemplateVersionItem[] }` ASC; platform retorna `{ data: [] }`
- [ ] `PATCH /api/v1/templates/:id` → 403 se platform; 404 se inexistente/deletado; `{ data }` atualizado
- [ ] `DELETE /api/v1/templates/:id` → 403 se platform; 404 se inexistente/deletado; 204 No Content
- [ ] ZodValidationPipe customizado do projeto (sem nestjs-zod)
- [ ] Swagger @ApiTags('templates') com descrições em inglês
- [ ] Nenhum stack trace em respostas de erro

**Referências**: plan §A5, security-rls.md CHK028-CHK034, CLAUDE.md

---

### 2.4 Extensão de POST /api/v1/trails com templateId [crit]

**Descrição**: Estender o endpoint `POST /api/v1/trails` existente para aceitar `templateId` opcional e materializar Trail+Modules+Lessons da structure do template.

**Arquivos**:
- `apps/api/src/content/trails/trail.controller.ts` (editar — createTrail aceita templateId?)
- `apps/api/src/content/content.service.ts` (editar — lógica de materialização)
- `apps/api/src/content/dto/create-trail.dto.ts` (editar — adicionar templateId? e groupId?)

**Critérios de aceite**:
- [ ] `CreateTrailRequestDto` estendido com `templateId?: string (UUID)` e `groupId?: string (UUID)`
- [ ] Se templateId presente: chama templateService.materializeFromTemplate(templateId, dto)
  - [ ] Template deletedAt NOT NULL → 404 NotFoundException (CHK041)
  - [ ] Cria Trail+Modules+Lessons com contentUrl=null, contentBody=null
  - [ ] Trilha independente: sem FK trilha→template
  - [ ] createdBy = ctx.userId, tenantId via RequestContext
- [ ] Se templateId ausente: fluxo existente inalterado (backward compatible)
- [ ] Retorna 201 com `{ data: TrailResponseDto }` no formato padrão
- [ ] `@Roles(ADMIN_TENANT, LIDER)` mantido no TrailsController

**Referências**: plan §A5, data-model.md §4, security-rls.md CHK038-CHK042, spec FR-14

---

## FASE 3 — Testes

### 3.1 RLS isolation spec (idempotente, CI 2x) [crit]

**Descrição**: Criar spec de isolamento RLS em `apps/api/test/rls/content-templates.rls-spec.ts`. Deve ser 100% idempotente e rodar 2x no CI sem erro (lição 13-3).

**Arquivos**:
- `apps/api/test/rls/content-templates.rls-spec.ts` (criar)

**Critérios de aceite**:
- [ ] Setup com UUIDs determinísticos e únicos para TENANT_A, TENANT_B, USER_A, USER_B (sem Math.random())
- [ ] Slugs únicos com sufixo fixo nos inserts raw (não conflita com outros testes)
- [ ] Inclui `updated_at = now()` nos inserts raw de tabelas que têm esse campo (lição 13-2b)
- [ ] Cenário 1 — READ isolation: TENANT_A vê platform + seus; não vê de TENANT_B; TENANT_B vê platform; não vê de TENANT_A
- [ ] Cenário 2 — WRITE isolation: INSERT tenant_id=NULL sob TENANT_A → rejeitado; INSERT tenant_id=TENANT_B sob TENANT_A → rejeitado; INSERT tenant_id=TENANT_A sob TENANT_A → aceito
- [ ] Cenário 3 — Platform read-only: UPDATE/DELETE de template platform sob TENANT_A → 0 rows affected
- [ ] Cenário 4 — Soft-delete isolation: template deletedAt NOT NULL invisível no findAll (filtragem na camada de aplicação, não RLS)
- [ ] Cenário 5 — Seed idempotência: seed roda 2x; contagem platform = 3 após 2x
- [ ] Spec roda 2x no CI sem erro
- [ ] Cleanup em afterAll remove apenas dados deste spec (por UUID determinístico)
- [ ] Usa $executeRawUnsafe ou $queryRaw com parâmetros para inserts diretos (sem ORM)

**Referências**: security-rls.md §1, plan §7 Riscos, lição 13-3

---

### 3.2 Unit/service tests: TemplateService [imp]

**Descrição**: Testes unitários do TemplateService cobrindo caminhos críticos.

**Arquivos**:
- `apps/api/src/content/templates/template.service.spec.ts` (criar — co-localizado com 2.2)

**Critérios de aceite**:
- [ ] Snapshot sem conteúdo: createTemplate com trail tendo lições com contentUrl → template gerado sem contentUrl no JSONB
- [ ] Versionamento v2: criar template da mesma trail-fonte → version = 2
- [ ] 403 platform PATCH: updateTemplate em scope=platform → ForbiddenException
- [ ] 403 platform DELETE: deleteTemplate em scope=platform → ForbiddenException
- [ ] 404 deletado GET: getTemplateById com deletedAt NOT NULL → NotFoundException
- [ ] Materialização independente: Trail criada sem FK para template; deletar template não afeta Trail
- [ ] 404 templateId deletado: materializeFromTemplate com deletedAt NOT NULL → NotFoundException
- [ ] Mocks via Jest; uuidv7() mocado para output determinístico

**Referências**: spec US1-US4, plan §A7, §A9

---

### 3.3 Snapshot tests: Zod schemas [imp]

**Descrição**: Garantir que mudanças acidentais nos schemas Zod sejam detectadas no CI.

**Arquivos**:
- `packages/types/src/content/template.schema.spec.ts` (criar — co-localizado com 1.3)

**Critérios de aceite**:
- [ ] `expect(ContentTemplateSchema.shape).toMatchSnapshot()` para cada schema exportado
- [ ] Parse de fixture válida → safeParse retorna success: true
- [ ] Parse de fixture com contentUrl na structure → safeParse falha (valida ausência de campos de conteúdo)
- [ ] Snapshot em `__snapshots__/template.schema.spec.ts.snap`
- [ ] CI falha se snapshot divergir

**Referências**: security-rls.md CHK035-CHK038

---

### 3.4 Teste de materialização [imp]

**Descrição**: Teste de integração do fluxo `POST /api/v1/trails { templateId }`.

**Arquivos**:
- `apps/api/src/content/content.service.spec.ts` (editar — adicionar casos de materialização)

**Critérios de aceite**:
- [ ] Trail criada de template: lessons têm contentUrl=null, contentBody=null
- [ ] Estrutura de módulos e lições espelha a structure do template
- [ ] Após deletar template, Trail criada permanece inalterada
- [ ] templateId inexistente → NotFoundException
- [ ] templateId com deletedAt NOT NULL → NotFoundException

**Referências**: data-model.md §4, spec FR-14, security-rls.md CHK040-CHK042

---

## FASE 4 — Frontend

### 4.1 Página biblioteca: /app/admin/templates [imp]

**Descrição**: Criar página `/app/admin/templates` com lista de templates (plataforma + tenant), busca e filtro por scope.

**Arquivos**:
- `apps/web/app/admin/templates/page.tsx` (criar — Server Component wrapper)
- `apps/web/app/admin/templates/templates-list.tsx` (criar — Client Component com TanStack Query)
- `apps/web/messages/pt-BR.json` (editar — adicionar chaves de templates)

**Critérios de aceite**:
- [ ] Rota `/app/admin/templates` acessível apenas para admin_tenant
- [ ] Server Component com Suspense para hydration
- [ ] Client Component com TanStack Query para busca/filtro
- [ ] Lista exibe: nome, descrição (truncada), scope (badge Plataforma/Tenant), versão, data criação, contagem módulos/lições
- [ ] Templates de plataforma com badge "Somente leitura" e sem botões Editar/Excluir
- [ ] Busca por nome com debounce 300ms
- [ ] Filtro por scope: Todos / Plataforma / Meus Templates
- [ ] Sort: nome A-Z (padrão), Z-A, mais recente, mais antigo
- [ ] Paginação pageSize=20 com prev/next
- [ ] Estado loading (skeleton) e erro (mensagem PT-BR)
- [ ] Mensagens PT-BR em pt-BR.json (templates.page.title, templates.scope.platform, etc.)
- [ ] Usa classe `text-secondary` (não `text-muted-foreground` — tech debt a11y EP12)
- [ ] Componentes shadcn/ui existentes (Badge, Button, Input, Skeleton)

**Referências**: spec US5, plan §4.5, §A11

---

### 4.2 Preview de estrutura + "Usar Template" [imp]

**Descrição**: Página de detalhe com árvore de estrutura do template e botão "Usar Template".

**Arquivos**:
- `apps/web/app/admin/templates/[id]/page.tsx` (criar — detalhe)
- `apps/web/app/admin/templates/[id]/template-structure-preview.tsx` (criar — árvore módulos/lições)
- `apps/web/messages/pt-BR.json` (editar — chaves de preview e ação)

**Critérios de aceite**:
- [ ] GET /api/v1/templates/:id via TanStack Query
- [ ] TemplateStructurePreview: árvore módulos expandíveis → lições com ícone de tipo e duração
- [ ] Botão "Usar Template" → redirect para /app/admin/trails/new?templateId=<id>
- [ ] Botão "Histórico de Versões" visível apenas para templates com sourceTrailId NOT NULL
- [ ] Templates de plataforma: sem Editar/Excluir; badge "Somente leitura"
- [ ] 404: template inexistente ou deletado → página de erro PT-BR
- [ ] axe-core nos componentes (reusar padrão Epic 12)

**Referências**: spec US4, US5

---

### 4.3 CRUD tenant + histórico de versões [opt]

**Descrição**: Formulário de edição, soft-delete e histórico de versões para templates de tenant.

**Arquivos**:
- `apps/web/app/admin/templates/[id]/edit/page.tsx` (criar)
- `apps/web/app/admin/templates/[id]/versions/page.tsx` (criar)
- `apps/web/app/admin/templates/create/page.tsx` (criar — captura snapshot de trilha)
- `apps/web/messages/pt-BR.json` (editar — chaves CRUD)

**Critérios de aceite**:
- [ ] Formulário de edição: name e description; validação Zod client-side; mutation PATCH via TanStack Query
- [ ] Feedback de sucesso/erro PT-BR após mutação
- [ ] Soft-delete com modal de confirmação
- [ ] Página Criar Template: dropdown de trilhas do tenant → POST /api/v1/templates
- [ ] Histórico de versões: lista version, name, createdAt; para platform exibe "Templates de plataforma não possuem histórico de versões"
- [ ] Botão "Salvar como Template" na página de detalhe de trilha existente
- [ ] Reutiliza FormField do projeto
- [ ] Todos os textos PT-BR via pt-BR.json

**Referências**: spec US2, US3, plan §4.5

---

## FASE 5 — Qualidade e Gate CI

### 5.1 Gate CI: RLS roda 2x + build [crit]

**Descrição**: Garantir que a RLS spec roda 2x no CI e que o build TypeScript passa.

**Critérios de aceite**:
- [ ] content-templates.rls-spec.ts incluída no glob de RLS do CI
- [ ] CI executa suite RLS 2x consecutivos e ambas passam
- [ ] Nenhum console.error de constraint violation em execução limpa
- [ ] docker-compose.test.yml tem DATABASE_URL com role que permite SET LOCAL row_security = off para seed de testes
- [ ] `pnpm --filter @metanoia/types build` sem erro
- [ ] `pnpm lint` sem erro nos arquivos novos

**Referências**: security-rls.md §Notas, lição 13-3

---

### 5.2 Smoke test: endpoints principais [imp]

**Descrição**: Smoke test básico dos endpoints.

**Arquivos**:
- `apps/api/test/smoke/templates.smoke.spec.ts` (criar — opcional se coberto por service tests)

**Critérios de aceite**:
- [ ] GET /api/v1/templates sem auth → 401
- [ ] GET /api/v1/templates com role lider → 403
- [ ] POST /api/v1/templates com body inválido → 400 com details de validação
- [ ] PATCH /api/v1/templates/:id em template platform → 403
- [ ] DELETE /api/v1/templates/:id em template platform → 403
- [ ] POST /api/v1/trails { templateId: deletedId } → 404
- [ ] Envelope: { data, meta? } em sucesso; { statusCode, error, message } em erro

**Referências**: security-rls.md CHK028-CHK034, CLAUDE.md

---

### 5.3 Revisão final de segurança (CHK001-CHK042) [crit]

**Descrição**: Verificação final de todos os 42 items do checklist antes de abrir PR.

**Critérios de aceite**:
- [ ] Todos os CHKs [crit] do checklists/security-rls.md passando
- [ ] CHK001-CHK009: 4 políticas RLS corretas e separadas (finding HIGH resolvido)
- [ ] CHK010-CHK019: JSONB snapshot sem conteúdo
- [ ] CHK020-CHK027: versionamento e materialização
- [ ] CHK028-CHK034: contrato API (envelope, paginação, sort, roles)
- [ ] CHK035-CHK038: Zod schemas completos
- [ ] CHK039-CHK042: edge cases (soft-delete, templateId deletado, platform 403)
- [ ] FR-21 (seed privilegiado) e FR-22 (filtro deleted_at) implementados e testados
- [ ] Nenhum tenant_id passado como parâmetro de função
- [ ] Nenhum @default(uuid()) no schema Prisma
- [ ] Nenhum text-muted-foreground no frontend
- [ ] uuidv7() em todos os inserts de ID
- [ ] PR com description referenciando checklist e findings resolvidos

**Referências**: security-rls.md (CHK001-CHK042), plan §7 Riscos

---

## Resumo

| Fase | Tasks | Criticidade |
|------|-------|-------------|
| 1 — DB + Contratos | 1.1 migration, 1.2 prisma, 1.3 zod, 1.4 seed | 4x `[crit]` |
| 2 — Backend | 2.1 repository, 2.2 service, 2.3 controller, 2.4 trails | 4x `[crit]` |
| 3 — Testes | 3.1 RLS spec, 3.2 service tests, 3.3 snapshot, 3.4 materialização | 1x `[crit]`, 3x `[imp]` |
| 4 — Frontend | 4.1 lista, 4.2 preview, 4.3 CRUD | 2x `[imp]`, 1x `[opt]` |
| 5 — Gate CI | 5.1 CI gate, 5.2 smoke, 5.3 revisão | 2x `[crit]`, 1x `[imp]` |

**Bloqueadores de merge**: tasks `[crit]` das Fases 1, 2, 3.1, 5.1, 5.3

**Ordem de execução**: 1.1 → 1.2 → {1.3, 1.4} → 2.1 → 2.2 → {2.3, 2.4} → {3.1, 3.2, 3.3} → 3.4 → 4.1 → {4.2, 4.3} → {5.1, 5.2, 5.3}
