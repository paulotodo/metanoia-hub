# Quickstart & Cenários de Teste: SSE Notifications (FR77)

**Feature**: sse-notificacoes · **Story**: 14-2a · **Fase**: plan / Phase 1

Cenários de validação manual + automatizada. Cada um cobre um fluxo crítico com
**Expected** explícito mapeado a Success Criteria / Requisitos.

---

## Pré-condições

- API NestJS rodando (`pnpm dev` em apps/api) com Redis up.
- Story 14-1 mergeada (NotificationsModule + InAppChannel publicando em `rt:notifications:{t}:{u}`).
- Token Keycloak válido para um usuário de tenant A (e outro de tenant B, para isolamento).
- Envs: `SSE_MAX_CONNECTIONS`, `SSE_MAX_PER_USER`, `SSE_HEARTBEAT_INTERVAL_MS` (ou defaults).

---

## Cenário 1 — Conexão SSE autenticada (happy path) — US1, SC-01

1. `curl -N -H "Authorization: Bearer $TOKEN_A" http://localhost:3001/api/v1/sse/notifications`
2. Observar headers da resposta.
3. **Expected**: 200 OK; `Content-Type: text/event-stream`; `Cache-Control: no-cache`;
   stream permanece aberto; `tenant_id`/`user_id` extraídos do token (sem param).

## Cenário 2 — Recusa sem token — US1, FR-11

1. `curl -N http://localhost:3001/api/v1/sse/notifications` (sem Authorization).
2. **Expected**: 401 Unauthorized; envelope `{statusCode,error,message}`; sem stream.

## Cenário 3 — Heartbeat a cada 30s — FR-03, SC-02

1. Conectar (Cenário 1) e capturar o stream por 35s.
2. **Expected**: ≥1 keep-alive `: heartbeat` recebido (ou `MessageEvent` heartbeat ignorável).

## Cenário 4 — Roundtrip End-to-End (chamada REAL, não mock) — US1, SC-05

> Cenário obrigatório de borda: dispara uma notificação REAL e compara o shape do frame SSE
> recebido contra o contrato. Expõe drift `notificationId`↔`id` que mocks mascarariam.

1. Conectar via SSE como user1/tenant A (Cenário 1), manter o stream.
2. Disparar uma notificação real: chamar `NotificationsService.dispatch()` (ou endpoint de
   dispatch) para user1/tenant A com `channels: ['in_app']`. O worker BullMQ processa →
   `InAppChannel` persiste `sent` + `publish` em `rt:notifications:{A}:{user1}`.
3. Capturar o frame SSE recebido.
4. **Expected**: frame `event: notification` com `data` = `{id,type,title,body,createdAt}`;
   `id` === `notificationId` da notificação criada (mapeamento aplicado); `type` ∈ enum;
   `createdAt` ISO 8601. O shape passa `NotificationRealtimeEventSchema` (lado broker) e o
   frame wire usa `id` (não `notificationId`).

## Cenário 5 — Isolamento cross-tenant — US5, NFR-04, SC-06

1. Conectar user1/tenant A e user1/tenant B simultaneamente via SSE.
2. Disparar notificação para tenant A / user1 (como Cenário 4).
3. **Expected**: SOMENTE a conexão de tenant A recebe o frame `notification`; a conexão de
   tenant B **não recebe nenhum evento**. (Teste determinístico, não probabilístico.)

## Cenário 6 — Limite por instância (503) — US2, FR-04, SC-03

1. Configurar `SSE_MAX_CONNECTIONS` baixo (ex.: mock do contador interno) e abrir N+1 conexões.
2. **Expected**: a conexão N+1 recebe 503 com header `Retry-After: 30`; recusada antes de
   ser aceita (sem ZADD, sem subscribe).

## Cenário 7 — Limite por usuário: evicção da mais antiga — US3, FR-06, SC-04

1. Com `SSE_MAX_PER_USER=5`, abrir 5 conexões SSE para o mesmo user1/tenant A.
2. Abrir a 6ª conexão.
3. **Expected**: a 1ª conexão (menor score no ZSET) recebe `event: close` com
   `data: {"reason":"max_connections_exceeded"}` e é encerrada; a 6ª é aceita.
   `ZRANGE sse:connections:{A}:{user1} 0 0` identificou a mais antiga.

## Cenário 8 — Cleanup na desconexão — US4, FR-09, NFR-05, SC-07

1. Conectar (Cenário 1) — `ZCARD sse:connections:{A}:{user1}` = 1.
2. Fechar o cliente (Ctrl-C no curl / fechar aba).
3. **Expected**: em < 1s, `ZCARD sse:connections:{A}:{user1}` = 0; subscription Redis
   encerrada (sem vazamento); contador de instância decrementado.

## Cenário 9 — Redis cai mid-stream (EC-02, blast radius mínimo)

1. Conectar via SSE; derrubar o Redis (ou simular erro no subscriber).
2. **Expected**: apenas as conexões do subscriber perdido recebem `event: error` ANTES do
   fechamento; cada uma é encerrada individualmente; nenhuma subscription vaza. (Em
   single-instance, na prática todas caem, mas a semântica é por subscriber.)

## Cenário 10 — Payload Redis malformado (EC-06)

1. Publicar manualmente JSON malformado em `rt:notifications:{A}:{user1}` (ex.: `redis-cli PUBLISH ... "{not json"`).
2. **Expected**: o servidor loga erro, descarta o evento, e a conexão SSE **permanece ativa**
   (não derruba o cliente). `safeParse` falha → ignora.

## Cenário 11 — Race na conexão mais antiga (EC-04)

1. Forçar concorrência: a "mais antiga" desconecta no mesmo instante em que o limite é excedido.
2. **Expected**: `ZREM` da entrada já removida retorna 0 (sem erro); o servidor tenta a
   próxima mais antiga via novo `ZRANGE`; a nova conexão **nunca** é recusada.

---

## Cobertura de testes automatizados (mapa)

| Cenário | Tipo | Arquivo | SC/Req |
|---------|------|---------|--------|
| 1, 2, 3 | integration | `sse.integration-spec.ts` | SC-01, FR-11, SC-02 |
| 4 | integration (roundtrip real) | `sse.integration-spec.ts` | SC-05 |
| 5 | integration (determinístico) | `sse.integration-spec.ts` | SC-06 |
| 6 | unit + integration | `sse-connection.manager.spec.ts` | SC-03 |
| 7 | unit + integration | `sse-connection.manager.spec.ts` | SC-04 |
| 8 | integration | `sse.integration-spec.ts` | SC-07 |
| 9 | unit | `sse-redis.service.spec.ts` | EC-02 |
| 10 | unit | `sse-redis.service.spec.ts` | EC-06 |
| 11 | unit | `sse-connection.manager.spec.ts` | EC-04 |
| Carga | load (`autocannon`) | `sse.load.ts` (script) | SC-08 (500 conn, heap<512MB, lag p99<100ms) |
