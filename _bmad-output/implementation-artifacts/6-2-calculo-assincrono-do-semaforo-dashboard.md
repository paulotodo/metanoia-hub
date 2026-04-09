# Story 6.2: Cálculo Assíncrono do Semáforo & Dashboard

Status: ready-for-dev

## Story

As a Líder,
I want a traffic-light dashboard showing each participant's pastoral status calculated asynchronously,
so that I can quickly identify who needs attention with fast load times.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Criar Prisma schema para `participant_radar_status` (AC: #1)
  - [ ] Model ParticipantRadarStatus: id, tenant_id, group_id, participant_id, status (enum), trend (enum), presence_percentage (Decimal), last_active_at, calculated_at
  - [ ] Enum RadarStatus: verde, amarelo, vermelho
  - [ ] Enum RadarTrend: melhorando, estavel, declinio
  - [ ] UUID v7, @@map("participant_radar_status")
  - [ ] Migration com RLS policy
- [ ] Task 2: Definir constantes de threshold em packages/types (AC: #1)
  - [ ] Criar `packages/types/src/pastoral/radar-constants.ts`
  - [ ] RADAR_GREEN_THRESHOLD = 0.75
  - [ ] RADAR_YELLOW_MIN = 0.50
  - [ ] RADAR_RED_THRESHOLD = 0.50
  - [ ] RADAR_ACTIVE_DAYS = 14
  - [ ] RADAR_INACTIVE_DAYS = 21
  - [ ] Snapshot tests para constantes
- [ ] Task 3: Implementar BullMQ job de cálculo do semáforo (AC: #1)
  - [ ] Criar queue `queue:radar-calculation`
  - [ ] Worker: recalcular status baseado em presença das últimas 3 reuniões + atividade
  - [ ] Persistir resultado em participant_radar_status
  - [ ] Cache resultado em Redis `cache:radar:{tenantId}:{groupId}` com TTL 5min
- [ ] Task 4: Criar módulo Pastoral no NestJS (AC: #1, #2)
  - [ ] Criar `apps/api/src/modules/pastoral/pastoral.module.ts`
  - [ ] Criar `pastoral.controller.ts`, `pastoral.service.ts`, `pastoral.repository.ts`
  - [ ] Core Domain — Repository Pattern obrigatório
  - [ ] Endpoint `GET /api/v1/groups/:groupId/radar` — servir do cache
- [ ] Task 5: Criar componente SemaforoPill (AC: #2)
  - [ ] Criar `apps/web/src/components/pastoral/semaforo-pill.tsx`
  - [ ] Cores: verde (#22c55e), amarelo (#eab308), vermelho (#ef4444) — ou design tokens
  - [ ] Tooltip acessível explicando significado
  - [ ] `aria-live="polite"` para screen readers
  - [ ] Respeitar `prefers-reduced-motion` em animações
- [ ] Task 6: Criar Radar Dashboard page (AC: #2)
  - [ ] Criar `apps/web/src/app/(authenticated)/radar/page.tsx`
  - [ ] Listar participantes do grupo com SemaforoPill
  - [ ] TanStack Query (Client Component) com staleTime adequado
  - [ ] Dashboard load ≤ 2s (NFR-P2)
- [ ] Task 7: Testes (AC: #1, #2, #3)
  - [ ] Testes unitários: cálculo do semáforo com diferentes cenários
  - [ ] Teste: 75% presença → verde, 50-74% → amarelo, <50% → vermelho
  - [ ] Teste: inatividade 14+ dias → amarelo, 21+ → vermelho
  - [ ] RLS isolation tests
  - [ ] Accessibility tests: tooltip, aria-live
  - [ ] Snapshot tests dos Zod schemas

## Dev Notes

- **Pastoral é Core Domain** — obrigatório usar Repository Pattern
- Semáforo MVP calcula APENAS com presença + atividade (trilhas = Epic 8)
- Cache Redis `cache:radar:{tenantId}:{groupId}` TTL 5min — dashboard lê do cache
- BullMQ job triggered por eventos de presença (Epic 5) ou schedule
- NFR-P2: dashboard load ≤ 2s — servir dados do cache Redis
- NFR-E3: cache TTL 5min para consistência eventual

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
- Epic 5 (Stories 5.1-5.3): Reuniões e presença (dados de entrada para cálculo)
- Story 6.1: Vocabulário Pastoral (termos nos tooltips)
- Epic 2: Auth e Guards (roles Líder/Admin)

### Project Structure Notes
```
apps/api/src/modules/pastoral/
  ├── pastoral.module.ts
  ├── pastoral.controller.ts
  ├── pastoral.service.ts
  ├── pastoral.repository.ts
  ├── radar/
  │   ├── radar-calculator.service.ts
  │   └── radar-calculator.processor.ts  (BullMQ)
  └── dto/
packages/types/src/pastoral/
  ├── radar-constants.ts
  ├── radar-status.enum.ts
  └── radar.schema.ts
apps/web/src/components/pastoral/
  └── semaforo-pill.tsx
apps/web/src/app/(authenticated)/radar/
  └── page.tsx
apps/api/test/rls/
  └── radar-status.rls.spec.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-06.md` — Story 6.2
- `docs/project-context.md` — NFR-P2, NFR-E3
- `docs/architecture.md` — Pastoral bounded context, Repository pattern
- UX-DR20: Acessibilidade screen readers
