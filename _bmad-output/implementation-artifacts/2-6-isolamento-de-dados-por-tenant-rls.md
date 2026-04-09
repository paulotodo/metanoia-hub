# Story 2.6: Isolamento de Dados por Tenant (RLS)

Status: ready-for-dev

## Story

As a platform operator,
I want complete data isolation between tenants enforced at the database level,
So that no data from one tenant is ever accessible by another tenant (FR07, NFR-S10).

## Acceptance Criteria

**Given** RLS policies are applied to all existing tables with `tenant_id` (`users`, `user_tenants`, `consents`)
**When** a query is executed via Prisma
**Then** the Prisma tenant extension automatically injects `WHERE tenant_id = :current_tenant` on all operations (SELECT, INSERT, UPDATE, DELETE)
**And** `tenant_id` is NEVER passed as a function parameter — always from AsyncLocalStorage via RequestContext

**Given** the RLS test suite runs
**When** tests execute with 2 provisioned test tenants
**Then** Tenant A cannot SELECT, UPDATE, or DELETE records belonging to Tenant B
**And** INSERT operations for Tenant A automatically set `tenant_id` to Tenant A's ID
**And** JOINs between tables (e.g., users ↔ user_tenants) respect RLS boundaries
**And** Subqueries and aggregations (e.g., COUNT of users per tenant) respect RLS
**And** the test suite runs on every PR in the CI pipeline

**Given** a new migration is created in a future epic that adds a table
**When** the migration is applied
**Then** the table MUST include `tenant_id` column
**And** an RLS policy MUST be created for the table
**And** the CI fails if RLS test coverage doesn't include the new table
**And** the RLS test framework is extensible to cover views and materialized views when created in future epics

## Tasks / Subtasks

- [ ] Task 1: Aplicar RLS policies em todas tabelas existentes (AC: #1, #2)
  - [ ] 1.1 Criar/verificar RLS policies para `users`
  - [ ] 1.2 Criar/verificar RLS policies para `user_tenants`
  - [ ] 1.3 Criar/verificar RLS policies para `consents`
  - [ ] 1.4 Aplicar policies em SELECT, INSERT, UPDATE, DELETE

- [ ] Task 2: Validar Prisma tenant extension (AC: #2, #3)
  - [ ] 2.1 Verificar que extension auto-injeta `WHERE tenant_id` em todas operações
  - [ ] 2.2 Verificar que tenant_id vem de AsyncLocalStorage (nunca parâmetro)
  - [ ] 2.3 Escrever testes de integração para cada operação CRUD

- [ ] Task 3: Suite completa de testes RLS (AC: #4, #5, #6, #7, #8)
  - [ ] 3.1 Criar 2 test tenants com dados isolados
  - [ ] 3.2 Teste: Tenant A não pode SELECT dados do Tenant B
  - [ ] 3.3 Teste: Tenant A não pode UPDATE dados do Tenant B
  - [ ] 3.4 Teste: Tenant A não pode DELETE dados do Tenant B
  - [ ] 3.5 Teste: INSERT auto-define tenant_id correto
  - [ ] 3.6 Teste: JOINs respeitam limites RLS
  - [ ] 3.7 Teste: Subqueries e aggregations respeitam RLS
  - [ ] 3.8 Integrar testes no CI pipeline

- [ ] Task 4: Framework extensível para futuras tabelas (AC: #9, #10, #11, #12)
  - [ ] 4.1 Criar helper genérico de teste RLS reutilizável
  - [ ] 4.2 Criar lint/check que valida que novas migrations incluem tenant_id
  - [ ] 4.3 Criar check que valida que novas tabelas têm RLS policy
  - [ ] 4.4 Preparar framework para views e materialized views

## Dev Notes

### Stack & Versões
- PostgreSQL 16 (Row Level Security)
- Prisma v7 com client extension
- AsyncLocalStorage (Node.js built-in)
- Vitest 4.1.2 para testes de integração

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.1 (Scaffold) — Prisma tenant extension, RLS test helper base
- Story 2.1 (Cadastro) — tabelas users, user_tenants, consents existem
- Story 1.5 (Observabilidade) — RequestContext com AsyncLocalStorage

### Project Structure Notes
```
apps/api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       └── YYYYMMDD_rls_policies/
├── src/prisma/
│   └── prisma.extension.ts        # Tenant extension (from Story 1.1, hardened)
└── test/rls/
    ├── rls-test.helper.ts          # Generic reusable RLS test helper
    ├── users.rls.spec.ts
    ├── user-tenants.rls.spec.ts
    └── consents.rls.spec.ts
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.6]
- [Source: docs/project-context.md — FR07, NFR-S10, multi-tenancy rules]
- [Source: _bmad-output/planning-artifacts/architecture.md — RLS, Prisma extension, data isolation]
