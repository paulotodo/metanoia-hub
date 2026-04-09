# Story 2.1: Cadastro de Usuário com Email e Senha

Status: ready-for-dev

## Story

As a new user,
I want to register with my email and password,
So that I can create an account and access the platform.

## Acceptance Criteria

**Given** I am on the registration page
**When** I submit a valid email and password (minimum 12 characters, max 64+)
**Then** a migration creates tables `users`, `user_tenants`, and `consents` (if not yet created) with `tenant_id`, UUID v7 PKs, and RLS policies
**And** my account is created in Keycloak and a user record is persisted in PostgreSQL with UUID v7
**And** my password is validated against the OWASP/NIST leaked password list — common/leaked passwords are rejected with a clear message (NFR-S3)
**And** my password is stored with Argon2id hash in Keycloak (NFR-S1)
**And** I receive a confirmation email to verify my account
**And** the registration page passes jest-axe accessibility tests

**Given** I submit an email that already exists
**When** the server processes the request
**Then** I see a clear error message without revealing whether the email is registered (security best practice)

**Given** I submit a password shorter than 12 characters or longer than 64 characters
**When** the server processes the request
**Then** I see a clear validation error explaining the password requirements (NFR-S2)

## Tasks / Subtasks

- [ ] Task 1: Criar migration para tabelas users, user_tenants, consents (AC: #1)
  - [ ] 1.1 Criar migration com tabela `users`: id (UUID v7), email, name, status, tenant_id, created_at, updated_at
  - [ ] 1.2 Criar tabela `user_tenants`: id (UUID v7), user_id, tenant_id, role, created_at
  - [ ] 1.3 Criar tabela `consents`: id (UUID v7), user_id, tenant_id, document_type, version, ip_address, user_agent, accepted_at
  - [ ] 1.4 Aplicar `@@map` e `@map` para snake_case em todas tabelas
  - [ ] 1.5 Criar RLS policies para todas 3 tabelas
  - [ ] 1.6 Adicionar RLS tests em `apps/api/test/rls/`

- [ ] Task 2: Implementar endpoint de registro (AC: #1, #2)
  - [ ] 2.1 Criar `POST /api/v1/auth/register` em `apps/api/src/auth/`
  - [ ] 2.2 Criar Zod schema `RegisterUserSchema` em `packages/types`
  - [ ] 2.3 Validar email e password com ZodValidationPipe
  - [ ] 2.4 Criar usuário no Keycloak com Argon2id
  - [ ] 2.5 Persistir user record no PostgreSQL com UUID v7
  - [ ] 2.6 Retornar 201 com dados do usuário (sem password)

- [ ] Task 3: Validação de password contra leaked passwords (AC: #3)
  - [ ] 3.1 Integrar validação OWASP/NIST leaked password list
  - [ ] 3.2 Rejeitar passwords comuns com mensagem clara
  - [ ] 3.3 Validar min 12, max 64+ caracteres

- [ ] Task 4: Envio de email de confirmação (AC: #5)
  - [ ] 4.1 Enfileirar job BullMQ para envio de email de verificação
  - [ ] 4.2 Stub implementation: log no console em dev

- [ ] Task 5: Tratamento de email duplicado (AC: #7)
  - [ ] 5.1 Verificar existência do email sem revelar se já está registrado
  - [ ] 5.2 Retornar mensagem genérica em caso de conflito

- [ ] Task 6: Validação de password length (AC: #8, #9)
  - [ ] 6.1 Validar comprimento < 12 ou > 64 no Zod schema
  - [ ] 6.2 Retornar erro descritivo com requisitos

- [ ] Task 7: Frontend — Página de registro (AC: #6)
  - [ ] 7.1 Criar `apps/web/app/(public)/register/page.tsx`
  - [ ] 7.2 Formulário com email, password, confirm password
  - [ ] 7.3 Validação client-side com Zod schema compartilhado
  - [ ] 7.4 Escrever testes jest-axe para a página

- [ ] Task 8: Snapshot test do Zod schema (gate against breaking changes)
  - [ ] 8.1 Criar snapshot test para `RegisterUserSchema`

## Dev Notes

### Stack & Versões
- NestJS 11.1.17
- Prisma v7
- Keycloak Admin REST API
- Zod 4.3.6 (schema compartilhado em packages/types)
- BullMQ para email queue
- Next.js 16.2 (App Router)

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Epic 1 completo (Scaffold, Docker, Keycloak spike, observabilidade)

### Project Structure Notes
```
apps/api/src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── dto/
│   └── register.dto.ts         # Uses RegisterUserSchema from packages/types

apps/web/app/(public)/
└── register/
    ├── page.tsx
    └── page.spec.tsx

packages/types/src/
└── auth/
    ├── register.ts             # RegisterUserSchema
    └── __tests__/
        └── register.spec.ts    # Snapshot test

apps/api/prisma/migrations/
└── YYYYMMDD_create_users_and_consents/
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-02.md — Story 2.1]
- [Source: docs/project-context.md — NFR-S1 (Argon2id), NFR-S2 (password policy), NFR-S3 (leaked passwords)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Auth bounded context]
