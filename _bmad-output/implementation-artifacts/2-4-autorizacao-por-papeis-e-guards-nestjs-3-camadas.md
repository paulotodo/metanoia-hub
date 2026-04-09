# Story 2.4: Autorização por Papéis e Guards NestJS (3 Camadas)

Status: ready-for-dev

## Story

As a platform operator,
I want role-based access control enforced at 3 independent layers,
So that users can only access resources permitted by their role and tenant context (FR05, FR09).

## Acceptance Criteria

**Given** the 3-layer authorization is configured
**When** a request reaches the API
**Then** Layer 1 (Keycloak): JWT token is validated and roles are extracted via `KeycloakAuthGuard` (from Epic 1 spike, now production-ready)
**And** Layer 2 (NestJS Guards): `RolesGuard` with `@Roles('admin_tenant', 'lider')` decorator checks the user's role. `TenantGuard` verifies the user belongs to the requested tenant
**And** Layer 3 (PostgreSQL RLS): queries are automatically scoped to `tenant_id` via Prisma extension — even if Guards are bypassed, data leakage is impossible

**Given** this story creates 3 Guards
**When** each Guard is implemented
**Then** `KeycloakAuthGuard` validates JWT signature, expiration, and extracts claims (production-hardened from spike)
**And** `RolesGuard` checks `realm_roles` claim against `@Roles()` decorator on the endpoint
**And** `TenantGuard` verifies the user's `tenant_id` matches the requested resource's tenant
**And** `GroupGuard` is NOT created in this story — deferred to Epic 4 (Grupos)

**Given** the 4 roles are defined: `super_admin`, `admin_tenant`, `lider`, `participante`
**When** each role accesses the API
**Then** `super_admin` can access all tenants and platform management endpoints
**And** `admin_tenant` can access only their tenant's management endpoints
**And** `lider` can access only their assigned groups within the tenant
**And** `participante` can access only their own data and group content

**Given** a user with role `participante` attempts to access an admin endpoint
**When** the NestJS Guard evaluates the request
**Then** the request is rejected with HTTP 403 and error `{ statusCode: 403, error: "Forbidden", message: "Insufficient permissions" }`
**And** no stack trace is exposed to the frontend
**And** the rejection is logged (Pino: `action: "auth.access.denied"`, `user_id`, `endpoint`, `required_role`)

## Tasks / Subtasks

- [ ] Task 1: Production-harden KeycloakAuthGuard (AC: #1, #4)
  - [ ] 1.1 Refatorar guard do spike para produção em `apps/api/src/auth/guards/keycloak-auth.guard.ts`
  - [ ] 1.2 Validar JWT signature com chave pública do Keycloak
  - [ ] 1.3 Validar expiration e issuer
  - [ ] 1.4 Extrair claims: realm_roles, tenant_id, user_id
  - [ ] 1.5 Escrever testes unitários completos

- [ ] Task 2: Implementar RolesGuard e @Roles decorator (AC: #2, #5)
  - [ ] 2.1 Criar `@Roles()` decorator em `apps/api/src/auth/decorators/roles.decorator.ts`
  - [ ] 2.2 Criar `RolesGuard` em `apps/api/src/auth/guards/roles.guard.ts`
  - [ ] 2.3 Verificar `realm_roles` do JWT contra roles do decorator
  - [ ] 2.4 Escrever testes para cada role

- [ ] Task 3: Implementar TenantGuard (AC: #2, #6)
  - [ ] 3.1 Criar `TenantGuard` em `apps/api/src/auth/guards/tenant.guard.ts`
  - [ ] 3.2 Verificar que user pertence ao tenant do recurso requisitado
  - [ ] 3.3 super_admin bypassa verificação de tenant
  - [ ] 3.4 Escrever testes unitários

- [ ] Task 4: Validar acesso por role (AC: #7, #8, #9, #10)
  - [ ] 4.1 Teste: super_admin acessa endpoints de qualquer tenant
  - [ ] 4.2 Teste: admin_tenant acessa apenas seu tenant
  - [ ] 4.3 Teste: lider acessa apenas grupos do seu tenant
  - [ ] 4.4 Teste: participante acessa apenas seus dados

- [ ] Task 5: Error handling e logging (AC: #11, #12, #13)
  - [ ] 5.1 Retornar 403 com formato padrão `{ statusCode, error, message }` (sem stack trace)
  - [ ] 5.2 Logar rejeições com Pino: `action: "auth.access.denied"`, user_id, endpoint, required_role

- [ ] Task 6: Confirmar que GroupGuard NÃO é criado nesta story (AC: #6)
  - [ ] 6.1 Documentar que GroupGuard é deferido para Epic 4

## Dev Notes

### Stack & Versões
- NestJS 11.1.17 (Guards, Decorators, ExecutionContext)
- Keycloak 24+ JWT validation
- Prisma v7 com RLS extension
- Pino structured logging

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.4 (Spike Keycloak) — KeycloakAuthGuard base (spike version)
- Story 1.5 (Observabilidade) — RequestContext, Pino logging
- Story 2.1 (Cadastro) — tabelas users, user_tenants com RLS

### Project Structure Notes
```
apps/api/src/auth/
├── guards/
│   ├── keycloak-auth.guard.ts      # Production-hardened from spike
│   ├── keycloak-auth.guard.spec.ts
│   ├── roles.guard.ts
│   ├── roles.guard.spec.ts
│   ├── tenant.guard.ts
│   └── tenant.guard.spec.ts
├── decorators/
│   ├── roles.decorator.ts          # @Roles('admin_tenant', 'lider')
│   └── current-user.decorator.ts
└── types/
    └── auth.types.ts               # Role enum, JWT claims interface
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.4]
- [Source: docs/project-context.md — Auth 3 camadas, FR05, FR09]
- [Source: _bmad-output/planning-artifacts/architecture.md — Authorization architecture, Guards]
