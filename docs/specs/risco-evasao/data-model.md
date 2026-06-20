# Data Model — Story 13.3: Detecção de Risco de Evasão (FR66)

## Migrations

### M1 — `users.last_seen_at` (C1 / DECISÃO-ESCOPO-02)
```sql
ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMPTZ NULL;
```
Prisma:
```prisma
model User {
  // ...
  lastSeenAt DateTime? @map("last_seen_at") @db.Timestamptz
}
```
- Global por usuário (não por grupo).
- Populado pelo `LastSeenInterceptor` (debounce Redis 15min).
- Teste RLS se `users` possui policy.

### M2 — `groups.status` + `groups.break_until` (C3 / FR66-05)
```sql
ALTER TABLE groups
  ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active',
  ADD COLUMN break_until TIMESTAMPTZ NULL;
```
Prisma:
```prisma
model Group {
  // ...
  status     String    @default("active") @db.VarChar(16) // 'active' | 'on_break'
  breakUntil DateTime? @map("break_until") @db.Timestamptz
}
```
- `status='on_break'` exige `breakUntil` (validado no Zod).
- Auto-resume: `status='on_break' AND breakUntil < now()` → volta a `'active'` (avaliado no job diário).
- Teste RLS obrigatório (tabela `groups` tem RLS).

### M3 — `participant_radar_status.risk_reason` (C2)
```sql
ALTER TABLE participant_radar_status ADD COLUMN risk_reason VARCHAR(500) NULL;
```
Prisma:
```prisma
model ParticipantRadarStatus {
  // ...
  riskReason String? @map("risk_reason") @db.VarChar(500)
}
```
- Mensagem pastoral PT-BR curta exibida no card do Radar.
- Gravado no mesmo upsert do status (C2).
- Teste RLS obrigatório.

### M4 — `evasion_job_log` (novo, opcional — métricas/alerta)
```sql
CREATE TABLE evasion_job_log (
  id                 UUID PRIMARY KEY,
  tenant_id          UUID NULL,
  duration_ms        INTEGER NOT NULL,
  tenants_processed  INTEGER NOT NULL,
  participants_flagged INTEGER NOT NULL,
  status             VARCHAR(16) NOT NULL, -- 'success' | 'failed'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: permitir INSERT com tenant_id IS NULL (igual mv_refresh_log)
```
Prisma `EvasionJobLog` análogo a `MvRefreshLog`.

## Enums

```prisma
// existente — reuso
enum RadarStatus { verde, amarelo, vermelho }
enum RadarTrend  { melhorando, estavel, declinio }
```

```ts
// packages/types/src/group.ts (novo)
export const GroupStatusSchema = z.enum(['active', 'on_break']);
```

## Entidades de leitura (sem migration)

| Entidade | Uso na detecção | Campos-chave |
|----------|-----------------|--------------|
| `Meeting` | reuniões do grupo | id, tenantId, groupId, scheduledFor, status |
| `MeetingAttendance` | presença/ausência | meetingId, userId, presenceType; `@@unique([meetingId,userId])` |
| `GroupMember` | participantes ativos do grupo | groupId, userId, role, deletedAt (ativo = deletedAt NULL) |
| `ParticipantStatusImproved` | transições positivas (CelebrationBanner) | previousStatus, newStatus, createdAt |

## riskReason — valores semânticos

| Critério acionado | `risk_reason` (PT-BR pastoral) |
|-------------------|--------------------------------|
| A (ausências) | `"3 faltas consecutivas nas reuniões do grupo"` |
| B (inatividade) | `"sem acesso à plataforma há mais de 2 semanas"` |
| A + B | `"faltas consecutivas e sem acesso recente"` |

## Invariantes
- Toda nova linha: UUID v7 (`generateId()`/`uuidv7()`), nunca `@default(uuid())`.
- `tenant_id` em toda tabela de domínio; RLS ativa.
- Datas: TIMESTAMPTZ no DB, ISO 8601 nas respostas.
- Nulls explícitos; sem `undefined` em JSON.
