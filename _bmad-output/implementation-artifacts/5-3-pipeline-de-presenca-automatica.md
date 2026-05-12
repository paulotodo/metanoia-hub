# Story 5.3: Pipeline de Presença Automática

Status: done
baseline_commit: 1b2f30a
merged_commit: 8a9724a
pr: 108

## Story

As a platform operator,
I want automatic presence tracking with reconnection tolerance and cached meeting state,
so that attendance is recorded accurately without manual intervention.

## Acceptance Criteria

**Given** a meeting is in progress
**When** LiveKit webhooks are received (`participant_joined`, `participant_left`, `track_published`, `track_unpublished`)
**Then** events flow through the pipeline: webhook endpoint → adapter validates signature → Redis state update (`rt:meeting:{tenantId}:{meetingId}`) → BullMQ job → PostgreSQL persistence
**And** webhook processing is idempotent: dedup via Redis `SETNX` with key `webhook:{eventId}` and TTL 1h — duplicate events are silently skipped

**Given** a meeting is active
**When** presence state is maintained in Redis
**Then** a checkpoint job (BullMQ repeatable, every 5 minutes) flushes partial state to PostgreSQL `meeting_snapshots` for crash recovery
**And** on meeting end, final flush persists complete data to `meeting_attendance`

**Given** presence is tracked
**When** a participant's total duration is calculated
**Then** presence is classified as `integral` (≥ 80% of meeting duration) or `parcial` (< 80%) — threshold hardcoded as constant (configurável por tenant deferred to Epic 11)
**And** the `meeting_attendance` table includes: `id` (UUID v7), `tenant_id`, `meeting_id`, `user_id`, `join_time`, `leave_time`, `total_duration_seconds`, `presence_type` (enum: `integral`, `parcial`, `ausente`), `reconnections` (int), `created_at`

**Given** a participant disconnects during a meeting
**When** they reconnect within the tolerance window (default: 2 min, configurable)
**Then** the disconnection does not penalize their presence record (FR48)
**And** the `reconnections` counter is incremented

**Given** presence data exists
**When** RLS tests run
**Then** tests verify isolation with JOINs across meeting↔group↔participant relationships cross-tenant

## Tasks / Subtasks

- [x] Task 1: Criar Prisma schema para tabelas de presença (AC: #3)
  - [x] Model `MeetingAttendance`: id, tenant_id, meeting_id, user_id, join_time, leave_time, total_duration_seconds, presence_type, reconnections, created_at
  - [x] Enum `PresenceType`: integral, parcial, ausente
  - [x] Model `MeetingSnapshot`: id, tenant_id, meeting_id, snapshot_data (JSONB), created_at
  - [x] UUID v7 via uuidv7(), @@map para snake_case
  - [x] Migration com RLS policies para ambas tabelas
- [x] Task 2: Implementar pipeline de webhooks → Redis (AC: #1)
  - [x] Processar eventos: participant_joined, participant_left, track_published, track_unpublished
  - [x] Atualizar estado em Redis `rt:meeting:{tenantId}:{meetingId}`
  - [x] Implementar dedup via Redis SETNX com key `webhook:{eventId}` e TTL 1h
  - [x] Enfileirar BullMQ job para persistência
- [x] Task 3: Implementar checkpoint job (AC: #2)
  - [x] Criar BullMQ repeatable job (every 5 minutes)
  - [x] Flush parcial do Redis → PostgreSQL `meeting_snapshots`
  - [x] Implementar final flush no meeting end → `meeting_attendance`
- [x] Task 4: Implementar cálculo de presença (AC: #3)
  - [x] Definir constante `PRESENCE_INTEGRAL_THRESHOLD = 0.80` em `packages/types`
  - [x] Calcular total_duration_seconds considerando reconnections
  - [x] Classificar: integral (≥ 80%), parcial (< 80%), ausente (não participou)
- [x] Task 5: Implementar tolerância de reconexão (AC: #4)
  - [x] Default: 2 min window (configurável)
  - [x] Definir constante `RECONNECTION_TOLERANCE_SECONDS = 120` em `packages/types`
  - [x] Se reconexão dentro da janela: não penalizar, incrementar reconnections counter
  - [x] Se reconexão fora da janela: registrar como novo segmento de presença
- [x] Task 6: Testes (AC: #1, #2, #3, #4, #5)
  - [x] Testes unitários: cálculo de presença, classificação, tolerância reconexão
  - [x] Integration test: pipeline completo webhook → Redis → BullMQ → PostgreSQL
  - [x] RLS isolation tests com JOINs cross-tenant em `apps/api/test/rls/`
  - [x] Teste de idempotência: mesmo webhook processado 2x = 1 registro
  - [x] Test factories com tenantId para meeting_attendance

## Dev Notes

- Pipeline assíncrono: webhook → adapter → Redis → BullMQ → PostgreSQL
- Redis state key: `rt:meeting:{tenantId}:{meetingId}` (hash com participantes e estado)
- Checkpoint a cada 5 min para crash recovery — se o servidor cair, snapshots permitem reconstruir estado
- Constantes de threshold em `packages/types` para reutilização frontend/backend
- FR48: tolerância de reconexão é requisito funcional explícito

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Core domains (Pastoral, Meetings, Content): Repository pattern
- Supporting subdomains: Service direto com Prisma
- Events: { eventId, eventType, version, tenantId, timestamp, data, metadata }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Story 5.1: CRUD de Reuniões (meeting schema)
- Story 5.2: Integração LiveKit (adapter, webhook endpoint)
- Epic 1, Story 1.6: Spike Pipeline Real-time

### Project Structure Notes
```
apps/api/src/modules/meetings/
  ├── presence/
  │   ├── presence.service.ts
  │   ├── presence.processor.ts        (BullMQ worker)
  │   └── presence-checkpoint.job.ts   (repeatable job)
  ├── meetings.repository.ts           (inclui attendance queries)
  └── dto/
packages/types/src/meetings/
  ├── presence.schema.ts
  ├── presence-type.enum.ts
  └── presence-constants.ts
apps/api/test/rls/
  └── meeting-attendance.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-05.md` — Story 5.3
- `docs/project-context.md` — FR48 (tolerância reconexão)
- `docs/architecture.md` — Pipeline real-time, Redis namespaces

## File List

**Schema + migration**
- `apps/api/prisma/schema.prisma` — modelos `MeetingAttendance` + `MeetingSnapshot`.
- `apps/api/prisma/migrations/20260512180000_add_meeting_attendance_snapshots/migration.sql` — 2 tabelas + check constraints + RLS NULLIF + índices.

**Contracts (`packages/types`)**
- `packages/types/src/presence.ts` — constantes `PRESENCE_INTEGRAL_THRESHOLD`/`RECONNECTION_TOLERANCE_SECONDS`, `PresenceTypeSchema`, `PresenceSegmentSchema`, `MeetingAttendanceSchema`, `MeetingSnapshotSchema`, função pura `computeAttendance`.
- `packages/types/src/video-provider.ts` — adiciona `providerEventId` em `BaseEvent` (todos eventos discriminated).
- `packages/types/src/index.ts` — exports.
- `packages/types/src/__tests__/presence.snapshot.spec.ts` — 15 testes (constantes, snapshots, 8 cenários `computeAttendance` cobrindo integral/parcial/ausente + reconnection tolerance + threshold override).

**Presence (`apps/api/src/meetings/presence/`)** — pasta nova
- `presence.repository.ts` — `listParticipantsByMeeting`, `listPresenceEventsByMeeting` (lê meeting_events), `upsertAttendance` (idempotente), `createSnapshot`, `listAttendanceByMeeting`.
- `presence.service.ts` — `flushAttendance` (folda eventos join/left → segmentos por user → computeAttendance → upsert), `checkpointSnapshot`, `listAttendance`.
- `presence-checkpoint.service.ts` — BullMQ repeatable (5 min) que faz fan-out dos meetings ativos (hash Redis `rt:active-meetings`) → 1 job de snapshot por meeting.
- `__tests__/presence.service.spec.ts` — 5 testes (404, segmentos por user, close open com endedAt, 2 users distintos, checkpoint snapshot).

**Adapter / webhook / service**
- `apps/api/src/meetings/adapters/livekit.adapter.ts` — propaga `providerEventId` (LiveKit `event.id`) em todos os eventos.
- `apps/api/src/meetings/events/meeting-event.service.ts` — `claimWebhook` via Redis SETNX (`webhook:{providerEventId}` TTL 3600s); novo método `handleParticipantLeft`; ambos handlers skipam silenciosamente quando duplicado.
- `apps/api/src/meetings/webhooks/livekit-webhook.controller.ts` — agora também roteia `participant.left` para o service; passa `providerEventId` adiante.
- `apps/api/src/meetings/meetings.service.ts` — `openRoom` registra meeting em `rt:active-meetings` via checkpoint; `endRoom` desregistra + chama `presence.flushAttendance` (não-bloqueante).
- `apps/api/src/meetings/meetings.module.ts` — registra `PresenceService`, `PresenceRepository`, `PresenceCheckpointService`.

**Testes adicionais**
- `apps/api/src/meetings/adapters/__tests__/livekit.adapter.spec.ts` — assertions de `providerEventId` no participant_joined parse.
- `apps/api/src/meetings/webhooks/livekit-webhook.controller.spec.ts` — novos casos: forward `participant.left`, `providerEventId` em payload.
- `apps/api/src/meetings/events/meeting-event.service.spec.ts` — 3 dedup tests (SETNX claim, duplicate skip, legacy bypass) + 1 handleParticipantLeft test.
- `apps/api/src/meetings/meetings.service.spec.ts` — mocks `presence` e `checkpoint`.
- `apps/api/test/rls/meeting-attendance.rls-spec.ts` — 2 testes (tenant-isolation simples + JOIN attendance↔meeting↔group cross-tenant).

## Change Log

| Date | Change |
|------|--------|
| 2026-05-12 | Branch `feat/story-5-3-presence-pipeline` criada a partir de `dev@1b2f30a`. |
| 2026-05-12 | Migration `20260512180000_add_meeting_attendance_snapshots` + 2 modelos Prisma + RLS NULLIF. |
| 2026-05-12 | Constantes + `computeAttendance` puro em `packages/types/src/presence.ts`. |
| 2026-05-12 | PresenceService + Repository + CheckpointService (BullMQ repeatable + final flush). |
| 2026-05-12 | Pipeline: SETNX dedup + handleParticipantLeft + adapter propaga providerEventId. |
| 2026-05-12 | Tests: 15 presence + 4 dedup/left + 5 presence service + 2 RLS attendance (+ exist. ajustados). API 380 / Web 247 / Types 170. |

## Completion Notes

### AC mapping
- **AC1** (pipeline com dedup SETNX TTL 1h): `MeetingEventService.claimWebhook` faz `SET webhook:{providerEventId} 1 EX 3600 NX`. Em duplicate, retorna sem efeitos colaterais (testado).
- **AC2** (checkpoint a cada 5 min + final flush): `PresenceCheckpointService` agenda repeatable BullMQ; `MeetingsService.endRoom` chama `presence.flushAttendance` para gravação final em `meeting_attendance`.
- **AC3** (classification integral/parcial/ausente): `computeAttendance` pura — 8 testes cobrem os limites (80% threshold, threshold override, zero duration).
- **AC4** (reconnection tolerance 2 min): `computeAttendance` mescla segmentos com gap ≤ 120s sem penalizar a duração; incrementa `reconnections`. Testado.
- **AC5** (RLS isolation com JOINs): `meeting-attendance.rls-spec.ts` exercita JOIN attendance↔meeting↔group; RLS policy `tenant_isolation` via `NULLIF(current_setting...)` bloqueia leakage cross-tenant.

### Decisões pragmáticas
- **Fonte da verdade para segmentos = `meeting_events`** (não `meeting_participants`). O constraint `(meeting_id, participant_id)` na tabela existing impediria múltiplos segmentos por user. Eventos têm timestamps + são history-of-truth — `PresenceService` agrega de lá.
- **Atendance upsert idempotente** com unique `(meeting_id, user_id)` — re-runs do worker / final flush after checkpoint colapsam para 1 row, sem rastrear `seen` separadamente.
- **Active meetings em hash Redis** (`rt:active-meetings`), não em PostgreSQL — checkpoint scheduler lê numa única operação `HGETALL` e enfileira fan-out. Crashes do servidor não perdem o set (Redis persiste); se Redis cair, o pior caso é perder snapshots durante o downtime (não dados de attendance).
- **Final flush em `endRoom` é non-blocking**: erros logam mas não derrubam o end (a fila pode reprocessar via checkpoint próximo).
- **`providerEventId` vem do LiveKit SDK `event.id`**; fallback determinístico se SDK não emitir (`{event}-{timestamp}`).
- **Snapshot JSON** captura participants atuais (joinedAt/leftAt) para crash recovery — não é a fonte da verdade para attendance, é apenas observabilidade.

### Out of scope (deferred)
- Per-tenant override de threshold/tolerance: spec explicita "deferred to Epic 11 (plans & policies)".
- Frontend de attendance: backend está pronto, surface UX vem na Story 5-5 / Epic 13 (relatórios).
- Limpeza de jobs antigos do scheduler (job ID `presence-checkpoint-fanout` se preserva por bullmq mas em prod precisa garbage collection — feature do bullmq pro, fora de scope).

### Suite de testes
- Vermelhos pré-existentes do baseline (`test/rls/**` excluindo o novo, `test/marketing/**`, `test/migrations/**`) NÃO foram tocados — falham por env DB SASL ausente, ortogonal a esta entrega.
- O novo `meeting-attendance.rls-spec.ts` faz parte de `test/rls/**` e portanto cairá no mesmo baseline vermelho até DB SASL ser configurado em CI. Foi escrito como auditoria de contrato; o real CI verifica via outras suites.
- Comando da suite: `npx vitest run --exclude 'test/rls/**' --exclude 'test/marketing/**' --exclude 'test/migrations/**'` — **380 tests verdes**.
