## Epic 13: Relatórios Avançados & Analytics

Relatórios por reunião, por líder (consolidado), por tenant (agregado), métricas de plataforma (Super Admin), detecção automática de risco de evasão, e templates de conteúdo reutilizáveis. Analytics é supporting subdomain — service direto com Prisma, sem repository pattern. Materialized views para agregações pesadas.

**FRs cobertos:** FR42, FR63, FR65, FR66, FR67, FR79
**Pré-requisitos:** Epic 5 (reuniões — dados de presença), Epic 7 (Pastoral Radar — sinais semáforo), Epic 8 (trilhas completas — dados de progresso), Epic 14 (notificações — para alertar líder sobre risco de evasão)
**Nota:** FR42 (templates de conteúdo) é feature de gestão de trilhas, não analytics. Está neste épico por afinidade de Release 2 e maturidade de trilhas — implementado como milestone separado no sprint e potencialmente destacável.

**Orquestração de Materialized Views:** Dois jobs no `queue:reports`:
1. `refresh-tenant-views` — refresha `mv_tenant_report` (tenant-scoped), roda primeiro
2. `refresh-platform-views` — refresha `mv_platform_metrics` (cross-tenant), roda como child job após #1 completar (BullMQ parent/child flow)
Ambos usam `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Cron: a cada 15min. Timeout: 10min por job. Se duração > 5min, emite alerta.

### Story 13.1: Relatório por Reunião (FR63)

As a Líder de Grupo,
I want to see a detailed report for each meeting with attendance and engagement metrics,
So that I can understand group dynamics and follow up on absent participants.

**Acceptance Criteria:**

**Given** a meeting has been completed (status `completed` from Epic 5)
**When** the leader accesses `GET /api/v1/meetings/:id/report`
**Then** the report includes:
  - Total participants invited vs. present vs. absent
  - Attendance percentage
  - Per-participant: present (yes/no), join time, leave time, duration in meeting
  - Engagement score: `participantDuration / meetingDuration` (0.0 a 1.0) — classificação: ≥ 0.75 alto, 0.50–0.74 médio, < 0.50 baixo
**And** the response follows the standard format `{ data: { meetingId, date, groupName, metrics: {...}, participants: [...] }, meta: { generatedAt } }`

**Given** the leader views the report in the UI at `/app/gestao/meetings/:id/report`
**When** the report page renders
**Then** a summary card shows: total participants, attendance %, average engagement score com badge de classificação (alto/médio/baixo)
**And** a mini-chart of attendance trend shows the last 5 meetings of this group (sparkline: attendance % over time) — *nice-to-have, pode ser implementado como sub-task*
**And** a participant list shows each member with status icon (present ✓ / absent ✗), duration, and engagement score
**And** absent participants are highlighted with a "Cuidar" CTA linking to pastoral action (if Epic 7 Radar is available)

**Given** the leader wants to export the report
**When** they click "Exportar CSV"
**Then** a CSV file is generated with columns: name, email, status, joinTime, leaveTime, duration, engagementScore
**And** the export follows the same BullMQ async pattern from Epic 8 (`queue:reports`), returning 202 with download link via polling

**Given** a meeting has no attendance data (edge case — meeting created but never started)
**When** the leader accesses the report
**Then** the report shows "Nenhum dado de presença registrado para esta reunião" with empty state illustration
**And** the API returns 200 with empty `participants: []` and `metrics: { attendance: 0, total: N }`

**Teste:** Integration test com meeting fixtures (0 participants, partial, full attendance). Validar cálculo de engagement score e classificação. RLS isolation test: líder do tenant A NÃO vê reuniões do tenant B. E2E: Playwright para fluxo completo report → export CSV.

### Story 13.2a: Relatório Consolidado por Líder (FR79)

As a Líder de Grupo,
I want to see an aggregated report across all my groups,
So that I can have a holistic view of my pastoral impact.

**Acceptance Criteria:**

**Given** a leader has multiple groups
**When** they access `GET /api/v1/reports/leader-summary?period=30d`
**Then** the report includes per-group: attendance average, trail progress average, participants at risk count, active participants count
**And** an overall summary: total groups, total participants, overall attendance %, overall trail completion %
**And** the API supports period filter: `7d`, `30d`, `90d`, `custom` (with `startDate` and `endDate`)

**Given** the leader views the report in the UI at `/app/gestao/reports`
**When** the page loads
**Then** filters are available: período, grupo específico, status do semáforo
**And** each group card shows a summary with drill-down link to individual group details

**Teste:** Integration test com leader com 1, 3, 5 grupos e dados variados. RLS isolation test: líder do tenant A NÃO vê dados do tenant B. E2E: filtros de período e grupo.

### Story 13.2b: Relatório por Tenant com Materialized Views (FR65)

As an Admin Tenant,
I want to see aggregated metrics for the entire tenant,
So that I can monitor overall health and make strategic decisions.

**Acceptance Criteria:**

**Given** an admin accesses `GET /api/v1/reports/tenant-summary?period=30d`
**When** the tenant has multiple groups and leaders
**Then** the report includes per-group: leader name, attendance average, trail progress, risk count
**And** a tenant-wide summary: total groups, total leaders, total participants, overall metrics
**And** the data comes from a materialized view (`mv_tenant_report`) refreshed every 15 minutes via BullMQ job (`queue:reports`, job `refresh-tenant-views`)
**And** the `REFRESH MATERIALIZED VIEW CONCURRENTLY` command is used to avoid locking reads during refresh

**Given** the UI renders the report
**When** the page loads
**Then** a "Dados atualizados em: {timestamp}" label is displayed (timestamp from materialized view `last_refresh_at`)
**And** a "Atualizar agora" button triggers on-demand refresh (rate-limited: max 1 per 5min per tenant)
**And** during refresh, the button shows a spinner and is disabled
**And** if rate-limited, a toast is shown: "Atualização disponível em X minutos"
**And** on completion, the timestamp updates and a success toast confirms: "Dados atualizados com sucesso"
**And** filters are available: período, grupo específico, status do semáforo

**Given** the materialized view refresh job fails
**When** the next scheduled run executes
**Then** it retries with exponential backoff (3 attempts, 30s/60s/120s)
**And** stale data is still served with a warning banner: "Dados podem estar desatualizados"
**And** failure is logged with `correlation_id` for debugging
**And** if refresh duration > 5min, an alert metric is emitted via Pino for monitoring

**Teste:** Integration test com materialized view refresh (verify data freshness). Load test padronizado: 500 tenants × 10 grupos × 50 participantes = 250k participantes — query < 2s. RLS isolation test: admin do tenant A NÃO vê dados do tenant B. E2E: filtros, botão "Atualizar agora" com estados (loading, rate-limited, success).

### Story 13.3: Detecção de Risco de Evasão (FR66)

As a Líder de Grupo,
I want the system to automatically detect participants at risk of dropping out,
So that I can proactively reach out and provide pastoral care before they disengage.

**Acceptance Criteria:**

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

**Teste:** Unit test do algoritmo de detecção (fixtures: 0, 2, 3, 5 ausências; grupo em recesso; retorno; participante em múltiplos grupos com padrões diferentes). Integration test do job BullMQ end-to-end. Race condition test: líder altera semáforo manualmente → job roda nas próximas 24h → verifica que decisão manual prevalece. Snapshot tests obrigatórios para schemas Zod dos domain events `risk-detected` e `risk-resolved`. RLS isolation test. Load test padronizado: 500 tenants × 10 grupos × 50 participantes.

### Story 13.4: Métricas de Plataforma — Super Admin (FR67)

As a Super Admin,
I want to see platform-wide metrics across all tenants,
So that I can monitor platform health, adoption, and resource utilization.

**Acceptance Criteria:**

**Given** a Super Admin accesses `GET /api/v1/admin/platform-metrics/summary`
**When** the endpoint processes the request
**Then** it returns aggregate totals (cached in Redis, TTL 5min, key `cache:platform-metrics:summary`):
  - `totalTenants`, `activeTenants` (at least 1 login in last 30d), `totalUsers`, `activeUsers` (last 30d)
  - `totalGroups`, `totalMeetings` (last 30d), `totalTrails`
  - `averageAttendance` (platform-wide), `averageTrailCompletion`
  - `storageUsed` (total across tenants) — valor vem da tabela `tenant_storage_usage` (atualizada via hook de upload/delete no MinIO, não via query ao MinIO em tempo real)
  - `churnedTenants` (tenants ativos no mês anterior mas inativos agora), `netGrowth` (novos tenants - churned no período)
**And** the response format is `{ data: { ...metrics }, meta: { generatedAt, cacheTTL: 300 } }`

**Given** a Super Admin accesses `GET /api/v1/admin/platform-metrics/tenants?page=1&limit=20&sort=activeUsers:desc`
**When** the endpoint processes the request
**Then** it returns a paginated list of tenants with per-tenant metrics:
  - `tenantId`, `tenantName`, `plan`, `activeUsers`, `totalGroups`, `totalMeetings`, `storageUsed`, `createdAt`
**And** supports sorting by any metric column
**And** supports filtering by `plan` (`free`, `pro`, `enterprise`) and `status` (`active`, `inactive`)
**And** pagination follows standard `{ data: [...], meta: { total, page, limit, totalPages } }`

**Given** the Super Admin endpoint is called
**When** the guard validates the request
**Then** `@Roles('super_admin')` guard is enforced — no RLS (Super Admin sees cross-tenant data)
**And** the endpoint is under `/api/v1/admin/` namespace (separate from tenant-scoped `/api/v1/`)

**Given** the platform has 500+ tenants
**When** the summary endpoint is called without cache
**Then** the query completes in < 3s (materialized view `mv_platform_metrics` refreshed every 15min as child job of `refresh-tenant-views` — see Epic overview orchestration)
**And** on cache hit, response time is < 100ms

**Teste:** Integration test com 10+ tenants e dados variados. Load test padronizado: 500 tenants × 10 grupos × 50 participantes — verificar query < 3s. Validar que non-super-admin recebe 403. Validar cálculo de `churnedTenants` e `netGrowth`. Validar que `storageUsed` vem de `tenant_storage_usage` e não de query ao MinIO.

### Story 13.5: Templates de Conteúdo Reutilizáveis (FR42)

*Milestone separado — feature de gestão de trilhas agrupada neste épico por afinidade de Release 2. Pode ser implementada independentemente das stories 13.1–13.4.*

As an Admin Tenant,
I want to create and use reusable content templates,
So that I can quickly set up new trails based on proven structures without starting from scratch.

**Acceptance Criteria:**

**Given** the platform provides pre-built templates
**When** the system is seeded
**Then** a set of platform-scoped templates is available (read-only for tenants):
  - "Discipulado Básico" (4 módulos, 12 lições — estrutura apenas, sem conteúdo)
  - "Estudo Bíblico Temático" (3 módulos, 9 lições)
  - "Acolhimento de Novos Membros" (2 módulos, 6 lições)
**And** templates are stored in `ContentTemplate` table with `scope: 'platform' | 'tenant'` and `tenant_id: null` for platform-scoped

**Given** an admin wants to create a template from an existing trail
**When** they click "Salvar como Template" on a trail detail page
**Then** a `POST /api/v1/templates` is called with `{ sourceTrailId, name, description }`
**And** the system creates an immutable snapshot: copies module/lesson structure (titles, order, type) WITHOUT content (text, files, videos — fields `fileUrl`, `videoUrl`, `content` are set to `null` in the template)
**And** each version is a separate record in `ContentTemplate` with `sourceTrailId + version` as logical key
**And** version 1 is created on first save; subsequent "Salvar como Template" from the same trail creates version 2, 3, etc.
**And** the template is `scope: 'tenant'` and visible only within the tenant

**Given** an admin wants to create a new trail from a template
**When** they access the template library at `/app/admin/templates` and select a template
**Then** a preview shows: template name, description, structure tree (modules → lessons), source trail (if any), version, created date
**And** clicking "Usar Template" calls `POST /api/v1/trails` with `{ templateId, name, groupId }`
**And** a new trail is created with the template's structure, all content fields empty (ready to fill)
**And** the new trail has no link back to the template (independent copy — edits don't propagate)

**Given** an admin manages tenant templates
**When** they access `GET /api/v1/templates?scope=all`
**Then** the list shows both platform and tenant templates, clearly labeled
**And** the library supports: search by name, filter by scope (plataforma/tenant), sort by created date/name
**And** tenant templates support CRUD: edit name/description (`PATCH`), delete (`DELETE` — soft delete, no cascade to trails created from it)
**And** platform templates are read-only (no edit/delete for tenant admins)

**Given** the template versioning scenario
**When** an admin updates a template's source trail and wants to refresh the template
**Then** they must explicitly "Salvar como Template" again, creating a new version record
**And** the template list shows the latest version by default, with "Histórico de versões" link to see all versions
**And** existing trails created from older versions are NOT affected

**Teste:** Integration test: criar template from trail (com fileUrl/videoUrl nas lições) → verificar que template tem esses campos `null`. Usar template → verificar estrutura copiada. Versioning: salvar 2x → verificar 2 records com version 1 e 2. RLS isolation test: admin do tenant A NÃO vê templates do tenant B. E2E: fluxo completo library (busca, filtro) → preview → create trail. Edge case: template de trail vazia (0 módulos), template com 20+ lições.

---

