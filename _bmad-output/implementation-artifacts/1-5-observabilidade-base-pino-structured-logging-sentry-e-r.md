# Story 1.5: Observabilidade Base — Pino Structured Logging, Sentry e RequestContext

Status: ready-for-dev

## Story

As a developer,
I want structured logging with Pino, error tracking with Sentry, and a RequestContext middleware using AsyncLocalStorage,
So that every request is traceable with tenant_id and user_id, and application errors generate automatic alerts with sufficient context.

## Acceptance Criteria

**Given** NestJS is running with the Pino logger configured
**When** an HTTP request is received
**Then** the `RequestContext` middleware extracts `tenant_id` and `user_id` from the Keycloak JWT and stores them in AsyncLocalStorage
**And** Pino automatically includes `tenant_id`, `user_id`, `request_id`, and `correlation_id` in every log line for that request
**And** logs are output as structured JSON (not plain text)
**And** unauthenticated requests (e.g., health check) log without tenant_id/user_id but still include request_id
**And** Sentry is configured for error tracking with `@sentry/nestjs`
**And** unhandled exceptions and rejected promises are captured by Sentry with tenant_id and user_id context
**And** a test utility in `apps/api/test/utils/log-capture.ts` captures Pino logs during tests and allows assertions on structured fields (tenant_id, action, etc.)
**And** NFR-O1 is met: logs are available for troubleshooting within 5 minutes (structured JSON queryable by tenant_id)
**And** NFR-O2 is met: application errors generate Sentry alerts with sufficient diagnostic context

## Tasks / Subtasks

- [ ] Task 1: Implementar RequestContext com AsyncLocalStorage (AC: #1)
  - [ ] 1.1 Criar `apps/api/src/common/context/request-context.ts` com AsyncLocalStorage
  - [ ] 1.2 Criar `RequestContextMiddleware` que extrai tenant_id e user_id do JWT
  - [ ] 1.3 Gerar `request_id` (UUID v7) e `correlation_id` para cada request
  - [ ] 1.4 Registrar middleware globalmente no NestJS

- [ ] Task 2: Configurar Pino structured logging (AC: #2, #3, #4)
  - [ ] 2.1 Instalar `nestjs-pino` e `pino-http`
  - [ ] 2.2 Configurar Pino para output JSON estruturado
  - [ ] 2.3 Integrar com RequestContext para incluir tenant_id, user_id, request_id, correlation_id
  - [ ] 2.4 Garantir que requests não autenticados logam sem tenant_id/user_id mas com request_id

- [ ] Task 3: Configurar Sentry para error tracking (AC: #5, #6)
  - [ ] 3.1 Instalar `@sentry/nestjs`
  - [ ] 3.2 Configurar DSN via variável de ambiente
  - [ ] 3.3 Configurar captura de unhandled exceptions e rejected promises
  - [ ] 3.4 Injetar tenant_id e user_id como context no Sentry

- [ ] Task 4: Criar test utility para log capture (AC: #7)
  - [ ] 4.1 Criar `apps/api/test/utils/log-capture.ts`
  - [ ] 4.2 Implementar captura de logs Pino durante testes
  - [ ] 4.3 Permitir assertions em campos estruturados (tenant_id, action, etc.)

- [ ] Task 5: Validar NFRs (AC: #8, #9)
  - [ ] 5.1 Escrever teste verificando que logs JSON são queryable por tenant_id
  - [ ] 5.2 Escrever teste verificando que Sentry recebe context adequado em erros

## Dev Notes

### Stack & Versões
- `nestjs-pino` (latest)
- `pino` / `pino-http`
- `@sentry/nestjs` (latest)
- AsyncLocalStorage (Node.js built-in)

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.1 (Scaffold do Monorepo) — NestJS app base
- Story 1.4 (Spike Keycloak) — JWT token structure for extracting claims

### Project Structure Notes
```
apps/api/src/common/
├── context/
│   ├── request-context.ts          # AsyncLocalStorage wrapper
│   └── request-context.middleware.ts
├── logger/
│   └── pino.config.ts              # Pino configuration
└── sentry/
    └── sentry.config.ts            # Sentry configuration

apps/api/test/utils/
└── log-capture.ts                  # Test utility for Pino log assertions
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-01.md — Story 1.5]
- [Source: docs/project-context.md — RequestContext, AsyncLocalStorage, NFR-O1, NFR-O2]
- [Source: _bmad-output/planning-artifacts/architecture.md — Observability]
