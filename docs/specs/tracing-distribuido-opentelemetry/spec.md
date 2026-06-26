# Feature Spec: Tracing Distribuído com OpenTelemetry (NFR-O5)

**Short name**: `tracing-distribuido-opentelemetry`
**Status**: Draft
**Story source**: `_bmad-output/implementation-artifacts/16-5-tracing-distribuido-entre-servicos-nfr-o5.md`
**Rationale**: Story 16.5 do Epic 16 (Observabilidade NFR); pré-requisito para diagnóstico de performance e falhas em produção num monolito multi-tenant com BullMQ, Prisma/PrismaPg, Redis e SSR Next.js.

---

## Context & Problem

O metanoia-hub não possui rastreabilidade end-to-end entre seus componentes. Quando uma requisição lenta ou falha ocorre, o operador não consegue determinar se o gargalo está no SSR do Next.js, na API NestJS, numa query Prisma, numa operação Redis ou num job BullMQ. A plataforma já coleta logs correlacionados (Epic 1/7, `correlationId` via `RequestContext`) e erros via Sentry, mas carece de traces distribuídos que liguem cada span ao seu contexto de tenant e usuário.

**Restrição crítica**: O Sentry v10 (`@sentry/nestjs` + `@sentry/node` v10.47.0) já instalado é construído sobre OpenTelemetry internamente — instrumenta HTTP e Express automaticamente. Qualquer SDK OTel adicional deve **coordenar com o TracerProvider do Sentry** para não duplicar instrumentação HTTP/Express nem criar conflito de `globalThis.OTEL_*`.

> Decisões de infraestrutura: N/A — feature é stateless (sem scheduling próprio, sem criptografia persistente, sem key rotation). Sampling e flush interval são configurados por variáveis de ambiente.

---

## User Scenarios & Testing

### P1 — Operador diagnostica requisição lenta (happy path)

**Como** desenvolvedor ou Super Admin,
**Quero** ver um trace completo de ponta a ponta de uma requisição HTTP lenta,
**Para que** eu possa identificar em qual camada (SSR → API → Prisma / Redis / BullMQ) está o gargalo sem precisar correlacionar logs manualmente.

**Acceptance scenarios**:
- Dado que a API está instrumentada e o endpoint OTLP está configurado, quando uma requisição HTTP chega à API, então existe um trace com: span raiz (método, URL, status), spans filhos para cada query Prisma (com `db.statement` sanitizado), operações Redis e chamadas HTTP externas (Resend, Keycloak), e o `tenant_id` está presente em todos os spans.
- Dado que o Next.js SSR está instrumentado, quando um Server Component faz `fetch` para a API, então o `traceparent` W3C é propagado e o trace exibe SSR → API como spans conectados.
- Dado que um job BullMQ é despachado durante uma requisição HTTP, quando o worker processa o job, então o span do worker está ligado ao trace original via `_traceContext.traceparent` no campo `data` do job.

**Edge cases**:
- Endpoint de health check (`/api/health`, `/api/v1/admin/health`) — excluído de traces para não gerar ruído.
- Queries `SELECT 1` keep-alive do Prisma — descartadas (dropped spans).
- `OTEL_EXPORTER_OTLP_ENDPOINT` ausente — SDK inicializa em modo no-op sem lançar exceção, boot da API não é afetado.

### P2 — Operador identifica origem de erro em produção

**Como** desenvolvedor ou Super Admin,
**Quero** que erros não tratados produzam spans com status ERROR e detalhes da exceção,
**Para que** eu possa correlacionar o trace com o log de erro usando o `correlation_id` existente.

**Acceptance scenarios**:
- Dado que uma exceção ocorre durante o processamento de uma requisição, quando o span é exportado, então ele tem: status `ERROR`, eventos `exception.type`, `exception.message`, `exception.stacktrace`, e o atributo `correlation_id` do `RequestContext` presente.

### P3 — Operador verifica traces em desenvolvimento sem backend externo

**Como** desenvolvedor,
**Quero** ver traces no stdout durante desenvolvimento local,
**Para que** eu possa validar a instrumentação sem configurar Jaeger/Tempo.

**Acceptance scenarios**:
- Dado que `OTEL_TRACES_EXPORTER=console` está definido, quando a API processa uma requisição, então traces aparecem no stdout no formato JSON legível.
- Dado que `OTEL_TRACES_EXPORTER` está ausente ou é `otlp` mas `OTEL_EXPORTER_OTLP_ENDPOINT` está ausente, então a API inicia sem erro — modo no-op silencioso.

### P4 — Operador reverte ou desabilita tracing sem downtime (runbook)

**Como** operador de produção,
**Quero** um runbook documentado de como monitorar, diagnosticar falhas no SDK OTel e reverter para modo no-op,
**Para que** um incidente no SDK de tracing não comprometa a disponibilidade da plataforma.

**Acceptance scenarios**:
- O runbook descreve: variáveis de ambiente necessárias, como verificar que traces chegam ao backend, como reverter (remover/zerar `OTEL_EXPORTER_OTLP_ENDPOINT`), como verificar coexistência com Sentry.

---

## Requirements

### Functional Requirements

**FR-01 — Inicialização do SDK OTel na API (no-op seguro)**
O SDK OpenTelemetry para NestJS é inicializado **antes** do bootstrap da aplicação (carregado como preload, padrão idêntico ao `instrument.ts` do Sentry). Quando `OTEL_EXPORTER_OTLP_ENDPOINT` está ausente, o SDK opera em modo no-op: nenhuma exceção é lançada, nenhuma rede é acessada, nenhum impacto de performance mensurável no boot.

**FR-02 — Coexistência com Sentry v10 (TracerProvider unificado)**
O Sentry v10 instancia seu próprio `TracerProvider` sobre a API OTel. O SDK OTel adicional deve **usar o provider já registrado pelo Sentry** (via `@sentry/opentelemetry`) em vez de registrar um segundo `globalThis.opentelemetry` provider. Isso evita duplicação de spans HTTP/Express e conflito de contexto. Caso o provider do Sentry não esteja disponível no momento de inicialização, o SDK usa um provider próprio (fallback documentado).

**FR-03 — Atributos obrigatórios em spans raiz**
Cada span raiz de requisição HTTP inclui: `http.method`, `http.url`, `http.status_code`, `user.id` (quando autenticado, do `RequestContext`), `tenant_id` (do `RequestContext`), `correlation_id` (do `RequestContext`, para correlação com logs Pino).

**FR-04 — Spans filhos por camada**
Spans filhos são criados automaticamente para: queries Prisma (via `@prisma/instrumentation` — se auto-instrumentação não cobrir o adapter `PrismaPg`, usar `$extends` manual de cliente Prisma), operações ioredis, jobs BullMQ (dispatch e processamento), chamadas HTTP externas (Resend, Keycloak).

**FR-05 — Sanitização de `db.statement` (anti-PII)**
O atributo `db.statement` em spans Prisma tem os valores de parâmetros substituídos por `?` antes de ser exportado. Nenhum dado do usuário (nomes, e-mails, conteúdo pastoral) aparece em texto plano nos traces.

**FR-06 — `tenant_id` em todos os spans**
O `tenant_id` do `RequestContext` (`AsyncLocalStorage`) é propagado como atributo em **todos** os spans da árvore de uma requisição — incluindo spans filhos de Prisma, Redis, BullMQ e HTTP externo. Isso habilita filtragem por tenant no backend de tracing.

**FR-07 — Exclusão de health checks de traces**
Os endpoints `/api/health` (público) e `/api/v1/admin/health` e subpaths são excluídos de traces via filtro de span. `SELECT 1` keep-alive do Prisma também é descartado.

**FR-08 — Configuração de batch e sampling**
- Batch OTLP: máximo 512 spans por lote, intervalo de flush de 5 segundos.
- Sampling: 100% em `development`/`test`, 10% em `production` — configurável via `OTEL_TRACES_SAMPLER_ARG` (override).
- Exporter: OTLP HTTP quando `OTEL_EXPORTER_OTLP_ENDPOINT` presente; console quando `OTEL_TRACES_EXPORTER=console`; no-op quando nenhuma das duas.

**FR-09 — Variáveis de ambiente OTel (todas opcionais)**
As seguintes variáveis são declaradas no schema Zod de validação de ambiente da API, **todas com `.optional()` e sem `default` obrigatório** (garantia de no-op quando ausentes, lição da Story 14-3):
- `OTEL_EXPORTER_OTLP_ENDPOINT` — URL do coletor OTLP (ausente = no-op).
- `OTEL_SERVICE_NAME` — nome do serviço (default: `"metanoia-api"` quando ausente).
- `OTEL_TRACES_EXPORTER` — `otlp` | `console` | `none` (default: `otlp`).
- `OTEL_TRACES_SAMPLER_ARG` — taxa de sampling 0.0–1.0 (default: por `NODE_ENV`).

**FR-10 — Instrumentação Next.js SSR (W3C traceparent)**
O arquivo `apps/web/instrumentation.ts` (suporte nativo Next.js 16) inicializa o SDK OTel com `service.name: "metanoia-web"`. O `traceparent` W3C é propagado do contexto SSR para chamadas `fetch` à API NestJS via header, criando trace end-to-end Browser → SSR → API.

**FR-11 — Atributos de span SSR**
Spans SSR incluem: `http.url`, `http.method`, `next.route`, `next.rsc` (boolean), `tenant.id` (quando disponível no contexto de sessão).

**FR-12 — Propagação de contexto em jobs BullMQ**
Quando um job é enfileirado durante o processamento de uma requisição HTTP, o contexto de trace W3C (`{ traceparent, tracestate }`) é injetado em `job.data._traceContext`. O worker extrai esse contexto e cria um linked span que continua o trace original. Atributos do worker: `job.name`, `job.id`, `job.attemptsMade`, `queue.name`.

**FR-13 — Registro de erros em spans**
Quando uma exceção não tratada é capturada durante o processamento de um span, o span recebe: `status = ERROR`, evento de span com `exception.type`, `exception.message`, `exception.stacktrace`. O `correlation_id` do `RequestContext` é adicionado como atributo.

**FR-14 — Runbook operacional**
Um runbook é entregue em `docs/specs/tracing-distribuido-opentelemetry/runbook.md` cobrindo: variáveis de ambiente necessárias, verificação de conectividade OTLP, diagnóstico de coexistência Sentry/OTel, procedimento de reversão (modo no-op), e como verificar que traces chegam ao backend (Jaeger/Tempo/qualquer OTLP-compatível).

### Key Entities

| Entidade | Descrição | Origem |
|----------|-----------|--------|
| `Span` | Unidade de trabalho rastreada com atributos, eventos e status | SDK OTel |
| `Trace` | Árvore de spans ligados por `traceId` | SDK OTel |
| `traceparent` | Header W3C Trace Context para propagação cross-service | RFC W3C |
| `_traceContext` | Campo em `job.data` BullMQ que carrega `{ traceparent, tracestate }` | BullMQ integration |
| `RequestContext` | `AsyncLocalStorage` com `tenantId`, `userId`, `correlationId` | Já existente (Epic 1) |

---

## Success Criteria

1. **Trace end-to-end verificável**: uma requisição HTTP ao endpoint de listagem de grupos produz um trace com ≥3 spans (SSR → API → Prisma), rastreável via console exporter ou backend OTLP, sem configuração adicional além de `OTEL_TRACES_EXPORTER=console`.

2. **No-op garantido**: a API inicia com sucesso em ≤5 segundos quando **nenhuma** variável `OTEL_*` está definida — comportamento idêntico ao estado pré-tracing (validado por `curl /api/health` retornando 200 após boot).

3. **Nenhum dado PII em traces**: inspeção manual de 20 spans de queries Prisma confirma que nenhum valor de parâmetro (email, nome, conteúdo) aparece em `db.statement` — apenas `?` como placeholder.

4. **`tenant_id` presente em 100% dos spans**: em ambiente de teste, 10 requisições autenticadas de tenants distintos produzem spans onde `tenant.id` está presente em todos os níveis da árvore (raiz, Prisma, Redis, BullMQ).

5. **BullMQ trace linked**: job despachado durante requisição HTTP produz span worker com `parentSpanId` diferente de null e `traceId` igual ao da requisição origem.

6. **Sentry não duplica spans HTTP**: com Sentry DSN e OTLP endpoint ambos configurados, o Sentry Dashboard não exibe spans duplicados para o mesmo endpoint (verificado por comparação de `spanId` únicos).

7. **CI verde**: `pnpm turbo lint`, `pnpm --filter @metanoia/api test`, `pnpm --filter @metanoia/web test` e `pnpm turbo build` todos passam após a implementação.

---

## Clarifications

> Nenhuma ambiguidade crítica pendente — todas resolvidas com base no contexto do codebase.

- **Coexistência Sentry/OTel**: decidido usar o provider já registrado pelo Sentry v10 (`@sentry/opentelemetry`) em vez de instanciar SDK standalone separado — evita dupla instrumentação HTTP/Express. Documentado em FR-02.
- **PrismaPg adapter**: `@prisma/instrumentation` pode não cobrir o adapter; plan decidirá entre auto-instrumentação + fallback `$extends` — documentado em FR-04.
- **Sampler por environment**: confirmado 100% dev / 10% prod via `OTEL_TRACES_SAMPLER_ARG` para override (FR-08).
- **Health check exclusion**: `/api/health` e `/api/v1/admin/health` confirmados como exclusões via inspeção dos controllers existentes.
