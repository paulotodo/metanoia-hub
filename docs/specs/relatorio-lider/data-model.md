# Data Model — Relatório Consolidado por Líder (FR79 / Story 13.2a)

> Phase 1. **Sem migration**: toda fonte é entidade existente. Apenas DTOs
> novos (Zod) em `packages/types/src/reports/leader-summary.ts`.

## Entidades existentes reutilizadas (sem alteração de schema)

### Entity: Group (`groups`)
| Campo | Tipo | Uso |
|-------|------|-----|
| id | uuid | `groupId` na resposta |
| tenantId | uuid | RLS (nunca exposto) |
| name | string | `groupName` na resposta |

Universo: `lider` → grupos via `GroupMember.role='lider'`; `admin_tenant` →
todos do tenant.

### Entity: GroupMember (`group_members`)
| Campo | Tipo | Uso |
|-------|------|-----|
| groupId | uuid | join |
| userId | uuid | dedup `totalParticipants` (DEC-INF-04) |
| role | string (`lider`\|`admin`\|`membro`) | derivar universo do líder |
| deletedAt | datetime? | **ativo = deletedAt IS NULL** (fonte de `activeParticipantsCount`) |

### Entity: GroupTrail (`group_trails`)
Liga grupo↔trilha. Usado para filtrar `TrailProgress` às trilhas do grupo.

### Entity: Meeting (`meeting`)
| Campo | Tipo | Uso |
|-------|------|-----|
| id, groupId, tenantId | — | reuniões do grupo |
| scheduledFor | datetime | filtro de período |
| status | string | reuniões realizadas |

### Entity: MeetingAttendance (`meeting_attendance`)
| Campo | Tipo | Uso |
|-------|------|-----|
| meetingId, userId, tenantId | — | linhas de presença por reunião |

`avgAttendancePercent` por grupo = média, sobre as reuniões do período, de
`(linhas de attendance da reunião) / (membros ativos do grupo)`. **`null`**
se nenhuma reunião no período (dec-008).

### Entity: ParticipantRadarStatus (`participant_radar_status`)
| Campo | Tipo | Uso |
|-------|------|-----|
| groupId | uuid | join |
| participantId | uuid | chave do participante (NÃO `userId`) |
| status | `RadarStatus` (`verde`\|`amarelo`\|`vermelho`) | `atRisk` = `amarelo`\|`vermelho` |

`atRiskCount` por grupo = `count(status IN ('amarelo','vermelho'))`.

### Entity: TrailProgress (`trail_progress`)
| Campo | Tipo | Uso |
|-------|------|-----|
| userId, trailId, tenantId | — | join (membros ativos × trilhas do grupo) |
| progressPercent | int 0..100 | `avgTrailProgressPercent` (média; `0` se nenhum) |
| completedAt | datetime? | `overallTrailCompletionPercent` (NOT NULL = concluído) |

## Tipos derivados / DTOs novos — `packages/types/src/reports/leader-summary.ts`

### LeaderSummaryPeriod (enum)
`z.enum(['7d','30d','90d','custom'])`.

### LeaderSummaryQuerySchema (query params)
| Campo | Tipo | Regra |
|-------|------|-------|
| period | LeaderSummaryPeriod | obrigatório; default `30d` no controller |
| startDate | string ISO 8601 (offset) | obrigatório sse `period='custom'` |
| endDate | string ISO 8601 (offset) | obrigatório sse `period='custom'`; `startDate < endDate` |
| groupId | uuid | opcional; filtra para 1 grupo (drill-down) |

Refinement: `period='custom'` ⇒ exige `startDate`+`endDate` e `startDate<endDate`.

### LeaderGroupMetricsSchema (1 por grupo)
| Campo | Tipo | Null? |
|-------|------|-------|
| groupId | uuid | não |
| groupName | string | não |
| avgAttendancePercent | number 0..100 \| null | **null** se sem reuniões (dec-008) |
| avgTrailProgressPercent | number 0..100 | não (0 se sem trilha) |
| atRiskCount | int ≥ 0 | não |
| activeParticipantsCount | int ≥ 0 | não |

### LeaderSummaryOverallSchema (`summary`)
| Campo | Tipo | Cálculo |
|-------|------|---------|
| totalGroups | int | tamanho do universo |
| totalParticipants | int | soma `activeParticipantsCount` **dedup por userId** (DEC-INF-04) |
| overallAttendancePercent | number 0..100 \| null | média **ponderada por activeParticipantsCount** (dec-009); null se todos grupos sem reuniões |
| overallTrailCompletionPercent | number 0..100 | membros com `completedAt!=null` / membros ativos com trilha |

### LeaderSummaryMetaSchema (`meta`)
`{ period, startDate (ISO), endDate (ISO) }` — janela efetiva resolvida.

### LeaderSummaryResponseSchema (envelope)
`{ data: { groups: LeaderGroupMetrics[], summary: LeaderSummaryOverall }, meta: LeaderSummaryMeta }`.

Quando `groupId` fornecido: `groups` = array com 1 item; `summary` calculado só
para esse grupo (dec-011). Quando grupo alheio/inexistente no universo:
`groups: []`, summary zerado, sem 403 (Decision 5).

## State transitions
N/A — leitura agregada read-only. Nenhuma entidade muda de estado.
