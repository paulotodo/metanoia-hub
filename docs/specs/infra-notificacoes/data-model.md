# Data Model: Infraestrutura de Notificações

**Feature**: `infra-notificacoes` | **Phase**: 1 (Design) | **Date**: 2026-06-20

## Entity: Notification

Registro persistente de um evento de comunicação. Tabela `notifications`.

### Prisma model (a adicionar em `apps/api/prisma/schema.prisma`)

```prisma
model Notification {
  id        String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String              @map("tenant_id") @db.Uuid
  userId    String              @map("user_id") @db.Uuid
  type      NotificationType
  title     String              @db.VarChar(200)
  body      String              @db.Text
  channel   NotificationChannel
  status    NotificationStatus  @default(pending)
  readAt    DateTime?           @map("read_at") @db.Timestamptz
  metadata  Json                @default("{}")
  createdAt DateTime            @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId, status, createdAt(sort: Desc)], map: "notifications_user_status_created_idx")
  @@index([tenantId], map: "notifications_tenant_idx")
  @@map("notifications")
}

enum NotificationType {
  meeting_reminder
  content_new
  pastoral_alert
  group_invite
  system

  @@map("notification_type")
}

enum NotificationChannel {
  in_app
  email

  @@map("notification_channel")
}

enum NotificationStatus {
  pending
  sent
  read
  failed

  @@map("notification_status")
}
```

> Nota UUID v7 (Princípio II): o `@default(dbgenerated("gen_random_uuid()"))` é
> apenas fallback DB-side (consistência com o schema existente). O **service
> sempre passa `id: uuidv7()`** no `create` — proibido `@default(uuid())` do
> Prisma. Ver `research.md` Decision 3.

### Fields

| Campo | Tipo | Null? | Notas |
|-------|------|-------|-------|
| `id` | UUID v7 | não | gerado por `uuidv7()` no service (FR-002) |
| `tenant_id` | UUID | não | derivado do `RequestContext`, nunca parâmetro (FR-001) |
| `user_id` | UUID | não | destinatário (FR-002) |
| `type` | enum `notification_type` | não | `pastoral_alert` nunca agrupado (FR-007) |
| `title` | varchar(200) | não | conteúdo PT-BR (vocabulário pastoral) |
| `body` | text | não | conteúdo PT-BR |
| `channel` | enum `notification_channel` | não | `in_app` \| `email` (FR-004) |
| `status` | enum `notification_status` | não | ciclo de vida; default `pending` |
| `read_at` | timestamptz | sim | preenchido na transição → `read` (US2) |
| `metadata` | jsonb | não | default `{}`; inclui `actionUrl` (FR-002, Decision 5) |
| `created_at` | timestamptz | não | imutável; default `now()` |

### State transitions (`status`)

```
pending ──(canal entrega OK)──▶ sent ──(usuário lê)──▶ read
   │
   └──(3 tentativas esgotadas)──▶ failed
```

- `pending`: criada no dispatch, antes do processamento do canal (FR-002).
- `sent`: `InAppChannel` persistiu/entregou + publicou Redis; `EmailChannel`
  stub registra log (US2, US3).
- `read`: usuário leu via notification center; `read_at` registra timestamp
  (US2 AC2). Transição posterior a esta feature (consumida pela Story 14.2x),
  mas o estado e a coluna já existem no MVP.
- `failed`: após 3 tentativas; job retido no failed set; log com
  `correlation_id`, `channel`, `error_message` (FR-009..FR-011, US5).

### Índices & performance

- `notifications_user_status_created_idx` em `(user_id, status, created_at DESC)`
  — atende a consulta do notification center ordenada (FR-012, SC do US2).
- `notifications_tenant_idx` em `(tenant_id)` — suporte à policy RLS e a
  varreduras administrativas tenant-scoped.

### RLS

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped SEMPRE (sem linhas globais → sem ramo IS NULL).
CREATE POLICY tenant_isolation ON notifications
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```

> Diferença vs. `evasion_job_log` (que tem `tenant_id IS NULL OR ...`):
> notificações **não têm linhas globais**, portanto o ramo `IS NULL` é OMITIDO
> (seria brecha cross-tenant). `WITH CHECK` espelha o `USING` para bloquear
> INSERT/UPDATE cross-tenant. Ver `research.md` Decision 4.

## Entity: NotificationChannel (interface de domínio — não persistida)

Abstração de entrega. Implementações: `InAppChannel`, `EmailChannel` (stub).
Contrato em `packages/types` (Zod) — ver `contracts/notification-channel.md`.

```ts
interface NotificationChannel {
  readonly channel: 'in_app' | 'email';
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
```

- `InAppChannel.send`: persiste `status: sent` (via `withTenantTx`) e publica em
  `rt:notifications:{tenantId}:{userId}` (FR-014, Decision 8).
- `EmailChannel.send`: stub — registra log "delivery delegated (stub OK)",
  retorna `{ success: true }` (US3). Integração Resend = Story 14.3.
- Extensibilidade (FR-005): novo canal = nova classe que implementa a interface
  + registro no Channel Router; `dispatch()` e router inalterados.

## Entity: Notification Job (payload BullMQ — fila `queue:notifications`)

Unidade de trabalho. NÃO persistida no Postgres (vive na fila Redis).

```ts
// camelCase nível 1 (Clarify Q4, score 3)
interface NotificationJobPayload {
  notificationId: string;
  tenantId: string;
  userId: string;
  channel: 'in_app' | 'email';
  correlationId: string;
}
```

- Carrega o mínimo para o processor reconstruir o `RequestContext`
  (`requestContext.run({ tenantId, userId, requestId, correlationId }, cb)`) e
  localizar a notificação persistida (`notificationId`).
- Retry: `attempts: 3`, `backoff: { type: 'exponential', delay: 30000 }`
  → 30s/60s/120s (FR-009). `removeOnFail: false` mantém o failed set (FR-010).

## Entity: Digest (delayed job — agregação)

Agrupamento de N notificações do mesmo `(userId, type)` numa janela.

- Job key/`jobId`: `digest:{userId}:{type}:{Math.floor(Date.now() /
  NOTIFICATION_DIGEST_WINDOW_MS)}` (idempotente multi-pod — Decision 7).
- `delay = NOTIFICATION_DIGEST_WINDOW_MS` (default 300000 ms; env override sem
  redeploy — FR-008, SC-007).
- Ao disparar, agrega as notificações `pending` do bucket numa única
  notificação digest (`title`/`body` com contagem e contexto pastoral —
  ex: "3 participantes precisam de cuidado").
- `pastoral_alert` NUNCA entra neste caminho (FR-007) — dispatch direto.
