# Story 13.3: Detecção de Risco de Evasão (FR66)

Status: ready-for-dev

## Story

As a Líder de Grupo,
I want the system to automatically detect participants at risk of dropping out,
So that I can proactively reach out and provide pastoral care before they disengage.

## Acceptance Criteria

**Given** the daily evasion detection job runs (`queue:reports`, job `detect-evasion-risk`, cron `0 6 * * *`)
**When** it analyzes participant activity across all tenants
**Then** it flags participants matching either criterion (avaliação é *per-participant-per-group*, não global):
  - 3+ consecutive absences in their specific group's meetings
  - 2+ weeks without any platform access (`last_seen_at` from user profile)
**And** the job is tenant-isolated: processes one tenant at a time to respect RLS boundaries
**And** uses batch processing (100 participants per batch) to avoid memory spikes
**And** SLA: job completa em no máximo 30 minutos. Métricas de duração emitidas ao final via Pino (`job.duration_ms`, `job.tenants_processed`, `job.participants_flagged`)

**Given** a participant is flagged as at risk
**When** the detection job processes them
**Then** it checks if the leader manually changed the semáforo in the last 24h — if yes, the job does NOT override the manual pastoral decision
**And** otherwise, the semáforo status transitions automatically:
  - 🟢 (ok) → 🟡 (attention) on first detection
  - 🟡 (attention) → 🔴 (urgent) if still flagged after 7 more days
**And** a domain event `pastoral.participant.risk-detected` is emitted with `{ tenantId, participantId, riskType: 'absence' | 'inactivity', details: { consecutiveAbsences?, daysSinceLastAccess? }, previousStatus, newStatus }`
**And** the status change is recorded in the participant's care timeline (Epic 7)
**And** a notification is created for the group leader via the notification system (Epic 14): "⚠️ {Nome} pode precisar de cuidado — {motivo}" (ex: "3 ausências consecutivas" ou "Sem acesso há 15 dias")
**And** the reason (riskType + details) is visible on the participant's card in the Radar UI: tooltip ou label com motivo

**Given** a group is marked as "em recesso" (paused)
**When** the detection job runs
**Then** absences during the recesso period are NOT counted toward consecutive absence detection
**And** the recesso status is set by the leader via `PATCH /api/v1/groups/:id` with `{ status: 'on_break', breakUntil: '2026-07-01' }`
**And** the group automatically resumes when `breakUntil` date passes

**Given** a participant returns to activity after being flagged
**When** they attend a meeting or access the platform
**Then** the semáforo transitions back per-group: 🔴→🟡 (on first activity) and 🟡→🟢 (after 2 consecutive attendances in the *next 2 scheduled meetings of that specific group*)
**And** a domain event `pastoral.participant.risk-resolved` is emitted
**And** a `CelebrationBanner` (componente do Epic 7 — dependência explícita; se não existir, implementar banner simples inline) is shown to the leader: "{Nome} voltou a participar!"

**Given** the detection job encounters an error for a specific tenant
**When** the error occurs
**Then** it skips the failed tenant, logs the error with `tenantId` and `correlation_id`, and continues processing remaining tenants
**And** retries the failed tenant in the next scheduled run
**And** after 3 consecutive failures for the same tenant, an alert is sent to Super Admin

## Tasks / Subtasks

- [ ] Task 1: Create Zod schemas for domain events in `packages/types` (AC: #2, #4)
  - [ ] Define `RiskDetectedEventSchema` with `tenantId, participantId, riskType, details, previousStatus, newStatus`
  - [ ] Define `RiskResolvedEventSchema`
  - [ ] Add snapshot tests for both event schemas (mandatory)
- [ ] Task 2: Implement evasion detection algorithm (AC: #1, #2)
  - [ ] Create `EvasionDetectionService` in `apps/api/src/modules/reports/`
  - [ ] Implement consecutive absence detection (3+ per-participant-per-group)
  - [ ] Implement inactivity detection (2+ weeks without platform access via `last_seen_at`)
  - [ ] Check for manual semáforo override in last 24h — skip if manual decision exists
  - [ ] Implement semáforo transition logic: ok→attention on first detection, attention→urgent after 7 more days
- [ ] Task 3: Implement BullMQ job `detect-evasion-risk` (AC: #1, #5)
  - [ ] Create repeatable job with cron `0 6 * * *` in `queue:reports`
  - [ ] Process one tenant at a time (tenant isolation)
  - [ ] Batch processing: 100 participants per batch
  - [ ] Recreate RequestContext via `RequestContext.run()` for each tenant
  - [ ] Emit Pino metrics: `job.duration_ms`, `job.tenants_processed`, `job.participants_flagged`
  - [ ] SLA enforcement: 30min max
  - [ ] Error handling: skip failed tenant, log with correlation_id, continue
  - [ ] Track consecutive failures per tenant, alert Super Admin after 3
- [ ] Task 4: Implement group "em recesso" support (AC: #3)
  - [ ] Add `status` and `breakUntil` fields to groups table (if not already present)
  - [ ] Implement `PATCH /api/v1/groups/:id` for recesso status
  - [ ] Auto-resume when `breakUntil` date passes
  - [ ] Exclude recesso period absences from detection
- [ ] Task 5: Implement risk resolution flow (AC: #4)
  - [ ] Detect participant return to activity (meeting attendance or platform access)
  - [ ] Implement transition back: 🔴→🟡 on first activity, 🟡→🟢 after 2 consecutive attendances
  - [ ] Emit `pastoral.participant.risk-resolved` domain event
  - [ ] Show CelebrationBanner to leader (use Epic 7 component or implement inline)
- [ ] Task 6: Integrate with notification system (AC: #2)
  - [ ] Create notification for group leader on risk detection via Epic 14 infrastructure
  - [ ] Format message: "⚠️ {Nome} pode precisar de cuidado — {motivo}"
  - [ ] Display risk reason on participant card in Radar UI (tooltip/label)
- [ ] Task 7: Write tests (AC: all)
  - [ ] Unit test of detection algorithm: fixtures with 0, 2, 3, 5 absences; group on break; return; participant in multiple groups with different patterns
  - [ ] Integration test of BullMQ job end-to-end
  - [ ] Race condition test: leader changes semáforo manually → job runs within 24h → verify manual decision prevails
  - [ ] Snapshot tests for Zod schemas of domain events `risk-detected` and `risk-resolved`
  - [ ] RLS isolation test
  - [ ] Load test: 500 tenants x 10 groups x 50 participants

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### BullMQ Job Context
- For BullMQ jobs executing outside request context, recreate via `RequestContext.run({ tenantId, userId }, callback)` using tenant_id stored in job payload
- Domain events must include `tenantId` (never omit)

### Dependencies
- Epic 5 (meetings — attendance data for consecutive absence detection)
- Epic 7 (Pastoral Radar — semáforo status, care timeline, CelebrationBanner)
- Epic 14 (notifications — leader notification on risk detection)

### Project Structure Notes
- Backend: `apps/api/src/modules/reports/services/evasion-detection.service.ts`
- BullMQ processor: `apps/api/src/modules/reports/jobs/detect-evasion-risk.processor.ts`
- Domain events: `packages/types/src/events/pastoral-risk.ts`
- Cron: daily at 06:00 UTC

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-13.md` (Story 13.3)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
