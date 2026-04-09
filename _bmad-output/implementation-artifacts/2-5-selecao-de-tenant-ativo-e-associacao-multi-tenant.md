# Story 2.5: Seleção de Tenant Ativo e Associação Multi-tenant

Status: ready-for-dev

## Story

As a user associated with multiple tenants,
I want to select which tenant I'm working in,
So that I see only data relevant to my current context.

## Acceptance Criteria

**Given** I am logged in and associated with 2+ tenants (FR03)
**When** I access the platform
**Then** I see a tenant selection screen listing all my tenants with their name, my role in each, and plan status
**And** I can select one tenant to set as active

**Given** I select a tenant
**When** the selection is confirmed
**Then** the `tenant_id` is set in my JWT/session context
**And** all subsequent API requests include `tenant_id` via RequestContext (AsyncLocalStorage)
**And** the Prisma tenant extension auto-filters all queries to the active tenant
**And** the `TenantGuard` from Story 2.4 validates my access to this tenant
**And** I am redirected to the app dashboard for that tenant

**Given** I am associated with only 1 tenant
**When** I login
**Then** that tenant is automatically selected and I skip the selection screen

**Given** I want to switch tenants during a session
**When** I access the tenant switcher
**Then** I can select a different tenant and the context switches immediately
**And** the previous tenant's data is no longer accessible in the UI

**Given** one of my tenants has an expired plan
**When** I see the tenant selection screen
**Then** the expired tenant is shown with a visual indicator (e.g., "Plano expirado") and is still selectable
**And** upon selecting an expired tenant, I see a limited view with an upgrade prompt (detailed behavior in Epic 11)

## Tasks / Subtasks

- [ ] Task 1: API — listar tenants do usuário (AC: #1, #2)
  - [ ] 1.1 Criar `GET /api/v1/tenants/me` retornando tenants do usuário com nome, role, plano
  - [ ] 1.2 Criar Zod schema `UserTenantsResponseSchema` em `packages/types`
  - [ ] 1.3 Incluir status do plano na resposta

- [ ] Task 2: API — selecionar tenant ativo (AC: #3, #4, #5, #6, #7)
  - [ ] 2.1 Criar `POST /api/v1/tenants/select` que define tenant ativo
  - [ ] 2.2 Atualizar JWT/session com tenant_id selecionado
  - [ ] 2.3 Garantir que RequestContext (AsyncLocalStorage) usa o tenant ativo
  - [ ] 2.4 Validar via TenantGuard que user pertence ao tenant

- [ ] Task 3: Auto-seleção para single tenant (AC: #8, #9)
  - [ ] 3.1 No login, se user tem apenas 1 tenant, selecionar automaticamente
  - [ ] 3.2 Redirecionar diretamente para dashboard

- [ ] Task 4: Tenant switcher (AC: #10, #11, #12)
  - [ ] 4.1 Implementar endpoint de switch de tenant
  - [ ] 4.2 Limpar cache/estado do tenant anterior no frontend

- [ ] Task 5: Indicador de plano expirado (AC: #13, #14, #15)
  - [ ] 5.1 Mostrar visual indicator "Plano expirado" na lista
  - [ ] 5.2 Permitir seleção mas mostrar view limitada

- [ ] Task 6: Frontend — Tela de seleção de tenant (AC: #1, #2, #10)
  - [ ] 6.1 Criar `apps/web/app/(auth)/tenant-select/page.tsx`
  - [ ] 6.2 Listar tenants com nome, role, status do plano
  - [ ] 6.3 Implementar tenant switcher no sidebar/header
  - [ ] 6.4 Testes jest-axe para acessibilidade

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Next.js 16.2 (App Router)
- Zustand 5.0.12 (`useAuthStore` para tenant ativo)
- TanStack Query 5.96.2 (Client Component para listar tenants)
- Zod 4.3.6

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 2.1 (Cadastro) — tabela user_tenants existe
- Story 2.2 (Login) — fluxo de login funcional
- Story 2.4 (Guards) — TenantGuard implementado
- Story 1.5 (Observabilidade) — RequestContext com AsyncLocalStorage

### Project Structure Notes
```
apps/api/src/tenant/
├── tenant.module.ts
├── tenant.controller.ts        # GET /tenants/me, POST /tenants/select
├── tenant.service.ts
└── dto/
    └── select-tenant.dto.ts

apps/web/app/(auth)/
└── tenant-select/
    ├── page.tsx
    └── page.spec.tsx

apps/web/stores/
└── auth.store.ts               # useAuthStore (tenant ativo, role)
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.5]
- [Source: docs/project-context.md — FR03 (multi-tenant), Zustand stores]
- [Source: _bmad-output/planning-artifacts/architecture.md — Multi-tenant context, tenant selection]
