# Contract: Notifications API (REST `/api/v1/`)

**Feature**: `infra-notificacoes` | **Module**: `apps/api/src/notifications/`

> Escopo MVP da Story 14.1 é a INFRAESTRUTURA (dispatch service + channels +
> queue + worker + digest + retry). Os endpoints REST de leitura/marcação são
> mínimos — o notification center completo é Story 14.2x. Documentados aqui
> para fixar o contrato de borda desde já.

## Padrões (Princípio IV)

- Prefixo `/api/v1/`. Sucesso `{ data, meta? }`. Erro
  `{ statusCode, error, message, details? }`. Create→201, Async→202.
- Guards Keycloak (roles) → RLS (tenant). `tenant_id` via `RequestContext`.
- Eventos de domínio: `notifications.notification.created`,
  `notifications.notification.sent`, `notifications.notification.failed`,
  `notifications.notification.digested` (envelope padrão `{ eventId, eventType,
  version, tenantId, timestamp, data, metadata }`).

## GET /api/v1/notifications

Lista notificações do usuário autenticado (RLS isola tenant; filtro por
`user_id` do contexto). Ordenado por `(status, created_at DESC)` usando o índice
`notifications_user_status_created_idx` (FR-012).

- Query: `status?` (enum), `page?`, `perPage?` (default 20, max 100).
- 200 `{ data: Notification[], meta: { page, perPage, total } }`.
- **BOLA/IDOR (owasp)**: a query SEMPRE filtra por `userId = ctx.userId` E
  depende da RLS por tenant. Nunca aceita `userId` arbitrário do cliente.

## PATCH /api/v1/notifications/:id/read

Marca como lida: `status → read`, `read_at = now()`.

- 200 `{ data: Notification }`.
- **BOLA/IDOR (owasp)**: o `UPDATE` ocorre sob `withTenantTx` + RLS `WITH CHECK`;
  além disso o WHERE inclui `id = :id AND user_id = ctx.userId`. Notificação de
  outro usuário/tenant → 404 (não 403, para não vazar existência).

> NÃO há endpoint público de `dispatch` — dispatch é serviço interno
> (`NotificationsService.dispatch`) chamado por outros módulos via injeção. Não
> há superfície HTTP para disparar notificação arbitrária (mitiga abuso).
