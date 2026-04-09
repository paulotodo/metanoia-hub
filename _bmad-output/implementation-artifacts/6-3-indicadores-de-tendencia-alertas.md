# Story 6.3: Indicadores de Tendência & Alertas

Status: ready-for-dev

## Story

As a Líder,
I want to see trend indicators and receive alerts when a participant's status worsens,
so that I can proactively care for participants showing declining engagement.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Criar Prisma schema para `pastoral_alerts` (AC: #2)
  - [ ] Model PastoralAlert: id, tenant_id, group_id, participant_id, previous_status, new_status, trend, created_at, read_at (nullable), dismissed_at (nullable)
  - [ ] UUID v7, @@map("pastoral_alerts")
  - [ ] Migration com RLS policy
- [ ] Task 2: Implementar cálculo de tendência (AC: #1)
  - [ ] Analisar últimas 3 reuniões + permanência média
  - [ ] Lógica: se presença melhorou → melhorando, estável → estavel, piorou → declinio
  - [ ] Persistir em participant_radar_status.trend
  - [ ] Integrar no BullMQ job de cálculo do semáforo (Story 6.2)
- [ ] Task 3: Implementar detecção de transição negativa e criação de alerta (AC: #2)
  - [ ] Comparar status anterior vs novo no BullMQ job
  - [ ] Se transição negativa (verde→amarelo, amarelo→vermelho): criar alerta
  - [ ] Dedup: verificar se já existe alerta para mesma transição ainda não resolvida
  - [ ] Garantir latência ≤ 2s end-to-end (NFR-P3)
- [ ] Task 4: Implementar lógica de transição positiva (AC: #3)
  - [ ] Se transição positiva (vermelho→amarelo, amarelo→verde): não criar alerta
  - [ ] Emitir evento para CelebrationBanner (Story 6.5)
  - [ ] Registrar transição positiva para histórico
- [ ] Task 5: Implementar endpoints de alertas (AC: #2)
  - [ ] `GET /api/v1/groups/:groupId/alerts` — listar alertas do grupo
  - [ ] `PATCH /api/v1/alerts/:id/read` — marcar como lido
  - [ ] `PATCH /api/v1/alerts/:id/dismiss` — dispensar alerta
- [ ] Task 6: Criar componente TrendIndicator no frontend (AC: #1)
  - [ ] Criar `apps/web/src/components/pastoral/trend-indicator.tsx`
  - [ ] Ícones: melhorando (↑), estável (→), declínio (↓)
  - [ ] Cores alinhadas com semáforo
  - [ ] Tooltip com explicação da tendência
- [ ] Task 7: Testes (AC: #1, #2, #3)
  - [ ] Testes unitários: cálculo de tendência com cenários variados
  - [ ] Teste: transição negativa → alerta criado
  - [ ] Teste: transição positiva → sem alerta
  - [ ] Teste: dedup — mesma transição não gera alertas duplicados
  - [ ] Teste: latência ≤ 2s (NFR-P3)
  - [ ] RLS isolation tests para pastoral_alerts

## Dev Notes

- Tendência é calculada no mesmo BullMQ job do semáforo (Story 6.2) — não criar job separado
- Dedup de alertas é crítico: evitar spam de alertas para o líder
- Transições positivas alimentam CelebrationBanner (Story 6.5) — emitir evento/flag
- NFR-P3: latência end-to-end ≤ 2s do evento de presença até atualização do semáforo
- Alertas têm ciclo de vida: created → read → dismissed

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
- Story 6.2: Cálculo do Semáforo (BullMQ job, participant_radar_status)
- Epic 5 (Stories 5.1-5.3): Dados de presença

### Project Structure Notes
```
apps/api/src/modules/pastoral/
  ├── alerts/
  │   ├── alerts.service.ts
  │   └── alerts.controller.ts
  ├── radar/
  │   └── trend-calculator.service.ts
  └── dto/
      └── alert.dto.ts
packages/types/src/pastoral/
  └── alert.schema.ts
apps/web/src/components/pastoral/
  └── trend-indicator.tsx
apps/api/test/rls/
  └── pastoral-alerts.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-06.md` — Story 6.3
- `docs/project-context.md` — NFR-P3 (latência ≤ 2s)
- `docs/architecture.md` — Pastoral bounded context
