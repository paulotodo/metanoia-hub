# Story 4.4: Associar Trilhas a Grupo

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to associate content trails to a group,
So that the group's participants have access to the assigned learning content.

## Acceptance Criteria

**Given** I am Admin or Líder of a group
**When** I associate one or more trails to the group
**Then** records are created in `group_trails` with: `group_id`, `trail_id`, `tenant_id`, `assigned_by` (UUID), `assigned_at` (timestamp)
**And** the endpoint accepts an array of `trail_ids` for bulk association
**And** if any `trail_id` does not exist, the API returns 422 with the list of invalid IDs (not 404)
**And** RLS ensures associations are isolated per tenant

**Given** I want to remove a trail association
**When** I unlink a trail from the group
**Then** the `group_trails` record is deleted and the API returns 204

**Given** trails do not exist yet (Epic 8)
**When** integration tests run for this story
**Then** tests use seed data with fictional trail records to validate the association flow end-to-end

## Tasks / Subtasks

- [ ] Task 1: Criar migration para tabela group_trails (AC: #1)
  - [ ] 1.1 Criar tabela `group_trails`: group_id, trail_id, tenant_id, assigned_by (UUID), assigned_at
  - [ ] 1.2 `UNIQUE(group_id, trail_id)` constraint
  - [ ] 1.3 `@@map('group_trails')` e `@map` para snake_case
  - [ ] 1.4 Criar RLS policies
  - [ ] 1.5 RLS tests

- [ ] Task 2: Criar tabela/seed de trails stub (AC: #7, #8)
  - [ ] 2.1 Criar tabela stub `trails` mínima: id (UUID v7), tenant_id, name, created_at
  - [ ] 2.2 Criar seed data com trail records ficcionais para testes
  - [ ] 2.3 Marcar como stub (será substituída no Epic 8)

- [ ] Task 3: API — associar trilhas ao grupo (AC: #1, #2, #3, #4)
  - [ ] 3.1 Criar `POST /api/v1/groups/:groupId/trails`
  - [ ] 3.2 Aceitar array de `trail_ids` no body
  - [ ] 3.3 Validar existência de cada trail_id
  - [ ] 3.4 Retornar 422 com lista de IDs inválidos se algum não existir
  - [ ] 3.5 Retornar 201 com associações criadas

- [ ] Task 4: API — remover associação (AC: #5, #6)
  - [ ] 4.1 Criar `DELETE /api/v1/groups/:groupId/trails/:trailId`
  - [ ] 4.2 Deletar registro em group_trails
  - [ ] 4.3 Retornar 204

- [ ] Task 5: Zod schemas e snapshot tests
  - [ ] 5.1 Criar `AssociateTrailsSchema` em `packages/types`
  - [ ] 5.2 Criar `GroupTrailResponseSchema`
  - [ ] 5.3 Snapshot tests

- [ ] Task 6: Frontend — Associação de trilhas
  - [ ] 6.1 Criar UI em `apps/web/app/(authenticated)/groups/[id]/trails/`
  - [ ] 6.2 Seleção de trilhas (multi-select)
  - [ ] 6.3 Lista de trilhas associadas com opção de remover
  - [ ] 6.4 Testes jest-axe

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Prisma v7 + RLS
- Zod 4.3.6
- Next.js 16.2 (App Router)

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 4.1 (CRUD Grupos) — tabela groups existe
- Story 2.4 (Guards) — RolesGuard
- Story 2.6 (RLS) — RLS framework

### Project Structure Notes
```
apps/api/src/groups/
├── trails/
│   ├── group-trails.controller.ts   # POST, DELETE /groups/:id/trails
│   ├── group-trails.service.ts
│   └── dto/
│       ├── associate-trails.dto.ts
│       └── group-trail-response.dto.ts

apps/api/prisma/migrations/
├── YYYYMMDD_create_trails_stub/     # Stub table for trails
└── YYYYMMDD_create_group_trails/

apps/api/prisma/seed/
└── trails.seed.ts                   # Fictional trail seed data

packages/types/src/groups/
├── associate-trails.ts
└── group-trail-response.ts

apps/web/app/(authenticated)/groups/[id]/trails/
├── page.tsx
└── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-04.md — Story 4.4]
- [Source: docs/project-context.md — Groups bounded context, bulk operations]
- [Source: _bmad-output/planning-artifacts/architecture.md — Trail associations, Epic 8 dependency]
