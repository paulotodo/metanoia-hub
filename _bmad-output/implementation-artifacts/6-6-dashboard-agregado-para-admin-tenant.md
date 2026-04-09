# Story 6.6: Dashboard Agregado para Admin Tenant

Status: ready-for-dev

## Story

As a Admin Tenant,
I want an aggregated dashboard across all groups with near-real-time updates,
so that I have organizational-level visibility of pastoral health.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Implementar endpoint de dashboard agregado (AC: #1, #2)
  - [ ] `GET /api/v1/radar/dashboard` — dashboard agregado
  - [ ] Admin Tenant: vê todos os grupos do tenant
  - [ ] Líder: vê apenas grupos onde é líder (server-side enforcement)
  - [ ] Filtros: group, time period, status
  - [ ] Response: total por status, distribuição por grupo, trend geral
- [ ] Task 2: Implementar agregação e cache Redis (AC: #1, #3)
  - [ ] Criar BullMQ job para agregação periódica dos dados do radar
  - [ ] Cache em Redis `cache:radar-aggregate:{tenantId}` com TTL 30s
  - [ ] Agregar: contagem por status, distribuição por grupo, trend geral
- [ ] Task 3: Implementar guard server-side para Líder (AC: #2)
  - [ ] Filtrar grupos no query level — não apenas UI
  - [ ] Líder recebe dados apenas de seus grupos via WHERE clause
  - [ ] Testar que Líder não vê dados de grupos de outros líderes
- [ ] Task 4: Criar página do dashboard agregado (AC: #1, #3)
  - [ ] Criar `apps/web/src/app/(authenticated)/radar/dashboard/page.tsx`
  - [ ] Charts/cards: total verde/amarelo/vermelho, distribuição por grupo
  - [ ] Filtros: dropdown grupo, date range, status
  - [ ] TanStack Query com refetchInterval: 30000 (polling 30s)
- [ ] Task 5: Criar componentes de visualização (AC: #1)
  - [ ] Criar `apps/web/src/components/pastoral/radar-summary-cards.tsx` — cards com totais
  - [ ] Criar `apps/web/src/components/pastoral/group-distribution-chart.tsx` — distribuição por grupo
  - [ ] Criar `apps/web/src/components/pastoral/overall-trend.tsx` — indicador de trend geral
- [ ] Task 6: Testes (AC: #1, #2, #3)
  - [ ] Teste: Admin vê todos os grupos
  - [ ] Teste: Líder vê apenas seus grupos (server-side)
  - [ ] Teste: polling a cada 30s atualiza dados
  - [ ] Teste: cache Redis servindo dados agregados
  - [ ] RLS isolation tests

## Dev Notes

- Dashboard agregado usa POLLING (30s) e não SSE — é view analítica, não real-time crítico
- Cache Redis `cache:radar-aggregate:{tenantId}` TTL 30s
- Server-side filtering para Líder é OBRIGATÓRIO — nunca filtrar apenas no frontend
- Reutilizar dados de `participant_radar_status` (Story 6.2) para agregação
- TanStack Query `refetchInterval: 30000` para polling automático

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
- Story 6.2: Semáforo e Dashboard (participant_radar_status)
- Story 6.3: Alertas e Tendências (dados de trend)
- Epic 2: Auth (roles Admin Tenant, Líder)
- Epic 4: Grupos (membership para filtering)

### Project Structure Notes
```
apps/api/src/modules/pastoral/
  ├── dashboard/
  │   ├── dashboard.service.ts
  │   ├── dashboard.controller.ts
  │   └── dashboard-aggregator.processor.ts  (BullMQ)
  └── dto/
      └── dashboard.dto.ts
apps/web/src/app/(authenticated)/radar/
  └── dashboard/
      └── page.tsx
apps/web/src/components/pastoral/
  ├── radar-summary-cards.tsx
  ├── group-distribution-chart.tsx
  └── overall-trend.tsx
```

### References
- `_bmad-output/planning-artifacts/epics/epic-06.md` — Story 6.6
- `docs/architecture.md` — Pastoral bounded context, caching strategy
- `docs/project-context.md` — Server-side authorization rules
