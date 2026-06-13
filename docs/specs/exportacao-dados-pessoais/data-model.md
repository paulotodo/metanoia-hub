# Data Model: exportacao-dados-pessoais

**Feature:** Story 9-1 — Exportação de Dados Pessoais / Portabilidade LGPD
**Data:** 2026-06-12

---

## Entity: PrivacyExportJob

**Tabela:** `privacy_export_jobs`
**Propósito:** Rastrear o ciclo de vida de cada solicitação de export de dados pessoais.

### Campos

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `id` | UUID PK | sim | `uuidv7()` |
| `tenant_id` | UUID FK | sim | Tenant ativo no momento da solicitação; RLS scope |
| `user_id` | UUID | sim | Usuário titular dos dados |
| `format` | VARCHAR(4) | sim | `'json'` ou `'pdf'` |
| `status` | VARCHAR(16) | sim | Default `'accepted'`; enum: `accepted\|processing\|completed\|failed` |
| `all_tenant_ids` | UUID[] | sim | Todos os tenants do usuário; write-once; não exposto na API |
| `object_key` | TEXT | não | MinIO object key quando `completed` |
| `signed_url` | TEXT | não | Signed URL quando `completed` (auditoria; polling lê Redis) |
| `expires_at` | TIMESTAMPTZ | não | Validade da signed URL (48h) |
| `failure_reason` | TEXT | não | Motivo da falha após 3 tentativas |
| `requested_at` | TIMESTAMPTZ | sim | Timestamp da solicitação |
| `completed_at` | TIMESTAMPTZ | não | Timestamp de conclusão |
| `created_at` | TIMESTAMPTZ | sim | Default `NOW()` |

### RLS

```sql
ALTER TABLE privacy_export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY privacy_export_jobs_tenant ON privacy_export_jobs
  USING (NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID = tenant_id);
```

### Índices

```sql
CREATE INDEX idx_privacy_export_jobs_user_id ON privacy_export_jobs(user_id);
CREATE INDEX idx_privacy_export_jobs_tenant_user ON privacy_export_jobs(tenant_id, user_id);
CREATE INDEX idx_privacy_export_jobs_status ON privacy_export_jobs(status) WHERE status IN ('accepted', 'processing');
```

### State Transitions

```
accepted → processing → completed
                      → failed (após 3 tentativas BullMQ)
```

---

## Entity: UserProfileExport (tipo de saída, não tabela)

**Origem:** Model `User` em `schema.prisma` (campos verificados empiricamente)
**Definido em:** `packages/types/src/privacy/export.ts` como `UserProfileExportSchema`

### Campos

| Campo | Tipo Zod | Notas |
|-------|----------|-------|
| `id` | `z.string().uuid()` | UUID v7 do usuário |
| `email` | `z.string().email()` | |
| `name` | `z.string()` | |
| `status` | `z.string()` | `'pending_verification'\|'active'\|...` |
| `onboardingCompletedAt` | `z.string().nullable()` | ISO 8601 ou null |
| `createdAt` | `z.string()` | ISO 8601 |
| `updatedAt` | `z.string()` | ISO 8601 |

**EXCLUÍDO:** `tenantId` (metadado interno de multi-tenancy).
**AUSENTES DO SCHEMA:** `phone, avatarUrl, locale, timezone` — não existem no model `User`.

---

## Schemas Zod em packages/types/src/privacy/export.ts

### PrivacyExportRequestSchema
```typescript
z.object({
  format: z.enum(['json', 'pdf'])
})
```

### PrivacyExportJobResponseSchema (202)
```typescript
z.object({
  data: z.object({
    jobId: z.string().uuid(),
    status: z.enum(['accepted']),
    estimatedCompletionHours: z.number()
  })
})
```

### PrivacyExportStatusSchema (polling GET)
```typescript
z.object({
  jobId: z.string().uuid(),
  status: z.enum(['accepted', 'processing', 'completed', 'failed']),
  signedUrl: z.string().url().nullable(),
  expiresAt: z.string().nullable(),    // ISO 8601
  failureReason: z.string().nullable()
})
```

### UserProfileExportSchema
```typescript
z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  status: z.string(),
  onboardingCompletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})
```

### UserExportDataSchema (retorno de users.exportUserData)
```typescript
z.object({
  profile: UserProfileExportSchema.nullable(),
  tenants: z.array(z.object({
    tenantId: z.string().uuid(),
    role: z.string(),
    joinedAt: z.string()   // ISO 8601
  }))
})
```

### GroupsExportDataSchema
```typescript
z.object({
  memberships: z.array(z.object({
    groupId: z.string().uuid(),
    groupName: z.string(),
    role: z.string(),
    joinedAt: z.string()
  }))
})
```

### MeetingsExportDataSchema
```typescript
z.object({
  attendance: z.array(z.object({
    meetingId: z.string().uuid(),
    title: z.string(),
    joinTime: z.string(),
    leaveTime: z.string(),
    presenceType: z.string()
  })),
  participantRecords: z.array(z.object({
    meetingId: z.string().uuid(),
    response: z.string().nullable(),
    joinedAt: z.string().nullable()
  }))
})
```

### TrailsExportDataSchema
```typescript
z.object({
  trailProgress: z.array(z.object({
    trailId: z.string().uuid(),
    trailName: z.string(),
    progressPercent: z.number(),
    completedAt: z.string().nullable()
  })),
  lessonProgress: z.array(z.object({
    lessonId: z.string().uuid(),
    lessonName: z.string(),
    status: z.string(),
    completedAt: z.string().nullable()
  }))
})
```

### PastoralExportDataSchema
```typescript
z.object({
  alertsAboutMe: z.array(z.object({
    id: z.string().uuid(),
    signalType: z.string(),
    createdAt: z.string()
  })),
  notesAboutMe: z.array(z.object({
    id: z.string().uuid(),
    noteType: z.string(),
    occurredAt: z.string(),
    content: z.string()
  }))
})
```

### ConsentExportDataSchema
```typescript
z.object({
  acceptances: z.array(z.object({
    documentType: z.string(),
    acceptedAt: z.string()
  })),
  withdrawals: z.array(z.object({
    consentType: z.string(),
    timestamp: z.string()
  }))
})
```

### AuditExportDataSchema
```typescript
z.object({
  events: z.array(z.object({
    action: z.string(),
    resource: z.string(),
    resourceId: z.string().nullable(),
    timestamp: z.string()
  }))
})
```

### FullExportPayloadSchema (payload do arquivo gerado)
```typescript
z.object({
  exportedAt: z.string(),
  userId: z.string().uuid(),
  format: z.enum(['json', 'pdf']),
  tenants: z.array(z.object({
    tenantId: z.string().uuid(),
    users: UserExportDataSchema,
    groups: GroupsExportDataSchema,
    meetings: MeetingsExportDataSchema,
    trails: TrailsExportDataSchema,
    pastoral: PastoralExportDataSchema,
    consent: ConsentExportDataSchema,
    audit: AuditExportDataSchema
  }))
})
```

---

## Constantes em packages/types/src/privacy/export.ts

```typescript
export const PRIVACY_EXPORT_QUEUE_NAME = 'queue:privacy-export';
export const PRIVACY_EXPORT_JOB_KEY_PREFIX = 'cache:privacy:export-job';
export const PRIVACY_EXPORT_JOB_TTL_SECONDS = 172800; // 48h
export const PRIVACY_EXPORT_SIGNED_URL_SECONDS = 172800; // 48h
export const PRIVACY_EXPORT_ESTIMATED_HOURS = 24;
export const PRIVACY_EXPORT_MAX_CONCURRENT_PER_USER = 1;
```

---

## Redis — Job Status

**Chave:** `cache:privacy:export-job:<jobId>`
**TTL:** 172800s (48h)
**Valor (JSON):**
```json
{
  "jobId": "uuid",
  "status": "accepted|processing|completed|failed",
  "signedUrl": "https://...|null",
  "expiresAt": "ISO8601|null",
  "failureReason": "string|null"
}
```

---

## MinIO — Object Key

**Padrão:** `exports/privacy/{userId}/{YYYY-MM-DD}-{jobId}.{format}`

Exemplo: `exports/privacy/01906a12-0abc-7def-0123-456789abcdef/2026-06-12-01906b34-0def-7abc-9876-123456789abc.json`
