# Research — Tracing Distribuído OpenTelemetry (NFR-O5)

Investigação empírica feita no codebase REAL (não suposições). Cada achado tem evidência verificável.

## R1 — @sentry/node v10 já embarca e registra o TracerProvider global OTel

**Evidência**: `apps/api/node_modules/@sentry/node/package.json` declara como deps DIRETAS toda a árvore OTel (`@opentelemetry/api@^1.9.1`, `sdk-trace-base@^2.6.1`, `instrumentation-http/-ioredis/-pg/-undici/-nestjs-core`, `context-async-hooks`, `resources`, `semantic-conventions`, `@sentry/opentelemetry@10.47.0`). O setup interno (`@sentry/node/build/cjs/sdk/initOtel.js`) cria `new sdkTraceBase.BasicTracerProvider({ spanProcessors: [SentrySpanProcessor(), ...(options.spanProcessors || [])] })` e o registra como provider global (`client.traceProvider = provider`).

**Conclusão**: ponto de injeção público = opção `openTelemetrySpanProcessors` do `Sentry.init()` (`sdk/index.js:59` → `options.spanProcessors`). → D-01.

## R2 — Pacotes OTel ausentes do store pnpm

**Evidência** (`ls node_modules/.pnpm/`):
- PRESENTES (transitivos do Sentry): `@opentelemetry/api`, `core`, `sdk-trace-base`, `resources`, `semantic-conventions`, `context-async-hooks`, todas as `instrumentation-*` (http, ioredis, pg, undici, nestjs-core, express...), `@sentry/opentelemetry@10.47.0`.
- AUSENTES: `@opentelemetry/sdk-node`, `auto-instrumentations-node`, `exporter-trace-otlp-http`, `instrumentation-bullmq`.

**Conclusão**: instalar APENAS `@opentelemetry/exporter-trace-otlp-http` (+ `sdk-trace-base` como dep direta explícita para import estável). NÃO instalar `sdk-node`/`auto-instrumentations-node` (colidiriam com o Sentry). → D-01, D-03.

## R3 — PrismaPg adapter (Prisma v7) e instrumentação

**Evidência**: `apps/api/src/prisma/prisma.service.ts` usa `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`. Queries tenant-scoped passam por `with-tenant-tx.ts` que emite `SET LOCAL app.current_tenant_id = '<uuid>'`.

**Conclusão**: `instrumentation-pg` pode não cobrir o caminho do adapter de forma confiável e não dá controle do `db.statement`. Usar Prisma client extension `$extends({ query: { $allOperations } })` para criar child span com `db.statement` sanitizado. O `SET LOCAL ...` carrega tenant UUID em texto → DEVE ser dropado/sanitizado. → D-03, D-04.

## R4 — BullMQ chokepoint único

**Evidência**: `apps/api/src/bullmq/bullmq.service.ts` é o único módulo com `new Queue`/`new Worker` (`createQueue`/`createWorker`). Todos os producers (`audit.service`, `meeting-reminder.service`, `reports.service`, etc.) e o worker passam por ele.

**Conclusão**: instrumentação centralizada (injeção no `.add`, extração no `processor`) cobre toda a app sem tocar cada call-site. → FR-12, §6 do plan.

## R5 — RequestContext (AsyncLocalStorage)

**Evidência**: `apps/api/src/common/context/request-context.ts` expõe `requestContext: AsyncLocalStorage<{ tenantId, userId?, requestId, correlationId }>` e `getRequestContext()` (lança se store ausente).

**Conclusão**: SpanProcessor `onStart` lê o contexto (try/catch defensivo p/ spans fora de request, ex. boot) e aplica `tenant.id`/`user.id`/`correlation_id` em TODOS os spans. → FR-03, FR-06, FR-13, D-05.

## R6 — Next.js 16 instrumentation

**Evidência**: `apps/web/package.json` → `next@^16.2.3`; `next@16.2.3` no store traz `@opentelemetry/api@1.9.1` como peer. `apps/web/instrumentation.ts` NÃO existe ainda.

**Conclusão**: criar `instrumentation.ts` com `register()` (nativo Next 16). Preferir `@vercel/otel` p/ propagação W3C automática no fetch SSR (confirmar disponibilidade na execução). No-op quando sem env. → FR-10, FR-11, D-02.

## R7 — Lição 14-3 (env sem default trava boot)

**Evidência** (MEMORY): env nova sem default travou jobs E2E/Axe e prod na Story 14-3. `env.validation.ts` mostra padrão `z.preprocess(v=>v===''?undefined:v, ...)` para SENTRY_DSN (docker-compose injeta string vazia).

**Conclusão**: todas as OTEL_* opcionais; `OTEL_EXPORTER_OTLP_ENDPOINT` com mesmo preprocess `''→undefined`. → FR-09, D-08.
