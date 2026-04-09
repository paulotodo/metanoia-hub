# Story 8.1: CRUD de Trilhas, Módulos & Aulas com Repository Pattern

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to create, edit, delete and reorder trails, modules within trails, and lessons within modules,
so that I can structure discipleship content in a clear hierarchy that participants can follow.

## Acceptance Criteria

**Given** the content module is set up at `apps/api/src/modules/content/`
**When** the module is initialized
**Then** it follows the Core Domain repository pattern with: `content.module.ts`, `content.controller.ts`, `content.service.ts`, `content.repository.ts`
**And** DTOs are created: `CreateTrailDto`, `UpdateTrailDto`, `CreateModuleDto`, `UpdateModuleDto`, `CreateLessonDto`, `UpdateLessonDto` in `dto/` folder, validated with Zod schemas from `packages/types`
**And** Zod schemas have snapshot tests in `packages/types/__tests__/schemas.snapshot.test.ts` — minimum 6 snapshots: CreateTrailDto, UpdateTrailDto, CreateModuleDto, UpdateModuleDto, CreateLessonDto, UpdateLessonDto

**Given** I am authenticated as Admin or Líder within my tenant
**When** I create a trail via `POST /api/v1/trails`
**Then** a new `Trail` record is created with: `id` (UUID v7), `tenantId` (auto-injected via Prisma extension), `name`, `description`, `status` (default: `draft`), `createdBy`, `createdAt`, `updatedAt`
**And** the Prisma model uses `@@map("trails")` with fields using `@map("snake_case")`
**And** RLS policy `rls_trails_tenant_isolation` ensures queries are scoped to my tenant_id
**And** the response follows the API contract: `{ "data": { ...trail }, "meta": null }` with status 201

**Given** a trail exists in my tenant
**When** I create a module via `POST /api/v1/trails/:trailId/modules`
**Then** a new `Module` record is created with: `id` (UUID v7), `trailId`, `tenantId`, `name`, `order` (auto-increment within trail), `createdAt`, `updatedAt`
**And** the `order` field supports reordering via `PATCH /api/v1/trails/:trailId/modules/reorder` accepting an array of module IDs
**And** the reorder endpoint returns 422 if the array contains duplicate IDs, IDs not belonging to this trail, or a count mismatch with existing modules

**Given** a module exists in my tenant
**When** I create a lesson via `POST /api/v1/trails/:trailId/modules/:moduleId/lessons`
**Then** a new `Lesson` record is created with: `id` (UUID v7), `moduleId`, `tenantId`, `name`, `contentType` (enum: `video`, `rich_text`, `pdf_doc`, `external_link`), `contentUrl` (nullable — set in Story 8.2), `order`, `estimatedDurationMinutes`, `createdAt`, `updatedAt`
**And** the `order` field supports reordering via `PATCH /api/v1/trails/:trailId/modules/:moduleId/lessons/reorder`
**And** the same 422 validation rules from module reorder apply to lesson reorder (duplicate IDs, wrong parent, count mismatch)

**Given** I try to access a trail from another tenant
**When** the query executes
**Then** RLS blocks the access and returns 404 (not 403, to prevent tenant enumeration)
**And** RLS isolation tests in `apps/api/test/rls/` validate cross-tenant isolation for trails, modules, and lessons

**Given** I delete a trail via `DELETE /api/v1/trails/:trailId`
**When** the trail has modules and lessons
**Then** soft-delete is applied (field `deletedAt`) — cascade soft-deletes modules and lessons
**And** the response is 204 (no body)

## Tasks / Subtasks

- [ ] Task 1: Criar Prisma schemas para Trail, Module, Lesson (AC: #2, #3, #4)
  - [ ] Model Trail: id (UUID v7), tenantId, name, description, status (enum: draft, published, archived), createdBy, createdAt, updatedAt, deletedAt (nullable)
  - [ ] Model Module: id, trailId, tenantId, name, order (Int), createdAt, updatedAt, deletedAt
  - [ ] Model Lesson: id, moduleId, tenantId, name, contentType (enum: video, rich_text, pdf_doc, external_link), contentUrl (nullable), order, estimatedDurationMinutes, createdAt, updatedAt, deletedAt
  - [ ] @@map("trails"), @@map("modules"), @@map("lessons") com @map snake_case
  - [ ] Migration com RLS policies para as 3 tabelas
- [ ] Task 2: Criar módulo Content no NestJS (AC: #1)
  - [ ] `apps/api/src/modules/content/content.module.ts`
  - [ ] `content.controller.ts` — trails endpoints
  - [ ] `content.service.ts` — business logic
  - [ ] `content.repository.ts` — Core Domain Repository Pattern
  - [ ] Subcontrollers para modules e lessons
- [ ] Task 3: Criar Zod schemas e DTOs (AC: #1)
  - [ ] `packages/types/src/content/trail.schema.ts` — CreateTrailDto, UpdateTrailDto
  - [ ] `packages/types/src/content/module.schema.ts` — CreateModuleDto, UpdateModuleDto
  - [ ] `packages/types/src/content/lesson.schema.ts` — CreateLessonDto, UpdateLessonDto
  - [ ] Snapshot tests: mínimo 6 snapshots em `packages/types/__tests__/schemas.snapshot.test.ts`
- [ ] Task 4: Implementar endpoints de Trail (AC: #2)
  - [ ] `POST /api/v1/trails` — criar (201)
  - [ ] `GET /api/v1/trails` — listar com paginação
  - [ ] `GET /api/v1/trails/:trailId` — detalhe
  - [ ] `PATCH /api/v1/trails/:trailId` — editar
  - [ ] `DELETE /api/v1/trails/:trailId` — soft-delete (204)
- [ ] Task 5: Implementar endpoints de Module (AC: #3)
  - [ ] `POST /api/v1/trails/:trailId/modules` — criar
  - [ ] `PATCH /api/v1/trails/:trailId/modules/:moduleId` — editar
  - [ ] `DELETE /api/v1/trails/:trailId/modules/:moduleId` — soft-delete
  - [ ] `PATCH /api/v1/trails/:trailId/modules/reorder` — reordenar
  - [ ] Validação 422: duplicate IDs, wrong trail, count mismatch
- [ ] Task 6: Implementar endpoints de Lesson (AC: #4)
  - [ ] `POST /api/v1/trails/:trailId/modules/:moduleId/lessons` — criar
  - [ ] `PATCH /api/v1/trails/:trailId/modules/:moduleId/lessons/:lessonId` — editar
  - [ ] `DELETE /api/v1/trails/:trailId/modules/:moduleId/lessons/:lessonId` — soft-delete
  - [ ] `PATCH /api/v1/trails/:trailId/modules/:moduleId/lessons/reorder` — reordenar
  - [ ] Mesmas validações 422 do module reorder
- [ ] Task 7: Implementar soft-delete cascade (AC: #6)
  - [ ] Trail delete → cascade soft-delete modules → cascade soft-delete lessons
  - [ ] deletedAt timestamp em cada nível
  - [ ] Queries filtram deletedAt IS NULL por default
- [ ] Task 8: RLS e segurança (AC: #5)
  - [ ] RLS policy rls_trails_tenant_isolation
  - [ ] Cross-tenant access retorna 404 (não 403)
  - [ ] RLS isolation tests para trails, modules, lessons
- [ ] Task 9: Testes (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Snapshot tests: 6 Zod schemas
  - [ ] Testes unitários: CRUD operations, reorder validation
  - [ ] Teste: reorder com duplicate IDs → 422
  - [ ] Teste: reorder com wrong parent → 422
  - [ ] Teste: soft-delete cascade
  - [ ] RLS isolation tests em `apps/api/test/rls/`
  - [ ] Test factories com tenantId

## Dev Notes

- **Content é Core Domain** — Repository Pattern obrigatório
- Hierarquia: Trail → Module → Lesson (3 níveis)
- Soft-delete em todos os níveis (deletedAt) — cascade programático
- Reorder endpoints aceitam array de IDs e validam integridade
- Cross-tenant access retorna 404 (não 403) para prevenir tenant enumeration
- contentUrl nullable na criação — preenchido na Story 8.2 (upload)

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
- Epic 1: Monorepo, Docker, Prisma setup
- Epic 2: Auth e Guards (roles Admin/Líder)
- Epic 3: Tenant provisioning (tenant_id)

### Project Structure Notes
```
apps/api/src/modules/content/
  ├── content.module.ts
  ├── content.controller.ts
  ├── content.service.ts
  ├── content.repository.ts
  ├── modules/
  │   └── module.controller.ts
  ├── lessons/
  │   └── lesson.controller.ts
  └── dto/
      ├── create-trail.dto.ts
      ├── update-trail.dto.ts
      ├── create-module.dto.ts
      ├── update-module.dto.ts
      ├── create-lesson.dto.ts
      └── update-lesson.dto.ts
packages/types/src/content/
  ├── trail.schema.ts
  ├── module.schema.ts
  ├── lesson.schema.ts
  └── content-type.enum.ts
packages/types/__tests__/
  └── schemas.snapshot.test.ts  (adicionar 6 snapshots)
apps/api/test/rls/
  ├── trails.rls.spec.ts
  ├── modules.rls.spec.ts
  └── lessons.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.1
- `docs/project-context.md` — Repository pattern, RLS, naming conventions
- `docs/architecture.md` — Content bounded context
