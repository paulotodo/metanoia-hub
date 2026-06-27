# Data Model — Preferências Granulares de Notificação por Tipo

**Feature**: `notif-preferencias-granulares`
**Plan companion**: `plan.md`, `research.md`

---

## 1. Entidade: `notification_preferences` (nova tabela)

Representa a escolha de um usuário sobre receber um tipo de notificação por
um canal. A combinação `(user_id, tenant_id, notification_type, channel)` é
única. **Defaults resolvidos no service** (não pré-populados no banco) — ver
§4.

### 1.1 Prisma model (apps/api/prisma/schema.prisma)

> Espelha o padrão do model `Notification` existente, MAS com diferença
> deliberada no `id`: usa `generateId()` (uuidv7, gerado na aplicação)
> conforme regra do projeto, em vez de `gen_random_uuid()`. O service faz
> `INSERT ... $1::uuid` com o id gerado.

```prisma
model NotificationPreference {
  id               String              @id @db.Uuid
  tenantId         String              @map("tenant_id") @db.Uuid
  userId           String              @map("user_id") @db.Uuid
  notificationType NotificationType    @map("notification_type")
  channel          NotificationChannel
  enabled          Boolean
  updatedAt        DateTime            @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([userId, tenantId, notificationType, channel], name: "notif_prefs_user_tenant_type_channel_uq")
  @@index([tenantId], name: "notification_preferences_tenant_idx")
  @@map("notification_preferences")
}
```

Notas:
- `id @db.Uuid` SEM `@default` — a aplicação gera o id via `generateId()`
  (`packages/types/src/id.ts`, uuidv7). Regra do projeto proíbe
  `@default(uuid())` do Prisma. (O model `Notification` legado usa
  `gen_random_uuid()`, mas seu service também gera id na aplicação; aqui
  alinhamos schema+aplicação ao padrão preferido do projeto.)
- `notificationType` e `channel` reusam os enums Postgres já criados pela
  migration 14-1 (`NotificationType`, `NotificationChannel`). NÃO recriar
  os enums.
- `enabled` é `Boolean` obrigatório (não-nulo); a ausência de linha = default
  do service, não NULL.

### 1.2 Migration SQL (apps/api/prisma/migrations/<ts>_16-1-notification-preferences/migration.sql)

Estrutura (espelha 14-1, incluindo o padrão RLS EXATO):

```sql
-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- Unique combination
CREATE UNIQUE INDEX "notif_prefs_user_tenant_type_channel_uq"
    ON "notification_preferences" ("user_id", "tenant_id", "notification_type", "channel");

-- Tenant index
CREATE INDEX "notification_preferences_tenant_idx"
    ON "notification_preferences" ("tenant_id");

-- Enable RLS
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: tenant isolation (espelha 20260629000000_14-1-notifications)
CREATE POLICY "tenant_isolation" ON "notification_preferences"
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

> A policy é EXATAMENTE a de 14-1 (sem branch `IS NULL` — não há linhas
> globais aqui; toda preferência pertence a um tenant). Reads/writes via
> `withTenantTx()` que faz `SET LOCAL app.current_tenant_id`.

### 1.3 Teste de isolamento RLS (obrigatório p/ migration que toca policy)

`apps/api/test/rls/notification-preferences.rls.spec.ts` — segue o padrão dos
testes RLS existentes (roda 2x p/ idempotência no CI):
- tenant A insere preferência; tenant B (outro `app.current_tenant_id`) NÃO
  enxerga a linha (SELECT retorna 0).
- tenant B NÃO consegue UPDATE/DELETE da linha de A (WITH CHECK).

---

## 2. NÃO alterar a tabela `notifications` (Decisão de spec #2)

A tabela `notifications` NÃO ganha colunas `delivered`/`reason`. Para registrar
"não-enviado por preferência do usuário" reusamos colunas existentes:

| Campo | Valor para supressão por preferência |
|-------|--------------------------------------|
| `status` | `'failed'` (enum `NotificationStatus`: pending/sent/failed/read) |
| `metadata` (JSONB) | merge de `{ "reason": "user_preference" }` |

**Decisão do status exato**: usar `status = 'failed'` com
`metadata.reason = 'user_preference'`. Justificativa: o enum atual
(`pending|sent|failed|read`) não tem um valor `suppressed`; adicionar valor ao
enum exigiria migration do tipo `NotificationType`/`NotificationStatus` e
mudaria o `Record` exaustivo no FE (lição Epic 14-3). `failed` + `reason`
discrimina a supressão sem alterar schema. Auditores filtram por
`status='failed' AND metadata->>'reason'='user_preference'`.

> Alternativa rejeitada: criar `status='suppressed'`. Rejeitada para honrar
> "NÃO alterar tabela notifications" e evitar quebra do Record exaustivo no FE.

---

## 3. Enums REAIS (packages/types/src/notification.ts) — NÃO inventar

`NotificationType` (Zod `z.enum`, 7 valores):
`pastoral_alert`, `group_message`, `content_update`, `meeting_reminder`,
`system`, `export_ready`, `content_new`.

`NotificationChannel` (Zod `z.enum`, 2 valores): `in_app`, `email`.

`NotificationStatus`: `pending`, `sent`, `failed`, `read`.

### 3.1 Mapeamento story → enum real

A story citava `system_announcement`; o enum real tem `system`. A UI exibe os
7 tipos reais. Rótulos PT-BR (em `apps/web/messages/pt-BR.json`):

| `notification_type` | Rótulo PT-BR | Descrição PT-BR |
|---------------------|--------------|-----------------|
| `pastoral_alert` | Alertas pastorais | Quando um participante muda de status no semáforo |
| `meeting_reminder` | Lembretes de reunião | 24h antes de uma reunião agendada |
| `content_new` | Novo conteúdo | Quando uma nova trilha é publicada no seu grupo |
| `content_update` | Atualização de conteúdo | Quando uma trilha que você acompanha é atualizada |
| `group_message` | Mensagens do grupo | Novas mensagens no seu grupo |
| `export_ready` | Relatórios prontos | Quando um relatório exportado está disponível |
| `system` | Anúncios do sistema | Atualizações e comunicados da plataforma |

> A UI cobre os 7 tipos reais (a story citava 5; cobrir todos é mais correto e
> evita tipos sem controle de preferência). `NotificationChannel`: "No app"
> (`in_app`) e "E-mail" (`email`).

---

## 4. Resolução de DEFAULTS no service (NÃO pré-popular o banco)

Decisão: defaults resolvidos no service. NÃO inserir N linhas por usuário na
criação de conta.

- GET: para cada `(type, channel)` do produto cartesiano (7 tipos × 2 canais =
  14 combinações), o service procura uma linha; se ausente, retorna o default
  `enabled: true`. (`inApp=true, email=true` para todos.)
- PATCH (patch semantics): só faz UPSERT das combinações presentes no payload.
  Combinações ausentes permanecem como default (sem linha) ou seu valor salvo
  anterior. Implementação: `INSERT ... ON CONFLICT (user_id, tenant_id,
  notification_type, channel) DO UPDATE SET enabled = EXCLUDED.enabled,
  updated_at = now()` (idempotente — FR idempotência da spec).

Vantagem: tabela cresce só com desvios do default; conta nova = 0 linhas.

---

## 5. Forma do recurso (contrato lógico GET/PATCH)

Resposta GET (objeto de preferências, defaults resolvidos):

```json
{
  "data": {
    "pastoral_alert":   { "inApp": true, "email": true },
    "meeting_reminder": { "inApp": true, "email": false },
    "content_new":      { "inApp": true, "email": true },
    "content_update":   { "inApp": true, "email": true },
    "group_message":    { "inApp": true, "email": true },
    "export_ready":     { "inApp": true, "email": true },
    "system":           { "inApp": true, "email": true }
  }
}
```

Body PATCH (parcial — apenas o que muda):

```json
{ "meeting_reminder": { "email": false } }
```

> Mapeamento canal lógico → coluna: `inApp` ⇔ `channel='in_app'`,
> `email` ⇔ `channel='email'`. Os schemas Zod (packages/types) definem o
> contrato exato — ver `contracts/`.

---

## 6. Cache Redis (chave & invalidação)

- Chave: `cache:notif-prefs:{userId}` (namespace `cache:` conforme convenção).
- Valor: JSON serializado do objeto de preferências resolvido (pós-defaults,
  pré-enforcement de papel).
- TTL: ~600s (10 min) via `set(key, json, 'EX', 600)`.
- Invalidação: `del(cache:notif-prefs:{userId})` no PATCH bem-sucedido.
- Fallback: se Redis indisponível (get/set/del lançam), capturar, logar
  `warn` e seguir com consulta direta ao DB. NUNCA dropar/abortar
  notificação por cache miss (SC-006).

> O enforcement de papel (Líder) é aplicado APÓS o cache (sobre o objeto
> resolvido), pois depende do papel corrente do request — NÃO cachear o
> resultado pós-enforcement. Ver plan.md §enforcement.
