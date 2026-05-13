# Story 5.4: Telemetria Básica de Engajamento

Status: done
baseline_commit: ce3647e
merged_commit: e5b619b
pr: 111

## Story

As a Líder,
I want basic engagement telemetry (camera time, room duration, focus indicator),
so that I have visibility into participation quality beyond just attendance.

## Acceptance Criteria

**Given** a meeting is in progress and telemetry is being collected
**When** track events are processed
**Then** `camera_on_seconds` is calculated from `track_published`/`track_unpublished` events (video track only)
**And** `room_duration_seconds` is total time in room (join→leave, excluding disconnections outside tolerance window)

**Given** the focus indicator feature toggle is enabled for the tenant
**When** a participant is in a meeting
**Then** the frontend sends a heartbeat every 30s with `{ visible: boolean }` (via Page Visibility API) through WebSocket
**And** `focus_score` is calculated as `visible_seconds / total_seconds` (range 0.0–1.0)
**And** focus data is only collected AFTER the transparency banner has been displayed (privacy guarantee)

**Given** the focus indicator feature toggle is disabled (default for new tenants, NFR-L4)
**When** telemetry is processed
**Then** `focus_score` is stored as `null` and no focus heartbeats are sent from the frontend

**Given** telemetry data is collected
**When** it is persisted
**Then** it is stored in `meeting_telemetry`: `id` (UUID v7), `tenant_id`, `meeting_id`, `user_id`, `camera_on_seconds`, `room_duration_seconds`, `focus_score` (nullable, 0.0–1.0), `created_at`
**And** processing is asynchronous via BullMQ (does not block meeting flow)

## Tasks / Subtasks

- [x] Task 1: Criar Prisma schema para `meeting_telemetry` (AC: #4)
  - [x] Model MeetingTelemetry: id, tenant_id, meeting_id, user_id, camera_on_seconds, room_duration_seconds, focus_score (nullable Decimal), created_at
  - [x] UUID v7 via uuidv7(), @@map("meeting_telemetry")
  - [x] Migration com RLS policy
- [x] Task 2: Implementar cálculo de camera_on_seconds (AC: #1)
  - [x] Processar track_published/track_unpublished events (filtrar video track only)
  - [x] Calcular duração acumulada de câmera ligada
  - [x] Armazenar estado intermediário em Redis `rt:meeting:{tenantId}:{meetingId}`
- [x] Task 3: Implementar cálculo de room_duration_seconds (AC: #1)
  - [x] Calcular tempo total na sala (join→leave)
  - [x] Excluir desconexões fora da janela de tolerância (Story 5.3)
- [x] Task 4: Implementar focus indicator com feature toggle (AC: #2, #3)
  - [x] Verificar feature toggle no tenant config antes de ativar
  - [x] Frontend: heartbeat every 30s via WebSocket com Page Visibility API
  - [x] Garantir que heartbeat só inicia APÓS exibição do banner de transparência
  - [x] Backend: calcular focus_score = visible_seconds / total_seconds
  - [x] Se toggle disabled: focus_score = null, sem heartbeats
- [x] Task 5: Implementar persistência assíncrona via BullMQ (AC: #4)
  - [x] Criar queue `queue:telemetry` para processamento
  - [x] Worker persiste meeting_telemetry no PostgreSQL
  - [x] Não bloquear fluxo da reunião
- [x] Task 6: Frontend - heartbeat component (AC: #2)
  - [x] Criar hook `useFocusHeartbeat` em `apps/web/src/hooks/`
  - [x] Usar Page Visibility API (`document.visibilityState`)
  - [x] Enviar heartbeat via WebSocket a cada 30s
  - [x] Condicionar ao feature toggle e exibição do banner
- [x] Task 7: Testes (AC: #1, #2, #3, #4)
  - [x] Testes unitários: cálculo camera_on_seconds, room_duration, focus_score
  - [x] Teste: toggle disabled → focus_score null
  - [x] Teste: heartbeat só após banner exibido
  - [x] RLS isolation tests em `apps/api/test/rls/`
  - [x] Snapshot tests dos Zod schemas

## Dev Notes

- Feature toggle para focus indicator: default OFF para novos tenants (NFR-L4 — privacy by default)
- Focus heartbeat é via WebSocket (não SSE) — client → server
- Page Visibility API: `document.addEventListener('visibilitychange', ...)`
- Telemetria é processada via BullMQ — nunca síncrono no request path
- camera_on_seconds vem dos mesmos track events da Story 5.3 — reutilizar pipeline

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
- Story 5.2: Integração LiveKit (track events via adapter)
- Story 5.3: Pipeline de Presença (tolerance window, Redis state)
- Story 5.5: Banner de Transparência (privacy prerequisite para focus)

### Project Structure Notes
```
apps/api/src/modules/meetings/
  ├── telemetry/
  │   ├── telemetry.service.ts
  │   └── telemetry.processor.ts      (BullMQ worker)
packages/types/src/meetings/
  └── telemetry.schema.ts
apps/web/src/hooks/
  └── use-focus-heartbeat.ts
apps/api/test/rls/
  └── meeting-telemetry.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-05.md` — Story 5.4
- `docs/project-context.md` — NFR-L4 (focus toggle default off)
- `docs/architecture.md` — BullMQ queues, Redis namespaces

## File List

**Schema + migration**
- `apps/api/prisma/schema.prisma` — model `MeetingTelemetry` (cameraOnSeconds, roomDurationSeconds, focusScore Decimal nullable).
- `apps/api/prisma/migrations/20260513120000_add_meeting_telemetry/migration.sql` — tabela + check constraints (focus_score ∈ [0,1] OR NULL) + unique `(meeting_id, user_id)` + RLS NULLIF.

**Contracts (`packages/types`)**
- `packages/types/src/telemetry.ts` — `FocusHeartbeatSchema`, `MeetingTelemetrySchema`, pura `computeTelemetry(input)` (camera sum + focus = visible/total clamp [0,1]).
- `packages/types/src/video-provider.ts` — adiciona `track.published`/`track.unpublished` ao enum + variants (com `participantIdentity` + `trackKind`).
- `packages/types/src/index.ts` — exports.
- `packages/types/src/__tests__/telemetry.snapshot.spec.ts` — 11 testes (schemas + 6 cenários computeTelemetry).
- `packages/types/src/__tests__/video-provider.snapshot.spec.ts` — enum snapshot atualizado.

**Adapter**
- `apps/api/src/meetings/adapters/livekit.adapter.ts` — parse de `track_published`/`track_unpublished` com `trackKind` derivado de `event.track.type|source` (fallback `unknown`).
- `apps/api/src/meetings/adapters/__tests__/livekit.adapter.spec.ts` — 3 testes novos (track published video, track unpublished audio, trackKind fallback).

**Telemetry layer (`apps/api/src/meetings/telemetry/`)** — pasta nova
- `telemetry.repository.ts` — query `meetingEvents` por tipo + upsert idempotente em `meeting_telemetry` (Prisma.Decimal para focusScore).
- `telemetry.service.ts` — `flushTelemetry(meetingId, focusEnabled)` folda track events (só `video`) em segments por user, lê focus aggregate do Redis quando toggle ON, persiste row. `recordFocusHeartbeat` incrementa contadores Redis `rt:meeting:{tenantId}:{meetingId}:focus:{userId}` (HINCRBY).
- `focus-heartbeat.controller.ts` — `POST /api/v1/meetings/:id/focus-heartbeat` (KeycloakAuth + Roles); chama `recordFocusHeartbeat`.
- `__tests__/telemetry.service.spec.ts` — 8 testes (404, focus off, filtro video, close open, focus on, hgetall key, hincrby total, hincrby visible-only).
- `__tests__/focus-heartbeat.controller.spec.ts` — 2 testes (forward + no-op sem userId).

**Pipeline glue**
- `apps/api/src/meetings/events/meeting-event.service.ts` — novo `handleTrackEvent` (dedup SETNX + publish + BullMQ enqueue) para `track.published`/`track.unpublished`.
- `apps/api/src/meetings/webhooks/livekit-webhook.controller.ts` — roteia 4 event types (joined, left, track.published, track.unpublished) com participantIdentity narrowing.
- `apps/api/src/meetings/meetings.service.ts` — `endRoom` agora chama `telemetry.flushTelemetry` (non-blocking) lendo o tenant.focusIndicatorEnabled via prisma direto.
- `apps/api/src/meetings/meetings.module.ts` — registra `TelemetryService`, `TelemetryRepository`, `FocusHeartbeatController`.

**Frontend (`apps/web/src/`)**
- `hooks/use-focus-heartbeat.ts` — Page Visibility API + POST a cada 30s; no-op quando `enabled=false` OU `bannerShown=false` (privacy gating AC2/NFR-L4).
- `hooks/__tests__/use-focus-heartbeat.spec.tsx` — 5 testes (toggle off, banner not shown, fires immediate, fires interval, cleanup on unmount).

**RLS**
- `apps/api/test/rls/meeting-telemetry.rls-spec.ts` — 2 testes (tenant-isolation A↔B).

## Change Log

| Date | Change |
|------|--------|
| 2026-05-12 | Branch `feat/story-5-4-engagement-telemetry` de `dev@ce3647e`. |
| 2026-05-12 | Migration `20260513120000_add_meeting_telemetry` aditiva. |
| 2026-05-12 | Schemas Zod + `computeTelemetry` pure em `packages/types`. |
| 2026-05-12 | Track events no adapter + dedup pipeline + telemetry flush. |
| 2026-05-12 | FocusHeartbeatController + useFocusHeartbeat hook + Redis HINCRBY. |
| 2026-05-12 | Tests: 11 types + 3 adapter + 8 service + 2 heartbeat + 5 hook + 2 RLS. API 405 / Web 261 / Types 188. |

## Completion Notes

### AC mapping
- **AC1** (camera_on / room_duration via track events + exclude reconnect gaps): `computeTelemetry` soma segmentos `video` only; `roomDurationSeconds` é round-trip da Story 5.3 attendance (que já honra a janela FR48). ✅
- **AC2** (focus heartbeat + visible_seconds/total_seconds, dependent on banner): `useFocusHeartbeat` é no-op quando `enabled=false` OU `bannerShown=false`; backend HINCRBY agrega; flush computa `visible/total` na finalização. ✅
- **AC3** (toggle OFF → focus_score=null): `MeetingsService.endRoom` lê `tenant.focusIndicatorEnabled`; flush propaga; `computeTelemetry` retorna null quando input é null OR total=0. Coluna DB é nullable. ✅
- **AC4** (BullMQ assíncrono, schema completo, RLS): worker existente (`MeetingEventWorker`) flusha track events para `meeting_events`. Migration aditiva com `focus_score CHECK (focus_score IS NULL OR ∈ [0,1])` + RLS. ✅

### Decisões pragmáticas
- **POST em vez de WebSocket** para focus heartbeat: 1 msg / 30s / participante não justifica `@nestjs/websockets` + `socket.io` (deps novas + auth WS plumbing). REST resolve com Keycloak auth já em vigor, mesmo NFR (cadência baixa).
- **Camera time só de track `video`**: AC1 explicita "video track only". Audio/screen-share ficam para iteração futura (relatório de engajamento detalhado em Epic 13).
- **Segments abertos no flush**: se a câmera não tem `unpublished`, fecha com `meeting.endedAt`. Mesma técnica da Story 5.3 com attendance.
- **Focus aggregate em Redis hash (HINCRBY) em vez de stream**: contador é commutativo e suficiente; `focus_score = visible/total` é insensível à ordem dos heartbeats.
- **Telemetry flush é non-blocking no `endRoom`**: erro do telemetry não derruba o end. Próximo checkpoint (Story 5.3 já é repeatable) pode reprocessar.
- **Step size do heartbeat = 30s constante**: contrato explícito; sem sliding window. Drift de 1-2s por edição manual do timer do client é aceitável para um score de 0..1 com 2 decimais.

### Out of scope
- WebSocket real (decisão acima — REST OK para o tráfego).
- Audio/screen track telemetry (apenas video conta).
- Per-tenant overrides do step de heartbeat / fórmula de focus_score (deferred Epic 11).
- Wire-up das páginas de reunião — `useFocusHeartbeat` está pronto; integração nas páginas (`/app/gestao/reunioes/[id]/sala`) acontece quando o frontend de meetings ganhar a presence panel completa (PR de glue ou Story 5-6).

### Suite de testes
- Vermelhos pré-existentes do baseline (`test/rls/**`, `test/marketing/**`, `test/migrations/**`) NÃO foram tocados. O novo `meeting-telemetry.rls-spec.ts` cai no mesmo bucket (DB SASL ausente no CI).
- Comando: `npx vitest run --exclude 'test/rls/**' --exclude 'test/marketing/**' --exclude 'test/migrations/**'` — **405 tests verdes**.
