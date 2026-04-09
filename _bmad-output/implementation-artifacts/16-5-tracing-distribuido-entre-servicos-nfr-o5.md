# Story 16.5: Tracing Distribuído entre Serviços (NFR-O5)

Status: ready-for-dev

## Story

As a developer or Super Admin,
I want distributed tracing across all service boundaries,
So that I can trace a request end-to-end and quickly identify bottlenecks or failures.

## Acceptance Criteria

**Given** the NestJS application is instrumented with OpenTelemetry
**When** the application starts
**Then** the OpenTelemetry SDK is initialized with:
  - `@opentelemetry/sdk-node` with auto-instrumentation for: HTTP, Express/Fastify, Prisma, BullMQ, Redis (ioredis)
  - `service.name`: "metanoia-api"
  - `service.version`: from `package.json`
  - `deployment.environment`: from `NODE_ENV`
**And** the SDK is configured via environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`) — no hardcoded endpoints

**Given** an HTTP request arrives at the API
**When** it is processed through guards, pipes, controllers, services, and repositories
**Then** a root span is created with: `http.method`, `http.url`, `http.status_code`, `user.id` (if authenticated), `tenant.id`
**And** child spans are created for: database queries (Prisma), Redis operations, BullMQ job dispatch, external HTTP calls (Resend, Keycloak)
**And** each span includes: `span.kind`, duration, status, and relevant attributes (e.g., `db.statement` for Prisma — sanitized with parameter values replaced by `?` placeholders to prevent PII leakage, `messaging.destination` for BullMQ)
**And** span filtering is configured to reduce noise: health check endpoints (`/health`, `/ready`) are excluded from tracing, and Prisma spans for simple `SELECT 1` keep-alive queries are dropped
**And** OTLP export batch size is limited to 512 spans per batch with 5s flush interval to prevent network saturation under high load
**And** `tenant_id` is propagated as a span attribute on ALL spans (for filtering by tenant in the tracing UI)

**Given** a Next.js SSR request makes API calls to NestJS
**When** the Server Component or `fetch` call is executed during SSR
**Then** the Next.js instrumentation (`instrumentation.ts` file, Next.js 16 native support) initializes OpenTelemetry with `service.name: "metanoia-web"`
**And** the `traceparent` header is propagated from the SSR request to the NestJS API call via `fetch` headers (W3C Trace Context propagation)
**And** this creates a true end-to-end trace: Browser → Next.js SSR → NestJS API → Prisma/Redis/BullMQ
**And** the SSR span includes: `http.url`, `http.method`, `next.route`, `next.rsc` (boolean), `tenant.id`

**Given** a BullMQ job is dispatched from an HTTP request
**When** the worker processes the job
**Then** the trace context (W3C `traceparent` header) is propagated via the job's `data` field: `{ ..., _traceContext: { traceparent, tracestate } }`
**And** the worker creates a linked span that continues the original trace
**And** the worker span includes: `job.name`, `job.id`, `job.attemptsMade`, `queue.name`

**Given** traces are exported
**When** the OTLP exporter sends data
**Then** traces are exported to the configured OTLP endpoint (Jaeger, Tempo, or any OTLP-compatible backend)
**And** in development, traces can also be viewed via `@opentelemetry/exporter-console` (enabled via `OTEL_TRACES_EXPORTER=console`)
**And** sampling is configured: 100% in dev, 10% in production (configurable via `OTEL_TRACES_SAMPLER_ARG`)

**Given** an error occurs during request processing
**When** the span records the error
**Then** the span status is set to `ERROR`
**And** `exception.type`, `exception.message`, and `exception.stacktrace` are recorded as span events
**And** the `correlation_id` from the request (already in logs from Epic 7) is added as a span attribute for log-trace correlation

## Tasks / Subtasks

- [ ] Task 1: Set up OpenTelemetry SDK in NestJS (AC: #1)
  - [ ] Install `@opentelemetry/sdk-node`, auto-instrumentation packages for HTTP, Prisma, BullMQ, Redis
  - [ ] Configure `service.name: "metanoia-api"`, `service.version` from `package.json`, `deployment.environment` from `NODE_ENV`
  - [ ] Configure via env vars: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`
- [ ] Task 2: Configure span attributes and filtering (AC: #2)
  - [ ] Add `user.id` and `tenant.id` to root spans
  - [ ] Create child spans for: Prisma, Redis, BullMQ, external HTTP
  - [ ] Sanitize `db.statement` — replace parameter values with `?`
  - [ ] Exclude health check endpoints from tracing
  - [ ] Drop `SELECT 1` keep-alive spans
  - [ ] Set OTLP batch: 512 spans, 5s flush interval
  - [ ] Propagate `tenant_id` on ALL spans
- [ ] Task 3: Set up OpenTelemetry in Next.js (AC: #3)
  - [ ] Create `instrumentation.ts` (Next.js 16 native support)
  - [ ] Configure `service.name: "metanoia-web"`
  - [ ] Propagate `traceparent` header via `fetch` to NestJS API
  - [ ] Add SSR span attributes: `http.url`, `http.method`, `next.route`, `next.rsc`, `tenant.id`
- [ ] Task 4: Implement BullMQ trace propagation (AC: #4)
  - [ ] Inject `_traceContext: { traceparent, tracestate }` into job data on dispatch
  - [ ] Extract and continue trace in worker processor
  - [ ] Add worker span attributes: `job.name`, `job.id`, `job.attemptsMade`, `queue.name`
- [ ] Task 5: Configure trace export and sampling (AC: #5)
  - [ ] Configure OTLP exporter for Jaeger/Tempo
  - [ ] Enable console exporter via `OTEL_TRACES_EXPORTER=console` for dev
  - [ ] Configure sampling: 100% dev, 10% production (`OTEL_TRACES_SAMPLER_ARG`)
- [ ] Task 6: Implement error span recording (AC: #6)
  - [ ] Set span status to `ERROR` on exceptions
  - [ ] Record `exception.type`, `exception.message`, `exception.stacktrace` as span events
  - [ ] Add `correlation_id` as span attribute for log-trace correlation
- [ ] Task 7: Write tests (AC: all)
  - [ ] Integration test: HTTP request → verify root span with correct attributes
  - [ ] Trace propagation test: HTTP → BullMQ job → verify linked spans via `traceparent`
  - [ ] Prisma span test: execute query → verify child span with sanitized `db.statement`
  - [ ] Error test: trigger 500 → verify span status ERROR with exception details
  - [ ] Sampling test: 50% sampling → 100 requests → ~50 traces (±10%)
  - [ ] Console exporter test: `OTEL_TRACES_EXPORTER=console` → traces to stdout
  - [ ] Tenant isolation: `tenant_id` present on all spans

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### OpenTelemetry Packages
- `@opentelemetry/sdk-node`
- `@opentelemetry/auto-instrumentations-node`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/exporter-console` (dev only)
- `@opentelemetry/instrumentation-prisma` (if available, or manual instrumentation)

### PII Protection
- Prisma `db.statement` sanitized: parameter values replaced with `?`
- No user data in span attributes beyond `user.id` and `tenant.id`

### Dependencies
- Epic 1 (observability base — Pino logging, RequestContext with correlation_id)
- Epic 7 (correlation_id in logs — for log-trace correlation)

### Project Structure Notes
- NestJS tracing: `apps/api/src/tracing.ts` (SDK initialization, loaded before app bootstrap)
- Next.js tracing: `apps/web/instrumentation.ts` (Next.js 16 native)
- BullMQ integration: `apps/api/src/modules/shared/bullmq-tracing.ts`
- Config: env vars `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_EXPORTER`, `OTEL_TRACES_SAMPLER_ARG`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-16.md` (Story 16.5)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
