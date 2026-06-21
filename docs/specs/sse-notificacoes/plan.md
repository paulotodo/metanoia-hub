# Plano de Implementação: SSE Endpoint & Redis Pub/Sub Backend (FR77)

**Feature**: sse-notificacoes
**Story**: 14-2a (Epic 14 — Notificações em Tempo Real)
**Spec**: `docs/specs/sse-notificacoes/spec.md`
**Versão**: 1.0.0
**Data**: 2026-06-20
**Pipeline**: feature-00c SDD (etapa plan)

---

## Summary

Implementar o **consumidor SSE** que fecha o ciclo de notificações em tempo real
iniciado na Story 14-1. O endpoint `GET /api/v1/sse/notifications` assina o canal
Redis Pub/Sub `rt:notifications:{tenantId}:{userId}` (publicado pelo `InAppChannel`)
e faz push das notificações ao navegador via Server-Sent Events, sem polling.

**Abordagem técnica**: SSE é um **adapter de entrega DENTRO do `NotificationsModule`**
(decisão dec-008 — não criar bounded-context novo). A implementação **estende o padrão
SSE já consolidado no codebase** em `apps/api/src/meetings/sse/` (decorator `@Sse()` +
RxJS `Observable<MessageEvent>` + conexão ioredis dedicada para subscriber mode +
refcount por canal), adicionando o que falta para 14-2a: heartbeat configurável,
tracking de conexões via **Redis ZSET** com limites por usuário e por instância, e
tratamento de queda de Redis com blast radius mínimo (EC-02).

---

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript (strict) — NestJS 11.1.17 |
| Runtime | Node.js (apps/api) |
| Framework SSE | `@Sse()` decorator + RxJS `Observable<MessageEvent>` (padrão herdado de `meetings/sse`) |
| Pub/Sub | `ioredis` — conexão dedicada em modo subscriber (separada do client de comandos) |
| Connection tracking | Redis ZSET `sse:connections:{tenantId}:{userId}` (score = timestamp Unix) |
| Auth | Keycloak guard (`apps/api/src/auth/keycloak.guard.ts`) → claims em `RequestContext` (AsyncLocalStorage) |
| Contratos | Zod 4 em `packages/types` — **`NotificationRealtimeEventSchema` JÁ EXISTE** (reuso) |
| ID generation | `uuidv7()` (lib) — proibido `crypto.randomUUID()` / `@default(uuid())` |
| Persistência | **Nenhuma** — SSE é stateless; estado efêmero só em Redis. Sem migration Prisma. |
| Testing | Vitest 4.1.2 (unit `*.spec.ts`, integration `*.integration-spec.ts`), load (`autocannon`) |
| Config | `apps/api/src/config/env.validation.ts` (Zod `envSchema`) — 3 envs novas |

**NEEDS CLARIFICATION restantes**: 0 (Q1/Q2/Q3 resolvidas no clarify; envs e payload confirmados contra código real).

---

## Constitution Check

*GATE: passou antes do Phase 0. Re-checado após Phase 1 (idêntico — design não introduziu violação).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS | `tenant_id`/`user_id` vêm do token via `getRequestContext()`, nunca de parâmetro/query. Canal e ZSET são tenant-scoped. Isolamento cross-tenant garantido pelo namespace do canal + filtro RxJS por `tenantId`. **Sem tabela DB → sem RLS de banco aqui**, mas teste determinístico de isolamento cross-tenant é OBRIGATÓRIO (SC-06). |
| II. Type-Safety & IDs Determinísticos (NON-NEGOTIABLE) | PASS | `strict: true`. Connection ID via `uuidv7()`. Datas ISO 8601 (`createdAt`). Payload validado por Zod (`NotificationRealtimeEventSchema`). |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs/comentários em inglês. `reason: "max_connections_exceeded"` é payload técnico (não user-facing). Sem strings PT-BR no backend SSE. |
| IV. Contratos de API Padronizados | PASS | `/api/v1/` prefix. Contrato Zod compartilhado em `packages/types` (reuso de `NotificationRealtimeEventSchema`). SSE é um stream (não envelope `{data,meta}`) — exceção legítima para `text/event-stream`, alinhada ao precedente `meetings/sse`. |
| V. Separação de Estado no Frontend | N/A | Esta feature é backend-only (14-2a). O consumo no cliente é Story 14-2b. |
| VI. Qualidade Verificável | PASS | Unit + integration + load tests planejados. Sem migration de RLS → sem RLS spec de DB, mas isolamento cross-tenant coberto por teste determinístico. CI verde antes de `done`. |
| VII. Processo de Entrega | PASS | Branch `feat/`, conventional commits PT-BR, PR para dev, CI gate. |

**Resultado**: PASS — nenhuma violação MUST. Complexity Tracking não aplicável.

---

## Phase 0 — Research

Consolidado em `research.md`. Decisões-chave:

- **D1**: `@Sse()` decorator + RxJS Observable (não stream manual `res.write`) — alinha ao precedente `meetings/sse`.
- **D2**: Conexão ioredis **dedicada** para subscriber (o `RedisService` de comandos não pode entrar em subscriber mode).
- **D3**: ZSET (não SET) para ordenação temporal nativa — clarify Q1/dec-011.
- **D4**: Heartbeat via `interval()` RxJS mesclado ao stream de eventos (`merge`).
- **D5**: Limite por instância = contador em memória local; limite por usuário = ZSET global.
- **D6**: EC-02 blast radius mínimo (clarify Q2/dec-012) — fechar só conexões do subscriber perdido.

---

## Phase 1 — Design

- **Modelo de dados**: `data-model.md` — sem entidade Prisma; entidades efêmeras (ConnectionRegistry no Redis ZSET, SseConnection in-memory).
- **Contratos**: `contracts/sse-notifications.md` — endpoint, headers, frames SSE, eventos.
- **Quickstart / cenários**: `quickstart.md` — happy path + roundtrip end-to-end real + error cases.

---

## Project Structure

### Documentação (feature dir)

```
docs/specs/sse-notificacoes/
  spec.md
  plan.md            (este arquivo)
  research.md
  data-model.md
  contracts/
    sse-notifications.md
  quickstart.md
```

### Código-fonte (árvore real — apps/api)

```
apps/api/src/
  notifications/                         (módulo existente — Story 14-1)
    notifications.module.ts              [EDIT] registrar SSE providers + controller
    sse/                                 [NEW]
      sse.controller.ts                  GET /api/v1/sse/notifications (@Sse())
      sse-connection.manager.ts          ZSET tracking + limites instância/usuário
      sse-redis.service.ts               conexão ioredis dedicada + subscribe/unsubscribe
      sse.controller.spec.ts             unit
      sse-connection.manager.spec.ts     unit
      sse-redis.service.spec.ts          unit
      sse.integration-spec.ts            integration (dispatch→SSE, cross-tenant, heartbeat)
  config/
    env.validation.ts                    [EDIT] SSE_MAX_CONNECTIONS / SSE_MAX_PER_USER / SSE_HEARTBEAT_INTERVAL_MS
  redis/redis.service.ts                 (reuso — client de comandos para ZADD/ZREM/ZCARD/ZRANGE)
  meetings/sse/                          (REFERÊNCIA de padrão — não editar)

packages/types/src/
  notification.ts                        (reuso — NotificationRealtimeEventSchema já existe)
```

**Padrão de reuso confirmado** (`apps/api/src/meetings/sse/meeting-sse.service.ts`):
conexão `new Redis({host,port})` dedicada; `subscriber.on('message', ...)` → `Subject`;
`Observable` com cleanup no teardown; refcount por canal (`channelSubscriberCount` Map).
A 14-2a estende esse padrão; **não** reimplementa do zero.

---

## Convenções de Borda

Feature backend-only com fronteira **broker (Redis Pub/Sub) ↔ consumer (SSE) ↔ wire (text/event-stream)**.

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| Redis channel name | `rt:notifications:{tenantId}:{userId}` (lower) | construído server-side a partir do token | `in-app.channel.ts` (publisher) — espelhado no subscriber |
| Redis ZSET key | `sse:connections:{tenantId}:{userId}` (lower) | construído server-side | `sse-connection.manager.ts` |
| Payload publicado (Redis) | camelCase | `JSON.stringify({notificationId,type,title,body,createdAt})` | `in-app.channel.ts` L40-47 |
| Contrato Zod do payload | camelCase | `NotificationRealtimeEventSchema.parse()` no subscriber | `packages/types/src/notification.ts` |
| SSE `data:` frame (wire) | camelCase | shape `{id,type,title,body,createdAt}` | `contracts/sse-notifications.md` |

**Mapper layer (broker payload → SSE wire)**: existe UM ponto de mapeamento explícito.
O payload publicado usa a chave **`notificationId`**; a spec descreve o frame SSE como
**`{id,...}`**. **Fonte da verdade**: o publisher (`in-app.channel.ts`) emite `notificationId`.
O `sse.controller`/`sse-redis.service` faz o mapeamento `notificationId → id` ao montar o
frame `data:`, documentado em `contracts/sse-notifications.md §Mapeamento de campo`. Esse
mapeamento é a ÚNICA transformação de nome e DEVE ser coberto por teste de shape (evita o
drift `notificationId`/`id` que passaria silencioso se ambos os lados usassem mocks).

**Validação Zod**: na borda de **entrada** (mensagem recebida do Redis) — `safeParse`;
em caso de erro (EC-06: JSON malformado), logar + descartar evento + manter conexão viva.

---

## Security Requirements (gate owasp-security — plan stage)

Findings do gate `owasp-security` (OWASP Top 10:2025 / ASVS 5.0 / API Security), todos
evidence-grounded contra código real. **Nenhum crítico/alto** — viram requisitos de
implementação para `/create-tasks`:

| # | Sev | Finding | Requisito de implementação | Decisão |
|---|-----|---------|----------------------------|---------|
| SR-1 | MEDIUM | Token via `?token=` (SSE/EventSource) trafega na URL (A09/CWE-598) | TLS obrigatório; NUNCA logar `req.url`/`query.token`/`Referer` com token; tokens de vida curta | dec-017 |
| SR-2 | MEDIUM | `title`/`body` do payload chegam ao DOM em 14-2b — stored XSS (CWE-79) | Marcar `data` como UNTRUSTED no contrato; frontend (14-2b) escapa antes do DOM; backend já faz `safeParse` (EC-06) | dec-018 |
| SR-3 | LOW | Limites cobrem concorrência, não a TAXA de abertura (connect-storm/slowloris, API4) | Considerar rate-limit de abertura por usuário/IP (namespace `rate:*`); não-bloqueante MVP | dec-019 |
| SR-4 | LOW | Token não re-valida mid-stream (A07) — aceito por EC-03 | Aceitar: stream read-only + heartbeat + token curto. Re-validação periódica = futuro | dec-020 |
| SR-5 | INFO | Key injection via `{tenantId}`/`{userId}` no nome da chave Redis (A05) | Descartado: vêm de claims JWT assinados (UUIDs), nunca de input. Hardening barato: assert formato UUID | dec-021 |

BOLA/IDOR (API1): **descartado** — cliente não pode escolher tenant/user do canal
(`getRequestContext()` do token, `keycloak.guard.ts` L85-104). Isolamento cross-tenant
coberto por C2/SC-06.

## Complexity Tracking

N/A — nenhuma violação de constitution. Sem novo serviço/camada além do padrão SSE já
existente no codebase. Sem nova tabela/migration.

---

## Próximos Passos

1. `/checklist` — quality gate (api + security + performance) antes de implementar
2. `/create-tasks` — decompor em backlog executável
3. `/analyze` — validar consistência spec↔plan↔tasks
