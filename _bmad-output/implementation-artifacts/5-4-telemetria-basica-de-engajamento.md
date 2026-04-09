# Story 5.4: Telemetria Básica de Engajamento

Status: ready-for-dev

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

- [ ] Task 1: Criar Prisma schema para `meeting_telemetry` (AC: #4)
  - [ ] Model MeetingTelemetry: id, tenant_id, meeting_id, user_id, camera_on_seconds, room_duration_seconds, focus_score (nullable Decimal), created_at
  - [ ] UUID v7 via uuidv7(), @@map("meeting_telemetry")
  - [ ] Migration com RLS policy
- [ ] Task 2: Implementar cálculo de camera_on_seconds (AC: #1)
  - [ ] Processar track_published/track_unpublished events (filtrar video track only)
  - [ ] Calcular duração acumulada de câmera ligada
  - [ ] Armazenar estado intermediário em Redis `rt:meeting:{tenantId}:{meetingId}`
- [ ] Task 3: Implementar cálculo de room_duration_seconds (AC: #1)
  - [ ] Calcular tempo total na sala (join→leave)
  - [ ] Excluir desconexões fora da janela de tolerância (Story 5.3)
- [ ] Task 4: Implementar focus indicator com feature toggle (AC: #2, #3)
  - [ ] Verificar feature toggle no tenant config antes de ativar
  - [ ] Frontend: heartbeat every 30s via WebSocket com Page Visibility API
  - [ ] Garantir que heartbeat só inicia APÓS exibição do banner de transparência
  - [ ] Backend: calcular focus_score = visible_seconds / total_seconds
  - [ ] Se toggle disabled: focus_score = null, sem heartbeats
- [ ] Task 5: Implementar persistência assíncrona via BullMQ (AC: #4)
  - [ ] Criar queue `queue:telemetry` para processamento
  - [ ] Worker persiste meeting_telemetry no PostgreSQL
  - [ ] Não bloquear fluxo da reunião
- [ ] Task 6: Frontend - heartbeat component (AC: #2)
  - [ ] Criar hook `useFocusHeartbeat` em `apps/web/src/hooks/`
  - [ ] Usar Page Visibility API (`document.visibilityState`)
  - [ ] Enviar heartbeat via WebSocket a cada 30s
  - [ ] Condicionar ao feature toggle e exibição do banner
- [ ] Task 7: Testes (AC: #1, #2, #3, #4)
  - [ ] Testes unitários: cálculo camera_on_seconds, room_duration, focus_score
  - [ ] Teste: toggle disabled → focus_score null
  - [ ] Teste: heartbeat só após banner exibido
  - [ ] RLS isolation tests em `apps/api/test/rls/`
  - [ ] Snapshot tests dos Zod schemas

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
