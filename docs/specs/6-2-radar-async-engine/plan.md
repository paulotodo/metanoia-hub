# Plan: 6-2-radar-async-engine

## Estratégia de implementação

Implementação em camadas, de baixo para cima: schema → tipos → engine backend → a11y frontend → testes.

## Arquivos a criar/modificar

### Camada 1: Schema e Tipos

**Novo:**
- `apps/api/prisma/schema.prisma` — adicionar enums `RadarStatus`, `RadarTrend` + model `ParticipantRadarStatus`
- `apps/api/prisma/migrations/20260610110000_add_participant_radar_status/migration.sql` — migration additive com RLS
- `apps/api/prisma/rls/radar-status.rls-spec.ts` — RLS isolation tests
- `packages/types/src/pastoral/radar-constants.ts` — constantes de threshold
- `packages/types/src/pastoral/index.ts` — barrel do subdiretório pastoral
- `packages/types/src/__tests__/radar-constants.snapshot.spec.ts` — snapshot test

**Modificar:**
- `packages/types/src/index.ts` — exportar radar-constants

### Camada 2: Engine Backend (NestJS)

**Novo (dentro de apps/api/src/pastoral/):**
- `radar/radar-calculator.service.ts` — lógica de cálculo (Core Domain)
- `radar/radar-calculator.repository.ts` — acesso a dados de presença/reuniões
- `radar/radar-status.repository.ts` — CRUD do ParticipantRadarStatus
- `radar/radar-calculation.worker.ts` — BullMQ worker `queue:radar-calculation`
- `radar/radar-job.service.ts` — enqueue de jobs
- `radar/radar.module.ts` — NestJS module para a sub-camada radar
- `radar/radar-calculator.service.spec.ts` — unit tests do algoritmo

**Modificar:**
- `apps/api/src/pastoral/pastoral.module.ts` — importar RadarModule
- `apps/api/src/pastoral/pastoral.service.ts` — injetar RadarJobService, adicionar getRadarStatus

### Camada 3: Frontend A11y

**Modificar:**
- `apps/web/app/(authenticated)/app/gestao/radar/_components/semaforo-pill.tsx` — tooltip acessível + aria-live + prefers-reduced-motion

## Sequência de execução

1. Adicionar enums e model ao schema.prisma
2. Criar migration SQL (manualmente, sem `prisma migrate dev`)
3. Criar RLS spec
4. Criar radar-constants.ts + exportar
5. Criar snapshot test das constantes
6. Rodar `prisma generate` para gerar tipos
7. Criar RadarCalculatorRepository (query presença)
8. Criar RadarStatusRepository (CRUD ParticipantRadarStatus)
9. Criar RadarCalculatorService (algoritmo)
10. Criar unit tests do RadarCalculatorService
11. Criar RadarCalculationWorker (BullMQ)
12. Criar RadarJobService (enqueue)
13. Criar RadarModule e integrar ao PastoralModule
14. Atualizar PastoralService com getRadarStatus (cache-first)
15. Atualizar SemaforoPill (a11y)
16. Build + lint + testes

## Decisões de arquitetura

### Localização dos novos arquivos
Sub-diretório `apps/api/src/pastoral/radar/` para manter a coesão do Core Domain pastoral sem poluir o diretório raiz.

### Não criar endpoint novo
O endpoint `GET /api/v1/pastoral/radar` já é servido por `pastoral.controller.ts`. Apenas adicionar o método de consulta ao service existente.

### BullMQ sem decorator @Processor
O projeto usa a abordagem manual via `BullMqService.createWorker()` (ver meeting-event.worker.ts). Seguir o mesmo padrão.

### Redis cache key
`cache:radar:{tenantId}:{groupId}` — TTL 300 segundos (5 minutos).

### Cálculo baseado em MeetingAttendance
O model `MeetingAttendance` (já existe) tem `presentForSeconds`, `tenantId`, `participantId`, vinculado a `Meeting` que tem `groupId`. Usar este model para calcular presença das últimas 3 reuniões do grupo.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Migration quebra CI | Additive only — sem ALTER/DROP, nova tabela/enums |
| E2E release-1a-happy-path quebra | Não tocar em fluxo de alertas/cálculo existente — apenas adicionar |
| ESLint no-surveillance-terms | Usar vocabulário pastoral (SEMAFORO_STATUS_LABELS) — não usar "monitor", "track", "surveillance" |
| no-unused-vars | Todas as importações devem ser usadas |
