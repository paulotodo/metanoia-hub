# Story 4.1: CRUD de Grupos

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to create, edit and delete groups within my tenant,
So that I can organize participants into discipleship groups.

## Acceptance Criteria

**Given** I am authenticated as Admin or Líder
**When** I create a new group with name and description
**Then** the group is created with the schema: `id` (UUID v7), `tenant_id`, `name` (required), `description` (optional), `status` (enum: `active`, `archived`; default `active`), `created_by` (UUID), `created_at`, `updated_at`
**And** RLS policies ensure the group is only visible within the tenant
**And** the Guard do Epic 3 bloqueia criação se o limite de grupos do plano for atingido (grupos com status `archived` não contam no limite)
**And** the API returns 201 with the created group data

**Given** I am viewing a group I have access to
**When** I edit the group name or description
**Then** the changes are persisted and `updated_at` is refreshed
**And** the API returns 200 with the updated group data

**Given** I want to remove a group
**When** I delete the group
**Then** the group is soft-deleted (status changed to `archived`), not physically removed
**And** archived groups retain their members for historical/pastoral reference
**And** the API returns 200 with confirmation

**Given** groups exist in my tenant
**When** I list groups
**Then** I see a paginated list of active groups (archived excluded by default, filterable)
**And** RLS tests include JOINs and subqueries cross-tenant to verify isolation

## Tasks / Subtasks

- [ ] Task 1: Criar migration para tabela groups (AC: #1)
  - [ ] 1.1 Criar tabela `groups`: id (UUID v7), tenant_id, name, description, status (enum: active/archived), created_by, created_at, updated_at
  - [ ] 1.2 Usar `@@map('groups')` e `@map` para snake_case
  - [ ] 1.3 Criar RLS policies para groups
  - [ ] 1.4 Adicionar RLS tests com JOINs e subqueries cross-tenant

- [ ] Task 2: API — criar grupo (AC: #1, #2, #3, #4)
  - [ ] 2.1 Criar `POST /api/v1/groups` protegido por @Roles('admin_tenant', 'lider')
  - [ ] 2.2 Validar com ZodValidationPipe (CreateGroupSchema)
  - [ ] 2.3 Integrar com PlanLimitGuard (grupos archived não contam)
  - [ ] 2.4 Retornar 201 com grupo criado

- [ ] Task 3: API — editar grupo (AC: #5, #6)
  - [ ] 3.1 Criar `PATCH /api/v1/groups/:id`
  - [ ] 3.2 Permitir edição de name e description
  - [ ] 3.3 Atualizar updated_at
  - [ ] 3.4 Retornar 200

- [ ] Task 4: API — soft delete (arquivar) grupo (AC: #7, #8, #9)
  - [ ] 4.1 Criar `DELETE /api/v1/groups/:id`
  - [ ] 4.2 Mudar status para `archived` (não deletar fisicamente)
  - [ ] 4.3 Manter membros para referência histórica/pastoral
  - [ ] 4.4 Retornar 200 com confirmação

- [ ] Task 5: API — listar grupos (AC: #10, #11)
  - [ ] 5.1 Criar `GET /api/v1/groups` com paginação
  - [ ] 5.2 Excluir archived por padrão, com filtro opcional
  - [ ] 5.3 RLS garante isolamento por tenant

- [ ] Task 6: Zod schemas e snapshot tests
  - [ ] 6.1 Criar `CreateGroupSchema` em `packages/types`
  - [ ] 6.2 Criar `UpdateGroupSchema`
  - [ ] 6.3 Criar `GroupResponseSchema`
  - [ ] 6.4 Snapshot tests

- [ ] Task 7: Frontend — CRUD de grupos
  - [ ] 7.1 Criar `apps/web/app/(authenticated)/groups/page.tsx` (lista)
  - [ ] 7.2 Criar `apps/web/app/(authenticated)/groups/new/page.tsx` (criar)
  - [ ] 7.3 Criar `apps/web/app/(authenticated)/groups/[id]/edit/page.tsx` (editar)
  - [ ] 7.4 Modal de confirmação para arquivar
  - [ ] 7.5 Testes jest-axe

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Prisma v7 + RLS
- Zod 4.3.6
- Next.js 16.2 (App Router)
- TanStack Query 5.96.2

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 3.3 (Guard de Limites) — PlanLimitGuard para bloqueio de criação
- Story 2.4 (Guards) — RolesGuard, TenantGuard
- Story 2.6 (RLS) — RLS framework

### Project Structure Notes
```
apps/api/src/groups/
├── groups.module.ts
├── groups.controller.ts        # POST, GET, PATCH, DELETE /groups
├── groups.service.ts
├── groups.repository.ts        # Core domain — repository pattern
└── dto/
    ├── create-group.dto.ts
    ├── update-group.dto.ts
    └── group-response.dto.ts

packages/types/src/groups/
├── create-group.ts
├── update-group.ts
├── group-response.ts
└── __tests__/
    └── group.spec.ts           # Snapshot tests

apps/api/test/rls/
└── groups.rls.spec.ts          # RLS tests with JOINs/subqueries

apps/web/app/(authenticated)/groups/
├── page.tsx                    # List
├── new/page.tsx                # Create
└── [id]/edit/page.tsx          # Edit
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-04.md — Story 4.1]
- [Source: docs/project-context.md — Groups bounded context, soft delete]
- [Source: _bmad-output/planning-artifacts/architecture.md — Groups module, repository pattern]
