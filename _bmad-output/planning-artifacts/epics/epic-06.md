## Epic 6: Radar Pastoral & Visibilidade MVP

Dashboard semáforo por participante baseado em sinais de presença de reunião (semáforo "completo" com progresso de trilhas só após Epic 8). Inclui tendência temporal, perfil consolidado, ações de cuidado pastoral, alertas de mudança de status, vocabulário pastoral.

### Story 6.1: Vocabulário Pastoral & Governança

As a platform operator,
I want a centralized pastoral vocabulary with lint enforcement across frontend and backend,
So that all communication uses care-oriented language, never surveillance terms.

**Acceptance Criteria:**

**Given** the platform needs consistent pastoral language
**When** `vocabulary.ts` is created in `packages/types`
**Then** it exports typed constants for all pastoral terms: "cuidado", "acompanhamento", "presença", "atenção pastoral", etc.
**And** lint rules are configured in both `apps/web` and `apps/api` to block surveillance/corporate terms hardcoded outside vocabulary (ex: "vigilância", "tracking", "monitoramento")
**And** any change to `vocabulary.ts` requires PR review (enforced via CODEOWNERS)

**Given** a developer adds a new UI string related to monitoring
**When** they use a hardcoded term not from vocabulary.ts
**Then** the lint rule fails CI with a descriptive error pointing to vocabulary.ts as the source of truth

### Story 6.2: Cálculo Assíncrono do Semáforo & Dashboard

As a Líder,
I want a traffic-light dashboard showing each participant's pastoral status calculated asynchronously,
So that I can quickly identify who needs attention with fast load times.

**Acceptance Criteria:**

**Given** presence events are processed (Epic 5)
**When** a BullMQ job recalculates participant status
**Then** the result is persisted in `participant_radar_status`: `id` (UUID v7), `tenant_id`, `group_id`, `participant_id`, `status` (enum: `verde`, `amarelo`, `vermelho`), `trend` (enum: `melhorando`, `estavel`, `declinio`), `presence_percentage` (decimal), `last_active_at`, `calculated_at`
**And** the result is cached in Redis (`cache:radar:{tenantId}:{groupId}`) with TTL 5min (NFR-E3)
**And** thresholds are defined as named constants in `packages/types` (not magic numbers):
- `RADAR_GREEN_THRESHOLD = 0.75` (≥75% presença últimas 3 reuniões E ativo últimos 14 dias)
- `RADAR_YELLOW_MIN = 0.50` (50–74% presença OU inativo 14–21 dias)
- `RADAR_RED_THRESHOLD = 0.50` (<50% presença OU inativo >21 dias)
- `RADAR_ACTIVE_DAYS = 14`, `RADAR_INACTIVE_DAYS = 21`

**Given** I am Líder and access the Radar dashboard
**When** the dashboard loads
**Then** I see my group's participants with `SemaforoPill` (verde/amarelo/vermelho) reading from cache — dashboard loads ≤ 2s (NFR-P2)
**And** each `SemaforoPill` has an accessible tooltip explaining the meaning (ex: "Presença consistente — participou de 3/3 últimas reuniões")
**And** `aria-live="polite"` announces status changes for screen readers (UX-DR20)
**And** all animations respect `prefers-reduced-motion`

**Given** the semáforo MVP is documented
**When** stakeholders review
**Then** it is clear that semáforo calculates only from presence signals + trend + permanence (progress de trilhas requires Epic 8)

### Story 6.3: Indicadores de Tendência & Alertas

As a Líder,
I want to see trend indicators and receive alerts when a participant's status worsens,
So that I can proactively care for participants showing declining engagement.

**Acceptance Criteria:**

**Given** a participant's status is recalculated
**When** the trend is determined from the last 3 meetings + average permanence time
**Then** the indicator shows: `melhorando` (↑), `estável` (→), or `declínio` (↓)
**And** the trend is persisted in `participant_radar_status.trend`

**Given** a participant's status changes negatively (verde→amarelo or amarelo→vermelho)
**When** the BullMQ job detects the transition
**Then** an alert is created in `pastoral_alerts`: `id` (UUID v7), `tenant_id`, `group_id`, `participant_id`, `previous_status`, `new_status`, `trend`, `created_at`, `read_at` (nullable), `dismissed_at` (nullable)
**And** dedup: only 1 alert per transition — no new alert while status remains the same (ex: stays vermelho for 3 meetings = 1 alert, not 3)
**And** semáforo updates within ≤ 2s end-to-end after event (NFR-P3)

**Given** a participant's status changes positively (vermelho→amarelo or amarelo→verde)
**When** the transition is detected
**Then** no alert is generated — positive transitions feed `CelebrationBanner` (Story 6.5)

### Story 6.4: Perfil Consolidado & Ações de Cuidado Pastoral

As a Líder,
I want to view a participant's consolidated profile and register pastoral care actions,
So that I have full context before reaching out and can track my pastoral efforts.

**Acceptance Criteria:**

**Given** I am Líder viewing the Radar
**When** I expand a participant's `ParticipantCard` (UX-DR05)
**Then** I see: name, photo, semáforo, trend, last meeting attended, average permanence time (read from `meeting_telemetry` — Epic 5), and pastoral context
**And** the card expands to show `TimelineCuidado` in reverse chronological order (most recent first): signals (presence/absence) → care actions registered → results (UX-DR06, chronological mode MVP)

**Given** no care actions have been registered for a participant
**When** the TimelineCuidado is displayed
**Then** an encouraging empty state message appears: "Nenhuma ação de cuidado registrada. Que tal começar com uma mensagem?" (pastoral tone, from vocabulary.ts)

**Given** I want to register a pastoral care action
**When** I submit the action form
**Then** the action is stored in `pastoral_actions`: `id` (UUID v7), `tenant_id`, `group_id`, `participant_id`, `leader_id`, `action_type` (enum: `ligacao`, `visita`, `mensagem`, `oracao`, `outro`), `description`, `action_date`, `created_at`
**And** the timeline updates immediately with the new action
**And** RLS ensures pastoral actions are isolated per tenant

**Given** the profile shows trail progress
**When** Epic 8 is not yet implemented
**Then** trail progress section shows "Em breve" placeholder

### Story 6.5: Componentes UX do Radar Pastoral

As a Líder,
I want contextual nudges, celebration banners, undo support and a pastoral greeting,
So that the Radar feels like a pastoral care companion.

**Acceptance Criteria:**

**Given** a participant has 2+ consecutive meeting absences
**When** the Líder views the Radar
**Then** a `NudgePastoral` notification appears guiding toward care action (ex: "Maria não participou das últimas 2 reuniões. Que tal uma ligação?") (UX-DR07)
**And** nudge trigger rules are: 2+ consecutive absences → suggest call; status changed to vermelho → suggest visit; 7+ days inactive → suggest message

**Given** a participant transitions positively (ex: vermelho→amarelo, amarelo→verde)
**When** the Líder views the Radar
**Then** a `CelebrationBanner` appears with positive feedback (ex: "Maria voltou a participar! Seu cuidado fez diferença.") (UX-DR09)

**Given** I register or undo a pastoral care action
**When** the action is submitted
**Then** `useUndoableAction` hook + `UndoToast` provides undo capability with 5s timeout and a visible progress indicator showing remaining time (UX-DR08)

**Given** all pastoral alerts are resolved for my group
**When** I view the Radar
**Then** `InboxZeroState` shows an optimistic empty state with pastoral message (ex: "Todos os seus participantes estão bem acompanhados!") (UX-DR10)

**Given** I open the Radar for the first time in a session
**When** the dashboard loads
**Then** `SaudacaoCard` shows a contextual greeting with pastoral summary (ex: "Bom dia, Pastor Marcos. Seu grupo tem 12 pessoas, 2 precisam de atenção.") (UX-DR11)

**And** all text strings come from `vocabulary.ts` (Story 6.1)
**And** MVP priority: `SaudacaoCard` and `NudgePastoral` are required; `InboxZeroState`, `CelebrationBanner`, and `UndoToast` are nice-to-have (can be deferred under schedule pressure)

### Story 6.6: Dashboard Agregado para Admin Tenant

As a Admin Tenant,
I want an aggregated dashboard across all groups with near-real-time updates,
So that I have organizational-level visibility of pastoral health.

**Acceptance Criteria:**

**Given** I am authenticated as Admin Tenant
**When** I access the aggregated Radar dashboard
**Then** I see: total participants by status (verde/amarelo/vermelho), distribution per group, overall trend
**And** I can filter by group, time period, and status

**Given** I am Líder (not Admin)
**When** I access the aggregated view
**Then** I see only groups where I am leader — filtering is enforced server-side (not just UI)

**Given** the aggregated dashboard needs updates
**When** data changes
**Then** updates are delivered via polling every 30s (not SSE — aggregated view is analytical, not real-time critical)
**And** data is served from aggregated Redis cache

