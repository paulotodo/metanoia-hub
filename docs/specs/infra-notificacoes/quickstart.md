# Quickstart / Test Scenarios: Infraestrutura de Notificações

**Feature**: `infra-notificacoes` | **Phase**: 1 (Design)

Cada cenário é um fluxo crítico (happy path + error case). Validação Postgres
local antes do PR via `docker-compose.test.yml` (porta 5433, isolado da prod).

## Cenário 1 — Dispatch multi-canal (US1, SC-002)

1. Em contexto de tenant A (RequestContext setado), chamar
   `notificationsService.dispatch({ userId, type: 'content_new', title, body,
   channels: ['in_app', 'email'] })`.
2. Inspecionar a fila `queue:notifications`.
   → **Expected**: exatamente 2 jobs enfileirados (1 por canal); a notificação
   persistida em `notifications` com `status: pending`, `tenant_id` = tenant A.

## Cenário 2 — Isolamento cross-tenant (US1 AC3, SC-001) [RLS spec]

1. Tenant A e Tenant B com usuários distintos. Dispatch em cada contexto.
2. Sob `withTenantTx` no contexto de A, consultar notificações.
   → **Expected**: somente notificações de A visíveis; nenhuma de B. RLS
   `tenant_isolation` bloqueia leitura e escrita cross-tenant.
3. Tentar `INSERT` com `tenant_id` de B sob contexto de A.
   → **Expected**: bloqueado por `WITH CHECK` (RLS violation).
4. Spec idempotente: rodar o `.rls-spec.ts` 2x seguidas → ambos verdes (CI roda
   2x). Cleanup determinístico no `afterEach`.

## Cenário 3 — Entrega in-app + publicação Redis (US2, FR-014)

1. Processar um job `channel: in_app`.
   → **Expected**: notificação atualizada para `status: sent`; mensagem
   publicada em `rt:notifications:{tenantId}:{userId}` com payload
   `{ notificationId, type, title, body, createdAt }`.
2. (Sem consumidor SSE no MVP) verificar via subscriber de teste que a mensagem
   foi publicada exatamente uma vez.

## Cenário 4 — Email stub (US3, SC-006)

1. Processar job `channel: email`.
   → **Expected**: Channel Router roteia para `EmailChannel`; log
   "delivery delegated (stub OK)"; `result.success === true`; `InAppChannel`
   inalterado.
2. Registrar um canal fictício `WhatsAppChannel` no router.
   → **Expected**: nenhuma mudança em `dispatch()` nem no router (apenas o
   registro) — extensibilidade FR-005 verificada.

## Cenário 5 — Digest agrupa mesmo tipo (US4, SC-003)

1. `NOTIFICATION_DIGEST_WINDOW_MS=300000`. Disparar 10 `content_new` para o
   mesmo `userId` dentro da janela.
   → **Expected**: 1 único digest entregue (job key
   `digest:{userId}:content_new:{epochBucket}` deduplicado pelo BullMQ);
   `title`/`body` com contagem agregada.
2. Multi-pod (race): 2 dispatches simultâneos no mesmo bucket.
   → **Expected**: idempotente — 1 digest (mesmo `jobId`).

## Cenário 6 — Janela configurável (US4 AC2, SC-007)

1. `NOTIFICATION_DIGEST_WINDOW_MS=60000`. Duas notificações com 30s de intervalo.
   → **Expected**: agrupadas (mesmo bucket).
2. Mesmas com 90s de intervalo.
   → **Expected**: buckets distintos → entregues individualmente. Alteração da
   env muda comportamento sem redeploy.

## Cenário 7 — pastoral_alert nunca agrupado (US4 AC3, SC-004)

1. Sob carga de muitos `content_new` em digest, disparar 1 `pastoral_alert`.
   → **Expected**: `pastoral_alert` NÃO entra no caminho de digest; entregue
   imediatamente (< 2s); sem job delayed.

## Cenário 8 — Retry com backoff + failed set (US5, SC-005) [error case]

1. Processor configurado para falhar 3x (`result.success: false`).
   → **Expected**: tentativas com delays crescentes 30s/60s/120s (backoff
   exponencial, `attempts: 3`).
2. Esgotadas as tentativas.
   → **Expected**: notificação `status: failed` no banco; job retido no failed
   set (`removeOnFail: false`); log estruturado com `correlation_id`, `channel`,
   `error_message`.
3. Inspecionar o failed set.
   → **Expected**: dados do job intactos para replay manual.

## Cenário 9 — Dispatch sem contexto de tenant (Edge Case) [error case]

1. Chamar `dispatch()` fora de request e sem tenant no contexto.
   → **Expected**: `getRequestContext()` lança erro claro ANTES de persistir;
   nenhuma notificação parcial criada; chamador recebe erro de serviço.

## Cenário 10 — Roundtrip End-to-End (borda BE) [obrigatório multi-camada]

1. Em ambiente local (Postgres 5433 + Redis), dispatch real → processar job →
   `GET /api/v1/notifications` autenticado como o usuário destinatário.
2. Capturar o payload REAL da resposta (não mock/fixture).
   → **Expected**: shape do JSON casa exatamente com o contrato
   (`NotificationDispatchSchema`/Notification): chaves em camelCase no payload
   da API (`createdAt`, `readAt`, `userId`), enquanto as colunas no banco são
   snake_case (`created_at`, `read_at`, `user_id`). Confirma que o mapper
   Prisma (camelCase model ↔ snake_case `@map`) está correto — evita drift
   snake_case/camelCase silencioso.
