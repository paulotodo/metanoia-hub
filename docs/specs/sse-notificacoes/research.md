# Research: SSE Endpoint & Redis Pub/Sub Backend (FR77)

**Feature**: sse-notificacoes · **Story**: 14-2a · **Fase**: plan / Phase 0

Resolução de unknowns técnicos. Toda decisão foi validada contra código real do
codebase (`apps/api/src/meetings/sse/`, `notifications/channels/in-app.channel.ts`,
`redis/redis.service.ts`, `packages/types/src/notification.ts`).

---

## Decision 1 — Mecanismo SSE: `@Sse()` decorator + RxJS Observable

**Decision**: Usar o decorator `@Sse()` do NestJS retornando `Observable<MessageEvent>`,
**não** stream manual via `Response.write()`.

**Rationale**: O codebase JÁ tem dois SSE controllers em produção
(`apps/api/src/meetings/sse/meeting-sse.controller.ts` e `attendance-live.controller.ts`)
usando exatamente esse padrão. NestJS `@Sse()` gerencia automaticamente os headers
`Content-Type: text/event-stream` e `Cache-Control: no-cache` (FR-02), a serialização
do frame (`event:`/`data:`) e o teardown do Observable na desconexão do cliente (base
para FR-09/US4). Seguir o padrão estabelecido reduz risco e mantém coerência arquitetural.

**Alternatives considered**:
- *Stream manual (`res.write`)*: dá controle fino sobre o comment `: heartbeat`, mas
  reintroduz boilerplate (headers, flush, cleanup) que o `@Sse()` resolve e desvia do
  padrão do projeto. **Rejeitado**.
- Heartbeat como comment `:` puro exige cuidado: o `@Sse()` serializa `MessageEvent`.
  Solução: emitir o heartbeat como um `MessageEvent` com `type: 'heartbeat'` OU usar
  `{ data: '' }`-comment via interface de baixo nível. Detalhe de implementação coberto
  em D4; o contrato com o cliente é "um keep-alive a cada 30s" (SC-02).

---

## Decision 2 — Conexão ioredis dedicada para subscriber

**Decision**: O `SseRedisService` instancia uma conexão ioredis **separada** dedicada a
`subscribe()`, distinta do `RedisService` de comandos.

**Rationale**: O `RedisService` (`apps/api/src/redis/redis.service.ts`) estende `ioredis`
e é o client de **comandos** (usado por `InAppChannel.publish`, e será usado para
`ZADD/ZREM/ZCARD/ZRANGE`). Em ioredis, uma vez que a conexão entra em **subscriber mode**
(`SUBSCRIBE`), ela só aceita comandos de (un)subscribe — comandos normais (ZADD etc.)
falham. Portanto subscriber e commander DEVEM ser conexões separadas. O precedente
`MeetingSseService` (L21-26) faz exatamente isso: `new Redis({host, port})` dedicado +
`onModuleDestroy → subscriber.quit()`. Reusar host/port do `ConfigService`.

**Alternatives considered**:
- *`RedisService.duplicate()`*: válido e idiomático (ioredis suporta `.duplicate()`).
  Equivalente a `new Redis(...)`; herda config. Aceitável como variante de implementação.
  Tanto `.duplicate()` quanto `new Redis({host,port})` satisfazem o requisito; a tarefa
  de implementação escolherá uma (preferência: `.duplicate()` por herdar config sem
  re-ler env). **Ambas aprovadas**, decisão deixada ao execute-task.
- *Reusar o client de comandos*: **rejeitado** — quebra ZADD/ZREM (subscriber mode).

---

## Decision 3 — Estrutura Redis: ZSET (não SET)

**Decision**: `sse:connections:{tenantId}:{userId}` é um **ZSET** com `score = timestamp
Unix de criação`. Operações: `ZADD` ao conectar, `ZRANGE key 0 0` (menor score = mais
antiga), `ZREM` para remover, `ZCARD` para contar.

**Rationale**: Resolvido no clarify (Q1/dec-011/block-001). Um SET simples não tem
ordenação — identificar "a conexão mais antiga" (FR-06/US3) exigiria estrutura auxiliar e
abriria race conditions. ZSET dá ordenação temporal nativa + atomicidade. `ZREM` de
entrada inexistente retorna 0 sem erro, o que resolve EC-04 (race) de graça.

**Alternatives considered**:
- *SET + chave auxiliar de timestamps*: dois roundtrips, não atômico, race-prone. **Rejeitado**.
- *Lista (LPUSH/LRANGE)*: ordenação por inserção, mas remoção de elemento arbitrário é
  O(N) e sem dedupe. **Rejeitado**.

---

## Decision 4 — Heartbeat: merge de `interval()` no stream de eventos

**Decision**: O stream retornado ao `@Sse()` é o `merge` (RxJS) do Observable de eventos
de notificação com um `interval(SSE_HEARTBEAT_INTERVAL_MS)` que emite um keep-alive.

**Rationale**: FR-03/NFR-02 exigem keep-alive a cada 30s (configurável via
`SSE_HEARTBEAT_INTERVAL_MS`, default 30000). Mesclar um `interval` ao Observable mantém
um único stream gerenciado pelo NestJS, com cleanup unificado no teardown (não vaza timer).
O heartbeat detecta clientes mortos: quando o `res` está fechado, a próxima escrita falha
e o NestJS dispara o teardown → cleanup (FR-09). Sintaxe SSE: o keep-alive ideal é o
comment `: heartbeat\n\n`; com `@Sse()` emite-se um `MessageEvent` com `type: 'heartbeat'`
(o cliente ignora) ou usa-se a forma de comment suportada. O contrato observável é SC-02
(≥1 keep-alive em 35s de captura).

**Alternatives considered**:
- *`setInterval` externo escrevendo no `res`*: contorna o `@Sse()`, gerencia timer à mão,
  risco de vazamento se cleanup falhar. **Rejeitado** em favor de `interval()` mesclado.

---

## Decision 5 — Limite por instância (memória) vs por usuário (Redis)

**Decision**: `SSE_MAX_CONNECTIONS` (default 1000) = contador **em memória local** da
instância NestJS, checado/incrementado ANTES de aceitar a conexão; ao exceder → 503 +
`Retry-After: 30` (FR-04/US2). `SSE_MAX_PER_USER` (default 5) = limite **global** via
`ZCARD` no ZSET; ao exceder, fecha a mais antiga (FR-05/FR-06/US3).

**Rationale**: EC-05 (multi-instance): o limite de conexões por instância é por definição
local (cada processo tem seu próprio teto de memória — NFR-01). O limite por usuário é
global e deve valer entre instâncias → único lugar consistente é o Redis (ZSET). O
contador em memória é decrementado no teardown (cleanup). `SSE_MAX_CONNECTIONS=0`/inválido
→ default 1000 + warning no startup (EC-07), tratado na validação Zod (coerce + refine ou
fallback no `SseConnectionManager`).

**Alternatives considered**:
- *Limite por instância via Redis também*: introduz dependência de Redis para um limite
  que é inerentemente local + custo de roundtrip por conexão. **Rejeitado**.

---

## Decision 6 — EC-02: queda de Redis com blast radius mínimo

**Decision**: Quando o subscriber Redis perde conexão/erro, encerrar **apenas** as
conexões SSE cujo subscriber específico foi perdido — emitir `event: error` ao cliente
ANTES de cada fechamento individual; não vazar subscriptions; cleanup determinístico por
conexão (ZREM + unsubscribe).

**Rationale**: Resolvido no clarify (Q2/dec-012/block-002) — menor blast radius, alinhado
ao Princípio I. Em single-instance MVP, uma queda total do Redis derruba todos os
subscribers (efeito prático = fechar todas), mas a **semântica** do código é granular (por
subscriber), preparando para multi-instance sem mudança de contrato. O `SseRedisService`
escuta `subscriber.on('error')`/`'end'` e propaga um sinal de erro pelos Observables das
conexões afetadas (via `Subject.error` filtrado ou um sinal dedicado), que emite
`event: error` e completa o stream daquela conexão.

**Alternatives considered**:
- *Encerrar todas as conexões da instância*: maior blast radius, viola Princípio I de
  confinamento. **Rejeitado** (clarify dec-012).

---

## Decision 7 — Reuso do contrato Zod (sem recriar)

**Decision**: Reusar `NotificationRealtimeEventSchema` de `packages/types/src/notification.ts`
para validar o payload recebido do canal Redis. **Não** criar schema novo.

**Rationale**: O schema já existe (`{notificationId: uuid, type: enum, title, body,
createdAt: datetime}`) e é exatamente o shape publicado pelo `InAppChannel` (confirmado L40-47).
Recriar violaria o princípio de contrato único compartilhado (Constituição IV). O subscriber
faz `NotificationRealtimeEventSchema.safeParse(JSON.parse(message))`; em falha (EC-06) loga
e descarta. O frame SSE `data:` mapeia `notificationId → id` (única transformação de nome;
ver Convenções de Borda no plan.md).

**Alternatives considered**:
- *Novo schema SSE-específico*: duplicação, risco de drift entre publisher e consumer.
  **Rejeitado**.

---

## Decision 8 — Connection ID via uuidv7()

**Decision**: Cada conexão SSE recebe um connection ID gerado por `uuidv7()` (lib), usado
como membro do ZSET. Proibido `crypto.randomUUID()` e `@default(uuid())`.

**Rationale**: Constituição II (NON-NEGOTIABLE). `uuidv7()` já é usado no codebase
(`apps/api/src/meetings/*.service.ts`). O ID ordenável por tempo é coerente com o score
do ZSET (timestamp), embora a ordenação efetiva venha do score, não do ID.

**Alternatives considered**: `crypto.randomUUID()` — **proibido** pela constitution.

---

## Sem persistência / sem migration

Confirmado: SSE é **stateless**; todo estado é efêmero (ZSET no Redis + contador em
memória). **Nenhuma tabela Prisma, nenhuma migration, nenhuma policy RLS de banco**.
Isolamento cross-tenant é garantido pelo canal/ZSET tenant-scoped + filtro por `tenantId`,
não por RLS de DB. Teste determinístico de isolamento cross-tenant é obrigatório (SC-06).
