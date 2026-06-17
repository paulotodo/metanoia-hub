# Data Model — Relatório por Reunião (FR63)

**Feature**: relatorio-reuniao | **Fase**: Phase 1 (Design)

Esta feature **não adiciona tabelas nem migrations**. Reusa entidades
existentes e introduz apenas **tipos derivados / DTOs Zod** em
`packages/types`. Não há mudança em policy de RLS → nenhum novo RLS spec
obrigatório por migration (mas testes de isolamento de leitura são exigidos
pela constitution para o caminho de relatório — ver quickstart.md).

---

## Entidades existentes reutilizadas (sem alteração de schema)

### Entity: Meeting (`meetings`)
Fonte: `apps/api/prisma/schema.prisma` (model Meeting).

| Campo | Tipo | Uso no FR63 |
|-------|------|-------------|
| `id` | uuid | identificador da reunião (`:id` no endpoint) |
| `tenantId` | uuid | isolamento (RLS, AsyncLocalStorage) — nunca parâmetro |
| `groupId` | uuid | resolve `groupName` e autorização de líder |
| `title` | varchar(200)? | título da reunião no header do relatório |
| `scheduledFor` | timestamptz | `date` do relatório |
| `durationMinutes` | int? | fallback p/ duração da reunião |
| `status` | varchar(16) | relatório só para `completed` (FR-01) |
| `startedAt`/`endedAt` | timestamptz? | duração real da reunião (preferencial) |

**Duração da reunião** (já implementado em `report.service.ts::deriveMeetingDuration`):
`endedAt - startedAt` (segundos) se ambos presentes; senão `durationMinutes*60`;
senão `0`.

### Entity: MeetingAttendance (`meeting_attendance`) — FONTE CANÔNICA (dec-006)
| Campo | Tipo | Uso no FR63 |
|-------|------|-------------|
| `meetingId` | uuid | join à reunião |
| `userId` | uuid | join a User (nome/email) + identifica a própria linha |
| `joinTime` | timestamptz | "hora de entrada" no CSV |
| `leaveTime` | timestamptz | "hora de saída" no CSV |
| `totalDurationSeconds` | int | **participantDuration** do engagement score |
| `presenceType` | varchar(16) | `integral`/`parcial`/(ausente) → status presença |

`@@unique([meetingId, userId])` garante 1 linha por participante por reunião.

### Entity: MeetingReport (`meeting_reports`) — summary persistido (Story 5.6)
| Campo | Tipo | Uso |
|-------|------|-----|
| `meetingId` | uuid `@@unique` | 1 report por reunião |
| `summary` | Json | `MeetingReportSummary` (attendees + agregados) |
| `generatedAt` | timestamptz | `meta.generatedAt` da resposta |

### Entity: MeetingTelemetry (`meeting_telemetry`)
Lido por `listAttendanceTelemetry` para `cameraSeconds`/`focusScore`. NÃO é
fonte do engagement FR63 (que usa só presença). Mantido para o `avgEngagementScore`
blend existente.

### Entity: User / GroupMember (bounded context usuários)
Join por `userId` para resolver `name`/`email` (Decision 6). `GroupMember.role`
(`lider`/`admin`) decide `canSeeFull` para o líder do grupo. Fallback de nome:
`MeetingParticipantRecord.name`.

---

## Tipos derivados / DTOs (novos — em `packages/types`)

Estes são os ÚNICOS artefatos novos de "dados". Vão em
`packages/types/src/meeting-report.ts` (estendendo o arquivo existente) com
snapshot tests em `packages/types/src/__tests__/meeting-report.snapshot.spec.ts`.

### EngagementLevel (enum)
```
EngagementLevelSchema = z.enum(['alto','medio','baixo'])
```
Classificação derivada (FR-03): `alto` se score≥0.75; `medio` se 0.50≤score<0.75;
`baixo` se score<0.50. Ausente → `baixo`.

### MeetingReportParticipant (linha de participante FR63 — visão líder)
| Campo | Tipo Zod | Origem |
|-------|----------|--------|
| `userId` | `z.string().uuid()` | MeetingAttendance.userId |
| `name` | `z.string().nullable()` | User join / fallback MeetingParticipantRecord.name |
| `email` | `z.string().email().nullable()` | User join |
| `presenceStatus` | `z.enum(['present','partial','absent'])` | derivado de presenceType |
| `joinTime` | `z.string().datetime({offset:true}).nullable()` | MeetingAttendance.joinTime |
| `leaveTime` | `z.string().datetime({offset:true}).nullable()` | MeetingAttendance.leaveTime |
| `durationSeconds` | `z.number().int().nonnegative()` | totalDurationSeconds |
| `engagementScore` | `z.number().min(0).max(1)` | duration/meetingDuration (clamp) |
| `engagementLevel` | `EngagementLevelSchema` | classificação do score |

### MeetingReportMetrics (agregado do relatório FR63)
| Campo | Tipo Zod | Origem |
|-------|----------|--------|
| `totalParticipants` | `z.number().int().nonnegative()` | count attendees |
| `presentCount` | `z.number().int().nonnegative()` | summary.totalPresent |
| `partialCount` | `z.number().int().nonnegative()` | summary.totalPartial |
| `absentCount` | `z.number().int().nonnegative()` | summary.totalAbsent |
| `attendanceRate` | `z.number().min(0).max(1)` | (present+partial)/total |
| `avgEngagementScore` | `z.number().min(0).max(1).nullable()` | média dos engagementScore FR63 |
| `avgEngagementLevel` | `EngagementLevelSchema.nullable()` | classificação da média |

### MeetingLeaderReportResponse (envelope de leitura — visão líder/admin)
```
{ data: { meetingId, date(ISO), groupName, title, metrics: MeetingReportMetrics,
          participants: MeetingReportParticipant[] },
  meta: { view: 'full', generatedAt(ISO) } }
```
Visão personal (Participante, herdada Story 5.6): `{ data: MeetingReportPersonal,
meta: { view: 'personal' } }` — inalterada, MAS o `attendee` é enriquecido com
`engagementScore`/`engagementLevel` (mesma derivação).

### CSV row (export) — não é Zod, é layout de arquivo
Colunas (P2): `Nome, Email, Status, Hora de entrada, Hora de saída,
Duração (min), Score de engajamento`. BOM UTF-8, separador `,`, linhas `\r\n`.
`Status` PT-BR: Presente / Parcial / Ausente.

### ReportExportJobPayload (estender união de payload em reports/index.ts)
Adicionar variante de meeting:
```
{ kind:'meeting', jobId, tenantId, meetingId, requesterUserId, canSeeFull }
```
(O payload de trilha existente vira `{kind:'trail', ...}` ou discrimina-se por
`job.name`. Decisão de discriminação detalhada no contracts/export.md.)

---

## State transitions

### ExportJob (Redis-only, `cache:reports:export-job:<jobId>`)
```
[POST export] --enqueue--> processing
processing --upload+sign OK--> completed (signedUrl, expiresAt)
processing --erro--> failed (failureReason)
```
TTL: `REPORTS_JOB_TTL_SECONDS + 300` em todos os estados; chave expira sozinha.
Sem persistência em DB (dec-009). Link válido por 1h (dec-008).

### Relatório de reunião
Pré-condição: `Meeting.status === 'completed'` E `MeetingReport` já gerado
(flush idempotente da Story 5.6). Se não gerado → `404 Report not generated yet`
(comportamento existente). Reunião sem presença → 200 com `participants:[]`
e métricas zeradas (FR-04).
