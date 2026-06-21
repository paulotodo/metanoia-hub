# Data Model: Notificações por Email via Resend

**Feature**: `notificacoes-email` | **Date**: 2026-06-21 | **Phase 1**

Esta feature estende entidades existentes (Story 14-1) e adiciona estado
efêmero em Redis. NÃO há nova tabela de domínio persistida em Postgres além
da extensão do enum.

---

## Entity: Notification (existente — estendida)

Tabela `notifications` (criada na Story 14-1). Esta feature **estende o enum**
`notification_type` e usa os campos existentes; nenhuma coluna nova.

| Campo | Tipo (DB) | Notas |
|-------|-----------|-------|
| `id` | `uuid` (v7) | `uuidv7()` no app — NUNCA `@default(uuid())` (Constitution II) |
| `tenant_id` | `uuid` | RLS obrigatório; resolvido via RequestContext (Constitution I) |
| `user_id` | `uuid` | destinatário |
| `type` | `notification_type` enum | **estendido**: + `export_ready`, `content_new` |
| `channel` | `notification_channel` enum | `in_app` \| `email` (sem mudança) |
| `status` | `notification_status` enum | `pending` → `sent` \| `failed` \| `read` |
| `title` | `text` | user-facing PT-BR |
| `body` | `text` | user-facing PT-BR |
| `metadata` | `jsonb` | livre: `failureReason`, `actionUrl`, `signedUrl`, `deferredUntil` |
| `read_at` | `timestamptz null` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### Enum `notification_type` — transição

**Antes (14-1)**: `pastoral_alert`, `group_message`, `content_update`,
`meeting_reminder`, `system`.

**Depois (14-3)**: + `export_ready`, + `content_new` (aditivo, via
`ALTER TYPE ... ADD VALUE`). `content_update` permanece (clarify Q2).

### Classificação por criticidade (rate-limit FR-10)

| Tipo | Crítico? | Comportamento em ≥ threshold |
|------|----------|------------------------------|
| `pastoral_alert` | sim | sempre envia |
| `export_ready` | sim | sempre envia |
| `system` | sim | sempre envia |
| `meeting_reminder` | não | difere email + **fallback in-app imediato** (SC-02) |
| `content_new` | não | difere para o próximo dia |
| `content_update` | não | difere para o próximo dia |
| `group_message` | não | difere para o próximo dia |

### State transitions (status)

```
pending ──(email enviado OK)──────────────► sent
pending ──(3 retries esgotados)───────────► failed ──┐
                                                      └─► cria fallback in_app (FR-06)
                                                          metadata.failureReason set (FR-07)
pending ──(rate-limited, deferível)───────► (re-enqueue próximo dia; status segue pending)
pending ──(circuit open)──────────────────► fallback in_app imediato (email não tentado, FR-12)
sent/failed ──(usuário lê)────────────────► read
```

### Metadata (jsonb) — chaves usadas por esta feature

| Chave | Quando | Exemplo |
|-------|--------|---------|
| `failureReason` | após esgotar retries (FR-07/FR-18) | `"Resend 503 Service Unavailable"` ou `"timeout after 10s"` |
| `actionUrl` | link de ação na notificação | `"/app/pastoral/radar?participant=..."` |
| `signedUrl` | export_ready (link 1h) | URL assinada MinIO, validade 3600s |
| `deferredUntil` | rate-limited deferível | ISO 8601 do próximo dia |
| `fallbackOf` | fallback in-app de um email falho | `notificationId` do email original |

---

## Entity: EmailRateCounter (novo — estado Redis, não persistido em DB)

| Atributo | Valor |
|----------|-------|
| Chave | `rate:email:{tenantId}:{YYYYMMDD}` (namespace `rate:*`, Constitution Arch) |
| Valor | inteiro (contador de emails enviados no dia) |
| Operação | `INCR` atômico dentro do Lua script (FR-11) |
| TTL | `EXPIREAT epoch_proxima_meia_noite_utc` (clarify Q4 — não TTL fixo 86400) |
| Chave auxiliar | `rate:email:{tenantId}:{YYYYMMDD}:alerted` — flag SET NX (admin alert 1×/dia) |

`{YYYYMMDD}` em UTC. Limite (`EMAIL_DAILY_LIMIT=100`) e threshold
(`EMAIL_RATE_THRESHOLD=80`) passados como ARGV ao Lua (configuráveis via env).

---

## Entity: CircuitBreakerState (novo — estado Redis gerenciado via porta)

| Atributo | Valor |
|----------|-------|
| Chave | `rate:email:circuit:{tenantId}` (hash) — ou global, ver Structure Decision |
| `state` | `closed` (operando) \| `open` (contingência) |
| `firstFailureAt` | timestamp ISO da 1ª falha contínua (detecta janela > 5min, FR-12) |
| `consecutiveHealthy` | contador de health-checks saudáveis (fecha em 3, FR-14) |
| `openedAt` | timestamp da abertura (auditoria + evento de domínio) |

Transições:
```
closed ──(falha contínua > 5 min)──► open  [emite notifications.email.circuit-open]
open   ──(3 health-checks OK)──────► closed [retoma envio p/ NOVAS notificações]
open   ──(notificações novas)──────► fallback in_app imediato (FR-12)
```
FR-15: diferidos durante `open` NÃO são reenviados ao fechar.

---

## Domain Event: notifications.email.circuit-open (FR-13)

Formato canônico (Constitution IV):

```json
{
  "eventId": "<uuidv7>",
  "eventType": "notifications.email.circuit-open",
  "version": 1,
  "tenantId": "<uuid>",
  "timestamp": "<ISO 8601>",
  "data": { "openedAt": "<ISO>", "reason": "email provider outage > 5min" },
  "metadata": { "correlationId": "<id>" }
}
```

---

## RLS / Multi-tenancy (Constitution I — NON-NEGOTIABLE)

- Toda leitura/escrita de `notifications` via `withTenantTx` (`SET LOCAL
  app.current_tenant_id`); `tenant_id` SEMPRE de `RequestContext`, nunca
  parâmetro. O worker já reconstrói `RequestContext` do payload do job.
- Chaves Redis de rate/circuit são namespaced por `{tenantId}` — isolamento
  lógico de contador por tenant (sem cross-tenant leak no contador).
- Migration que toca `notifications` (enum) NÃO altera policy de RLS, mas o
  teste RLS isolation roda 2× no CI (Constitution VI + memória do projeto).
