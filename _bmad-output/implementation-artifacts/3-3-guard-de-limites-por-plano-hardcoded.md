# Story 3.3: Guard de Limites por Plano (Hardcoded)

Status: ready-for-dev

## Story

As a platform operator,
I want hardcoded plan limits enforced via a NestJS Guard,
So that tenants cannot exceed their plan's resource allocation before dynamic configuration exists.

## Acceptance Criteria

**Given** the system has hardcoded plan limits defined as constants:
- Free: max 3 groups, 15 members/group
- Pro: max 10 groups, 50 members/group
- Enterprise: max 50 groups, 200 members/group
**When** any resource creation request is received
**Then** a NestJS Guard (not middleware) checks the tenant's current resource count against the plan limit
**And** if the `plan_limits_override` field (from Story 3.1) is set, those values take precedence over hardcoded defaults

**Given** a tenant on the Free plan already has 3 groups
**When** a request to create a 4th group is made
**Then** the Guard returns 403 with message indicating the plan limit was reached
**And** the response includes current count, limit, and a hint about upgrading

**Given** concurrent requests attempt to create resources that would exceed the limit
**When** both requests are processed simultaneously
**Then** atomic limit enforcement via Redis `INCR` atômico ensures only one succeeds (race condition test required)
**And** the resource count is cached in Redis (`cache:tenant:{id}:resource_count`) with TTL de 5 minutos e invalidação eager on create/delete
**And** if Redis is unavailable, fallback para `SELECT COUNT` com lock pessimista no PostgreSQL (garantindo consistência mesmo sem cache)

**Given** the Guard is implemented
**When** integration tests run
**Then** tests include a simulated group creation scenario (preparation for Epic 4)
**And** tests verify Guard blocks creation at exact boundary (e.g., 3rd group OK, 4th blocked for Free plan)
**And** tests verify `plan_limits_override` correctly overrides hardcoded defaults

## Tasks / Subtasks

- [ ] Task 1: Definir constantes de limites por plano (AC: #1)
  - [ ] 1.1 Criar `apps/api/src/common/constants/plan-limits.ts`
  - [ ] 1.2 Definir: Free (3 groups, 15 members), Pro (10, 50), Enterprise (50, 200)
  - [ ] 1.3 Exportar tipo `PlanLimits` em `packages/types`

- [ ] Task 2: Implementar PlanLimitGuard (AC: #1, #2)
  - [ ] 2.1 Criar `PlanLimitGuard` em `apps/api/src/common/guards/plan-limit.guard.ts`
  - [ ] 2.2 Guard verifica count atual vs limite do plano
  - [ ] 2.3 Se `plan_limits_override` existe, usar em vez dos defaults
  - [ ] 2.4 Criar decorator `@PlanLimit('groups')` para uso em controllers

- [ ] Task 3: Resposta quando limite atingido (AC: #3, #4)
  - [ ] 3.1 Retornar 403 com: `{ statusCode: 403, error: "Plan limit reached", message: "...", details: { currentCount, limit, plan, upgradeHint } }`

- [ ] Task 4: Enforcement atômico via Redis (AC: #5, #6, #7)
  - [ ] 4.1 Cachear resource count em `cache:tenant:{id}:resource_count` com TTL 5min
  - [ ] 4.2 Usar Redis `INCR` atômico para concurrent check
  - [ ] 4.3 Invalidação eager on create/delete
  - [ ] 4.4 Fallback para `SELECT COUNT` com lock pessimista se Redis indisponível
  - [ ] 4.5 Teste de race condition com requests concorrentes

- [ ] Task 5: Testes de integração (AC: #8, #9, #10)
  - [ ] 5.1 Teste: criar 3 grupos OK, 4o bloqueado (Free plan)
  - [ ] 5.2 Teste: plan_limits_override sobreescreve defaults
  - [ ] 5.3 Teste: simulated group creation scenario (prep para Epic 4)
  - [ ] 5.4 Teste: boundary exact (3o OK, 4o blocked)
  - [ ] 5.5 Teste: concurrent requests — apenas um sucede
  - [ ] 5.6 Teste: fallback para PostgreSQL quando Redis down

## Dev Notes

### Stack & Versões
- NestJS 11.1.17 (Guards)
- Redis 7 (INCR atômico, cache namespace `cache:*`)
- PostgreSQL 16 (fallback com lock pessimista)
- Vitest 4.1.2

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 3.1 (Provisionamento) — tabela tenants com plan e plan_limits_override
- Story 1.1 (Scaffold) — Redis connection
- Story 2.4 (Guards) — Guard pattern established

### Project Structure Notes
```
apps/api/src/common/
├── constants/
│   └── plan-limits.ts              # PLAN_LIMITS constant
├── guards/
│   ├── plan-limit.guard.ts
│   └── plan-limit.guard.spec.ts
└── decorators/
    └── plan-limit.decorator.ts     # @PlanLimit('groups')

packages/types/src/tenant/
└── plan-limits.ts                  # PlanLimits type

apps/api/test/integration/
└── plan-limit.integration-spec.ts  # Race condition + boundary tests
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-03.md — Story 3.3]
- [Source: docs/project-context.md — Redis namespaces (cache:*), Guard patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md — Plan limits, caching strategy]
