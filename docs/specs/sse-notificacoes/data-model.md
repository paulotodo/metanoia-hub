# Data Model: SSE Endpoint & Redis Pub/Sub Backend (FR77)

**Feature**: sse-notificacoes · **Story**: 14-2a · **Fase**: plan / Phase 1

> **Nota arquitetural**: esta feature é **stateless** — não há entidade Prisma nem
> migration. Todo estado é **efêmero**: vive no Redis (ZSET) e na memória do processo
> NestJS. As "entidades" abaixo descrevem estruturas em runtime, não tabelas de banco.

---

## Entity: ConnectionRegistry (Redis ZSET — global, tenant-scoped)

Rastreia conexões SSE ativas **por usuário**, persistido no Redis (compartilhado entre
instâncias). Chave por usuário; membro = connection ID; score = timestamp de criação.

| Campo | Tipo | Notas |
|-------|------|-------|
| key | string | `sse:connections:{tenantId}:{userId}` (namespace `sse:*`) |
| member | string | connection ID (UUID v7) |
| score | number | timestamp Unix (ms ou s) de criação da conexão |

**Operações (via RedisService de comandos)**:

| Operação | Comando | Quando | Requisito |
|----------|---------|--------|-----------|
| Registrar conexão | `ZADD key {now} {connId}` | ao aceitar conexão | FR-05, FR-12 |
| Contar conexões do usuário | `ZCARD key` | antes de aceitar (checar SSE_MAX_PER_USER) | FR-05 |
| Obter mais antiga | `ZRANGE key 0 0` | ao exceder limite por usuário | FR-06 |
| Remover conexão | `ZREM key {connId}` | desconexão OU evicção da mais antiga | FR-09, FR-06 |

**State transitions**:
```
(absent) --ZADD--> [registered]
[registered] --ZREM (disconnect / heartbeat-timeout)--> (absent)
[registered=oldest] --ZREM (evicted: SSE_MAX_PER_USER exceeded)--> (absent)  // + event:close ao cliente
```

**Edge cases**:
- EC-04 (race): se a "mais antiga" já sumiu, `ZREM` retorna 0 (sem erro) → tentar a
  próxima via novo `ZRANGE`; **nunca** recusar a nova conexão.
- EC-05 (multi-instance): este ZSET é **global** → o limite por usuário vale entre instâncias.
- SC-07: após desconexão, `ZCARD key` DEVE ser 0 (quando era a única conexão).

**Isolamento**: a chave é tenant-scoped (`{tenantId}` do token). Nenhuma operação aceita
`tenantId`/`userId` de input do cliente — sempre de `getRequestContext()`.

---

## Entity: SseConnection (in-memory — por instância, efêmera)

Representa uma conexão SSE viva no processo NestJS atual. Não persistida.

| Campo | Tipo | Notas |
|-------|------|-------|
| connectionId | string (UUID v7) | identidade única da conexão |
| tenantId | string | do token (RequestContext) |
| userId | string | do token (RequestContext) |
| channel | string | `rt:notifications:{tenantId}:{userId}` (canal Redis assinado) |
| createdAt | number | timestamp (espelha o score do ZSET) |
| teardown | function | callback de cleanup (ZREM + unsubscribe + decremento do contador) |

**Ciclo de vida**:
```
open() -> [limite-instância OK? senão 503] -> [evict mais antiga se ZCARD>=MAX_PER_USER]
       -> ZADD -> subscribe(channel) -> stream (notification | heartbeat)
close()/error() -> teardown: ZREM + unsubscribe (se refcount 0) + decrementa contador instância
```

---

## Entity: InstanceConnectionCounter (in-memory — por instância)

Contador local do número de conexões SSE ativas nesta instância NestJS.

| Campo | Tipo | Notas |
|-------|------|-------|
| count | number | conexões ativas nesta instância |
| max | number | `SSE_MAX_CONNECTIONS` (default 1000; 0/inválido → 1000 + warning, EC-07) |

**Regras**:
- Incrementar ANTES de aceitar; se `count >= max` → 503 + `Retry-After: 30` (FR-04, US2);
  a conexão é recusada **antes** de ser aceita (sem ZADD, sem subscribe).
- Decrementar no teardown.
- Reset implícito no restart da instância (estado em memória).

---

## Entity: NotificationRealtimeEvent (contrato Zod — REUSO)

**Já definido** em `packages/types/src/notification.ts` — **não recriar**.

```ts
NotificationRealtimeEventSchema = z.object({
  notificationId: z.string().uuid(),
  type: NotificationTypeSchema,          // pastoral_alert | group_message | content_update | meeting_reminder | system
  title: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
});
```

| Campo (broker payload) | Campo (SSE wire) | Transformação |
|------------------------|------------------|---------------|
| notificationId | id | **rename** (única transformação — ver Convenções de Borda) |
| type | type | identidade |
| title | title | identidade |
| body | body | identidade |
| createdAt | createdAt | identidade |

**Validação**: `safeParse` na entrada (mensagem do Redis). Falha (EC-06) → log + descarta + mantém conexão.

---

## Sem entidades de banco

Nenhuma tabela PostgreSQL, nenhuma migration Prisma, nenhuma policy RLS de banco.
O isolamento multi-tenant nesta feature é por **namespace de canal/chave Redis**
(tenant-scoped), validado por teste determinístico (SC-06), não por RLS.
