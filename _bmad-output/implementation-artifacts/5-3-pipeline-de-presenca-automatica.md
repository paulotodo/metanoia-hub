# Story 5.3: Pipeline de Presença Automática

Status: ready-for-dev

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

- [ ] Task 1: Criar Prisma schema para tabelas de presença (AC: #3)
  - [ ] Model `MeetingAttendance`: id, tenant_id, meeting_id, user_id, join_time, leave_time, total_duration_seconds, presence_type, reconnections, created_at
  - [ ] Enum `PresenceType`: integral, parcial, ausente
  - [ ] Model `MeetingSnapshot`: id, tenant_id, meeting_id, snapshot_data (JSONB), created_at
  - [ ] UUID v7 via uuidv7(), @@map para snake_case
  - [ ] Migration com RLS policies para ambas tabelas
- [ ] Task 2: Implementar pipeline de webhooks → Redis (AC: #1)
  - [ ] Processar eventos: participant_joined, participant_left, track_published, track_unpublished
  - [ ] Atualizar estado em Redis `rt:meeting:{tenantId}:{meetingId}`
  - [ ] Implementar dedup via Redis SETNX com key `webhook:{eventId}` e TTL 1h
  - [ ] Enfileirar BullMQ job para persistência
- [ ] Task 3: Implementar checkpoint job (AC: #2)
  - [ ] Criar BullMQ repeatable job (every 5 minutes)
  - [ ] Flush parcial do Redis → PostgreSQL `meeting_snapshots`
  - [ ] Implementar final flush no meeting end → `meeting_attendance`
- [ ] Task 4: Implementar cálculo de presença (AC: #3)
  - [ ] Definir constante `PRESENCE_INTEGRAL_THRESHOLD = 0.80` em `packages/types`
  - [ ] Calcular total_duration_seconds considerando reconnections
  - [ ] Classificar: integral (≥ 80%), parcial (< 80%), ausente (não participou)
- [ ] Task 5: Implementar tolerância de reconexão (AC: #4)
  - [ ] Default: 2 min window (configurável)
  - [ ] Definir constante `RECONNECTION_TOLERANCE_SECONDS = 120` em `packages/types`
  - [ ] Se reconexão dentro da janela: não penalizar, incrementar reconnections counter
  - [ ] Se reconexão fora da janela: registrar como novo segmento de presença
- [ ] Task 6: Testes (AC: #1, #2, #3, #4, #5)
  - [ ] Testes unitários: cálculo de presença, classificação, tolerância reconexão
  - [ ] Integration test: pipeline completo webhook → Redis → BullMQ → PostgreSQL
  - [ ] RLS isolation tests com JOINs cross-tenant em `apps/api/test/rls/`
  - [ ] Teste de idempotência: mesmo webhook processado 2x = 1 registro
  - [ ] Test factories com tenantId para meeting_attendance

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
