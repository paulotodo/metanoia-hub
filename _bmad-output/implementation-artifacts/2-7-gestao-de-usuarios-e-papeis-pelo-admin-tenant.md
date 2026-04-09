# Story 2.7: Gestão de Usuários e Papéis pelo Admin Tenant

Status: ready-for-dev

## Story

As an Admin Tenant,
I want to manage users and their roles within my tenant,
So that I can control who has access and what they can do (FR08).

## Acceptance Criteria

**Given** I am logged in as Admin Tenant
**When** I access the user management page
**Then** I see a list of all users in my tenant with their name, email, role, and status
**And** the list is scoped to my tenant only (RLS enforced)

**Given** I want to change a user's role
**When** I select a user and assign a new role (e.g., `participante` → `lider`)
**Then** the role is updated in both Keycloak and PostgreSQL
**And** the change is logged in the audit trail (Pino: `action: "auth.role.changed"`, `target_user_id`, `old_role`, `new_role`)
**And** the user's JWT is invalidated and they must re-authenticate to get updated claims

**Given** I want to remove a user from my tenant
**When** I remove the user
**Then** the user's association with this tenant is removed
**And** all active sessions and tokens for this user in this tenant are revoked (FR11)
**And** the removal is logged in the audit trail
**And** the user can still access other tenants they belong to (FR03)

**Given** I remove a user and the user attempts to use their old token
**When** the old token is sent in an API request
**Then** the request is rejected with HTTP 401 Unauthorized
**And** the rejection is logged (Pino: `action: "auth.token.revoked"`, `user_id`, `tenant_id`)

**Given** I attempt to manage users from another tenant
**When** the request reaches the API
**Then** it is rejected by RLS — no data from other tenants is visible

## Tasks / Subtasks

- [ ] Task 1: API — listar usuários do tenant (AC: #1, #2)
  - [ ] 1.1 Criar `GET /api/v1/users` com paginação
  - [ ] 1.2 Retornar nome, email, role, status
  - [ ] 1.3 Garantir scope por RLS (tenant_id automático)

- [ ] Task 2: API — alterar role do usuário (AC: #3, #4, #5)
  - [ ] 2.1 Criar `PATCH /api/v1/users/:id/role`
  - [ ] 2.2 Atualizar role no Keycloak via Admin API
  - [ ] 2.3 Atualizar role no PostgreSQL (user_tenants)
  - [ ] 2.4 Invalidar JWT do usuário no Keycloak
  - [ ] 2.5 Logar mudança com Pino: `action: "auth.role.changed"`

- [ ] Task 3: API — remover usuário do tenant (AC: #6, #7, #8, #9)
  - [ ] 3.1 Criar `DELETE /api/v1/users/:id`
  - [ ] 3.2 Remover associação user_tenants (não deletar user)
  - [ ] 3.3 Revogar sessões e tokens no Keycloak para este tenant
  - [ ] 3.4 Logar remoção no audit trail

- [ ] Task 4: Validar token revogado (AC: #10, #11)
  - [ ] 4.1 Implementar verificação de token revogado
  - [ ] 4.2 Retornar 401 para tokens revogados
  - [ ] 4.3 Logar rejeição: `action: "auth.token.revoked"`

- [ ] Task 5: Validar isolamento cross-tenant (AC: #12, #13)
  - [ ] 5.1 Teste: admin_tenant não vê usuários de outro tenant
  - [ ] 5.2 Teste: RLS rejeita queries cross-tenant

- [ ] Task 6: Frontend — Página de gestão de usuários (AC: #1, #3, #6)
  - [ ] 6.1 Criar `apps/web/app/(authenticated)/admin/users/page.tsx`
  - [ ] 6.2 Lista paginada com TanStack Query
  - [ ] 6.3 Modal de alteração de role
  - [ ] 6.4 Confirmação de remoção de usuário
  - [ ] 6.5 Testes jest-axe

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Keycloak Admin REST API
- Prisma v7 + RLS
- Next.js 16.2 (App Router)
- TanStack Query 5.96.2 (Client Component)
- Zustand 5.0.12

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 2.1 (Cadastro) — tabelas users, user_tenants
- Story 2.4 (Guards) — RolesGuard (@Roles('admin_tenant'))
- Story 2.6 (RLS) — isolamento de dados por tenant

### Project Structure Notes
```
apps/api/src/users/
├── users.module.ts
├── users.controller.ts         # GET /users, PATCH /users/:id/role, DELETE /users/:id
├── users.service.ts
└── dto/
    ├── update-role.dto.ts
    └── user-response.dto.ts

apps/web/app/(authenticated)/admin/
└── users/
    ├── page.tsx
    └── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.7]
- [Source: docs/project-context.md — FR08, FR11, FR03, audit logging]
- [Source: _bmad-output/planning-artifacts/architecture.md — User management, Keycloak Admin API]
