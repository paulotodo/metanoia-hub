# Story 2.2: Login via Email/Senha e Google OAuth

Status: ready-for-dev

## Story

As a registered user,
I want to login with my email/password or Google account,
So that I can access my account securely.

## Acceptance Criteria

**Given** I am on the login page
**When** I submit valid email and password credentials
**Then** I receive a JWT token from Keycloak with `realm_roles`, `tenant_id`, and `user_id` claims
**And** the session is established with high-entropy session ID (NFR-S9)
**And** I am redirected to tenant selection (if multiple tenants) or the app dashboard

**Given** I am on the login page
**When** I click "Login with Google"
**Then** I am redirected to Google OAuth flow via Keycloak
**And** upon successful Google authentication, I receive a valid JWT with the same claims
**And** if this is my first Google login, a user record is created in PostgreSQL
**And** if this is my first login (no consent recorded), I am redirected to the LGPD consent flow (Story 2.8) before accessing the app

**Given** I submit invalid credentials
**When** the server processes the request
**Then** I see a generic error message "Email ou senha incorretos" (no credential enumeration)
**And** failed login attempts are logged in the audit trail (Pino structured log with `action: "auth.login.failed"`)

**Given** the CI pipeline runs Google OAuth tests
**When** the test suite executes
**Then** a mock identity provider is configured in Keycloak for CI (simulating Google OAuth flow without real Google credentials)
**And** the mock IdP test validates the full flow: redirect → callback → JWT issued → user created

## Tasks / Subtasks

- [ ] Task 1: Implementar login via email/senha (AC: #1, #2, #3)
  - [ ] 1.1 Criar `POST /api/v1/auth/login` que autentica via Keycloak
  - [ ] 1.2 Retornar JWT com claims: realm_roles, tenant_id, user_id
  - [ ] 1.3 Estabelecer sessão com high-entropy session ID
  - [ ] 1.4 Redirecionar para tenant selection ou dashboard

- [ ] Task 2: Implementar login via Google OAuth (AC: #4, #5, #6, #7)
  - [ ] 2.1 Criar endpoint de redirect para Google OAuth via Keycloak
  - [ ] 2.2 Criar callback handler que processa resposta do Google
  - [ ] 2.3 Criar user record no PostgreSQL se primeiro login Google
  - [ ] 2.4 Verificar consent e redirecionar para fluxo LGPD se necessário

- [ ] Task 3: Tratamento de credenciais inválidas (AC: #8, #9)
  - [ ] 3.1 Retornar mensagem genérica "Email ou senha incorretos" (sem enumeration)
  - [ ] 3.2 Logar tentativas falhas com Pino: `action: "auth.login.failed"`

- [ ] Task 4: Mock IdP para CI (AC: #10, #11)
  - [ ] 4.1 Configurar mock identity provider no Keycloak para CI
  - [ ] 4.2 Escrever teste que valida fluxo completo: redirect → callback → JWT → user created

- [ ] Task 5: Frontend — Página de login (AC: #1, #4)
  - [ ] 5.1 Criar `apps/web/app/(public)/login/page.tsx`
  - [ ] 5.2 Formulário com email/senha
  - [ ] 5.3 Botão "Login com Google"
  - [ ] 5.4 Mensagens de erro user-friendly em PT-BR
  - [ ] 5.5 Testes jest-axe para acessibilidade

- [ ] Task 6: Zod schemas compartilhados
  - [ ] 6.1 Criar `LoginSchema` em `packages/types/src/auth/`
  - [ ] 6.2 Snapshot test do schema

## Dev Notes

### Stack & Versões
- Keycloak 24+ (OAuth2/OIDC)
- NestJS 11.1.17
- Next.js 16.2 (App Router)
- Pino structured logging
- Zod 4.3.6

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 2.1 (Cadastro) — tabelas users, user_tenants existem
- Story 1.4 (Spike Keycloak) — Keycloak configurado com Google OAuth
- Story 1.5 (Observabilidade) — Pino logging para audit trail

### Project Structure Notes
```
apps/api/src/auth/
├── auth.controller.ts          # POST /login, GET /google, GET /google/callback
├── auth.service.ts             # Login logic, Google OAuth flow
└── dto/
    └── login.dto.ts

apps/web/app/(public)/
└── login/
    ├── page.tsx
    └── page.spec.tsx

packages/types/src/auth/
├── login.ts                    # LoginSchema
└── __tests__/
    └── login.spec.ts           # Snapshot test

infra/keycloak/
└── mock-idp.json               # Mock IdP config for CI
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.2]
- [Source: docs/project-context.md — NFR-S9 (high-entropy session), audit logging]
- [Source: _bmad-output/planning-artifacts/architecture.md — Auth flow, Google OAuth]
