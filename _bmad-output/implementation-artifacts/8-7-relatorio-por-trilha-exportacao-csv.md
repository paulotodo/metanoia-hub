# Story 8.7: Relatório por Trilha & Exportação CSV

Status: ready-for-dev

## Story

As a Líder/Admin,
I want to view trail completion reports with per-participant metrics and export them as CSV,
so that I can monitor group progress and share reports with church leadership.

## Acceptance Criteria

**Given** I am a Líder with a group that has trails assigned
**When** I access `GET /api/v1/reports/trails/:trailId`
**Then** I see a report with:
  - Trail name, total modules, total lessons
  - Per-participant row: name, overall progress %, modules completed, lessons completed, last activity date, status (not started / in progress / completed)
  - Aggregated metrics: average completion %, participants who completed, participants who haven't started
**And** the report is paginated using `{ "data": [...], "meta": { "page", "perPage", "total", "totalPages" } }`
**And** results are filterable by: status (not_started, in_progress, completed), date range (lastActivityAfter, lastActivityBefore)
**And** all data is scoped to my tenant and my groups (Líder sees only their groups; Admin sees all groups in tenant)

**Given** I want to export the report
**When** I request `GET /api/v1/reports/trails/:trailId/export?format=csv`
**Then** the API returns a CSV file with Content-Type `text/csv` and Content-Disposition `attachment; filename="trilha-{trailName}-{date}.csv"`
**And** the CSV includes headers in Portuguese: "Participante", "Progresso (%)", "Módulos Concluídos", "Aulas Concluídas", "Última Atividade", "Status"
**And** the CSV uses UTF-8 with BOM for correct character display in Excel
**And** for large datasets (> 1000 participants), the export is processed asynchronously via BullMQ job in `queue:reports` and the API returns 202 with a `jobId`
**And** the client polls `GET /api/v1/reports/jobs/:jobId` for status (`processing`, `completed`, `failed`) — when completed, the response includes a signed download URL (valid for 1 hour). This polling approach works without Epic 14 notifications; when Epic 14 is implemented, an in-app notification is added as enhancement

**Given** I am an Admin
**When** I access `GET /api/v1/reports/trails` (without trailId)
**Then** I see a summary of all trails in my tenant: trail name, total participants, average progress, completion rate
**And** I can drill down into any trail for the detailed per-participant report

## Tasks / Subtasks

- [ ] Task 1: Implementar endpoint de relatório por trilha (AC: #1)
  - [ ] `GET /api/v1/reports/trails/:trailId` — relatório detalhado
  - [ ] Agregar: trail name, total modules, total lessons
  - [ ] Per-participant: name, progress %, modules completed, lessons completed, last activity, status
  - [ ] Aggregated metrics: avg completion, completed count, not started count
  - [ ] Paginação: { data, meta: { page, perPage, total, totalPages } }
  - [ ] Filtros: status, lastActivityAfter, lastActivityBefore
- [ ] Task 2: Implementar scoping por role (AC: #1)
  - [ ] Líder: ver apenas seus grupos (server-side WHERE clause)
  - [ ] Admin: ver todos os grupos do tenant
  - [ ] RLS garante isolamento por tenant
- [ ] Task 3: Implementar exportação CSV síncrona (AC: #2)
  - [ ] `GET /api/v1/reports/trails/:trailId/export?format=csv`
  - [ ] Content-Type: text/csv
  - [ ] Content-Disposition: attachment; filename="trilha-{trailName}-{date}.csv"
  - [ ] Headers PT-BR: "Participante", "Progresso (%)", "Módulos Concluídos", "Aulas Concluídas", "Última Atividade", "Status"
  - [ ] UTF-8 com BOM (\uFEFF) para Excel
- [ ] Task 4: Implementar exportação CSV assíncrona para large datasets (AC: #2)
  - [ ] Se > 1000 participants: enqueue BullMQ job em `queue:reports`
  - [ ] Retornar 202 com { jobId }
  - [ ] Worker gera CSV e armazena em MinIO
  - [ ] `GET /api/v1/reports/jobs/:jobId` — polling status
  - [ ] Status: processing, completed, failed
  - [ ] Quando completed: signed download URL (1h expiration)
- [ ] Task 5: Implementar summary de todas as trilhas (AC: #3)
  - [ ] `GET /api/v1/reports/trails` — summary (Admin only)
  - [ ] Trail name, total participants, average progress, completion rate
  - [ ] Drill-down link para relatório detalhado
- [ ] Task 6: Criar UI de relatórios (AC: #1, #2, #3)
  - [ ] Página de relatórios: `apps/web/src/app/(authenticated)/reports/trails/page.tsx`
  - [ ] Tabela com dados por participante
  - [ ] Filtros de status e date range
  - [ ] Botão "Exportar CSV"
  - [ ] Loading state durante export async
  - [ ] Polling UI para status do job
- [ ] Task 7: Testes (AC: #1, #2, #3)
  - [ ] Teste: relatório retorna dados corretos paginados
  - [ ] Teste: filtros status e date range
  - [ ] Teste: Líder vê apenas seus grupos
  - [ ] Teste: Admin vê todos os grupos
  - [ ] Teste: CSV com headers PT-BR e UTF-8 BOM
  - [ ] Teste: > 1000 participants → 202 async
  - [ ] Teste: polling job status
  - [ ] Teste: signed download URL com 1h expiration
  - [ ] RLS isolation tests

## Dev Notes

- CSV com UTF-8 BOM (\uFEFF no início do arquivo) para exibição correta no Excel
- Async export para datasets > 1000 participants — evitar timeout
- Signed download URL via MinIO (1h expiration)
- Polling approach funciona sem Epic 14 — in-app notification é enhancement futuro
- Server-side filtering por role é OBRIGATÓRIO — nunca confiar no frontend

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
- Story 8.1: CRUD Trilhas (trail data)
- Story 8.3: Progresso Individual (LessonProgress, ModuleProgress, TrailProgress)
- Story 8.6: Publicação (only published trails in reports)
- Epic 1: Storage (MinIO for async CSV files)

### Project Structure Notes
```
apps/api/src/modules/reports/
  ├── reports.module.ts
  ├── trail-report.controller.ts
  ├── trail-report.service.ts
  ├── csv/
  │   ├── csv-generator.service.ts
  │   └── csv-export.processor.ts   (BullMQ worker)
  └── jobs/
      └── report-jobs.controller.ts
apps/web/src/app/(authenticated)/reports/
  └── trails/
      └── page.tsx
packages/types/src/reports/
  └── trail-report.schema.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.7
- `docs/project-context.md` — API pagination format, async processing
- `docs/architecture.md` — Reports module, BullMQ patterns
