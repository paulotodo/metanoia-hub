# Implementation Plan: Tracing Distribuído com OpenTelemetry (NFR-O5)

**Short name**: `tracing-distribuido-opentelemetry`
**Spec**: `docs/specs/tracing-distribuido-opentelemetry/spec.md`
**Story**: `_bmad-output/implementation-artifacts/16-5-tracing-distribuido-entre-servicos-nfr-o5.md`
**Status**: Draft
**Scope guardrail**: Código + validação local, ZERO produção. NÃO adicionar Jaeger/Tempo/collector ao docker-compose; NÃO migration; NÃO Keycloak; NÃO tocar containers/portas `metanoia-prod-*`. Toda config OTLP de backend fica apenas DOCUMENTADA no runbook.

---

## 0. Decisão arquitetural central (resolve FR-02) — Coexistência Sentry v10 ↔ OTel

### Fato verificado empiricamente no codebase (não suposição)

`@sentry/node@10.47.0` **já embarca toda a árvore OpenTelemetry** como dependência direta e **já cria o único TracerProvider global** no preload `apps/api/src/common/sentry/instrument.ts` (importado em `main.ts:1`). Evidências coletadas no `node_modules` real:

- `@sentry/node` declara como deps diretas: `@opentelemetry/api@^1.9.1`, `@opentelemetry/core`, `@opentelemetry/sdk-trace-base@^2.6.1`, `@opentelemetry/instrumentation-http`, `-ioredis`, `-pg`, `-undici`, `-nestjs-core`, `@opentelemetry/context-async-hooks`, `@opentelemetry/resources`, `@opentelemetry/semantic-conventions`, e o pacote interno `@sentry/opentelemetry@10.47.0`.
- O setup interno do Sentry (`@sentry/node/build/cjs/sdk/initOtel.js`) faz:
  ```
  const provider = new sdkTraceBase.BasicTracerProvider({
    ...,
    spanProcessors: [
      SentrySpanProcessor(),
      ...(options.spanProcessors || []),   // <-- ponto de injeção público
    ],
  });
  client.traceProvider = provider;         // registrado como provider global
  ```
- O `Sentry.init()` aceita a opção pública **`openTelemetrySpanProcessors`** (`sdk/index.js:59` → repassada como `options.spanProcessors`), que **anexa SpanProcessors adicionais ao provider que o Sentry já cria**.
- Pacotes **ausentes** do store pnpm (confirmado): `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/instrumentation-bullmq`.

### Decisão (D-01): Registrar OTLP SpanProcessor no provider do Sentry — NÃO instanciar `@opentelemetry/sdk-node` standalone

Mecanismo escolhido: **anexar nosso `BatchSpanProcessor` (OTLP) à opção `openTelemetrySpanProcessors` do `Sentry.init()` existente**. Consequências:

1. **Um único TracerProvider global** (o `BasicTracerProvider` do Sentry). Nenhum segundo `globalThis` provider, nenhum conflito de `globalThis.OTEL_*`.
2. **Zero duplicação de instrumentação HTTP/Express**: o Sentry já registra `instrumentation-http`/`-express`/`-nestjs-core`/`-ioredis`/`-pg`. Não adicionamos `auto-instrumentations-node` (evita registrar uma 2ª vez as MESMAS instrumentações → spans duplicados; ver SC #6).
3. **No-op trivial**: se `OTEL_EXPORTER_OTLP_ENDPOINT` ausente, simplesmente **não anexamos** o BatchSpanProcessor → o Sentry funciona exatamente como hoje, sem rede OTLP, sem boot afetado.
4. **Dependência nova mínima a instalar**: apenas `@opentelemetry/exporter-trace-otlp-http` (e `@opentelemetry/sdk-trace-base` como dep direta explícita já presente transitivamente, mas declarado para estabilidade de import). NÃO instalar `sdk-node`/`auto-instrumentations-node`.

### Ordem de carga do preload (resolve "tracing.ts antes ou junto do instrument.ts")

A configuração OTLP **vive DENTRO do `instrument.ts`** (não há `tracing.ts` separado carregado antes). Justificativa: o provider é criado pelo `Sentry.init()` — para injetar o SpanProcessor é preciso passá-lo NA chamada `Sentry.init()`. Um `tracing.ts` carregado *antes* tentaria criar um provider concorrente; carregado *depois* perderia a janela de injeção. Portanto:

- `apps/api/src/common/sentry/instrument.ts` passa a montar `openTelemetrySpanProcessors` (vazio em no-op; com OTLP BatchSpanProcessor quando endpoint presente) e configurar `resource`/`sampler`.
- `main.ts:1` permanece `import './common/sentry/instrument';` — **inalterado**. A ordem (preload antes de qualquer outro import) já está correta.
- Helpers de atributo/sanitização/sampler ficam em módulos auxiliares importados por `instrument.ts` (sem efeito colateral de boot): `apps/api/src/common/sentry/otel-resource.ts`, `otel-sampler.ts`, `otel-span-filter.ts`.

> **Nota de divergência face à Story AC#1**: a Story sugere `@opentelemetry/sdk-node` + `auto-instrumentations-node`. O plan **rejeita** essa abordagem por colidir com o Sentry v10 (dupla instrumentação, dois providers). A coexistência via `openTelemetrySpanProcessors` cumpre os mesmos ACs (service.name, child spans HTTP/Prisma/Redis/BullMQ, batch, sampling) SEM o conflito. Esta divergência é deliberada e auditada (dec abaixo); o runbook documenta o porquê.

---

## 1. Arquitetura geral (camadas instrumentadas)

```
Browser
  │  (W3C traceparent gerado no SSR)
  ▼
Next.js SSR (service.name=metanoia-web)         apps/web/instrumentation.ts
  │  fetch() c/ header traceparent  ─────────────┐
  ▼                                              │
NestJS API (service.name=metanoia-api)           │  apps/api/src/common/sentry/instrument.ts
  ├─ root span HTTP (Sentry instrumentation-http)│   + openTelemetrySpanProcessors[OTLP]
  │   attrs: http.*, user.id, tenant.id, correlation_id  (via SpanProcessor onStart)
  ├─ child: Prisma query (PrismaPg)              │   instrumentação manual via $extends
  │   attrs: db.statement SANITIZADO, db.system, tenant.id
  ├─ child: Redis/ioredis (Sentry instrumentation-ioredis)
  ├─ child: HTTP externo Resend/Keycloak (Sentry instrumentation-http/undici)
  └─ dispatch BullMQ → injeta _traceContext{traceparent,tracestate} no job.data
        │
        ▼
BullMQ Worker (mesma API process)               apps/api/src/bullmq/bullmq.service.ts + bullmq-tracing.ts
  └─ extrai _traceContext → linked span (continua trace original)
        attrs: job.name, job.id, job.attemptsMade, queue.name, tenant.id

Exportação: BatchSpanProcessor(512 / 5s) → OTLPTraceExporter(HTTP) → OTEL_EXPORTER_OTLP_ENDPOINT
            OU ConsoleSpanExporter quando OTEL_TRACES_EXPORTER=console
            OU nenhum processor anexado (no-op) quando ambos ausentes
```

### Arquivos novos / modificados

| Arquivo | Ação | Conteúdo |
|---------|------|----------|
| `apps/api/src/common/sentry/instrument.ts` | MOD | monta `openTelemetrySpanProcessors`, `resource`, `sampler` no `Sentry.init()` |
| `apps/api/src/common/sentry/otel-config.ts` | NEW | leitura tipada das env OTEL_* + decisão exporter (otlp\|console\|none) |
| `apps/api/src/common/sentry/otel-resource.ts` | NEW | `resourceFromAttributes` (service.name/version/deployment.environment) |
| `apps/api/src/common/sentry/otel-sampler.ts` | NEW | `ParentBasedSampler(TraceIdRatioBased)` por NODE_ENV + OTEL_TRACES_SAMPLER_ARG |
| `apps/api/src/common/sentry/otel-span-filter.ts` | NEW | filtro de health/`SELECT 1` + enriquecimento de atributos no `onStart` |
| `apps/api/src/common/sentry/context-span-processor.ts` | NEW | SpanProcessor que injeta tenant.id/user.id/correlation_id de `RequestContext` em TODOS os spans |
| `apps/api/src/common/sentry/sanitize-sql.ts` | NEW | sanitização de `db.statement` (valores→`?`) — superfície OWASP |
| `apps/api/src/prisma/prisma-tracing.extension.ts` | NEW | Prisma `$extends` client extension → child span por query c/ db.statement sanitizado |
| `apps/api/src/prisma/prisma.service.ts` | MOD | aplica `.$extends(prismaTracingExtension)` no client |
| `apps/api/src/bullmq/bullmq-tracing.ts` | NEW | `injectTraceContext(jobData)` + `runWithExtractedContext(jobData, fn)` |
| `apps/api/src/bullmq/bullmq.service.ts` | MOD | `createQueue.add` wrap p/ injeção; `createWorker` processor wrap p/ extração |
| `apps/api/src/config/env.validation.ts` | MOD | 4 env OTEL_* opcionais no schema Zod |
| `apps/web/instrumentation.ts` | NEW | Next.js 16 native `register()` — service.name=metanoia-web |
| `apps/web/next.config.ts` | MOD (se preciso) | garantir `instrumentationHook` (nativo no 16; confirmar) |
| `apps/api/package.json` | MOD | +`@opentelemetry/exporter-trace-otlp-http`, +`@opentelemetry/sdk-trace-base` (explicit) |
| `apps/web/package.json` | MOD | +`@opentelemetry/sdk-node`? **NÃO** — usar registro mínimo (ver §5) |
| `docs/specs/tracing-distribuido-opentelemetry/runbook.md` | NEW | runbook operacional (FR-14) |

---

## 2. Modo NO-OP seguro (resolve FR-09 / lição 14-3)

### Schema Zod — `apps/api/src/config/env.validation.ts`

Adicionar ao `envSchema` (todas opcionais, defaults só onde a spec exige; NUNCA `.url()` obrigatório que trave boot — lição 14-3 onde env nova sem default travou jobs E2E/Axe e prod):

```ts
// ── Tracing distribuído (Story 16.5 / NFR-O5) — todas opcionais ───────────
// Ausência de OTEL_EXPORTER_OTLP_ENDPOINT => SDK em no-op (sem rede, sem boot impact).
// docker-compose injeta string vazia p/ vars não-configuradas: preprocess trata ''→undefined.
OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().url().optional(),
),
OTEL_SERVICE_NAME: z.string().min(1).default('metanoia-api'),
OTEL_TRACES_EXPORTER: z
  .enum(['otlp', 'console', 'none'])
  .default('otlp'),
// sampling 0.0–1.0; default resolvido por NODE_ENV (100% dev/test, 10% prod) em otel-sampler.ts
OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).optional(),
```

### Tabela de decisão do exporter (`otel-config.ts`)

| `OTEL_TRACES_EXPORTER` | `OTEL_EXPORTER_OTLP_ENDPOINT` | Resultado |
|---|---|---|
| `console` | (qualquer) | `ConsoleSpanExporter` via `SimpleSpanProcessor` (dev; stdout JSON) |
| `otlp` (default) | presente (url válida) | `OTLPTraceExporter(HTTP)` via `BatchSpanProcessor` (512 / 5s) |
| `otlp` (default) | **ausente** | **NO-OP**: nenhum processor anexado → `openTelemetrySpanProcessors: []` |
| `none` | (qualquer) | **NO-OP** explícito |

Garantia de no-op: quando o resultado é NO-OP, `instrument.ts` chama `Sentry.init()` **sem** `openTelemetrySpanProcessors` adicionais. O Sentry segue funcionando normalmente; nenhuma conexão OTLP é tentada; boot da API ≤5s (SC #2). Nenhum `OTLPTraceExporter` é instanciado (não dispara DNS/socket).

### Defaults exatos (resolve "defina os defaults exatos")

- **Batch**: `maxExportBatchSize: 512`, `scheduledDelayMillis: 5000` (FR-08).
- **Sampling**: `ParentBasedSampler({ root: new TraceIdRatioBasedSampler(rate) })`.
  - `rate = OTEL_TRACES_SAMPLER_ARG` se definido;
  - senão `NODE_ENV ∈ {development,test}` → `1.0`; `production` → `0.1`.
- **Service name**: `OTEL_SERVICE_NAME` (default `metanoia-api`); web hardcoded `metanoia-web`.
- **service.version**: lido de `apps/api/package.json` (`version`), via import estático JSON.
- **deployment.environment**: `process.env.NODE_ENV || 'development'`.

---

## 3. Instrumentação Prisma / PrismaPg + sanitização (resolve FR-04, FR-05, FR-07 — superfície OWASP)

### Por que instrumentação manual via `$extends` (não auto)

`apps/api/src/prisma/prisma.service.ts` usa `new PrismaClient({ adapter: new PrismaPg(...) })` (Prisma v7 driver adapter). A `@opentelemetry/instrumentation-pg` que o Sentry registra cobre o **driver `pg` puro**, mas o adapter `PrismaPg` encapsula o `pg` e pode emitir queries cujo `db.statement` chega **com parâmetros já bindados** OU não cobrir o caminho do adapter de forma confiável. Para garantir (a) cobertura e (b) **sanitização determinística anti-PII**, usamos uma **Prisma client extension (`$extends({ query: { $allOperations } })`)** que cria o child span explicitamente, com controle total do atributo `db.statement`.

### `prisma-tracing.extension.ts` (NEW)

```ts
// Pseudo-contrato (implementação na fase execute-task)
export const prismaTracingExtension = Prisma.defineExtension({
  query: {
    async $allOperations({ model, operation, args, query }) {
      const tracer = trace.getTracer('prisma');
      // FR-07: drop SELECT 1 keep-alive (não cria span)
      // FR-05: db.statement = `${model}.${operation}` (operação lógica),
      //        NUNCA os args com valores. Para raw queries, sanitizar via sanitize-sql.ts.
      return tracer.startActiveSpan(`prisma.${model ?? 'raw'}.${operation}`, async (span) => {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.operation', operation);
        span.setAttribute('db.statement', sanitizedStatement(model, operation)); // sem valores
        applyTenantAttribute(span); // FR-06 (defensivo; context-span-processor já cobre)
        try { return await query(args); }
        catch (e) { recordException(span, e); throw e; }
        finally { span.end(); }
      });
    },
  },
});
```

### `sanitize-sql.ts` (NEW) — superfície que o OWASP gate audita de verdade

Regras de sanitização (FR-05, SC #3):

1. **Operações de modelo** (`user.findMany`, `group.create`, ...): `db.statement` = `"<model>.<operation>"`. **NUNCA** serializar `args` (contêm where/data com PII: emails, nomes, conteúdo pastoral).
2. **Raw queries** (`$queryRaw`/`$executeRaw`): se o texto SQL bruto for capturado, aplicar sanitização: substituir literais string `'...'`, literais numéricos e placeholders `$1,$2` por `?`. Regex conservadora; em caso de dúvida, **omitir** `db.statement` (fail-closed → nunca vaza).
3. **Allowlist de atributos**: spans Prisma carregam SOMENTE `db.system`, `db.operation`, `db.statement` (sanitizado), `tenant.id`, `correlation_id`. **Proibido**: `db.statement.params`, valores de bind, payload de resultado.
4. **Span filter** (`otel-span-filter.ts`): `SELECT 1`, `SELECT version()`, `SET LOCAL app.current_tenant_id` keep-alive/RLS-setup → dropados (não exportados) para reduzir ruído E evitar vazar o tenant_id literal do `SET LOCAL` (que contém o UUID do tenant em texto — manter como `tenant.id` atributo estruturado, não como statement).

> **Nota crítica OWASP (anti-PII real)**: o `SET LOCAL app.current_tenant_id = '<uuid>'` emitido por `with-tenant-tx.ts` carrega o tenant UUID em texto plano. O filtro DEVE dropar esse statement OU substituir o valor por `?`. Isso é parte central da auditoria de segurança.

---

## 4. Atributos por contexto em TODOS os spans (resolve FR-03, FR-06, FR-13)

### `context-span-processor.ts` (NEW) — SpanProcessor `onStart`

Um `SpanProcessor` customizado anexado **também** a `openTelemetrySpanProcessors` (junto do BatchSpanProcessor) cujo `onStart(span)` lê `getRequestContext()` (defensivo: try/catch — fora de request HTTP, ex. boot, o store não existe e NÃO deve lançar) e aplica em **todo span criado dentro do request**:

- `tenant.id` ← `ctx.tenantId` (FR-06: 100% dos spans)
- `user.id` ← `ctx.userId` (quando autenticado; FR-03)
- `correlation_id` ← `ctx.correlationId` (FR-03/FR-13: correlação com logs Pino)

Isso garante FR-06 (tenant_id em raiz, Prisma, Redis, BullMQ, HTTP externo) de forma central, sem instrumentar cada camada manualmente. O `onStart` roda no contexto async do request, então o `AsyncLocalStorage` resolve corretamente para spans filhos.

### Erros em spans (FR-13)

O `AllExceptionsFilter` (`apps/api/src/common/filters/http-exception.filter.ts`) já existe. Na captura, obter `trace.getActiveSpan()` e:
- `span.setStatus({ code: SpanStatusCode.ERROR })`
- `span.recordException(err)` → gera evento com `exception.type`, `exception.message`, `exception.stacktrace`
- `span.setAttribute('correlation_id', ctx.correlationId)` (defensivo; já aplicado pelo context processor)

O Sentry já captura exceptions; aqui apenas garantimos o **status ERROR no span OTel** e o atributo de correlação.

### Health exclusion (FR-07)

`otel-span-filter.ts` dropa spans cujo `http.url`/`http.target` casa `/api/health` (controller `@Controller('api/health')`) ou `/api/v1/admin/health` (controller `@Controller('api/v1/admin/health')`) e subpaths. Implementado como `shouldSample` no sampler (não-amostra → não cria span) OU no `onStart` marcando para drop — preferir **sampler** (mais barato: nem cria o span).

---

## 5. Next.js SSR (resolve FR-10, FR-11)

### `apps/web/instrumentation.ts` (NEW) — Next.js 16 native

Next 16 chama `register()` de `instrumentation.ts` automaticamente (nativo, sem flag experimental). O `next@16.2.3` no store já traz `@opentelemetry/api@1.9.1` como peer. Estratégia **mínima** (sem `@opentelemetry/sdk-node` no web — evita bloat e mantém paridade no-op):

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return; // só server runtime
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT &&
      process.env.OTEL_TRACES_EXPORTER !== 'console') return; // no-op
  const { registerOTel } = await import('@vercel/otel'); // OU sdk-trace-node mínimo
  registerOTel({ serviceName: 'metanoia-web' });
}
```

**Decisão D-02 (web exporter)**: avaliar na fase execute-task entre `@vercel/otel` (wrapper oficial Next, 1 dep, propaga traceparent W3C nativamente no `fetch` SSR) vs. registro manual com `@opentelemetry/sdk-trace-node`. Preferência: `@vercel/otel` (menor superfície, propagação W3C automática no `fetch` do Next SSR → API, que é exatamente FR-10). Confirmar que está no store ou adicionar como única dep web. **No-op garantido**: sem endpoint nem console, `register()` retorna cedo → zero impacto no boot/build do web (lição 14-3: não travar jobs E2E/Axe).

### Propagação traceparent (FR-10)

Com `@vercel/otel`, o `fetch` global do Node no SSR já recebe o `traceparent` W3C via `instrumentation-undici`/`-fetch` que o wrapper registra. O Server Component que faz `fetch(API_URL)` (padrão do projeto: Server Components usam `fetch` nativo) propaga o header automaticamente → API NestJS cria root span como filho do SSR span (trace end-to-end).

### Atributos SSR (FR-11)

`http.url`, `http.method`, `next.route`, `next.rsc` vêm das instrumentações Next nativas. `tenant.id` (quando disponível na sessão SSR) é adicionado via span processor leve no web OU omitido se não houver contexto de tenant no SSR (a maioria do SSR autenticado resolve tenant via cookie/sessão — adicionar best-effort, sem travar).

---

## 6. BullMQ trace propagation (resolve FR-12)

### Chokepoint único confirmado

`apps/api/src/bullmq/bullmq.service.ts` é o **único** ponto onde `Queue`/`Worker` são criados (`createQueue`/`createWorker`). Toda a app passa por aqui. Isso permite instrumentação centralizada sem tocar cada producer/processor.

### `bullmq-tracing.ts` (NEW)

```ts
// injectTraceContext: chamado no dispatch (queue.add) — injeta no job.data
export function injectTraceContext<T extends object>(data: T): T {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier); // W3C: traceparent + tracestate
  return { ...data, _traceContext: {
    traceparent: carrier.traceparent,
    tracestate: carrier.tracestate,
  } };
}

// runWithExtractedContext: chamado no worker processor — continua o trace
export async function runWithExtractedContext<R>(jobData: any, jobMeta: {...}, fn: () => Promise<R>): Promise<R> {
  const tc = jobData?._traceContext;
  const parentCtx = tc
    ? propagation.extract(context.active(), { traceparent: tc.traceparent, tracestate: tc.tracestate })
    : context.active();
  const tracer = trace.getTracer('bullmq');
  return context.with(parentCtx, () =>
    tracer.startActiveSpan(`bullmq.process ${jobMeta.queueName}`,
      { kind: SpanKind.CONSUMER }, async (span) => {
        span.setAttributes({
          'job.name': jobMeta.jobName, 'job.id': jobMeta.jobId,
          'job.attemptsMade': jobMeta.attemptsMade, 'queue.name': jobMeta.queueName,
        });
        try { return await fn(); }
        catch (e) { recordException(span, e); throw e; }
        finally { span.end(); }
      }));
}
```

### Wrap em `bullmq.service.ts` (MOD)

- `createQueue(name)`: retornar uma Queue cujo `.add(name, data, opts)` é envolvido para chamar `injectTraceContext(data)` antes de delegar. Implementar via wrapper de método (Proxy ou subclasse leve) preservando a assinatura.
- `createWorker(name, processor)`: envolver o `processor` recebido em `runWithExtractedContext(job.data, jobMeta, () => processor(job))`.

Atributos do worker (FR-12): `job.name`, `job.id`, `job.attemptsMade`, `queue.name` + `tenant.id` (via context processor se o tenant estiver no `_traceContext` — opcional: propagar tenantId no `_traceContext` também, para o worker reconstruir o RequestContext). **Linked span**: o worker span tem `traceId` == trace de origem e `parentSpanId` != null (SC #5).

---

## 7. Cenários de teste (resolve "cenários de teste" — mapeia Task 7 da Story)

Co-located `*.spec.ts` (Vitest 4.1.2). Para integração de tracing, usar `InMemorySpanExporter` (de `@opentelemetry/sdk-trace-base`, já no store) — captura spans sem rede.

| # | Teste | Tipo | Verifica |
|---|-------|------|----------|
| T1 | Boot no-op: sem env OTEL_*, API sobe e `/api/health`→200 em ≤5s | integration | SC #2, FR-09 |
| T2 | Console exporter: `OTEL_TRACES_EXPORTER=console` → span JSON no stdout | unit | P3, FR-08 |
| T3 | Root span HTTP tem `http.method`, `http.url`, `http.status_code`, `tenant.id`, `user.id`, `correlation_id` | integration (InMemoryExporter) | FR-03 |
| T4 | Prisma child span: `db.statement` sanitizado, **nenhum** valor de parâmetro presente (assert regex sem email/uuid de PII) | unit | FR-05, SC #3 |
| T5 | `SELECT 1` e `SET LOCAL app.current_tenant_id` → **não** geram span exportado | unit | FR-07 |
| T6 | Health `/api/health` e `/api/v1/admin/health` → **não** geram trace | integration | FR-07 |
| T7 | `tenant.id` presente em 100% dos spans da árvore (root+Prisma+Redis+BullMQ) p/ 2 tenants distintos | integration | FR-06, SC #4 |
| T8 | BullMQ linked: dispatch+process → worker span `traceId`==origem, `parentSpanId`!=null | integration | FR-12, SC #5 |
| T9 | Erro: trigger 500 → span `status=ERROR` + `exception.*` events + `correlation_id` | integration | FR-13 |
| T10 | Sampling: rate=0.5, 100 reqs → ~50 traces (±10%) | unit (sampler) | FR-08 |
| T11 | Sentry não duplica: com DSN+OTLP, spans HTTP têm `spanId` únicos (sem auto-instrumentation 2x) | integration | SC #6, FR-02 |
| T12 | SSR propagation (web): `register()` no-op sem env; traceparent presente no fetch quando habilitado | unit (web) | FR-10 |

CI gate (SC #7): `pnpm turbo lint`, `pnpm --filter @metanoia/api test`, `pnpm --filter @metanoia/web test`, `pnpm turbo build` (web E api, + boot `start:e2e`+health — lição 14-3/14-FECHADO: features backend escapam de `--filter api`).

---

## 8. Decisões técnicas (registro)

| ID | Decisão | Justificativa | Alternativa rejeitada |
|----|---------|---------------|----------------------|
| D-01 | OTLP SpanProcessor anexado ao provider do Sentry via `openTelemetrySpanProcessors` | Único provider global; zero dupla instrumentação; no-op trivial; menos deps | `@opentelemetry/sdk-node` standalone (2 providers, spans HTTP duplicados, conflito globalThis) |
| D-02 | Web: `@vercel/otel` (a confirmar) p/ propagação W3C no fetch SSR | Wrapper oficial Next, propaga traceparent nativamente, 1 dep, no-op fácil | sdk-node no web (bloat, risco de travar build/E2E) |
| D-03 | Prisma: instrumentação manual via client `$extends` | Garante cobertura do adapter PrismaPg + controle total do `db.statement` (sanitização) | confiar só em `instrumentation-pg` (pode não cobrir adapter; sem garantia anti-PII) |
| D-04 | `db.statement` = `<model>.<operation>`, nunca args; raw → sanitizado/omitido | Anti-PII fail-closed (SC #3) | serializar args (vaza email/nome/conteúdo pastoral) |
| D-05 | tenant.id/user.id/correlation_id via SpanProcessor `onStart` central | FR-06 em 100% dos spans sem instrumentar cada camada | setar atributo em cada instrumentação (frágil, esquecível) |
| D-06 | Sampler `ParentBasedSampler(TraceIdRatioBased)` 100% dev / 10% prod, override `OTEL_TRACES_SAMPLER_ARG` | FR-08; parent-based mantém trace coeso | sampler fixo (quebra trace parcial) |
| D-07 | Toda config OTLP de backend só no runbook; nada no docker-compose | Escopo "ZERO produção"; não adicionar Jaeger/Tempo/collector | adicionar serviço de collector ao compose (fora de escopo) |
| D-08 | env OTEL_* todas opcionais, sem default obrigatório que trave boot | Lição 14-3 (env sem default travou jobs E2E/Axe e prod) | env obrigatória (quebra boot quando ausente) |

---

## 9. Riscos & mitigação

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| `@vercel/otel` ausente do store → precisa instalar no web | médio | baixo | confirmar na execução; fallback `sdk-trace-node` mínimo; manter no-op |
| Wrap de `Queue.add`/`Worker` quebra assinatura ou tipos | médio | médio | wrapper preservando tipos `bullmq`; testes T8; rodar `pnpm --filter api test` |
| `BasicTracerProvider` do Sentry pode não respeitar nosso sampler global | baixo | médio | sampler aplicado via opção `Sentry.init`/processor; T10 valida taxa; runbook documenta |
| Auto-instrumentation do Sentry já criar spans HTTP que nós também criamos | baixo | médio | NÃO adicionar `auto-instrumentations-node`; T11 valida unicidade de spanId |
| `db.statement` de raw query vazar PII | baixo | alto | fail-closed: omitir quando incerto; OWASP gate audita; T4 |
| `next-env.d.ts` ser commitado por engano | baixo | baixo | NÃO commitar (instrução explícita); `.gitignore` já cobre |

---

## 10. Sequência de implementação (alimenta create-tasks)

1. **Env schema** (`env.validation.ts`) — 4 vars OTEL_* opcionais. Base p/ tudo.
2. **otel-config + resource + sampler + span-filter + sanitize-sql** (módulos auxiliares puros, testáveis isolados: T2, T4, T5, T10).
3. **instrument.ts** — montar `openTelemetrySpanProcessors` + resource + sampler no `Sentry.init()` (no-op quando sem endpoint: T1).
4. **context-span-processor** — tenant/user/correlation em todos os spans (T3, T7).
5. **prisma-tracing.extension + prisma.service `$extends`** (T4, T5).
6. **bullmq-tracing + wrap em bullmq.service** (T8).
7. **AllExceptionsFilter** — status ERROR + correlation_id no span ativo (T9).
8. **apps/web/instrumentation.ts** — SSR W3C (T12).
9. **runbook.md** (FR-14).
10. **Testes** T1–T12 + CI gate (SC #7): turbo lint/build web+api, test api+web, boot start:e2e+health.

