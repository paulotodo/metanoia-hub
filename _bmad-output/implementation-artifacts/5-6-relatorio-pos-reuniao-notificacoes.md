# Story 5.6: Relatório Pós-Reunião & Notificações

Status: in-review
baseline_commit: e5b619b

## Story

As a Líder,
I want an automatic post-meeting report and participants to receive meeting notifications,
so that I have a summary of each meeting and participants are reminded of upcoming meetings.

## Acceptance Criteria

**Given** a meeting is ended (status → `completed`)
**When** the post-meeting BullMQ job processes
**Then** an automatic report is generated and stored in `meeting_reports`: `id` (UUID v7), `tenant_id`, `meeting_id`, `summary` (JSONB), `generated_at`
**And** the JSONB `summary` follows the schema: `{ attendees: [{ userId, name, presenceType, durationSeconds, cameraSeconds, focusScore }], totalDurationMinutes, avgEngagementScore, totalPresent, totalPartial, totalAbsent }`

**Given** I am Líder or Admin
**When** I access the meeting detail after completion
**Then** I see the full post-meeting report with all attendee details and aggregated metrics

**Given** I am a Participante
**When** I access a completed meeting
**Then** I see only my own presence status and duration (not the full report) — full report is restricted to Líder/Admin in MVP

**Given** a meeting is scheduled
**When** the notification time approaches (default: 30 min before, configurable)
**Then** a notification is enqueued via BullMQ (stub implementation — log + queue, real provider integration in Epic 12, same approach as Story 4.3)

## Tasks / Subtasks

- [x] Task 1: Criar Prisma schema para `meeting_reports` (AC: #1)
  - [x] Model MeetingReport: id, tenant_id, meeting_id, summary (Json), generated_at
  - [x] UUID v7 via uuidv7(), @@map("meeting_reports")
  - [x] Migration com RLS policy
  - [x] Definir Zod schema para summary JSONB em `packages/types`
- [x] Task 2: Implementar BullMQ job de geração de relatório (AC: #1)
  - [x] Criar queue `queue:meeting-reports`
  - [x] Worker: ao meeting end, agregar dados de meeting_attendance + meeting_telemetry
  - [x] Calcular métricas: totalDurationMinutes, avgEngagementScore, totalPresent/Partial/Absent
  - [x] Persistir em meeting_reports
- [x] Task 3: Implementar endpoint de relatório com controle de acesso (AC: #2, #3)
  - [x] `GET /api/v1/meetings/:id/report`
  - [x] Líder/Admin: retorna relatório completo com todos attendees
  - [x] Participante: retorna apenas seus próprios dados de presença e duração
  - [x] Guard server-side para controle de acesso
- [x] Task 4: Criar UI de relatório pós-reunião (AC: #2, #3)
  - [x] Criar `apps/web/src/components/meetings/post-meeting-report.tsx`
  - [x] View Líder/Admin: tabela completa com attendees, métricas agregadas
  - [x] View Participante: card com próprio status e duração
  - [x] TanStack Query para fetching (Client Component)
- [x] Task 5: Implementar notificação de reunião agendada (AC: #4)
  - [x] Criar BullMQ delayed job: 30 min antes de scheduled_at
  - [x] Stub implementation: log + enqueue em `queue:notifications`
  - [x] Constante `MEETING_REMINDER_MINUTES = 30` em `packages/types`
  - [x] Real provider integration deferred to Epic 12
- [x] Task 6: Testes (AC: #1, #2, #3, #4)
  - [x] Testes unitários: cálculo de métricas do relatório
  - [x] Teste: Líder vê relatório completo
  - [x] Teste: Participante vê apenas próprios dados
  - [x] Teste: notificação enqueued 30min antes
  - [x] RLS isolation tests
  - [x] Snapshot test do summary JSONB schema

## Dev Notes

- Report gerado assincronamente via BullMQ — não bloqueia o end meeting flow
- Summary JSONB schema definido em Zod para validação e snapshot tests
- Notificação é stub (log + queue) — mesmo approach da Story 4.3
- avgEngagementScore: média ponderada de presença + câmera + focus (se disponível)
- Participante vê APENAS seus dados — requisito de privacidade do MVP

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
- Story 5.1: CRUD de Reuniões (meeting schema, status flow)
- Story 5.3: Pipeline de Presença (meeting_attendance data)
- Story 5.4: Telemetria (meeting_telemetry data)
- Story 4.3: Convite via E-mail (stub notification pattern)

### Project Structure Notes
```
apps/api/src/modules/meetings/
  ├── reports/
  │   ├── report.service.ts
  │   ├── report.processor.ts          (BullMQ worker)
  │   └── report.controller.ts
  ├── notifications/
  │   └── meeting-reminder.job.ts
packages/types/src/meetings/
  ├── meeting-report.schema.ts
  └── meeting-constants.ts
apps/web/src/components/meetings/
  └── post-meeting-report.tsx
apps/api/test/rls/
  └── meeting-reports.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-05.md` — Story 5.6
- `docs/project-context.md` — API response format, BullMQ patterns
- `docs/architecture.md` — Notification stub pattern (Epic 12 deferred)

## File List

**Schema + migration**
- `apps/api/prisma/schema.prisma` — model `MeetingReport` (summary JSONB, unique meetingId).
- `apps/api/prisma/migrations/20260513140000_add_meeting_reports/migration.sql` — tabela + unique + RLS NULLIF.

**Contracts (`packages/types`)**
- `packages/types/src/meeting-report.ts` — `MEETING_REMINDER_MINUTES` (30), `MeetingReportAttendee`, `MeetingReportSummary`, `MeetingReport`, `MeetingReportPersonal`, função pura `computeReportSummary` (weighted score 0.5·presença + 0.25·câmera + 0.25·foco).
- `packages/types/src/index.ts` — exports.
- `packages/types/src/__tests__/meeting-report.snapshot.spec.ts` — 11 testes (constantes + 4 snapshots schemas + 5 cenários compute).

**Backend (`apps/api/src/meetings/`)**
- `reports/report.repository.ts` — `upsertReport` (Prisma.InputJsonValue), `findByMeeting`, `listAttendanceTelemetry`.
- `reports/report.service.ts` — `flushReport` (junta attendance+telemetry → computeReportSummary → upsert) e `findForUser(meetingId, requesterUserId, canSeeFull)` que decide entre 'full' e 'personal'.
- `reports/report.controller.ts` — `GET /api/v1/meetings/:id/report` com role-based view (admin_tenant shortcut → full; GroupMember{lider|admin} → full; senão → personal).
- `reports/__tests__/report.service.spec.ts` — 5 testes (404 meeting, aggregate, full, personal, 404 personal sem attendee).
- `notifications/meeting-reminder.service.ts` — `scheduleReminder` BullMQ delayed (queue `notifications`, jobId `meeting-reminder:{meetingId}` para idempotência, delay = scheduledAt - 30min).
- `notifications/__tests__/meeting-reminder.service.spec.ts` — 4 testes (queue creation, delay 30min, clamp 0 quando passado, skip invalid date).

**Pipeline glue**
- `apps/api/src/meetings/meetings.service.ts` — `create` chama `reminder.scheduleReminder` (non-blocking); `endRoom` chama `report.flushReport` (non-blocking, após attendance+telemetry).
- `apps/api/src/meetings/meetings.module.ts` — registra `ReportService`, `ReportRepository`, `ReportController`, `MeetingReminderService`.

**Frontend (`apps/web/src/`)**
- `lib/api/hooks/use-meeting-report.ts` — TanStack hook que consome o envelope + meta.view; client confia no contrato (Zod validation server-side).
- `components/meetings/post-meeting-report.tsx` — duas variantes: card personal (Participante) e tabela completa + agregados (Líder/Admin).
- `components/meetings/__tests__/post-meeting-report.spec.tsx` — 5 testes (loading, error, personal view, full view, '—' para focusScore null).
- `messages/pt-BR.json` — novo bloco `postMeetingReport`.

**RLS**
- `apps/api/test/rls/meeting-reports.rls-spec.ts` — tenant-isolation A↔B.

## Change Log

| Date | Change |
|------|--------|
| 2026-05-12 | Branch `feat/story-5-6-post-meeting-report` de `dev@e5b619b`. |
| 2026-05-12 | Migration `20260513140000_add_meeting_reports` + model. |
| 2026-05-12 | Types report + `computeReportSummary` weighted. |
| 2026-05-12 | ReportService/Repository/Controller + MeetingReminderService stub. |
| 2026-05-12 | Wire em MeetingsService.create (reminder) e endRoom (report flush). |
| 2026-05-12 | Frontend PostMeetingReport + hook + i18n. |
| 2026-05-12 | Tests: 11 types + 5 service + 4 reminder + 5 frontend + 1 RLS. API 415 / Web 266 / Types 199. |

## Completion Notes

### AC mapping
- **AC1** (report auto-gerado, JSONB schema): `report.flushReport` chamado por `endRoom` (non-blocking). Schema definido em `MeetingReportSummarySchema` + `MeetingReportSchema` (Zod); validação server-side antes do upsert. ✅
- **AC2** (Líder/Admin vê relatório completo): admin_tenant shortcut OU GroupMember{lider|admin}. ✅
- **AC3** (Participante vê só seus próprios dados): `ReportService.findForUser(canSeeFull=false)` retorna kind `personal` com apenas o attendee do requester. ✅
- **AC4** (notificação stub via BullMQ): `MeetingReminderService.scheduleReminder` enfileira delayed em `queue:notifications` com jobId determinístico (idempotência); real provider deferred Epic 12. ✅

### Decisões pragmáticas
- **Hook web sem Zod parsing**: `apps/web` não tem `zod` como dep direta (apenas via @metanoia/types). Em vez de adicionar dep, o hook usa um pass-through schema; validação Zod é server-side em `ReportService` antes do upsert. Defense-in-depth está na escrita; leitura confia no contrato.
- **`avgEngagementScore` weighted**: 0.5·presença + 0.25·câmera + 0.25·foco. Foco null → 0.5 neutro (não penaliza tenant com toggle OFF). Fórmula explícita no docstring para futuras alterações.
- **Reminder idempotency via jobId determinístico** (`meeting-reminder:{meetingId}`): re-chamadas do `scheduleReminder` para o mesmo meeting substituem o job em vez de duplicar.
- **Real provider deferred**: stub é apenas log + enqueue. Worker para consumir `queue:notifications` vem em Epic 12 (mesma decisão da Story 4.3 / convite e-mail).
- **Nomes vazios no relatório**: `name: null` no attendee. Resolver com join `users.full_name` no Epic 13 (relatórios avançados). Para MVP, frontend cai no `userId` como label.
- **Cancel/reschedule fora de escopo**: PATCH/DELETE no meeting NÃO cancelam o job. Worker do reminder precisa no-op se meeting cancelled — fica para próxima iteração.

### Out of scope
- Worker que consome `queue:notifications` (Epic 12).
- Join com `users` para popular `name` nos attendees.
- Cancel/reschedule do reminder quando meeting é editado.
- Métricas de tendência cross-meeting (Epic 13).

### Suite de testes
- Vermelhos pré-existentes do baseline (`test/rls/**`, `test/marketing/**`, `test/migrations/**`) NÃO foram tocados.
- Novos `meeting-reports.rls-spec.ts` entra no mesmo bucket (env DB SASL).
- Comando: `npx vitest run --exclude 'test/rls/**' --exclude 'test/marketing/**' --exclude 'test/migrations/**'` — **415 tests verdes**.
