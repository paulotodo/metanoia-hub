# Story 4.2: Vincular Membros & Líderes a Grupo

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to add and remove participants and leaders from a group,
So that each group has the correct members with appropriate roles.

## Acceptance Criteria

**Given** I am Admin or Líder of a group
**When** I add a participant or leader to the group
**Then** a record is created in `group_members` with: `id` (UUID v7), `group_id`, `user_id`, `tenant_id`, `role` (enum: `participant`, `leader`), `status` (enum: `active`, `invited`, `inactive`), `joined_at`, `created_at`
**And** `UNIQUE(group_id, user_id)` constraint prevents duplicates — duplicate attempt returns 409 Conflict with descriptive message
**And** the Guard do Epic 3 bloqueia adição se o limite de membros/grupo do plano for atingido

**Given** I am viewing the group member list as Líder
**When** I access the members area
**Then** I see the list of members with name, role (participant/leader), status (active/invited/inactive) and join date (FR25)

**Given** I try to remove the last leader of a group
**When** I submit the removal request
**Then** the API returns 422 with message "Cannot remove the last leader of a group"
**And** the leader remains linked to the group

**Given** I remove a non-last-leader member
**When** I submit the removal request
**Then** the member is unlinked from the group
**And** RLS tests verify cross-group isolation (members of group A cannot see members of group B)

## Tasks / Subtasks

- [ ] Task 1: Criar migration para tabela group_members (AC: #1)
  - [ ] 1.1 Criar tabela `group_members`: id (UUID v7), group_id, user_id, tenant_id, role (enum: participant/leader), status (enum: active/invited/inactive), joined_at, created_at
  - [ ] 1.2 `UNIQUE(group_id, user_id)` constraint
  - [ ] 1.3 `@@map('group_members')` e `@map` para snake_case
  - [ ] 1.4 Criar RLS policies
  - [ ] 1.5 RLS tests com cross-group isolation

- [ ] Task 2: API — adicionar membro ao grupo (AC: #1, #2, #3)
  - [ ] 2.1 Criar `POST /api/v1/groups/:groupId/members`
  - [ ] 2.2 Proteger com @Roles('admin_tenant', 'lider')
  - [ ] 2.3 Validar com ZodValidationPipe
  - [ ] 2.4 Retornar 409 para duplicatas com mensagem descritiva
  - [ ] 2.5 Integrar PlanLimitGuard para limite de membros/grupo

- [ ] Task 3: API — listar membros do grupo (AC: #4, #5)
  - [ ] 3.1 Criar `GET /api/v1/groups/:groupId/members`
  - [ ] 3.2 Retornar: name, role, status, join date
  - [ ] 3.3 Paginação padrão

- [ ] Task 4: API — remover membro (AC: #6, #7, #8, #9)
  - [ ] 4.1 Criar `DELETE /api/v1/groups/:groupId/members/:userId`
  - [ ] 4.2 Verificar se é último leader: retornar 422 "Cannot remove the last leader of a group"
  - [ ] 4.3 Remover membro (unlink)
  - [ ] 4.4 Retornar 204

- [ ] Task 5: RLS tests (AC: #10)
  - [ ] 5.1 Teste: membros de grupo A não visíveis para grupo B
  - [ ] 5.2 Teste: cross-tenant isolation para group_members

- [ ] Task 6: Zod schemas e snapshot tests
  - [ ] 6.1 Criar `AddGroupMemberSchema` em `packages/types`
  - [ ] 6.2 Criar `GroupMemberResponseSchema`
  - [ ] 6.3 Snapshot tests

- [ ] Task 7: Frontend — Gestão de membros
  - [ ] 7.1 Criar `apps/web/app/(authenticated)/groups/[id]/members/page.tsx`
  - [ ] 7.2 Lista de membros com role e status
  - [ ] 7.3 Modal para adicionar membro
  - [ ] 7.4 Confirmação para remover membro
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
- Story 4.1 (CRUD Grupos) — tabela groups existe
- Story 3.3 (Guard de Limites) — PlanLimitGuard para membros/grupo
- Story 2.1 (Cadastro) — tabela users existe
- Story 2.4 (Guards) — RolesGuard

### Project Structure Notes
```
apps/api/src/groups/
├── members/
│   ├── group-members.controller.ts  # POST, GET, DELETE /groups/:id/members
│   ├── group-members.service.ts
│   └── dto/
│       ├── add-member.dto.ts
│       └── member-response.dto.ts

apps/api/prisma/migrations/
└── YYYYMMDD_create_group_members/

packages/types/src/groups/
├── add-member.ts
├── member-response.ts
└── __tests__/
    └── member.spec.ts

apps/api/test/rls/
└── group-members.rls.spec.ts

apps/web/app/(authenticated)/groups/[id]/members/
├── page.tsx
└── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-04.md — Story 4.2]
- [Source: docs/project-context.md — FR25, groups bounded context]
- [Source: _bmad-output/planning-artifacts/architecture.md — Group members, constraints]
