# Contract: GET /api/v1/notifications (extensão `since`)

**Feature**: `sse-reconnection` (Story 14-2c, FR77)
**Endpoint**: `GET /api/v1/notifications`
**Status**: EXTENSÃO de endpoint existente (14-2a/14-2b) — backward-compatible.

## Mudança

Adicionar o parâmetro de query OPCIONAL `since` ao endpoint existente.
Sem `since`, o comportamento é IDÊNTICO ao atual (FR-003 da US3 / spec
linha 62). O contrato de RESPONSE é INALTERADO.

## Auth & Tenancy (inalterados)

- `KeycloakAuthGuard` (JWT obrigatório).
- `userId` extraído do `RequestContext` (AsyncLocalStorage) — NUNCA de
  query/body (BOLA-safe).
- `tenant_id` aplicado via RLS (`withTenantTx` → `SET LOCAL
  app.current_tenant_id`). O filtro `since` é ortogonal ao isolamento
  (FR-018).

## Request

### Query params (schema Zod compartilhado — `@metanoia/types`)

| Param | Tipo | Obrigatório | Validação | Default |
|-------|------|-------------|-----------|---------|
| `status` | `notification_status` enum | não | `pending\|sent\|failed\|read` | — |
| `unread` | boolean (coerce) | não | — | — |
| `page` | int positivo (coerce) | não | — | `1` |
| `perPage` | int positivo (coerce) | não | `<= 100` | `20` |
| **`since`** | **string ISO 8601** | **não** | **`z.string().datetime()`** | **—** |

**Decisão de schema (research Decision 6)**: o `NotificationsQuerySchema`
compartilhado em `packages/types/src/notification.ts` ganha o campo
`since`. O `notifications.controller.ts` DEVE passar a importar/estender
esse schema compartilhado (hoje ele tem uma cópia inline divergente, sem
`unread`/`since`) — eliminando a duplicação e garantindo paridade FE/BE
(Princípio IV).

```ts
// packages/types/src/notification.ts (forma alvo)
export const NotificationsQuerySchema = z.object({
  status: NotificationStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  unread: z.coerce.boolean().optional(),
  since: z.string().datetime().optional(), // ISO 8601 — gap-fill (FR-015/FR-017)
});
```

### Exemplos

```
GET /api/v1/notifications?unread=true&perPage=20
    → comportamento atual, inalterado (FR-003)

GET /api/v1/notifications?since=2026-06-21T05:48:00.000Z&status=unread
    → apenas notificações com created_at > 2026-06-21T05:48:00.000Z (FR-016)

GET /api/v1/notifications?since=not-a-date
    → 400 (ZodValidationPipe rejeita; z.string().datetime() falha) (FR-019)
```

## Response (INALTERADO)

Envelope padrão `{ data, meta }` (Princípio IV). Shape idêntico ao
endpoint atual — `since` não altera a forma, só filtra as linhas.

```json
{
  "data": [
    {
      "id": "0192f8b2-...",        // uuid v7 — chave de dedup no cliente
      "type": "pastoral_alert",
      "channel": "in_app",
      "status": "sent",
      "title": "Sinal de cuidado",
      "body": "...",
      "metadata": {},
      "read_at": null,
      "created_at": "2026-06-21T05:48:30.000Z",
      "updated_at": "2026-06-21T05:48:30.000Z"
    }
  ],
  "meta": { "page": 1, "perPage": 20, "total": 3 }
}
```

> NOTA de borda (snake_case vs camelCase): o response atual expõe colunas
> em **snake_case** (`read_at`, `created_at`, `updated_at`) — confirmado
> no `NotificationListItemSchema` de `@metanoia/types` e no
> `findByUser` (SELECT de colunas snake_case). Esta feature MANTÉM essa
> convenção (não introduz mapper camelCase). Ver §Convenções de Borda do
> plan.md.

## Filtro server-side (`notifications.service.ts → findByUser`)

```sql
-- pseudocódigo do WHERE resultante (param bindado, NUNCA interpolado)
SELECT ... FROM notifications
WHERE user_id = $1::uuid
  {statusFilter}                       -- unread/status existente
  {sinceFilter}                        -- AND created_at > $N::timestamptz  (se since presente)
ORDER BY created_at DESC
LIMIT $K OFFSET $M
```

- `since` ⇒ `AND created_at > $N::timestamptz` com bind posicional
  (consistente com o padrão `$queryRawUnsafe` atual). **Estritamente
  posterior** (`>`, não `>=`) — FR-016.
- Mesma cláusula adicionada ao `COUNT(*)` para `meta.total` consistente.
- `since` ausente ⇒ cláusula omitida (comportamento atual). FR-003.

## Erros

| Cenário | HTTP | Corpo |
|---------|------|-------|
| `since` formato inválido (não ISO 8601) | 400 | `{ statusCode, error, message, details? }` (ZodValidationPipe) |
| Sem JWT / token inválido | 401 | guard padrão (sem stack trace) |
| `since` válido mas futuro | 200 | `{ data: [], meta: { total: 0 } }` (lista vazia, US3 test) |

## Requisitos cobertos

FR-015 (`since` aceito), FR-016 (estritamente posterior), FR-017 (schema
Zod compartilhado), FR-018 (RLS preservado), FR-019 (400 inválido),
SC-005 (filtro + 400 verificável em integração).
