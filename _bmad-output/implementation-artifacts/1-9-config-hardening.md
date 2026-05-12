# Story 1.9: Config Hardening (Logger, Sentry, Observability)

Status: ready-for-dev

## Story

As a SRE/dev operando a API em produção,
I want a configuração de logging, Sentry e propagação de request-id alimentada por env vars (não constantes em load time),
so that posso ajustar amostragem por ambiente, evitar vazamento de headers sensíveis nos logs e correlacionar requests end-to-end via cabeçalho de resposta — sem rebuild.

## Acceptance Criteria

**Given** o `LoggerModule.forRoot(pinoLoggerConfig())` em `apps/api/src/app.module.ts:42` é avaliado em load time (chama `pinoLoggerConfig()` antes do `ConfigService` estar disponível, ler `process.env` direto em vez de validado via `EnvConfig`)
**When** esta story é entregue
**Then** `LoggerModule` é registrado via `LoggerModule.forRootAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config: ConfigService<EnvConfig, true>) => pinoLoggerConfig(config) })`
**And** `pinoLoggerConfig` aceita `ConfigService` e lê `NODE_ENV`, `LOG_LEVEL`, `SENTRY_TRACES_SAMPLE_RATE` etc. via `config.get(..., { infer: true })` — não mais `process.env.NODE_ENV === 'production'` literal
**And** o teste existente `apps/api/src/common/logger/__tests__/logger.config.spec.ts` é adaptado para injetar um `ConfigService` mock e continua verde

**Given** `apps/api/src/common/sentry/instrument.ts:7` tem `tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0` hardcoded (impossível desligar tracing em prod sem rebuild, ou subir amostragem para debug ad-hoc)
**When** esta story é entregue
**Then** `tracesSampleRate` lê `SENTRY_TRACES_SAMPLE_RATE` do env (parseFloat) com default `0.2` em production e `1.0` em demais ambientes
**And** valores fora de `[0.0, 1.0]` ou não numéricos fazem fallback para o default + log de warning (não throw — `instrument.ts` roda antes do logger Nest estar pronto, mas pode usar `console.warn`)
**And** `.env.example` ganha a entrada `SENTRY_TRACES_SAMPLE_RATE=1.0` (default dev) na seção Sentry
**And** `apps/api/src/config/env.validation.ts` adiciona `SENTRY_TRACES_SAMPLE_RATE` como optional `z.coerce.number().min(0).max(1).optional()`

**Given** `apps/api/src/common/logger/logger.config.ts:26` redact cobre apenas `req.headers.authorization` — cookies (`req.headers.cookie`, `req.headers["set-cookie"]`), `req.headers["x-api-key"]`, e `res.headers["set-cookie"]` continuam visíveis nos logs estruturados Pino
**When** esta story é entregue
**Then** a config `redact` em `pinoLoggerConfig` cobre TODOS estes paths:
- `req.headers.authorization`
- `req.headers.cookie`
- `req.headers["x-api-key"]`
- `req.headers["x-csrf-token"]`
- `res.headers["set-cookie"]`
**And** o teste `logger.config.spec.ts` cobre cada path novo com `expect(redact).toContain(...)` — uma asserção por header sensível
**And** integration test (novo, `apps/api/src/common/logger/__tests__/logger.redact.integration-spec.ts`) faz request fake com cabeçalhos sensíveis preenchidos e captura logs Pino via stream custom, verificando que o output emitido contém `[Redacted]` (default do Pino) nos paths configurados — não os valores originais

**Given** `RequestContextMiddleware` (`apps/api/src/common/context/request-context.middleware.ts:19`) já gera `requestId` (uuidv7) e popula `requestContext` no AsyncLocalStorage — mas NÃO espelha esse id no header de resposta, então clients não conseguem correlacionar uma resposta com logs server-side
**When** esta story é entregue
**Then** `RequestContextMiddleware` é refatorado para receber `res: Response` (assinatura `use(req, res, next)`) e chamar `res.setHeader('X-Request-Id', requestId)` antes de `requestContext.run(...)` — o header viaja em toda resposta, incluindo erros (`AllExceptionsFilter` já preserva headers setados antes do throw)
**And** se `x-correlation-id` foi fornecido pelo client, o header `X-Correlation-Id` também é espelhado (read-back, mantém o valor sanitizado pela função existente `sanitizeCorrelationId`)
**And** unit test do middleware atualizado: mock de `res.setHeader`, asserção de chamada com `'X-Request-Id'` + valor uuidv7-shaped
**And** integration test fim-a-fim (novo, `apps/api/test/observability/request-id-header.integration-spec.ts`) faz `GET /health` (ou rota pública existente) e verifica `response.headers['x-request-id']` presente + UUID v7 válido

**Given** todas as mudanças são internas (logger, sentry, middleware) — zero impacto em contratos de API externos
**When** esta story é entregue
**Then** `pnpm turbo test build lint` está verde em `apps/api`
**And** suite RLS existente continua verde (mudanças não tocam Prisma nem queries)
**And** smoke test manual: subir API local (`pnpm dev`), fazer request autenticado, confirmar (a) log Pino redact cookies, (b) response header `X-Request-Id`, (c) `SENTRY_TRACES_SAMPLE_RATE=0` desliga sampling

## Tasks / Subtasks

### Task 1 — LoggerModule.forRootAsync com ConfigService (AC1)
- [ ] Refatorar `pinoLoggerConfig` em `apps/api/src/common/logger/logger.config.ts` para aceitar `ConfigService<EnvConfig, true>` como argumento (assinatura nova: `pinoLoggerConfig(config: ConfigService<EnvConfig, true>): Params`)
- [ ] Substituir `process.env.NODE_ENV === 'production'` por `config.get('NODE_ENV', { infer: true }) === 'production'`
- [ ] Em `apps/api/src/app.module.ts:42`, trocar `LoggerModule.forRoot(pinoLoggerConfig())` por `LoggerModule.forRootAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config) => pinoLoggerConfig(config) })`
- [ ] Adaptar `logger.config.spec.ts` para passar `ConfigService` mock (preferir `{ get: vi.fn().mockImplementation((key) => ...) }`)

### Task 2 — SENTRY_TRACES_SAMPLE_RATE env var (AC2)
- [ ] Em `apps/api/src/common/sentry/instrument.ts`, adicionar helper `parseTracesSampleRate(): number` que lê `process.env.SENTRY_TRACES_SAMPLE_RATE`, faz `parseFloat`, valida range `[0, 1]`, faz fallback para default por NODE_ENV (`0.2` prod / `1.0` outros) com `console.warn` em valor inválido
- [ ] Substituir literal hardcoded no `Sentry.init` por `tracesSampleRate: parseTracesSampleRate()`
- [ ] Adicionar `SENTRY_TRACES_SAMPLE_RATE=1.0` em `.env.example` (seção `# --- Sentry ---`)
- [ ] Em `apps/api/src/config/env.validation.ts`, adicionar `SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional()` ao schema `EnvConfig`
- [ ] Unit test cobre: (a) env não setado → default por NODE_ENV; (b) env válido `0.5` → retorna `0.5`; (c) env inválido `"abc"` → fallback + warn; (d) env fora de range `1.5` → fallback + warn

### Task 3 — Redact expandido para cookies/CSRF/API key (AC3)
- [ ] Em `pinoLoggerConfig`, expandir array `redact` para incluir os 5 paths listados na AC3 (mantendo `req.headers.authorization` existente)
- [ ] Atualizar `logger.config.spec.ts`: adicionar uma asserção `expect(redact).toContain(...)` por header sensível
- [ ] Criar `apps/api/src/common/logger/__tests__/logger.redact.integration-spec.ts` — usar `pino` com stream custom (`pino({ ... }, customStream)`) e validar que log JSON tem `[Redacted]` nos paths configurados quando request fake tem headers preenchidos

### Task 4 — X-Request-Id e X-Correlation-Id em response headers (AC4)
- [ ] Em `apps/api/src/common/context/request-context.middleware.ts`, mudar assinatura de `use(req, _res: Response, next)` para `use(req, res: Response, next)`
- [ ] Antes de `requestContext.run(...)`, chamar `res.setHeader('X-Request-Id', requestId)` e `res.setHeader('X-Correlation-Id', correlationId)`
- [ ] Adaptar unit test existente (se houver — caso contrário criar `apps/api/src/common/context/__tests__/request-context.middleware.spec.ts`): mockar `res.setHeader`, asserção `toHaveBeenCalledWith('X-Request-Id', expect.stringMatching(/^[0-9a-f-]{36}$/i))`
- [ ] Criar `apps/api/test/observability/request-id-header.integration-spec.ts` — supertest contra app boot real, GET em rota pública (`/health` ou criar fixture), asserção `response.headers['x-request-id']` definido e em formato UUID v7
- [ ] Verificar que `AllExceptionsFilter` (`apps/api/src/common/filters/http-exception.filter.ts`) NÃO sobrescreve headers já setados (Express preserva headers em throw caminho); se sobrescrever, garantir preservação

### Task 5 — Suite completa + Change Log + PR
- [ ] `pnpm turbo test build lint --filter=@metanoia/api` verde
- [ ] Sanity manual conforme AC5 (smoke local de redact + header + sample rate)
- [ ] Atualizar Change Log da story com summary das 4 mudanças
- [ ] Atualizar `_bmad-output/implementation-artifacts/deferred-work.md`: marcar as 4 entradas tagged `Sprint 8 (Story 1-9 config-hardening)` como ✅ Resolvido (com link para esta story)
- [ ] Atualizar `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-9-config-hardening: ready-for-dev → in-progress → review → done`
- [ ] PR com título `feat(api, story-1-9): config hardening — loggerasync + sentry env + redact expandido + x-request-id` em PT-BR

## Dev Notes

### Por que `forRootAsync` (não `forRoot`) — load order
`LoggerModule.forRoot(pinoLoggerConfig())` em `app.module.ts:42` executa `pinoLoggerConfig()` no MODULE LOAD do Nest, antes do `ConfigService` estar instanciado. Resultado: a config lê `process.env` raw em vez do schema validado por `env.validation.ts`. Em produção um typo em `NODE_ENV` (ex: "Production" com maiúscula) silenciosamente vira pretty-print + debug level. `forRootAsync` injeta `ConfigService` na factory — garantia que toda leitura passa pelo schema Zod.

### Por que `SENTRY_TRACES_SAMPLE_RATE` no `instrument.ts` (não via ConfigService)
`instrument.ts` é importado como **primeiro statement** de `main.ts` (`import './common/sentry/instrument';`) — antes do `NestFactory.create`. ConfigService não existe ainda. Por isso o parsing fica em helper sync que lê `process.env` direto + valida em runtime. Trade-off aceito: duplicação de schema (env.validation.ts + parseTracesSampleRate), mas é a única forma de capturar o valor no boot do Sentry sem reordenar inicialização.

### Por que `redact` em vez de `serializers` customizados
Pino oferece dois mecanismos: `redact` (path-based, substitui valor por `[Redacted]`) e `serializers` (transforma objeto inteiro). Redact é declarativo, suporta wildcards, e é o caminho idiomático para headers sensíveis. Serializers seriam over-engineering para 5 paths.

### Por que adicionar `X-Correlation-Id` também (escopo não pedido literalmente)
A AC4 lista X-Request-Id como item deferido. Mas a middleware já trata correlation-id como conceito separado (uuidv7 fallback se header inbound ausente, sanitizado se presente). Espelhar **ambos** no response é zero custo extra e fecha o loop pra clientes que querem rastrear chains (browser → API → worker). Excluir `X-Correlation-Id` seria assimetria sem ganho.

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro) — esta story NÃO toca multi-tenancy
- IDs: UUID v7 via `uuidv7()` — já em uso no `RequestContextMiddleware` (linha 19)
- Validação: Zod em `packages/types`, ZodValidationPipe custom no NestJS — `env.validation.ts` é o schema canônico para env vars
- API: REST `/api/v1/`, response `{ data, meta? }`, error `{ statusCode, error, message }` — esta story não muda contratos
- Testes: co-located `*.spec.ts`, integration tests em `test/observability/`

### Dependencies
- `nestjs-pino` (já em uso) — `Params` type aceita `pinoHttp.redact` como `string[]` ou `{ paths: string[], censor: string }`
- `@sentry/nestjs` (já em uso)
- `zod` (já em uso) — `z.coerce.number().min(0).max(1)` para parse de env
- Nenhuma nova dependência

### Project Structure Notes
- Logger: `apps/api/src/common/logger/`
- Sentry: `apps/api/src/common/sentry/`
- Context middleware: `apps/api/src/common/context/`
- Env validation: `apps/api/src/config/env.validation.ts`
- Integration tests: `apps/api/test/observability/`

### Fora de escopo (não nesta story)
- Reescrever `AllExceptionsFilter` (já fechado em 7-3)
- Adicionar OpenTelemetry / OTel exporter (Sprint 17 / Epic 12 do roadmap)
- Adicionar log levels custom (`fatal`, `trace`) — Pino já expõe via env `LOG_LEVEL` quando integrado com ConfigService
- Adicionar Sentry breadcrumbs custom (release 1b)

### References
- `_bmad-output/implementation-artifacts/deferred-work.md` — entradas com tag `→ Sprint 8 (Story 1-9 config-hardening)`:
  - LoggerModule.forRoot avaliado em load time (review story 1-5)
  - tracesSampleRate hardcoded (review story 1-5)
  - redact config só cobre authorization header (review story 1-5)
  - Adicionar header X-Request-Id na response do middleware (review story 1-5)
- `_bmad-output/planning-artifacts/sprint-roadmap.md` — Sprint 8 (Release 1a-beta)
- `CLAUDE.md` — section "Critical Rules" (multi-tenancy, IDs, validação Zod)

## Dev Agent Record

### Implementation Plan

_(preencher pelo dev ao iniciar)_

### Completion Notes

_(preencher pelo dev ao concluir)_

### Debug Log

_(preencher pelo dev se houver achados não óbvios)_

## File List

_(preencher pelo dev — NEW/MODIFIED/DELETED por área)_

## Change Log

| Date | Change |
|------|--------|
| 2026-05-11 | Story criada como ready-for-dev. Absorve 4 itens do deferred-work.md (review story 1-5, todos 2026-04-09) em uma única entrega de hardening de config/observabilidade. |
