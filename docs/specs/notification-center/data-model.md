# Data Model: Notification Center UI

Esta feature é predominantemente UI; **não cria tabelas nem migrations**. Reusa
o modelo `Notification` da Story 14-1. Documentado aqui o contrato de leitura, o
novo contrato de escrita em lote e as entidades client-side.

## 1. Entidade persistida (REUSO — sem alteração de schema)

### `Notification` (`notifications`) — já existe (14-1)
| Campo (Prisma) | Coluna | Tipo | Notas |
|----------------|--------|------|-------|
| `id` | `id` | uuid | PK |
| `tenantId` | `tenant_id` | uuid | RLS scope (nunca exposto na UI) |
| `userId` | `user_id` | uuid | dono; filtro de ownership |
| `type` | `type` | enum `NotificationType` | `pastoral_alert\|group_message\|content_update\|meeting_reminder\|system` → ícone |
| `channel` | `channel` | enum | `in_app\|email` |
| `status` | `status` | enum `NotificationStatus` | `pending\|sent\|failed\|read`; "não lida" = `<> read` |
| `title` | `title` | varchar(200) | render como TEXTO |
| `body` | `body` | text | preview slice(0,100) |
| `metadata` | `metadata` | jsonb `{}` | free-form; `actionUrl` opcional (validar same-origin) |
| `readAt` | `read_at` | timestamptz? | setado no mark-read / mark-all |
| `createdAt` | `created_at` | timestamptz | base do tempo relativo |
| `updatedAt` | `updated_at` | timestamptz | |

**RLS** (existente, reusada): policy `tenant_isolation` em `notifications`
(USING + WITH CHECK = `tenant_id = NULLIF(current_setting('app.current_tenant_id', true),'')::uuid`).
O novo UPDATE em lote herda a policy automaticamente sob `withTenantTx`.

**Índices relevantes** (já existem): `notifications_user_status_created_idx`
(`user_id, status, created_at DESC`) cobre tanto a listagem de não-lidas quanto
o UPDATE em lote por `user_id` + `status` — sem necessidade de índice novo.

## 2. Contratos Zod compartilhados (`packages/types/src/notification.ts`)

### Reuso (já existem)
- `NotificationTypeSchema`, `NotificationChannelSchema`, `NotificationStatusSchema`
- `NotificationRealtimeEventSchema` = `{ id(notificationId), type, title, body, createdAt }`
  (payload do SSE — consumido pelo `use-notification-stream`).

### Novo — resposta do read-all (FR-009)
```ts
export const ReadAllResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});
export type ReadAllResponse = z.infer<typeof ReadAllResponseSchema>;
```
- Snapshot test obrigatório em `__tests__/notification.snapshot.spec.ts`.

### Possível ampliação de listagem (ver research D2 — confirmar no create-tasks)
Se a listagem precisar de "todos os não-lidos" (não um único status), o
`NotificationsQuerySchema` pode ganhar `unread?: boolean` que filtra
`status <> 'read'`. Decisão diferida ao create-tasks (default fiel: ampliar
preservando o contrato existente; não é breaking change).

## 3. Estado client-side (não persistido em banco)

### Preferência de silêncio (localStorage)
| Chave | Tipo | Persistência | Sync |
|-------|------|--------------|------|
| `metanoia:notificationSilence` | `"1"` \| ausente | localStorage (dispositivo) | `storage` event cross-tab |
Não sincroniza entre dispositivos (FR-010; FR78 = Post-MVP).

### Server state (TanStack Query — cache, não banco)
| Query key | Fonte | Invalidação |
|-----------|-------|-------------|
| `['notifications','unread']` | `GET /notifications?status=...&perPage=20` | evento SSE `notification`; após mark-read / mark-all |

## 4. Fluxos de mutação

```
Mark-read individual:
  click item → useMarkRead(id) → PATCH /notifications/:id/read
            → onSuccess: invalidate ['notifications','unread']
            → safeNavigate(metadata.actionUrl)   (same-origin ou no-op)

Mark-all:
  click "Marcar todas" → useMarkAllRead() → PATCH /notifications/read-all
            → service markAllAsRead(userId, now): UPDATE ... WHERE user_id AND status<>read RETURNING id
            → { data: { updatedCount } }
            → onSuccess: invalidate ['notifications','unread'] (badge → 0)
            → onError: estado mantido (sem marcação parcial otimista persistida)

Realtime:
  SSE 'notification' → invalidate ['notifications','unread'] (badge atualiza SEMPRE)
            → if (!silenced) announce("Nova notificação: <title>")
```
