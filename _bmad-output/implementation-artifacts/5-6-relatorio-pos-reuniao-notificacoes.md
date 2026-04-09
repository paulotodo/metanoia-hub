# Story 5.6: Relatório Pós-Reunião & Notificações

Status: ready-for-dev

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

- [ ] Task 1: Criar Prisma schema para `meeting_reports` (AC: #1)
  - [ ] Model MeetingReport: id, tenant_id, meeting_id, summary (Json), generated_at
  - [ ] UUID v7 via uuidv7(), @@map("meeting_reports")
  - [ ] Migration com RLS policy
  - [ ] Definir Zod schema para summary JSONB em `packages/types`
- [ ] Task 2: Implementar BullMQ job de geração de relatório (AC: #1)
  - [ ] Criar queue `queue:meeting-reports`
  - [ ] Worker: ao meeting end, agregar dados de meeting_attendance + meeting_telemetry
  - [ ] Calcular métricas: totalDurationMinutes, avgEngagementScore, totalPresent/Partial/Absent
  - [ ] Persistir em meeting_reports
- [ ] Task 3: Implementar endpoint de relatório com controle de acesso (AC: #2, #3)
  - [ ] `GET /api/v1/meetings/:id/report`
  - [ ] Líder/Admin: retorna relatório completo com todos attendees
  - [ ] Participante: retorna apenas seus próprios dados de presença e duração
  - [ ] Guard server-side para controle de acesso
- [ ] Task 4: Criar UI de relatório pós-reunião (AC: #2, #3)
  - [ ] Criar `apps/web/src/components/meetings/post-meeting-report.tsx`
  - [ ] View Líder/Admin: tabela completa com attendees, métricas agregadas
  - [ ] View Participante: card com próprio status e duração
  - [ ] TanStack Query para fetching (Client Component)
- [ ] Task 5: Implementar notificação de reunião agendada (AC: #4)
  - [ ] Criar BullMQ delayed job: 30 min antes de scheduled_at
  - [ ] Stub implementation: log + enqueue em `queue:notifications`
  - [ ] Constante `MEETING_REMINDER_MINUTES = 30` em `packages/types`
  - [ ] Real provider integration deferred to Epic 12
- [ ] Task 6: Testes (AC: #1, #2, #3, #4)
  - [ ] Testes unitários: cálculo de métricas do relatório
  - [ ] Teste: Líder vê relatório completo
  - [ ] Teste: Participante vê apenas próprios dados
  - [ ] Teste: notificação enqueued 30min antes
  - [ ] RLS isolation tests
  - [ ] Snapshot test do summary JSONB schema

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
