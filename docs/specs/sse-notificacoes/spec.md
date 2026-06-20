# Spec: SSE Endpoint & Redis Pub/Sub Backend (FR77)

**Feature**: sse-notificacoes
**Story**: 14-2a (Epic 14 — Notificações em Tempo Real)
**Status**: especificado
**Versão**: 1.0.0
**Data**: 2026-06-20
**Pipeline**: feature-00c SDD

---

## 1. Contexto e Problema

O módulo `notifications` (Story 14-1) entrega a infraestrutura de disparo:
InAppChannel processa jobs BullMQ, persiste o status `sent` no banco e publica
no canal Redis Pub/Sub `rt:notifications:{tenantId}:{userId}`. Hoje não há
consumidor desse canal — as notificações ficam na fila sem chegar ao cliente.

Esta feature (14-2a) fecha o ciclo: implementa o endpoint SSE
`GET /api/v1/sse/notifications` que assina o canal Redis e faz push das
notificações para o navegador em tempo real, sem polling.

---

## 2. User Stories

### US1 — Conexão SSE autenticada e tenant-scoped

**Como** usuário autenticado,
**Quero** estabelecer uma conexão SSE persistente no endereço
`GET /api/v1/sse/notifications`,
**Para que** receba notificações em tempo real sem recarregar a página.

**Acceptance Criteria**:

- Given um usuário autenticado com token Keycloak válido
  When faz GET /api/v1/sse/notifications
  Then a conexão é aceita com `Content-Type: text/event-stream`
  And `tenant_id` e `user_id` são extraídos do token pelo guard (nunca passados como parâmetro)
  And o servidor envia keep-alive comment `: heartbeat` a cada 30 segundos
  And o servidor responde 401 para requisições sem token ou token inválido

- Given conexão SSE ativa
  When chega uma notificação para `rt:notifications:{tenantId}:{userId}`
  Then o servidor faz push `event: notification\ndata: {id,type,title,body,createdAt}\n\n`

### US2 — Limite de conexões por instância

**Como** operador da plataforma,
**Quero** limitar o número máximo de conexões SSE por instância NestJS,
**Para que** instâncias não esgote memória sob tráfego elevado.

**Acceptance Criteria**:

- Given a instância já possui `SSE_MAX_CONNECTIONS` (padrão: 1000) conexões ativas
  When um novo cliente tenta conectar
  Then o servidor responde 503 com header `Retry-After: 30`
  And a conexão é recusada antes de ser aceita

- Given `SSE_MAX_CONNECTIONS` não está configurado
  Then o padrão de 1000 conexões é aplicado

### US3 — Limite de conexões por usuário via Redis

**Como** usuário abrindo múltiplas abas,
**Quero** que o sistema gerencie minhas conexões simultâneas,
**Para que** não consuma recursos excessivos de outros usuários.

**Acceptance Criteria**:

- Given um usuário já possui `SSE_MAX_PER_USER` (padrão: 5) conexões abertas
  When abre uma 6ª aba e estabelece nova conexão SSE
  Then o servidor identifica a conexão mais antiga via Redis SET `sse:connections:{tenantId}:{userId}`
  And envia `event: close\ndata: {"reason":"max_connections_exceeded"}\n\n` à conexão mais antiga
  And encerra a conexão mais antiga
  And aceita a nova conexão

- Given `SSE_MAX_PER_USER` não está configurado
  Then o padrão de 5 conexões por usuário é aplicado

### US4 — Cleanup na desconexão

**Como** servidor NestJS,
**Quero** limpar recursos quando um cliente SSE desconecta,
**Para que** não haja vazamento de memória ou subscriptions órfãs.

**Acceptance Criteria**:

- Given uma conexão SSE ativa com ID registrado no Redis SET
  When o cliente desconecta (navegação, fechamento de aba, timeout de heartbeat)
  Then o connection ID é removido do SET `sse:connections:{tenantId}:{userId}`
  And a subscription Redis Pub/Sub daquele canal é encerrada

### US5 — Isolamento cross-tenant

**Como** administrador de tenant,
**Quero** garantia de que notificações de meu tenant nunca vazem para outro,
**Para que** o isolamento multi-tenant seja preservado na camada de tempo real.

**Acceptance Criteria**:

- Given usuário user1 do tenant A e usuário user1 do tenant B ambos conectados via SSE
  When o InAppChannel publica notificação para tenant A / user1
  Then SOMENTE a conexão de tenant A recebe o evento
  And a conexão de tenant B não recebe nenhum evento

---

## 3. Functional Requirements

| ID | Requisito | Prioridade |
|----|-----------|-----------|
| FR-01 | O endpoint `GET /api/v1/sse/notifications` deve ser protegido por guard Keycloak que valida o token e extrai `tenant_id` e `user_id` sem aceitá-los como parâmetros de query/header | MUST |
| FR-02 | A resposta bem-sucedida deve ter `Content-Type: text/event-stream` e `Cache-Control: no-cache` | MUST |
| FR-03 | O servidor deve emitir `: heartbeat` a cada 30 segundos para manter a conexão viva e detectar clientes mortos | MUST |
| FR-04 | O número máximo de conexões por instância é configurável via variável de ambiente `SSE_MAX_CONNECTIONS` (padrão: 1000); ao exceder, retornar 503 + `Retry-After: 30` | MUST |
| FR-05 | O número máximo de conexões por usuário é configurável via `SSE_MAX_PER_USER` (padrão: 5); rastreado via Redis SET `sse:connections:{tenantId}:{userId}` (namespace `sse:*`) | MUST |
| FR-06 | Ao exceder o limite por usuário, a conexão mais antiga deve receber `event: close\ndata: {"reason":"max_connections_exceeded"}` e ser encerrada antes de aceitar a nova | MUST |
| FR-07 | O SSE Controller deve assinar o canal `rt:notifications:{tenantId}:{userId}` para cada conexão ativa | MUST |
| FR-08 | Mensagens recebidas do canal Redis Pub/Sub devem ser emitidas como `event: notification\ndata: {id,type,title,body,createdAt}` | MUST |
| FR-09 | Na desconexão (heartbeat timeout ou close explícito), o connection ID deve ser removido do Redis SET e a subscription encerrada | MUST |
| FR-10 | Os canais Redis são tenant-scoped (`rt:notifications:{tenantId}:{userId}`); o tenant_id é obtido do token, nunca de entrada do cliente | MUST |
| FR-11 | O endpoint deve rejeitar com 401 requisições sem token ou com token inválido/expirado | MUST |
| FR-12 | Cada conexão SSE deve receber um identificador único (connection ID) para rastreamento no Redis SET | MUST |

---

## 4. Non-Functional Requirements

| ID | Requisito | Métrica |
|----|-----------|---------|
| NFR-01 | Performance sob carga | 500 conexões simultâneas: heap < 512 MB, event loop lag p99 < 100 ms, zero dropped connections em 5 min |
| NFR-02 | Heartbeat interval | 30 segundos (configurable via `SSE_HEARTBEAT_INTERVAL_MS` se necessário) |
| NFR-03 | Latência de entrega | Notificação publicada → recebida pelo cliente SSE em < 500 ms em condições normais |
| NFR-04 | Isolamento multi-tenant | Zero cross-tenant leakage (verificado por teste determinístico) |
| NFR-05 | Cleanup determinístico | 100% de conexões fechadas removem seu ID do Redis SET em < 1 s |

---

## 5. Success Criteria (mensuráveis)

| SC | Critério | Como medir |
|----|----------|-----------|
| SC-01 | Endpoint retorna `Content-Type: text/event-stream` em 200 OK | Teste de integração: `expect(headers['content-type']).toMatch(/text\/event-stream/)` |
| SC-02 | Heartbeat `: heartbeat` é emitido a cada 30 s | Teste: capturar stream por 35 s, assert ≥ 1 comment heartbeat |
| SC-03 | 503 + `Retry-After: 30` quando instância atinge `SSE_MAX_CONNECTIONS` | Teste: simular N+1 conexões com mock do contador interno |
| SC-04 | Conexão mais antiga fechada com `reason: max_connections_exceeded` ao atingir `SSE_MAX_PER_USER` | Teste: abrir 6 conexões, assert primeira recebeu close event |
| SC-05 | Notificação publicada no canal Redis chega ao cliente SSE correto | Teste de integração: dispatch → InAppChannel → assert SSE event recebido |
| SC-06 | Isolamento cross-tenant: user no tenant A não recebe notificação do tenant B | Teste determinístico: dois tenants, publicar em A, assert B vazio |
| SC-07 | Connection ID removido do SET após desconexão | Teste: conectar, desconectar, assert `SCARD sse:connections:{t}:{u}` = 0 |
| SC-08 | Carga: 500 conexões simultâneas, heap < 512 MB, lag p99 < 100 ms | Load test (`autocannon` ou similar) com monitoramento de `process.memoryUsage()` e `perf_hooks` |

---

## 6. Edge Cases e Restrições

| EC | Cenário | Comportamento esperado |
|----|---------|------------------------|
| EC-01 | Redis indisponível no momento da conexão | Retornar 503; logar erro; não aceitar conexão sem tracking |
| EC-02 | Redis cai com conexões ativas | Emitir `event: error` e encerrar conexões afetadas; não vazar subscriptions |
| EC-03 | Token expirado mid-stream | SSE não re-valida (validação só na conexão inicial); heartbeat detecta client morto |
| EC-04 | Conexão mais antiga já não existe (race condition) | Ignorar silenciosamente; tentar a próxima mais antiga; nunca recusar a nova conexão |
| EC-05 | Múltiplas instâncias NestJS (horizontal scaling) | Limite por instância (`SSE_MAX_CONNECTIONS`) é local; limite por usuário é global via Redis |
| EC-06 | Payload do canal Redis inválido (JSON mal-formado) | Logar erro, descartar evento, manter conexão ativa |
| EC-07 | SSE_MAX_CONNECTIONS=0 ou valor inválido | Usar padrão 1000; logar warning no startup |

---

## 7. Dependências

| Dependência | Tipo | Status |
|-------------|------|--------|
| Story 14-1 (NotificationsModule, InAppChannel, Redis Pub/Sub publisher) | Predecessora | done (mergeada em dev) |
| RedisService (`apps/api/src/redis/redis.service.ts`) | Interna | disponível |
| RequestContext / AsyncLocalStorage (`tenant_id`, `user_id`) | Interna | disponível |
| Keycloak guard (extrai claims do token JWT) | Interna | disponível |
| `packages/types` — `NotificationPayload` | Interna | disponível (definido em 14-1) |

---

## 8. Estrutura de Arquivos Esperada

```
apps/api/src/notifications/
  sse/
    sse.controller.ts           — endpoint GET /api/v1/sse/notifications
    sse-connection.manager.ts   — tracking de conexões (instância + por usuário)
    sse-redis.service.ts        — Subscribe/Unsubscribe ao canal Redis Pub/Sub
    sse.controller.spec.ts      — unit tests
  notifications.module.ts       — registrar SseController, SseConnectionManager, SseRedisService
```

---

## 9. Notas Técnicas (referência — não constitui FRs)

> Estas notas descrevem a intenção arquitetural derivada do story file e dos guardrails do CLAUDE.md. A skill `plan` detalhará as decisões de implementação.

- **SSE no NestJS**: usar `@Sse()` decorator ou `Response` nativa com `res.write()` — a escolha entre `RxJS Observable` e stream manual é decisão do `plan`.
- **Redis Pub/Sub separado**: o `RedisService` atual estende `ioredis` e é usado para cache/pub. Pub/Sub requer um client dedicado em modo subscriber; o `SseRedisService` deve instanciar um client separado para `subscribe()`.
- **Connection ID**: UUID v7 via `uuidv7()` — nunca `crypto.randomUUID()` ou `@default(uuid())` Prisma.
- **Namespace Redis**: `sse:connections:{tenantId}:{userId}` — SET de connection IDs (novo namespace `sse:*`, conforme story).
- **AsyncLocalStorage**: `tenant_id` e `user_id` extraídos do token Keycloak pelo guard e propagados via `RequestContext`; nunca aceitos como parâmetro de função.
