# Story 3.1: Provisionamento Transacional de Tenant

Status: ready-for-dev

## Story

As a Super Admin,
I want to provision a new tenant with minimal required data in a transactional flow,
So that tenant creation is atomic and no orphan records exist if any step fails.

## Acceptance Criteria

**Given** I am authenticated as Super Admin
**When** I submit the tenant provisioning form with name, slug, admin email and selected plan (Free/Pro/Enterprise)
**Then** the system creates the tenant record, Keycloak realm, and admin user in a single transaction
**And** the flow uses saga pattern (não 2PC): criar tenant no banco → criar realm Keycloak → se Keycloak falhar, marcar tenant com `status: provisioning_failed` para retry manual pelo Super Admin (botão na UI)
**And** the `tenants` table includes: `id` (UUID v7), `name`, `slug` (unique, URL-safe: `^[a-z0-9-]+$`), `status` (enum `TenantStatus`: `active`, `provisioning_failed`, `suspended`), `plan` (enum `TenantPlan`: `free`, `pro`, `enterprise`), `plan_limits_override` (JSONB, nullable), `metadata` (JSONB), `created_at`, `updated_at`
**And** slug validation rejects values that não match `^[a-z0-9-]+$` with 422 and descriptive error
**And** RLS policies are applied to the tenants table from creation
**And** the API returns 201 with the created tenant data

**Given** a tenant with `status: provisioning_failed` exists
**When** I trigger a retry for that tenant
**Then** the system retries the failed Keycloak step and updates status to `active` on success

**Given** I try to create a tenant with a slug that already exists
**When** I submit the provisioning form
**Then** the API returns 409 Conflict with a clear error message

## Tasks / Subtasks

- [ ] Task 1: Criar migration para tabela tenants (AC: #3)
  - [ ] 1.1 Criar tabela `tenants` com: id (UUID v7), name, slug (unique), status (enum), plan (enum), plan_limits_override (JSONB), metadata (JSONB), created_at, updated_at
  - [ ] 1.2 Usar `@@map('tenants')` e `@map` para snake_case
  - [ ] 1.3 Criar enum `TenantStatus`: active, provisioning_failed, suspended
  - [ ] 1.4 Criar enum `TenantPlan`: free, pro, enterprise
  - [ ] 1.5 Aplicar RLS policies na tabela tenants
  - [ ] 1.6 Adicionar RLS tests

- [ ] Task 2: Implementar saga de provisionamento (AC: #1, #2)
  - [ ] 2.1 Criar `POST /api/v1/tenants` (protegido por @Roles('super_admin'))
  - [ ] 2.2 Step 1: Criar tenant record no PostgreSQL
  - [ ] 2.3 Step 2: Criar realm no Keycloak
  - [ ] 2.4 Step 3: Criar admin user no Keycloak e PostgreSQL
  - [ ] 2.5 Se Keycloak falhar: marcar tenant como `provisioning_failed`
  - [ ] 2.6 Retornar 201 com tenant data

- [ ] Task 3: Validação de slug (AC: #4)
  - [ ] 3.1 Criar Zod schema com regex `^[a-z0-9-]+$` em `packages/types`
  - [ ] 3.2 Rejeitar slugs inválidos com 422 e mensagem descritiva

- [ ] Task 4: Retry de provisionamento falho (AC: #7, #8)
  - [ ] 4.1 Criar `POST /api/v1/tenants/:id/retry`
  - [ ] 4.2 Retry apenas do step que falhou (Keycloak)
  - [ ] 4.3 Atualizar status para `active` em sucesso

- [ ] Task 5: Slug duplicado (AC: #9, #10)
  - [ ] 5.1 Verificar unicidade do slug antes de criar
  - [ ] 5.2 Retornar 409 Conflict com mensagem clara

- [ ] Task 6: Zod schemas e snapshot tests
  - [ ] 6.1 Criar `CreateTenantSchema` em `packages/types`
  - [ ] 6.2 Criar `TenantResponseSchema`
  - [ ] 6.3 Snapshot tests para ambos schemas

- [ ] Task 7: Frontend — Formulário de provisionamento
  - [ ] 7.1 Criar `apps/web/app/(authenticated)/super-admin/tenants/new/page.tsx`
  - [ ] 7.2 Formulário: name, slug, admin email, plan
  - [ ] 7.3 Validação client-side com Zod compartilhado
  - [ ] 7.4 Botão de retry para tenants com provisioning_failed
  - [ ] 7.5 Testes jest-axe

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Prisma v7
- Keycloak Admin REST API
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
- Story 2.4 (Guards) — @Roles('super_admin') guard
- Story 2.6 (RLS) — RLS framework para nova tabela
- Story 1.4 (Spike Keycloak) — Keycloak Admin API

### Project Structure Notes
```
apps/api/src/tenant/
├── tenant.module.ts
├── tenant.controller.ts        # POST /tenants, POST /tenants/:id/retry
├── tenant.service.ts           # Saga pattern implementation
├── tenant.repository.ts        # Core domain — repository pattern
└── dto/
    ├── create-tenant.dto.ts
    └── tenant-response.dto.ts

apps/api/prisma/migrations/
└── YYYYMMDD_create_tenants/

packages/types/src/tenant/
├── create-tenant.ts            # CreateTenantSchema
├── tenant-response.ts          # TenantResponseSchema
└── __tests__/
    └── tenant.spec.ts          # Snapshot tests

apps/web/app/(authenticated)/super-admin/tenants/
└── new/
    ├── page.tsx
    └── page.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-03.md — Story 3.1]
- [Source: docs/project-context.md — Multi-tenancy, saga pattern, FR19]
- [Source: _bmad-output/planning-artifacts/architecture.md — Tenant provisioning, bounded contexts]
