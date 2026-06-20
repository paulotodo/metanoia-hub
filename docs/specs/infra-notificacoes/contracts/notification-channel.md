# Contract: NotificationChannel & Dispatch (Zod, `@metanoia/types`)

**Feature**: `infra-notificacoes` | **Layer**: shared FE+BE contracts

Todos os schemas vivem em `packages/types/src/notification.ts` e são
re-exportados por `packages/types/src/index.ts`. Snapshot test obrigatório
(gate contra breaking changes silenciosos — Princípio IV / FR-013).

## Enums (fonte da verdade dos tipos)

```ts
export const NotificationTypeSchema = z.enum([
  'meeting_reminder', 'content_new', 'pastoral_alert', 'group_invite', 'system',
]);
export const NotificationChannelSchema = z.enum(['in_app', 'email']);
export const NotificationStatusSchema = z.enum(['pending', 'sent', 'read', 'failed']);
```

## Dispatch input (FR-001, US1)

Contrato chamado por qualquer módulo. **Não inclui `tenantId`** — derivado do
`RequestContext` no service (FR-001).

```ts
export const NotificationDispatchSchema = z.object({
  userId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  channels: z.array(NotificationChannelSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(), // actionUrl etc.
});
export type NotificationDispatch = z.infer<typeof NotificationDispatchSchema>;
```

- Validado pelo `ZodValidationPipe` custom (não `nestjs-zod`).
- `dispatch()` retorna void/202-style internamente; cada canal vira 1 job
  (SC-002: 2 canais → 2 jobs).

## NotificationChannel.send — payload & result (Clarify Q1, score 2)

```ts
export const NotificationPayloadSchema = z.object({
  notificationId: z.string().uuid(),
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  channel: NotificationChannelSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;

export const NotificationResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});
export type NotificationResult = z.infer<typeof NotificationResultSchema>;
```

> Falha de entrega comunicada por `result.success === false` (não exceção). O
> processor converte falha em throw para o BullMQ contabilizar retry.

## Job payload BullMQ (Clarify Q4, score 3) — camelCase nível 1

```ts
export const NotificationJobPayloadSchema = z.object({
  notificationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  channel: NotificationChannelSchema,
  correlationId: z.string(),
});
export type NotificationJobPayload = z.infer<typeof NotificationJobPayloadSchema>;
```

## SSE Redis pub payload (Clarify Q2, score 3)

Canal: `rt:notifications:{tenantId}:{userId}`. Payload **mínimo** (cliente busca
detalhes via API após o evento):

```ts
export const NotificationRealtimeEventSchema = z.object({
  notificationId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  createdAt: z.string(), // ISO 8601
});
export type NotificationRealtimeEvent = z.infer<typeof NotificationRealtimeEventSchema>;
```

## Constantes exportadas

```ts
export const NOTIFICATIONS_QUEUE_NAME = 'notifications'; // prefixo 'queue' aplicado pelo BullMqService
export const NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS = 300000;
```

## Snapshot test

`packages/types/src/__tests__/notification.snapshot.spec.ts` — snapshot do
shape de cada schema (`.shape`/`zodToJsonSchema`), idêntico ao padrão dos demais
schemas em `packages/types` (Princípio IV / VI).
