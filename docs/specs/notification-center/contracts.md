# API Contracts: Notification Center UI

## Endpoints REUSADOS (sem alteração)

### `GET /api/v1/notifications` (14-1)
- Auth: `KeycloakAuthGuard` (Bearer). Query: `status?`, `page=1`, `perPage≤100`.
- 200 → `{ data: Notification[], meta: { page, perPage, total } }`.
- Uso: lista de não-lidas no painel + `unreadCount` via `meta.total`.

### `PATCH /api/v1/notifications/:id/read` (14-1)
- Auth: Bearer. `id` UUID. Marca como `read` checando ownership (`user_id`); 404
  se não-existe ou de outro user (anti-IDOR). 200 → `{ success: true }` (legado).

### `GET /api/v1/sse/notifications` (14-2a)
- Auth: Bearer OU `?token=` (fallback do guard). SSE.
- Evento `notification`: `data: {"id","type","title","body","createdAt"}`.
- Evento `heartbeat`: keep-alive (`data: ""`).
- Uso: invalidação realtime do cache de não-lidas.

## Endpoint NOVO

### `PATCH /api/v1/notifications/read-all`  (FR-008)
- **Auth**: `KeycloakAuthGuard` (Bearer). Sem body.
- **Declaração**: ANTES de `@Patch(':id/read')` no controller (defesa de
  roteamento; `read-all` é estático de 1 segmento).
- **Semântica**: marca como `read` TODAS as notificações não-lidas
  (`status <> 'read'`) do usuário autenticado (`getRequestContext().userId`),
  tenant-scoped via `withTenantTx` + RLS. Idempotente.
- **200 OK** → `{ "data": { "updatedCount": <int ≥0> } }`
  (`ReadAllResponseSchema`).
- **Erros**: 401 sem token; 500 mapeado para `{ statusCode, error, message }`
  (sem stack trace ao front — regra do projeto).
- **Performance**: SC-003 — ≤3s para ≤200 não-lidas (UPDATE único indexado por
  `user_id,status`).

#### Exemplo
```
PATCH /api/v1/notifications/read-all
Authorization: Bearer <jwt>
→ 200
{ "data": { "updatedCount": 7 } }
```

## Contrato de eventos realtime (consumo FE)
`NotificationRealtimeEventSchema` valida o payload SSE antes de qualquer uso;
`safeParse` falho → ignora o evento (sem crash).

## Notas de segurança (entrada do gate owasp)
- `title`/`body` renderizados como TEXTO (React escapa) — sem
  `dangerouslySetInnerHTML` (anti-XSS, SR-2).
- `metadata.actionUrl` validado same-origin/path-relativo por `safeNavigate`
  antes de qualquer navegação (anti open-redirect).
- `?token=` no SSE: token de sessão; evitar logar a URL completa no cliente.
