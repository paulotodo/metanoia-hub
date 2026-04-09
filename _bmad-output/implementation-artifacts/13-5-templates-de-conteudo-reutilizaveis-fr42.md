# Story 13.5: Templates de Conteúdo Reutilizáveis (FR42)

Status: ready-for-dev

## Story

As an Admin Tenant,
I want to create and use reusable content templates,
So that I can quickly set up new trails based on proven structures without starting from scratch.

## Acceptance Criteria

**Given** the platform provides pre-built templates
**When** the system is seeded
**Then** a set of platform-scoped templates is available (read-only for tenants):
  - "Discipulado Básico" (4 módulos, 12 lições — estrutura apenas, sem conteúdo)
  - "Estudo Bíblico Temático" (3 módulos, 9 lições)
  - "Acolhimento de Novos Membros" (2 módulos, 6 lições)
**And** templates are stored in `ContentTemplate` table with `scope: 'platform' | 'tenant'` and `tenant_id: null` for platform-scoped

**Given** an admin wants to create a template from an existing trail
**When** they click "Salvar como Template" on a trail detail page
**Then** a `POST /api/v1/templates` is called with `{ sourceTrailId, name, description }`
**And** the system creates an immutable snapshot: copies module/lesson structure (titles, order, type) WITHOUT content (text, files, videos — fields `fileUrl`, `videoUrl`, `content` are set to `null` in the template)
**And** each version is a separate record in `ContentTemplate` with `sourceTrailId + version` as logical key
**And** version 1 is created on first save; subsequent "Salvar como Template" from the same trail creates version 2, 3, etc.
**And** the template is `scope: 'tenant'` and visible only within the tenant

**Given** an admin wants to create a new trail from a template
**When** they access the template library at `/app/admin/templates` and select a template
**Then** a preview shows: template name, description, structure tree (modules → lessons), source trail (if any), version, created date
**And** clicking "Usar Template" calls `POST /api/v1/trails` with `{ templateId, name, groupId }`
**And** a new trail is created with the template's structure, all content fields empty (ready to fill)
**And** the new trail has no link back to the template (independent copy — edits don't propagate)

**Given** an admin manages tenant templates
**When** they access `GET /api/v1/templates?scope=all`
**Then** the list shows both platform and tenant templates, clearly labeled
**And** the library supports: search by name, filter by scope (plataforma/tenant), sort by created date/name
**And** tenant templates support CRUD: edit name/description (`PATCH`), delete (`DELETE` — soft delete, no cascade to trails created from it)
**And** platform templates are read-only (no edit/delete for tenant admins)

**Given** the template versioning scenario
**When** an admin updates a template's source trail and wants to refresh the template
**Then** they must explicitly "Salvar como Template" again, creating a new version record
**And** the template list shows the latest version by default, with "Histórico de versões" link to see all versions
**And** existing trails created from older versions are NOT affected

## Tasks / Subtasks

- [ ] Task 1: Create `ContentTemplate` table via Prisma migration (AC: #1, #2)
  - [ ] Define schema: `id` (UUID v7), `tenant_id` (nullable for platform), `scope` (enum: platform/tenant), `source_trail_id`, `name`, `description`, `version`, `structure` (JSONB — modules/lessons), `created_by`, `created_at`, `deleted_at` (soft delete)
  - [ ] Add RLS policy (platform templates readable by all, tenant templates isolated)
  - [ ] Add unique index on `(source_trail_id, version)` for logical key
  - [ ] Map with `@@map("content_templates")`
- [ ] Task 2: Create seed data for platform templates (AC: #1)
  - [ ] "Discipulado Básico" — 4 modules, 12 lessons (structure only)
  - [ ] "Estudo Bíblico Temático" — 3 modules, 9 lessons
  - [ ] "Acolhimento de Novos Membros" — 2 modules, 6 lessons
- [ ] Task 3: Create Zod schemas in `packages/types` (AC: all)
  - [ ] Define `ContentTemplateSchema`, `CreateTemplateRequestSchema`, `UseTemplateRequestSchema`
  - [ ] Define `TemplateListQuerySchema` (scope filter, search, sort)
  - [ ] Add snapshot tests
- [ ] Task 4: Implement template CRUD endpoints (AC: #2, #4)
  - [ ] `POST /api/v1/templates` — create template from trail (snapshot structure, null content fields)
  - [ ] `GET /api/v1/templates` — list with scope filter, search by name, sort
  - [ ] `GET /api/v1/templates/:id` — detail with structure tree preview
  - [ ] `PATCH /api/v1/templates/:id` — edit name/description (tenant templates only)
  - [ ] `DELETE /api/v1/templates/:id` — soft delete (tenant templates only)
  - [ ] Apply `@Roles('admin_tenant')` guard
- [ ] Task 5: Implement "use template" flow (AC: #3)
  - [ ] `POST /api/v1/trails` with `{ templateId, name, groupId }` — create trail from template
  - [ ] Copy structure, set all content fields to empty
  - [ ] No back-link to template (independent copy)
- [ ] Task 6: Implement versioning logic (AC: #5)
  - [ ] Auto-increment version per `sourceTrailId`
  - [ ] Default list shows latest version
  - [ ] Provide version history endpoint `GET /api/v1/templates/:id/versions`
- [ ] Task 7: Build template library UI (AC: #3, #4)
  - [ ] Template library page at `/app/admin/templates`
  - [ ] Search by name, filter by scope, sort by date/name
  - [ ] Template preview: name, description, structure tree, source trail, version, date
  - [ ] "Usar Template" action → create trail flow
  - [ ] "Salvar como Template" button on trail detail page
  - [ ] Version history link
  - [ ] Platform templates marked as read-only
- [ ] Task 8: Write tests (AC: all)
  - [ ] Integration: create template from trail with fileUrl/videoUrl → verify template has those fields `null`
  - [ ] Use template → verify structure copied
  - [ ] Versioning: save 2x → verify 2 records with version 1 and 2
  - [ ] RLS isolation: admin tenant A cannot see tenant B templates
  - [ ] E2E: complete flow library (search, filter) → preview → create trail
  - [ ] Edge cases: template from empty trail (0 modules), template with 20+ lessons

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Milestone Note
- This is a separate milestone from stories 13.1–13.4 — can be implemented independently
- Feature is trail management, grouped in this epic by Release 2 affinity

### Dependencies
- Epic 8 (trails — trail data structure for template snapshot)

### Project Structure Notes
- Backend: `apps/api/src/modules/content/templates/` (content bounded context)
- Migration: `apps/api/prisma/migrations/YYYYMMDD_add_content_templates/`
- Frontend: `apps/web/app/(authenticated)/admin/templates/page.tsx`
- Shared types: `packages/types/src/content/template.ts`
- Seed: `apps/api/prisma/seed/platform-templates.ts`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-13.md` (Story 13.5)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
