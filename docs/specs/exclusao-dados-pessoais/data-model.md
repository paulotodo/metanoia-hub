# Data Model: exclusao-dados-pessoais

**Feature:** Story 9-2 — Exclusão de Dados Pessoais / Eliminação LGPD
**Data:** 2026-06-12

---

## Entity: DeletionRequest

**Tabela:** `deletion_requests`
**Propósito:** Rastrear o ciclo de vida de cada solicitação de exclusão de dados pessoais (grace period + fases soft/hard-delete).

### Campos

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `id` | UUID PK | sim | `uuidv7()` |
| `tenant_id` | UUID FK | sim | Tenant ativo na solicitação; RLS scope |
| `user_id` | UUID | sim | Usuário titular dos dados |
| `status` | TEXT | sim | Default `'pending'`; enum Zod: `pending\|soft_deleted\|hard_deleted\|cancelled\|failed` |
| `all_tenant_ids` | UUID[] | sim | Todos os tenants do usuário; write-once |
| `cancellable_until` | TIMESTAMPTZ | sim | `requestedAt + 7 dias` — prazo para cancelamento |
| `deletion_deadline` | TIMESTAMPTZ | sim | `requestedAt + 30 dias` — prazo legal LGPD |
| `cancelled_at` | TIMESTAMPTZ | não | Preenchido em cancelamento |
| `confirmed_at` | TIMESTAMPTZ | não | Preenchido quando soft-delete completo |
| `completed_at` | TIMESTAMPTZ | não | Preenchido quando hard-delete completo |
| `failure_reason` | TEXT | não | Motivo da falha após 3 tentativas |
| `created_at` | TIMESTAMPTZ | sim | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | sim | `DEFAULT NOW()`, atualizado on soft/hard-delete |

### RLS

```sql
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deletion_requests_tenant"
    ON deletion_requests
    USING (
        NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID = tenant_id
    );
```

Worker (`PrivacyDeletionProcessor`) usa `prisma.client` diretamente (modo privilegiado, bypass RLS).

### Índices

```sql
CREATE INDEX idx_deletion_requests_user_id ON deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_tenant_user ON deletion_requests(tenant_id, user_id);
CREATE INDEX idx_deletion_requests_status ON deletion_requests(status)
    WHERE status IN ('pending', 'soft_deleted');
```

### State Transitions

```
pending → soft_deleted → hard_deleted (completed)
pending → cancelled
soft_deleted → failed (após 3 retries do hard-delete)
```

---

## Alterações no modelo User

Novos valores para `User.status` (String — sem enum PG, consistente com o projeto):
- `deletion_pending` — solicitação criada, aguardando grace period
- `deleted` — hard-delete concluído

Enum Zod em `packages/types`:
```ts
export const UserStatusSchema = z.enum([
  'pending_verification',
  'active',
  'inactive',
  'deletion_pending',
  'deleted',
]);
```

---

## Novos campos: `deleted_at TIMESTAMPTZ NULL` em 14 tabelas

Migration 9-2 adiciona `deleted_at` a todas as tabelas marcadas para soft-delete:

| Tabela | Modelo Prisma |
|--------|--------------|
| `user_tenants` | `UserTenant` |
| `group_members` | `GroupMember` |
| `meeting_attendance` | `MeetingAttendance` |
| `meeting_telemetry` | `MeetingTelemetry` |
| `meeting_participants` | `MeetingParticipantRecord` |
| `meeting_events` | `MeetingEvent` |
| `reflections` | `Reflection` |
| `pastoral_alerts` | `PastoralAlert` |
| `pastoral_actions` | `PastoralAction` |
| `pastoral_notes` | `PastoralNote` |
| `outreach_intents` | `OutreachIntent` |
| `lesson_progress` | `LessonProgress` |
| `module_progress` | `ModuleProgress` |
| `trail_progress` | `TrailProgress` |

Padrão da migration para cada tabela:
```sql
ALTER TABLE <tabela> ADD COLUMN "deleted_at" TIMESTAMPTZ;
CREATE INDEX "idx_<tabela>_deleted_at" ON <tabela>(deleted_at) WHERE deleted_at IS NULL;
```

---

## Novo campo: `anonymized_user_ref TEXT NULL` em `audit_events`

A anonimização no hard-delete não pode usar o campo `user_id` (tipo UUID) para armazenar texto como `anonymous-<hash>`. Solução:

```sql
ALTER TABLE audit_events ADD COLUMN "anonymized_user_ref" TEXT;
```

No hard-delete:
```sql
UPDATE audit_events
   SET user_id            = NULL,
       anonymized_user_ref = 'anonymous-' || substring(encode(sha256(user_id::text::bytea), 'hex'), 1, 8)
 WHERE user_id = :userId;
```

Correlação intra-tenant: `anonymized_user_ref` é determinístico para o mesmo `userId`.
Não-reversível: hash SHA-256 truncado, sem salt por design (correlação interna necessária).

---

## Diagrama ER (simplificado)

```
User ─┬─ DeletionRequest (1:N, mas apenas 1 ativo por vez)
      ├─ deletion_requests.user_id
      └─ User.status → 'deletion_pending' | 'deleted'

DeletionRequest
  ├── status: pending → soft_deleted → hard_deleted
  ├── cancellable_until: +7d
  ├── deletion_deadline: +30d
  └── all_tenant_ids: snapshot de UserTenant no momento da criação

Tabelas soft-deletadas (14 tabelas)
  └── deleted_at: NULL → timestamp (soft-delete) → hard-DELETE (purge)

audit_events
  └── user_id: UUID → NULL
  └── anonymized_user_ref: NULL → 'anonymous-<hash>'  (no hard-delete)
```

---

## Nenhuma alteração de schema em:

- `consents` / `consent_records` — RETIDOS intactos (LGPD art. 16)
- `audit_events` — RETIDOS + anonimizados (apenas `user_id` e novo `anonymized_user_ref`)
- `participant_radar_status` / `participant_status_improved` — removidos via `onDelete: Cascade` quando `users` row for hard-deletada
- `privacy_export_jobs` — cleanup via raw DELETE (não usa soft-delete)
