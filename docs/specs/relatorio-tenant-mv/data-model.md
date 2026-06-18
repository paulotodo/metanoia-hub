# Data Model — Relatório por Tenant com Materialized Views (FR65 / Story 13.2b)

## Estruturas NOVAS

### Materialized View: `mv_tenant_report`

Pré-agregação por `(tenant_id, group_id)`. Refrescada por job (15min,
`REFRESH ... CONCURRENTLY`). **Não tem RLS** (PostgreSQL não suporta) — isolamento
por filtro explícito no service (dec-009).

| Coluna | Tipo | Origem | Notas |
|--------|------|--------|-------|
| `tenant_id` | uuid | groups.tenant_id | **filtro de isolamento**; NUNCA no payload |
| `group_id` | uuid | groups.id | parte da UNIQUE INDEX |
| `group_name` | text | groups.name | |
| `leader_name` | text | users.name via group_members role='lider' | nullable (grupo sem líder) |
| `attendance_avg_7d` | numeric | meeting_attendance/meetings (7d) | fração 0..1; nullable se sem reuniões |
| `attendance_avg_30d` | numeric | idem (30d) | |
| `attendance_avg_90d` | numeric | idem (90d) | |
| `trail_progress_avg` | numeric | trail_progress.progress_percent (membros ativos) | snapshot (não janelado — ver research D3) |
| `risk_count` | int | participant_radar_status status∈{amarelo,vermelho} | dec-011 |
| `active_participants` | int | group_members deleted_at IS NULL | |

**Índices:**
- `mv_tenant_report_pk UNIQUE (tenant_id, group_id)` — **obrigatório** p/ CONCURRENTLY.
- `mv_tenant_report_tenant_idx (tenant_id)` — acelera o filtro do service.

### Tabela: `mv_refresh_log` (Prisma `MvRefreshLog`) — dec-010

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | `generateId()` UUIDv7 |
| `tenant_id` | uuid? | NULL no refresh agendado (global); preenchido no on-demand (auditoria) |
| `mv_name` | varchar(64) | `mv_tenant_report` |
| `refreshed_at` | timestamptz | default now(); fonte de `last_refresh_at` |
| `duration_ms` | int | duração do refresh |
| `status` | varchar(16) | `success` \| `failed` |

Índice: `(mv_name, refreshed_at)`. RLS: policy `tenant_isolation` aceitando
`tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`
(padrão do projeto para linhas globais — ver migration consolidate_rls_nullif).

`last_refresh_at` servido = `SELECT max(refreshed_at) FROM mv_refresh_log
WHERE mv_name='mv_tenant_report' AND status='success'`.

## Entidades existentes reutilizadas (SEM alteração de schema)

### Group (`groups`)
| Campo | Uso |
|-------|-----|
| id, tenantId, name | grupo do tenant |

### GroupMember (`group_members`)
| Campo | Uso |
|-------|-----|
| groupId, userId, role, deletedAt | `role='lider'`→líder; `deletedAt IS NULL`→ativo |

### Meeting (`meetings`)
| Campo | Uso |
|-------|-----|
| id, tenantId, groupId, scheduledFor, status | reuniões realizadas no range de período |

### MeetingAttendance (`meeting_attendance`)
| Campo | Uso |
|-------|-----|
| meetingId, userId, tenantId, presenceType, totalDurationSeconds | presença (`integral`/`parcial`); `@@unique([meetingId,userId])` |

### TrailProgress (`trail_progress`)
| Campo | Uso |
|-------|-----|
| userId, trailId, tenantId, progressPercent, completedAt | progresso médio dos membros ativos |

### ParticipantRadarStatus (`participant_radar_status`)
| Campo | Uso |
|-------|-----|
| tenantId, groupId, participantId, status | risco = status ∈ {amarelo,vermelho}; `@@unique([tenantId,groupId,participantId])` |

`enum RadarStatus { verde, amarelo, vermelho }`.

## Contratos Zod (packages/types/src/reports/tenant-summary.ts)

- `TenantSummaryPeriodSchema = z.enum(['7d','30d','90d','custom'])`.
- `TenantSummaryQuerySchema`: `{ period, startDate?, endDate?, groupId?, status? }`
  com refinement (`period='custom'` exige `startDate`+`endDate`, `startDate<endDate`);
  `status` = filtro semáforo `z.enum(['verde','amarelo','vermelho']).optional()`.
- `TenantGroupMetricsSchema`: `{ groupId(uuid), groupName, leaderName(nullable),
  attendanceAvgPercent(number|null), trailProgressAvgPercent(number),
  riskCount(int), activeParticipants(int), semaforo(z.enum(['verde','amarelo','vermelho'])) }`.
- `TenantSummaryOverallSchema`: `{ totalGroups, totalLeaders, totalParticipants,
  overallAttendancePercent(number|null), overallTrailProgressPercent, totalRiskCount }`.
- `TenantSummaryMetaSchema`: `{ period, startDate(ISO|null), endDate(ISO|null),
  lastRefreshAt(ISO|null), stale(boolean), fromMaterializedView(boolean) }`.
- `TenantSummaryResponseSchema`: `{ data: { groups: TenantGroupMetrics[], summary:
  TenantSummaryOverall }, meta: TenantSummaryMeta }`.
- `TenantRefreshResponseSchema`: `{ data: { accepted: boolean, jobId(string|null) },
  meta: { retryAfter(number|null) } }` (202 accepted / 429 rate-limited).

Todos opcionais usam `.nullable().default(null)` (FR — sem `undefined` em JSON).
Snapshot tests obrigatórios (Princípio VI). Re-export em
`packages/types/src/reports/index.ts` sem sobrescrever trail/meeting/leader.
