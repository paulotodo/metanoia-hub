# Story 8.6: Publicação, Versionamento & Catálogo Tenant

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to manage trail content through a draft-to-published workflow and make trails available as a tenant-wide catalog,
so that content quality is controlled before participant access and trails can be shared across multiple groups.

## Acceptance Criteria

**Given** I create a trail (Story 8.1)
**When** the trail is created
**Then** it starts with `status: draft` — invisible to participants
**And** only users with role Admin or Líder (or future Editor de Conteúdo) can view draft trails

**Given** a trail is in `draft` status
**When** I publish it via `POST /api/v1/trails/:trailId/publish`
**Then** the `status` changes to `published` and a `version` number is set (starts at 1)
**And** `publishedAt` and `publishedBy` fields are recorded
**And** the trail becomes visible and accessible to participants in associated groups
**And** a domain event `content.trail.published` is emitted with: `{ eventId, eventType, version: 1, tenantId, timestamp, data: { trailId, trailVersion, publishedBy } }`

**Given** a published trail needs updates
**When** I edit the trail content (add/modify modules, lessons)
**Then** edits are made on a new draft version (participants continue seeing the current published version)
**And** when I re-publish, the `version` is incremented and the new content becomes live
**And** previous versions are retained in a `TrailVersion` table for audit/rollback
**And** publishing a new version does NOT invalidate existing participant progress — `LessonProgress` records reference `lessonId` (stable UUID v7), not the trail version number. If lessons are removed in a new version, orphaned progress records are soft-archived (not deleted)
**And** a regression test validates: publish v2 with modified lesson structure → participant progress from v1 is NOT lost, NOT corrupted, and correctly displayed

**Given** I want to make a trail available across my tenant
**When** I add the trail to the tenant catalog via `POST /api/v1/trails/:trailId/catalog`
**Then** the trail is flagged as `catalogVisible: true`
**And** it appears in the tenant-wide trail catalog endpoint: `GET /api/v1/trails/catalog`
**And** any Admin/Líder in the tenant can associate it with their groups (N:N relationship via `GroupTrail` join table)

**Given** a trail is associated with multiple groups (Epic 4, Story 4.4 integration)
**When** I query trail associations
**Then** the `GroupTrail` table stores: `groupId`, `trailId`, `assignedAt`, `assignedBy`
**And** participants see the trail in each group context they belong to
**And** progress is tracked per-participant (not per-group) — a participant in multiple groups sees the same progress

**Given** trail catalog operations
**When** any query is executed
**Then** all operations are scoped by tenant via RLS — no cross-tenant catalog leakage

## Tasks / Subtasks

- [ ] Task 1: Adicionar campos de publicação ao Trail schema (AC: #1, #2)
  - [ ] Campos: version (Int, nullable), publishedAt (nullable), publishedBy (nullable), catalogVisible (Boolean, default false)
  - [ ] Prisma migration
- [ ] Task 2: Criar tabela TrailVersion (AC: #3)
  - [ ] Model TrailVersion: id, trailId, version (Int), snapshotData (Json), publishedAt, publishedBy, createdAt
  - [ ] @@map("trail_versions")
  - [ ] Migration com RLS policy
- [ ] Task 3: Criar tabela GroupTrail (AC: #4, #5)
  - [ ] Model GroupTrail: groupId, trailId, assignedAt, assignedBy
  - [ ] Composite unique: (groupId, trailId)
  - [ ] @@map("group_trails")
  - [ ] Migration com RLS policy
- [ ] Task 4: Implementar publish endpoint (AC: #2)
  - [ ] `POST /api/v1/trails/:trailId/publish`
  - [ ] Set status → published, version = 1 (ou increment)
  - [ ] Set publishedAt, publishedBy
  - [ ] Salvar snapshot em TrailVersion
  - [ ] Emitir domain event `content.trail.published`
  - [ ] Zod schema + snapshot test para domain event
- [ ] Task 5: Implementar draft versioning (AC: #3)
  - [ ] Edits em published trail criam draft version
  - [ ] Participants continuam vendo versão publicada atual
  - [ ] Re-publish incrementa version number
  - [ ] TrailVersion retém versões anteriores para audit/rollback
- [ ] Task 6: Garantir preservação de progresso (AC: #3)
  - [ ] LessonProgress referencia lessonId (UUID v7 estável), não trail version
  - [ ] Lessons removidas em nova versão: progress records soft-archived
  - [ ] Regression test: publish v2 → progress v1 preservado
- [ ] Task 7: Implementar catalog endpoints (AC: #4)
  - [ ] `POST /api/v1/trails/:trailId/catalog` — adicionar ao catálogo
  - [ ] `DELETE /api/v1/trails/:trailId/catalog` — remover do catálogo
  - [ ] `GET /api/v1/trails/catalog` — listar catálogo do tenant
- [ ] Task 8: Implementar associação trail↔group (AC: #5)
  - [ ] `POST /api/v1/groups/:groupId/trails/:trailId` — associar
  - [ ] `DELETE /api/v1/groups/:groupId/trails/:trailId` — desassociar
  - [ ] `GET /api/v1/groups/:groupId/trails` — listar trails do grupo
  - [ ] Progress é per-participant, não per-group
- [ ] Task 9: Testes (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Teste: trail criada como draft → invisible para participantes
  - [ ] Teste: publish → status published, version set
  - [ ] Teste: domain event emitido com payload correto
  - [ ] Regression test: publish v2 → progress v1 NOT lost/corrupted
  - [ ] Teste: catalog visible → aparece no GET /trails/catalog
  - [ ] Teste: progress per-participant (não per-group)
  - [ ] RLS isolation tests: no cross-tenant catalog leakage
  - [ ] Snapshot test do domain event schema

## Dev Notes

- Draft→Published workflow: participants NUNCA veem conteúdo draft
- Version history via TrailVersion table (JSONB snapshot)
- Progress preservação é CRÍTICO: lessonId é estável (UUID v7), independente de trail version
- Orphaned progress (lesson removida): soft-archive, não delete
- Catalog é tenant-wide — qualquer Admin/Líder pode associar a seus grupos
- GroupTrail é N:N — uma trail pode estar em múltiplos grupos

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
- Story 8.1: CRUD Trilhas (Trail schema, content module)
- Story 8.3: Progresso Individual (LessonProgress)
- Epic 4, Story 4.4: Associar Trilhas a Grupo (GroupTrail)

### Project Structure Notes
```
apps/api/src/modules/content/
  ├── publishing/
  │   ├── publishing.service.ts
  │   └── publishing.controller.ts
  ├── catalog/
  │   ├── catalog.service.ts
  │   └── catalog.controller.ts
  └── versioning/
      └── version.service.ts
packages/types/src/content/
  ├── trail-version.schema.ts
  ├── group-trail.schema.ts
  └── content-events.schema.ts  (adicionar trail.published)
apps/api/test/rls/
  ├── trail-versions.rls.spec.ts
  └── group-trails.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.6
- `docs/project-context.md` — Domain events format, soft-delete pattern
- `docs/architecture.md` — Content bounded context, versioning strategy
