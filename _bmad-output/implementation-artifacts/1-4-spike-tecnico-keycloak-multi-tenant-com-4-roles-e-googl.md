# Story 1.4: Spike Técnico — Keycloak Multi-tenant com 4 Roles e Google OAuth

Status: ready-for-dev

## Story

As a developer,
I want a validated Keycloak configuration with multi-tenant support, 4 initial roles, and Google OAuth,
So that I have confidence the auth architecture works before building identity features.

## Acceptance Criteria

**Given** Keycloak is running via Docker Compose with the `metanoia` realm loaded from JSON
**When** the realm configuration is validated
**Then** 4 realm roles are defined: `super_admin`, `admin_tenant`, `lider`, `participante`
**And** Google OAuth is configured as an identity provider in the realm
**And** a test user can register with email/password and receive a valid JWT
**And** a test user can login via Google OAuth and receive a valid JWT
**And** the JWT token includes `realm_roles`, `tenant_id`, and `user_id` claims via custom mappers
**And** a NestJS `KeycloakAuthGuard` can extract and validate the JWT token
**And** the guard rejects expired, malformed, or missing tokens with appropriate error responses
**And** the final realm configuration is exported as JSON and committed to `infra/keycloak/realm-export.json`
**And** Docker Compose loads this JSON automatically on boot (no manual configuration required for new devs)
**And** **time-box:** this spike must be completed in 3 days maximum
**And** if spike fails within time-box, a decision document is created in `docs/decisions/` evaluating auth alternatives (e.g., JWT self-issued, Auth.js)

## Tasks / Subtasks

- [ ] Task 1: Configurar realm Keycloak com 4 roles (AC: #1)
  - [ ] 1.1 Criar realm `metanoia` com roles: `super_admin`, `admin_tenant`, `lider`, `participante`
  - [ ] 1.2 Configurar client `metanoia-api` com access type confidential
  - [ ] 1.3 Configurar client `metanoia-web` com access type public

- [ ] Task 2: Configurar Google OAuth como Identity Provider (AC: #2, #4)
  - [ ] 2.1 Adicionar Google como Identity Provider no realm
  - [ ] 2.2 Configurar client ID e secret do Google (via .env)
  - [ ] 2.3 Validar fluxo completo: redirect → callback → JWT

- [ ] Task 3: Configurar custom JWT mappers (AC: #3, #4, #5)
  - [ ] 3.1 Criar mapper para `realm_roles` no token
  - [ ] 3.2 Criar mapper para `tenant_id` (user attribute → token claim)
  - [ ] 3.3 Criar mapper para `user_id` no token
  - [ ] 3.4 Testar JWT com email/password e Google OAuth

- [ ] Task 4: Implementar KeycloakAuthGuard no NestJS (AC: #6, #7)
  - [ ] 4.1 Criar `KeycloakAuthGuard` em `apps/api/src/auth/guards/`
  - [ ] 4.2 Implementar validação de JWT: signature, expiration, claims
  - [ ] 4.3 Rejeitar tokens expirados com 401
  - [ ] 4.4 Rejeitar tokens malformados com 401
  - [ ] 4.5 Rejeitar requisições sem token com 401
  - [ ] 4.6 Escrever testes unitários para cada cenário

- [ ] Task 5: Exportar e committar realm config (AC: #8, #9)
  - [ ] 5.1 Exportar realm final como JSON
  - [ ] 5.2 Salvar em `infra/keycloak/realm-export.json`
  - [ ] 5.3 Verificar que Docker Compose carrega automaticamente no boot

- [ ] Task 6: Contingência — documento de decisão se spike falhar (AC: #10, #11)
  - [ ] 6.1 Se spike falhar em 3 dias, criar `docs/decisions/auth-alternative.md`
  - [ ] 6.2 Avaliar alternativas: JWT self-issued, Auth.js, outros

## Dev Notes

### Stack & Versões
- Keycloak 24+ (via Docker)
- NestJS 11.1.17
- `@nestjs/passport` ou validação manual de JWT via `jsonwebtoken` / `jose`
- Zod para validação de JWT claims

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.1 (Scaffold do Monorepo) — NestJS app base
- Story 1.2 (Docker Compose Completo) — Keycloak service running

### Project Structure Notes
```
apps/api/src/auth/
├── guards/
│   └── keycloak-auth.guard.ts
│   └── keycloak-auth.guard.spec.ts
├── decorators/
│   └── current-user.decorator.ts
└── strategies/
    └── keycloak.strategy.ts

infra/keycloak/
└── realm-export.json           # Final validated realm config
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-01.md — Story 1.4]
- [Source: docs/project-context.md — Auth: Keycloak 3 camadas, 6 roles]
- [Source: _bmad-output/planning-artifacts/architecture.md — Authentication architecture]
