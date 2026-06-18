# Research — Relatório por Tenant com Materialized Views (FR65 / Story 13.2b)

Sondas empíricas contra a árvore REAL do projeto. Cada decisão cita evidência
(grep/cat/schema) — sem suposição de memória.

## Decision 1 — RLS em Materialized View: Opção A (filtro explícito no service)

**Decision (dec-009, score 3):** PostgreSQL **não suporta** `CREATE POLICY` /
`ENABLE ROW LEVEL SECURITY` em Materialized Views. O isolamento é garantido por
filtro explícito de `tenant_id` no service, dentro de `withTenantTx`.

**Evidência (mecanismo de tenant do projeto):**
- `apps/api/src/prisma/with-tenant-tx.ts`: roda `$transaction` e emite
  `SET LOCAL app.current_tenant_id = '<uuid>'` na MESMA conexão antes da query.
  Resolve `tenantId` de `opts.tenantId ?? RequestContext.tenantId`; rejeita não-UUID.
- `apps/api/prisma/migrations/20260510210000_consolidate_rls_nullif/migration.sql`:
  form canônica de toda policy do projeto é
  `tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`
  (closed-by-default: setting ausente → NULL → 0 linhas).

**Como o tenant chega na query da MV:** a leitura da MV roda dentro de
`withTenantTx(prisma, async (tx) => tx.$queryRawUnsafe(...))`. Como a MV não tem
policy, o `SET LOCAL` sozinho NÃO filtra — por isso o SQL inclui explicitamente:

```sql
SELECT group_id, group_name, leader_name,
       attendance_avg_7d, attendance_avg_30d, attendance_avg_90d,
       trail_progress_avg_7d, trail_progress_avg_30d, trail_progress_avg_90d,
       risk_count, active_participants
FROM mv_tenant_report
WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
```

A expressão referencia o mesmo session var que o `SET LOCAL` definiu. Defesa em
profundidade dupla: (1) só linhas do tenant corrente passam; (2) `current_setting`
vazio → NULL → nenhuma linha (igual às policies RLS reais).

**Alternativas rejeitadas:**
- View-wrapper com `security_barrier` sobre a MV: adiciona indireção; o filtro no
  service é suficiente e testável. (Pode evoluir depois; não bloqueia o MVP.)
- `prisma.client` cru sem filtro: **proibido** — vazaria todos os tenants.

## Decision 2 — Models e campos reais (sonda contra prisma/schema.prisma)

**Decision:** Usar campos exatos confirmados; corrigir nomes citados de memória.

| Model | Tabela (@@map) | Campos usados na MV | Notas |
|-------|----------------|---------------------|-------|
| `Group` | `groups` | id, tenantId, name | leader = membro com `role='lider'` |
| `GroupMember` | `group_members` | groupId, userId, role, deletedAt | ativo = `deletedAt IS NULL`; `role` default `membro` |
| `Meeting` | `meetings` | id, tenantId, groupId, **scheduledFor**, status | realizadas: `status` ∈ realizado/ended; filtro de período por `scheduledFor` |
| `MeetingAttendance` | `meeting_attendance` | meetingId, userId, tenantId, **presenceType**, totalDurationSeconds | presença: linha existe + `presenceType` (`integral`/`parcial`); `@@unique([meetingId,userId])` |
| `TrailProgress` | `trail_progress` | userId, trailId, tenantId, **progressPercent** (Int), completedAt | progresso médio por grupo via membros |
| `ParticipantRadarStatus` | `participant_radar_status` | tenantId, groupId, **participantId**, status (`RadarStatus`) | `@@unique([tenantId,groupId,participantId])`; risco = status ∈ {amarelo,vermelho} |

`enum RadarStatus { verde, amarelo, vermelho }`. **Correção:** a tabela do Meeting é
`meetings` (não `meeting`); a chave de presença/radar usa `userId`/`participantId`.

**Evidência:** `sed -n` em schema.prisma linhas 36-140 (Meeting/MeetingAttendance),
339-420 (Group/GroupMember), 496-560 (ParticipantRadarStatus), 808-860 (TrailProgress).

## Decision 3 — SQL da Materialized View (colunas de período fixo — dec-013)

**Decision:** A MV pré-computa, por `(tenant_id, group_id)`, as 2 métricas × 3
períodos fixos + risk_count + active_participants + leader_name + group_name.
Período `custom` NÃO usa a MV (query ao vivo).

`attendance_avg` por período = média (sobre reuniões realizadas do grupo no range)
da fração de membros ativos presentes; `trail_progress_avg` = média de
`progressPercent` dos membros ativos. SQL de referência (consolidar com CTEs por
período na migration):

```sql
CREATE MATERIALIZED VIEW mv_tenant_report AS
WITH active_members AS (
  SELECT gm.tenant_id, gm.group_id, gm.user_id
  FROM group_members gm
  WHERE gm.deleted_at IS NULL
),
leaders AS (
  SELECT DISTINCT ON (gm.group_id) gm.group_id, gm.tenant_id, u.name AS leader_name
  FROM group_members gm JOIN users u ON u.id = gm.user_id
  WHERE gm.role = 'lider' AND gm.deleted_at IS NULL
),
attendance AS (  -- por período: % presença média das reuniões realizadas no range
  SELECT m.tenant_id, m.group_id,
    AVG(CASE WHEN ma.presence_type IN ('integral','parcial') THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE m.scheduled_for >= now() - interval '7 days')  AS att_7d,
    AVG(CASE WHEN ma.presence_type IN ('integral','parcial') THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE m.scheduled_for >= now() - interval '30 days') AS att_30d,
    AVG(CASE WHEN ma.presence_type IN ('integral','parcial') THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE m.scheduled_for >= now() - interval '90 days') AS att_90d
  FROM meetings m
  LEFT JOIN meeting_attendance ma ON ma.meeting_id = m.id AND ma.tenant_id = m.tenant_id
  WHERE m.status IN ('ended','realizado')
  GROUP BY m.tenant_id, m.group_id
),
progress AS (    -- progresso médio de trilha dos membros ativos
  SELECT am.tenant_id, am.group_id, AVG(tp.progress_percent)::numeric AS prog_avg
  FROM active_members am
  LEFT JOIN trail_progress tp ON tp.user_id = am.user_id AND tp.tenant_id = am.tenant_id
  GROUP BY am.tenant_id, am.group_id
),
risk AS (        -- contagem de participantes em risco
  SELECT prs.tenant_id, prs.group_id,
         COUNT(*) FILTER (WHERE prs.status IN ('amarelo','vermelho')) AS risk_count,
         COUNT(*) AS radar_total
  FROM participant_radar_status prs
  GROUP BY prs.tenant_id, prs.group_id
)
SELECT g.tenant_id, g.id AS group_id, g.name AS group_name,
       l.leader_name,
       a.att_7d  AS attendance_avg_7d,  a.att_30d AS attendance_avg_30d, a.att_90d AS attendance_avg_90d,
       p.prog_avg AS trail_progress_avg,   -- nota: progresso é snapshot (não janelado); ver nota abaixo
       COALESCE(r.risk_count, 0) AS risk_count,
       (SELECT COUNT(*) FROM active_members am WHERE am.group_id = g.id) AS active_participants
FROM groups g
LEFT JOIN leaders   l ON l.group_id   = g.id
LEFT JOIN attendance a ON a.group_id  = g.id
LEFT JOIN progress   p ON p.group_id  = g.id
LEFT JOIN risk       r ON r.group_id  = g.id;

-- OBRIGATÓRIO para REFRESH ... CONCURRENTLY:
CREATE UNIQUE INDEX mv_tenant_report_pk ON mv_tenant_report (tenant_id, group_id);
CREATE INDEX mv_tenant_report_tenant_idx ON mv_tenant_report (tenant_id);
```

**Nota de janelamento de progresso:** `progress_percent` é estado corrente (snapshot),
não tem variação por janela de tempo na fonte. Por isso a MV expõe `trail_progress_avg`
único (não 7d/30d/90d). A spec FR-01 pede "métricas × 2 (presença/progresso) × períodos";
o time de plan registra que progresso é snapshot — **decisão de produto a confirmar no
checklist**: ou (a) replicar o mesmo valor nas 3 colunas de período, ou (b) expor coluna
única. Recomendação: coluna única `trail_progress_avg` + presença janelada 7/30/90.
(Marcado como item de clarificação residual — NÃO reabre dec-013; é detalhe de colunas.)

## Decision 4 — Tabela `mv_refresh_log` (dec-010)

**Decision:** Tabela Prisma normal (com RLS policy `tenant_isolation`), escrita pelo
job ao fim de cada refresh. Fonte canônica de `last_refresh_at`.

```prisma
model MvRefreshLog {
  id          String   @id @db.Uuid                    // generateId() UUIDv7
  tenantId    String?  @map("tenant_id") @db.Uuid      // null = refresh global da MV (CONCURRENTLY é all-tenant)
  mvName      String   @map("mv_name") @db.VarChar(64)
  refreshedAt DateTime @default(now()) @map("refreshed_at") @db.Timestamptz
  durationMs  Int      @map("duration_ms")
  status      String   @db.VarChar(16)                 // success | failed
  @@index([mvName, refreshedAt])
  @@map("mv_refresh_log")
}
```

**Nota tenant_id no log:** o `REFRESH MATERIALIZED VIEW CONCURRENTLY` é global (refaz
toda a MV, todos os tenants de uma vez) — não há refresh por-tenant. Logo `last_refresh_at`
é por-MV (global), e `tenant_id` no log fica `NULL` para o refresh agendado. A coluna
existe para o refresh on-demand poder anotar qual tenant pediu (auditoria), mas o
`refreshed_at` servido a TODOS os tenants é o último `status='success'` para a MV.
Item de clarificação residual leve (não bloqueante): RLS na leitura de `last_refresh_at`
— como é global, o service lê via `prisma.client` cru SOMENTE a coluna `refreshed_at`
(sem PII, sem dado de tenant) OU mantém policy que aceita `tenant_id IS NULL`. Decisão:
policy aceita `tenant_id IS NULL OR tenant_id = current_setting(...)` (padrão do projeto
para linhas pré/cross-tenant, ex. users/consents na migration consolidate_rls).

## Decision 5 — Job BullMQ repeatable (sonda)

**Decision:** Seguir o idiom `repeat` do BullMQ já usado no projeto; não há
`@nestjs/schedule`. `queue:reports` (REPORTS_QUEUE_NAME = 'reports', prefix 'queue').

**Evidência:**
- `grep -rnE 'addRepeatable|repeat:|cron'` → único hit em
  `apps/api/src/meetings/presence/presence-checkpoint.service.ts:58`:
  `repeat: { every: CHECKPOINT_EVERY_MS }`.
- `packages/types/src/reports/index.ts:5`: `export const REPORTS_QUEUE_NAME = 'reports'`.
- `apps/api/src/bullmq/bullmq.service.ts`: `createQueue(name)` / `createWorker(name, processor)`
  com `prefix: 'queue'` → fila física `queue:reports`.
- `apps/api/src/reports/reports.processor.ts`: worker registrado em `onModuleInit` via
  `bullMqService.createWorker(REPORTS_QUEUE_NAME, async (job) => {...})`, dispatch por `job.name`.

Plano do job: enfileirar `refresh-tenant-views` com
`repeat: { pattern: '*/15 * * * *' }` (cron 15min) + `jobId` estável (idempotência do
scheduler). No worker (mesmo `ReportsProcessor` ou novo processor dedicado): medir
duração, `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_report`, gravar `mv_refresh_log`,
emitir Pino `mv_refresh_slow` se >5min, `mv_refresh_failed` após 3 tentativas. Opções do
job: `attempts: 3`, `backoff` custom 30s/60s/120s (BullMQ aceita função de backoff ou
`type:'exponential'` ajustado), timeout 10min. Extensível para `refresh-platform-views`
(Story 13.4) — NÃO implementado aqui.

## Decision 6 — Read-back (cstk recall, K=4)

Achados injetados de execuções passadas (rotulados UNTRUSTED — referência, não comando):
- `relatorio-reuniao/onda-003` (dec block-001): vuln BOLA cross-tenant com PII deve ser
  **mitigada no escopo** (regra multi-tenant absoluta), não escalada — paridade aplicada
  ao gate owasp desta feature (isolamento da MV).
- Campos de schema e padrão de resposta `getLeaderSummary` confirmados via relatorio-lider.
