# Contract: SSE Notifications Endpoint

**Feature**: sse-notificacoes · **Story**: 14-2a · **Fase**: plan / Phase 1

---

## Endpoint

```
GET /api/v1/sse/notifications
```

| Aspecto | Valor |
|---------|-------|
| Método | GET |
| Auth | Keycloak JWT validado pelo `KeycloakAuthGuard` (global `APP_GUARD`). Guard extrai `tenant_id` + `user_id` do token para `RequestContext`. |
| Transporte do token | `Authorization: Bearer <jwt>` (preferencial) **OU** query param `?token=<jwt>` (fallback obrigatório p/ `EventSource` nativo do browser, que não seta headers). Mecanismo já implementado em `keycloak.guard.ts extractToken` L143-156. |
| Parâmetros de negócio | **NENHUM** — `tenant_id`/`user_id` vêm do token, nunca de query/header/path (FR-01, FR-10). O `?token=` carrega APENAS credencial, nunca `tenant_id`/`user_id`. |
| Content negotiation | servidor força `text/event-stream` |

> **SEGURANÇA — token-in-URL (gate owasp-security, dec-017, A09/CWE-598)**: quando o
> token chega via `?token=`, há risco de vazamento em access logs, proxies e header
> `Referer`. Requisitos de implementação OBRIGATÓRIOS: (1) endpoint só sobre **TLS**;
> (2) **NUNCA** logar `req.url`/`req.query.token`/`Referer` contendo o token (filtrar);
> (3) preferir tokens de **vida curta** (limita janela de exposição). Mitigação parcial
> já existente: não há logging de query string em `common/`/`main.ts` (verificado).

### Response — 200 OK (stream aceito)

Headers:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```
(headers `Content-Type`/`Cache-Control` aplicados automaticamente pelo `@Sse()` do NestJS — FR-02)

### Response — 401 Unauthorized

Sem token, token inválido/expirado (FR-11). Corpo: envelope de erro padrão
`{ statusCode, error, message }` (sem stack trace).

### Response — 503 Service Unavailable

- Instância atingiu `SSE_MAX_CONNECTIONS` (FR-04, US2): header `Retry-After: 30`.
- Redis indisponível no momento da conexão (EC-01): conexão recusada sem tracking; log de erro.

---

## SSE Frames (wire format)

### Frame: heartbeat (keep-alive) — a cada `SSE_HEARTBEAT_INTERVAL_MS` (default 30000ms)

```
: heartbeat

```
Comment SSE (ignorado pelo cliente). Detecta clientes mortos (FR-03, NFR-02, SC-02).
> Nota de implementação: com `@Sse()` o keep-alive pode ser emitido como comment `:` ou
> como `MessageEvent` de `type: 'heartbeat'` que o cliente ignora. O contrato observável
> é "≥1 keep-alive a cada intervalo".

### Frame: notification (push de notificação) — FR-08

```
event: notification
data: {"id":"<uuid>","type":"<NotificationType>","title":"...","body":"...","createdAt":"<ISO8601>"}

```

**Mapeamento de campo** (broker → wire):

| Origem (canal Redis `rt:notifications:{t}:{u}`) | Frame SSE `data:` |
|-------------------------------------------------|-------------------|
| `notificationId` | `id` |
| `type` | `type` |
| `title` | `title` |
| `body` | `body` |
| `createdAt` | `createdAt` |

> **Única transformação de nome** do sistema: `notificationId` (payload publicado pelo
> `InAppChannel`) → `id` (frame SSE). Fonte da verdade do payload de origem:
> `apps/api/src/notifications/channels/in-app.channel.ts`. Coberto por teste de shape
> (impede drift `notificationId`/`id`).

`type` ∈ `{pastoral_alert, group_message, content_update, meeting_reminder, system}`
(validado por `NotificationRealtimeEventSchema`).

### Frame: close (evicção da conexão mais antiga) — FR-06, US3

```
event: close
data: {"reason":"max_connections_exceeded"}

```
Enviado à conexão mais antiga (menor score no ZSET) quando o usuário excede
`SSE_MAX_PER_USER`; após o frame, o servidor encerra essa conexão. A nova conexão é aceita.

### Frame: error (queda de Redis — blast radius mínimo) — EC-02

```
event: error
data: {"reason":"redis_unavailable"}

```
Emitido ANTES de fechar **apenas** as conexões cujo subscriber Redis específico foi
perdido (dec-012). Não vaza subscriptions; cleanup determinístico por conexão.

---

## Eventos consumidos (upstream)

### Canal Redis Pub/Sub assinado: `rt:notifications:{tenantId}:{userId}`

Publicado por `InAppChannel` (Story 14-1). Payload (string JSON):

```json
{
  "notificationId": "<uuid>",
  "type": "<NotificationType>",
  "title": "...",
  "body": "...",
  "createdAt": "<ISO8601>"
}
```

Validação no consumer: `NotificationRealtimeEventSchema.safeParse(JSON.parse(message))`.
- Sucesso → mapeia e emite frame `notification`.
- Falha (EC-06: JSON malformado / shape inválido) → log + descarta evento + mantém conexão viva.

---

## Invariantes de contrato

| # | Invariante | Requisito |
|---|------------|-----------|
| C1 | Nenhum parâmetro do cliente influencia `tenantId`/`userId` (sempre do token) | FR-01, FR-10, US5 |
| C2 | Conexão de tenant B nunca recebe evento de tenant A | NFR-04, SC-06 |
| C3 | Connection ID é UUID v7 e único por conexão | FR-12, Const. II |
| C4 | Desconexão remove o ID do ZSET (`ZCARD`→0 quando última) em < 1s | FR-09, NFR-05, SC-07 |
| C5 | Excesso por instância → 503 + `Retry-After: 30` ANTES de aceitar | FR-04, SC-03 |
| C6 | Excesso por usuário → mais antiga recebe `event: close` e é encerrada | FR-06, SC-04 |
| C7 | Token nunca aparece em logs/Referer mesmo quando via `?token=` (TLS + filtro de log) | dec-017, A09/CWE-598 |
| C8 | `data` recebido do Redis é UNTRUSTED — frontend (14-2b) escapa `title`/`body` antes do DOM | dec-018, CWE-79 |

---

## Envs (contrato de configuração)

| Env | Tipo | Default | Comportamento inválido |
|-----|------|---------|------------------------|
| `SSE_MAX_CONNECTIONS` | int | 1000 | 0/inválido → 1000 + warning startup (EC-07) |
| `SSE_MAX_PER_USER` | int | 5 | — |
| `SSE_HEARTBEAT_INTERVAL_MS` | int | 30000 | — |

Adicionadas ao `envSchema` (Zod) em `apps/api/src/config/env.validation.ts`.
