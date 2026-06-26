# Runbook — Tracing Distribuído OpenTelemetry (NFR-O5)

**Escopo**: operação do tracing OTel em **desenvolvimento/staging**. Em produção (este VPS), tracing fica **desabilitado por padrão** (no-op) — ativação é decisão operacional manual, NUNCA via deploy automático. Este runbook NÃO altera containers `metanoia-prod-*`.

> **Princípio de segurança operacional**: um incidente no SDK de tracing JAMAIS pode comprometer a disponibilidade. Todo o tracing é no-op quando `OTEL_EXPORTER_OTLP_ENDPOINT` está ausente. Reverter = remover/zerar essa env.

---

## 1. Variáveis de ambiente (todas opcionais)

| Var | Default | Efeito |
|-----|---------|--------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (ausente) | URL do coletor OTLP/HTTP (ex: `http://localhost:4318`). **Ausente = no-op total** (sem rede). |
| `OTEL_SERVICE_NAME` | `metanoia-api` | nome do serviço da API nos traces |
| `OTEL_TRACES_EXPORTER` | `otlp` | `otlp` \| `console` \| `none`. `console`=stdout (dev); `none`=desliga |
| `OTEL_TRACES_SAMPLER_ARG` | (por NODE_ENV) | taxa 0.0–1.0. Default: 1.0 em dev/test, 0.1 em prod |

**Matriz de comportamento**:

| EXPORTER | ENDPOINT | Resultado |
|----------|----------|-----------|
| `console` | — | traces no stdout (JSON). Dev local sem backend. |
| `otlp` | presente | exporta p/ coletor (batch 512 / flush 5s) |
| `otlp` | **ausente** | **no-op** — boot normal, nenhuma conexão |
| `none` | qualquer | **no-op** explícito |

---

## 2. Verificar tracing em desenvolvimento (sem backend externo)

```bash
# 1. Console exporter — não precisa de Jaeger/Tempo
OTEL_TRACES_EXPORTER=console pnpm --filter @metanoia/api dev

# 2. Faça uma requisição autenticada (ex: listar grupos)
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/groups

# 3. Observe no stdout da API: spans JSON com
#    - name: span raiz HTTP
#    - attributes: http.method, http.url, http.status_code, tenant.id, user.id, correlation_id
#    - child spans: prisma.<model>.<op> (db.statement SANITIZADO), ioredis, bullmq.process
```

**Trace end-to-end (SSR → API)**: rodar web também com `OTEL_TRACES_EXPORTER=console` e abrir uma página autenticada que faça SSR fetch → confirmar o mesmo `traceId` aparecendo no web (service.name=metanoia-web) e na API (metanoia-api).

---

## 3. Verificar conectividade OTLP (com backend)

Backend OTLP de teste (executar SOMENTE em ambiente de dev local do operador — **NÃO** adicionar ao docker-compose do projeto):

```bash
# Exemplo: Jaeger all-in-one local (porta OTLP/HTTP 4318) — ad-hoc, fora do compose do repo
docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest

# Apontar a API:
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
OTEL_TRACES_EXPORTER=otlp \
pnpm --filter @metanoia/api dev

# Gerar tráfego, depois abrir Jaeger UI:
open http://localhost:16686   # service "metanoia-api" deve listar traces
```

Checklist de conectividade:
- API loga "OTLP exporter configured" (ou equivalente) no boot quando endpoint presente.
- Após 5s (flush interval) os spans aparecem no backend.
- Sem erros de rede repetidos no log da API (se o endpoint estiver errado, o BatchSpanProcessor loga falha de export mas **não** derruba a API).

---

## 4. Diagnóstico de coexistência Sentry ↔ OTel

A API usa **um único TracerProvider** (o que o Sentry v10 cria). O OTLP exporter é anexado via `openTelemetrySpanProcessors` no `Sentry.init()` (`apps/api/src/common/sentry/instrument.ts`).

**Verificar que não há spans HTTP duplicados**:
- No backend OTLP, uma requisição HTTP deve produzir **um** span raiz HTTP (não dois).
- Se aparecerem duplicados: alguém adicionou `@opentelemetry/sdk-node`/`auto-instrumentations-node` — REMOVER (re-registra as mesmas instrumentações que o Sentry já tem). Ver `plan.md` §0/D-01.

**Verificar que Sentry continua funcionando**:
- Com `SENTRY_DSN` setado, erros ainda chegam ao Sentry Dashboard normalmente.
- OTel e Sentry compartilham o mesmo provider → mesmo `traceId`.

---

## 5. Procedimento de reversão (no-op) — SEM downtime

Para desabilitar tracing imediatamente, em ordem de menor a maior impacto:

1. **Reversão suave (recomendada)**: remover/zerar `OTEL_EXPORTER_OTLP_ENDPOINT`.
   ```bash
   unset OTEL_EXPORTER_OTLP_ENDPOINT   # ou OTEL_EXPORTER_OTLP_ENDPOINT=
   ```
   Efeito: SDK em no-op, nenhum span exportado, Sentry intacto. **Não requer rebuild** — só restart do processo da API.

2. **Reversão explícita**: `OTEL_TRACES_EXPORTER=none`.

3. **Reduzir volume** (em vez de desligar): baixar sampling.
   ```bash
   OTEL_TRACES_SAMPLER_ARG=0.01   # 1% das requisições
   ```

> Em produção (este VPS): NUNCA setar `OTEL_EXPORTER_OTLP_ENDPOINT` sem antes ter um coletor saudável e validado. O default em prod já é no-op.

---

## 6. PII / segurança nos traces (auditável)

- `db.statement` em spans Prisma é **sempre** `<model>.<operation>` (sem valores) ou SQL bruto sanitizado (valores → `?`). Nunca emails/nomes/conteúdo pastoral.
- `SET LOCAL app.current_tenant_id = '<uuid>'` (RLS setup) é **dropado** dos spans — o tenant aparece apenas como atributo estruturado `tenant.id`.
- Health checks (`/api/health`, `/api/v1/admin/health`) e `SELECT 1` keep-alive são excluídos de traces.
- Atributos permitidos em spans: `http.*`, `db.system`, `db.operation`, `db.statement` (sanitizado), `tenant.id`, `user.id`, `correlation_id`, `job.*`, `queue.name`, `next.*`. Qualquer outro atributo carregando valor de usuário é violação.

---

---

## 8. Comportamento de falha do exporter OTLP em runtime (CHK036)

O `BatchSpanProcessor` do OTel opera com **drop silencioso** quando a fila interna atinge o limite:

- `maxQueueSize`: **2048** (default OTel — não customizado, comportamento padrão)
- `maxExportBatchSize`: 512 (configurado em `instrument.ts`)
- `scheduledDelayMillis`: 5 000 ms (flush a cada 5s)

**Comportamento de overflow**: quando a fila atinge 2048 spans pendentes, novos spans são **descartados silenciosamente**. Isso é comportamento fail-safe intencional — a aplicação nunca bloqueia/falha por causa de backpressão do tracing.

**Quando isso ocorre**: exporter OTLP falhando repetidamente (endpoint inalcançável, timeout de rede) + alto volume de tráfego → spans acumulam na fila. Após ~2048 spans, drops começam.

**Como detectar**: no backend OTLP (Jaeger/Tempo), observe gaps em traces ou spanCount total menor que expected_rps × sampler_rate × 5s. O `BatchSpanProcessor` pode logar warnings de export failure (`OTLP export failed`), mas não gera exceção na aplicação.

**Ação recomendada** em produção: monitorar métrica `otel.exporter.otlp.dropped_spans` no backend OTLP, se disponível. Alternativa: usar `OTEL_TRACES_SAMPLER_ARG=0.01` para reduzir volume de spans durante incidente de conectividade.

> Este comportamento é documentado na decisão CHK054 (state.json) e no plan.md §2 (Decision: "overflow = drop silencioso — fail-safe").


## 7. Troubleshooting rápido

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| API não sobe após mudança | env OTEL_* obrigatória adicionada por engano | confirmar que todas são `.optional()` em `env.validation.ts` |
| Boot lento (>5s) | OTLP exporter tentando conectar endpoint inválido no boot | endpoint deve ser lazy; verificar que no-op não instancia exporter |
| Spans HTTP duplicados | `auto-instrumentations-node`/`sdk-node` adicionado | remover; usar só o provider do Sentry |
| Sem traces no backend | endpoint errado / firewall / sampling 0 | checar `OTEL_EXPORTER_OTLP_ENDPOINT`, sampler arg, log de export |
| PII em `db.statement` | sanitização falhou p/ raw query | sanitize-sql deve fail-closed (omitir); abrir bug |
| traceparent não propaga SSR→API | web register() em no-op ou fetch sem header | habilitar OTEL no web; confirmar `@vercel/otel`/register |
