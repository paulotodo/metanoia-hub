# Data Model: dados-demonstracao (Story 10-2)

> Migration a criar: `apps/api/prisma/migrations/<timestamp>_add_is_demo_data/migration.sql`

---

## Migration: `is_demo_data` em 12 tabelas

### Prisma Schema Diff

Adicionar em cada um dos 12 modelos:

```prisma
isDemoData Boolean @default(false) @map("is_demo_data")
```

E index composto:

```prisma
@@index([tenantId, isDemoData])
```

### Modelos afetados (na ordem de adição)

```prisma
model User {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model Group {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model GroupMember {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model Trail {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model Module {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model Lesson {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model TrailProgress {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model ModuleProgress {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model Meeting {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model MeetingAttendance {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model MeetingTelemetry {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}

model PastoralAction {
  // ...campos existentes...
  isDemoData Boolean @default(false) @map("is_demo_data")
  // ...
  @@index([tenantId, isDemoData])  // novo
}
```

### SQL equivalente

```sql
-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_tenant_id_is_demo_data_idx ON users(tenant_id, is_demo_data);

-- groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS groups_tenant_id_is_demo_data_idx ON groups(tenant_id, is_demo_data);

-- group_members
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS group_members_tenant_id_is_demo_data_idx ON group_members(tenant_id, is_demo_data);

-- trails
ALTER TABLE trails ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS trails_tenant_id_is_demo_data_idx ON trails(tenant_id, is_demo_data);

-- modules
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS modules_tenant_id_is_demo_data_idx ON modules(tenant_id, is_demo_data);

-- lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS lessons_tenant_id_is_demo_data_idx ON lessons(tenant_id, is_demo_data);

-- trail_progress
ALTER TABLE trail_progress ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS trail_progress_tenant_id_is_demo_data_idx ON trail_progress(tenant_id, is_demo_data);

-- module_progress
ALTER TABLE module_progress ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS module_progress_tenant_id_is_demo_data_idx ON module_progress(tenant_id, is_demo_data);

-- meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS meetings_tenant_id_is_demo_data_idx ON meetings(tenant_id, is_demo_data);

-- meeting_attendance
ALTER TABLE meeting_attendance ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS meeting_attendance_tenant_id_is_demo_data_idx ON meeting_attendance(tenant_id, is_demo_data);

-- meeting_telemetry
ALTER TABLE meeting_telemetry ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS meeting_telemetry_tenant_id_is_demo_data_idx ON meeting_telemetry(tenant_id, is_demo_data);

-- pastoral_actions
ALTER TABLE pastoral_actions ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS pastoral_actions_tenant_id_is_demo_data_idx ON pastoral_actions(tenant_id, is_demo_data);
```

---

## UUIDs fixos do seed (prefixo `01989b10-1002-7...`)

Todos UUID v7 com prefixo `01989b10-1002-7000-8000-` para evitar colisão com 7-2 (`019899a0-7002-...`).

| Entidade | UUID fixo |
|----------|-----------|
| DEMO_GROUP_ID | `01989b10-1002-7000-8000-000000000001` |
| DEMO_LEADER_ID (Marcos Silva) | `01989b10-1002-7000-8000-000000000002` |
| DEMO_USER_ANA_ID | `01989b10-1002-7000-8000-000000000003` |
| DEMO_USER_PEDRO_ID | `01989b10-1002-7000-8000-000000000004` |
| DEMO_USER_MARIA_ID | `01989b10-1002-7000-8000-000000000005` |
| DEMO_TRAIL_ID | `01989b10-1002-7000-8000-000000000010` |
| DEMO_MODULE_1_ID | `01989b10-1002-7000-8000-000000000011` |
| DEMO_MODULE_2_ID | `01989b10-1002-7000-8000-000000000012` |
| DEMO_LESSON_1_ID | `01989b10-1002-7000-8000-000000000021` |
| DEMO_LESSON_2_ID | `01989b10-1002-7000-8000-000000000022` |
| DEMO_LESSON_3_ID | `01989b10-1002-7000-8000-000000000023` |
| DEMO_LESSON_4_ID | `01989b10-1002-7000-8000-000000000024` |
| DEMO_MEETING_ID | `01989b10-1002-7000-8000-000000000030` |
| DEMO_ACTION_ANA_ID | `01989b10-1002-7000-8000-000000000041` |
| DEMO_ACTION_PEDRO_ID | `01989b10-1002-7000-8000-000000000042` |
| DEMO_ACTION_MARIA_ID | `01989b10-1002-7000-8000-000000000043` |

---

## Entidade: DemoStatus (response apenas — sem tabela nova)

Endpoint `GET /api/v1/onboarding/demo-status` retorna:

```typescript
// packages/types/src/onboarding.ts (extensão)
export const DemoStatusResponseSchema = z.object({
  hasDemoData: z.boolean(),       // tenant tem isDemoData=true em qualquer tabela?
  hasRealData: z.boolean(),       // tem grupos sem isDemoData?
  nudgeDismissed: z.boolean(),    // metadata.demoDismissedAt presente?
  demoRecordCount: z.number(),    // contagem total de registros demo
});
export type DemoStatusResponse = z.infer<typeof DemoStatusResponseSchema>;
```

---

## Entidade: Tenant.metadata (extensão de chave)

Nenhuma migration necessária — `metadata` já é `JsonB @default("{}")`.

Nova chave usada por esta story:
```json
{
  "demoDismissedAt": "2026-06-13T10:00:00.000Z"
}
```

Atualizável via `PATCH /api/v1/onboarding/demo-nudge-dismiss` (204).

---

## Tabela de estado do semáforo por participante demo

| Participante | Semáforo | Trail Progress | Meeting Presence | Ação Pastoral |
|---|---|---|---|---|
| Ana Costa | verde | 80% (modulo 1 completo, módulo 2 em 60%) | `integral` | concluída |
| Pedro Santos | amarelo | 40% (módulo 1 em 40%, módulo 2 não iniciado) | `parcial` | pendente |
| Maria Oliveira | vermelho | 10% (módulo 1 em 10%, sem progresso módulo 2) | `ausente` | urgente |
| Marcos Silva (líder) | — | — | `integral` | — |
