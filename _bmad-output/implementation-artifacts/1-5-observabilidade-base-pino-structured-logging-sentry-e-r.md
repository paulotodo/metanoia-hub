# Story 1.5: Observabilidade Base — Pino Structured Logging, Sentry e RequestContext

Status: done

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

- [x] Task 1: Implementar RequestContext com AsyncLocalStorage (AC: #1)
  - [x] 1.1 Criar `apps/api/src/common/context/request-context.ts` com AsyncLocalStorage
  - [x] 1.2 Criar `RequestContextMiddleware` que extrai tenant_id e user_id do JWT
  - [x] 1.3 Gerar `request_id` (UUID v7) e `correlation_id` para cada request
  - [x] 1.4 Registrar middleware globalmente no NestJS

- [x] Task 2: Configurar Pino structured logging (AC: #2, #3, #4)
  - [x] 2.1 Instalar `nestjs-pino` e `pino-http`
  - [x] 2.2 Configurar Pino para output JSON estruturado
  - [x] 2.3 Integrar com RequestContext para incluir tenant_id, user_id, request_id, correlation_id
  - [x] 2.4 Garantir que requests não autenticados logam sem tenant_id/user_id mas com request_id

- [x] Task 3: Configurar Sentry para error tracking (AC: #5, #6)
  - [x] 3.1 Instalar `@sentry/nestjs`
  - [x] 3.2 Configurar DSN via variável de ambiente
  - [x] 3.3 Configurar captura de unhandled exceptions e rejected promises
  - [x] 3.4 Injetar tenant_id e user_id como context no Sentry

- [x] Task 4: Criar test utility para log capture (AC: #7)
  - [x] 4.1 Criar `apps/api/test/utils/log-capture.ts`
  - [x] 4.2 Implementar captura de logs Pino durante testes
  - [x] 4.3 Permitir assertions em campos estruturados (tenant_id, action, etc.)

- [x] Task 5: Validar NFRs (AC: #8, #9)
  - [x] 5.1 Escrever teste verificando que logs JSON são queryable por tenant_id
  - [x] 5.2 Escrever teste verificando que Sentry recebe context adequado em erros

### Review Findings

- [x] [Review][Patch] Sanitizar header X-Correlation-Id contra log/tag injection [request-context.middleware.ts:12]
- [x] [Review][Patch] SentryExceptionFilter captura exceção dupla (manual + auto-instrumentação) [sentry.filter.ts:22]
- [x] [Review][Patch] Mover pino-pretty para devDependencies [package.json]
- [x] [Review][Patch] SentryExceptionFilter não trata falha do SDK Sentry (try-catch) [sentry.filter.ts]
- [x] [Review][Patch] Usar null ao invés de undefined em customProps (regra project-context) [logger.config.ts]
- [x] [Review][Patch] Logger obtido 2x em main.ts — redundância [main.ts]
- [x] [Review][Patch] Auth module registra guards tanto explicitamente quanto via APP_GUARD [auth.module.ts] — mantido: providers explícitos necessários para export funcionar
- [x] [Review][Patch] Adicionar teste para middleware quando next() lança exceção [request-context.middleware.spec.ts]
- [x] [Review][Defer] Adicionar header X-Request-Id na response — melhoria futura
- [x] [Review][Defer] Store mutable no guard — pattern existente, não regressão
- [x] [Review][Defer] LoggerModule.forRoot avaliado em load time — otimização futura
- [x] [Review][Defer] tenantId inicializado como '' — pattern existente
- [x] [Review][Defer] SET LOCAL sem transaction no Prisma extension — pré-existente
- [x] [Review][Defer] tracesSampleRate não configurável via env — MVP aceitável
- [x] [Review][Defer] redact config só cobre authorization header — expandir futuramente

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

## Dev Agent Record

### Implementation Plan
- Consolidated existing AsyncLocalStorage from `prisma.extension.ts` into new `common/context/request-context.ts` with expanded interface (requestId, correlationId)
- Replaced `TenantContextMiddleware` with `RequestContextMiddleware` that generates UUID v7 request IDs and reads X-Correlation-Id header
- Configured `nestjs-pino` with `customProps` reading from AsyncLocalStorage for automatic context injection
- Configured `@sentry/nestjs` with global exception filter that enriches Sentry scope with tenant/user/request context
- Created `LogCapture` test utility for structured log assertions in tests

### Completion Notes
- All 5 tasks completed, all acceptance criteria satisfied
- 67 tests passing (10 new test files), only pre-existing RLS integration test fails (requires running DB)
- Middleware chain: RequestContextMiddleware → pino-http → KeycloakAuthGuard → Controller → SentryExceptionFilter
- Sentry is optional (disabled when SENTRY_DSN not set)
- Pino outputs JSON in production, pino-pretty in development

## File List

### Created
- `apps/api/src/common/context/request-context.ts`
- `apps/api/src/common/context/request-context.middleware.ts`
- `apps/api/src/common/context/__tests__/request-context.middleware.spec.ts`
- `apps/api/src/common/logger/logger.config.ts`
- `apps/api/src/common/logger/__tests__/logger.config.spec.ts`
- `apps/api/src/common/sentry/instrument.ts`
- `apps/api/src/common/sentry/sentry.filter.ts`
- `apps/api/src/common/sentry/__tests__/sentry.filter.spec.ts`
- `apps/api/test/utils/log-capture.ts`
- `apps/api/test/utils/log-capture.spec.ts`
- `apps/api/test/observability/log-queryable.spec.ts`
- `apps/api/test/observability/sentry-context.spec.ts`

### Modified
- `apps/api/src/prisma/prisma.extension.ts` — import migrado para common/context
- `apps/api/src/auth/keycloak.guard.ts` — import migrado para common/context
- `apps/api/src/auth/__tests__/keycloak.guard.spec.ts` — import migrado
- `apps/api/src/config/env.validation.ts` — adicionado SENTRY_DSN opcional
- `apps/api/src/app.module.ts` — RequestContextMiddleware + LoggerModule
- `apps/api/src/main.ts` — Sentry instrument, Logger, SentryExceptionFilter
- `apps/api/package.json` — nestjs-pino, pino-http, pino-pretty, @sentry/nestjs, @sentry/node
- `.env.example` — SENTRY_DSN

### Deleted
- `apps/api/src/auth/tenant-context.middleware.ts` — substituído por RequestContextMiddleware

## Change Log

- 2026-04-09: Implementação completa da Story 1-5 — Observabilidade Base com Pino structured logging, Sentry error tracking, e RequestContext consolidado com AsyncLocalStorage
