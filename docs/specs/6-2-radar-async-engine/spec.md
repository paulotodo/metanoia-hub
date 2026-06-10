# Spec: 6-2-radar-async-engine

## Overview

Async radar engine para cálculo de semáforo pastoral. Migra o cálculo síncrono existente em `pastoral.service.ts` para um pipeline assíncrono BullMQ com persistência em `participant_radar_status` e cache Redis.

## Escopo desta feature

### O que existe e NÃO será recriado
- `apps/api/src/pastoral/` — módulo NestJS completo (controller, service, repository, module)
- `apps/api/src/admin-pastoral/` — módulo separado de vista agregada
- `packages/types/src/radar.ts` — schemas Zod e tipos (SignalType etc.)
- `packages/types/src/pastoral-admin.ts` — schemas da vista agregada
- `apps/web/app/(authenticated)/app/gestao/radar/_components/semaforo-pill.tsx` — componente base já usando SEMAFORO_STATUS_LABELS

### O que será implementado (residual)

1. **Model Prisma `ParticipantRadarStatus`** + migration + RLS policy + RLS spec
2. **Constantes de threshold** em `packages/types/src/pastoral/radar-constants.ts` + snapshot test
3. **Async engine**: `RadarCalculatorService` + `RadarCalculatorRepository` + `RadarCalculationWorker` (BullMQ `queue:radar-calculation`)
4. **Serviço de enfileiramento** `RadarJobService` (trigger de cálculo)
5. **Refino a11y** do `SemaforoPill`: tooltip acessível + `aria-live="polite"` + `prefers-reduced-motion`
6. **Testes**: unit do cálculo, RLS isolation, snapshot Zod, a11y

## Requisitos funcionais

### FR-001: Model ParticipantRadarStatus
- Campos: `id` (UUID v7 via uuidv7()), `tenant_id`, `group_id`, `participant_id`, `status` (enum RadarStatus), `trend` (enum RadarTrend), `presence_percentage` (Decimal), `last_active_at` (DateTime?), `calculated_at` (DateTime)
- Enums: `RadarStatus { verde, amarelo, vermelho }` / `RadarTrend { melhorando, estavel, declinio }`
- `@@map("participant_radar_status")`, colunas snake_case via @map
- Migration additive, RLS policy por tenant_id
- RLS spec em `apps/api/prisma/rls/radar-status.rls-spec.ts`

### FR-002: Constantes de threshold
- `packages/types/src/pastoral/radar-constants.ts`
- `RADAR_GREEN_THRESHOLD = 0.75`
- `RADAR_YELLOW_MIN = 0.50`
- `RADAR_RED_THRESHOLD = 0.50`
- `RADAR_ACTIVE_DAYS = 14`
- `RADAR_INACTIVE_DAYS = 21`
- Exportadas no `packages/types/src/index.ts`
- Snapshot test em `packages/types/src/__tests__/radar-constants.snapshot.spec.ts`

### FR-003: RadarCalculatorService (Core Domain — Repository Pattern)
- Mover lógica de cálculo síncrono inline para serviço dedicado
- Algoritmo: presença das últimas 3 reuniões do grupo + inatividade
  - `presence_percentage >= 0.75` E ativo ≤ 14 dias → `verde`
  - `0.50 <= presence_percentage < 0.75` OU inativo 14–21 dias → `amarelo`
  - `presence_percentage < 0.50` OU inativo > 21 dias → `vermelho`
- Trend: comparar com último registro (melhorando/estável/declínio)
- Usa `RadarCalculatorRepository` para acesso a dados
- Usa `RadarStatusRepository` para persistência

### FR-004: BullMQ Worker `queue:radar-calculation`
- Nome do worker: `radar-calculation`
- Job payload: `{ tenantId, groupId, triggeredAt }`
- Worker executa `RadarCalculatorService.recalculate(tenantId, groupId)`
- Após cálculo: cacheia em Redis `cache:radar:{tenantId}:{groupId}` TTL 300s (5min)
- Usa `requestContext.run()` para injetar tenant_id (padrão do projeto)
- Retry automático (BullMQ default)
- Idempotente: recalcular não é destrutivo

### FR-005: RadarJobService (enfileiramento)
- `enqueueRadarCalculation(tenantId: string, groupId: string): Promise<void>`
- Usado pelo pastoral.service.ts para trigger (após care action, etc.)
- Também exposto para trigger manual/schedule futuro

### FR-006: Endpoint de consulta (cache-first)
- `pastoral.service.ts` e `pastoral.controller.ts` já existem
- Adicionar método `getRadarStatus(groupId: string)` que:
  1. Tenta cache Redis `cache:radar:{tenantId}:{groupId}`
  2. Fallback: lê do model `participant_radar_status` via Prisma
  3. Retorna array de status por participante

### FR-007: A11y SemaforoPill (refino)
- Tooltip acessível: `title` attribute + `aria-describedby` com texto explicativo
- `aria-live="polite"` no container que muda status
- Animações: `prefers-reduced-motion: reduce` → sem transições/animações
- Labels já usam `SEMAFORO_STATUS_LABELS` (não alterar)

## Requisitos não-funcionais

- NFR-P2: dashboard load ≤ 2s (servir de cache Redis)
- NFR-E3: cache TTL 5min para consistência eventual
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage
- Segurança: sem SQL injection (Prisma ORM), sem exposição de dados cross-tenant

## Decisões de design

### DES-001: Não recriar pastoral module
O módulo `apps/api/src/pastoral/` já existe e funciona. A engine async é adicionada como novos serviços dentro do mesmo módulo (ou sub-módulo `pastoral/radar/`), sem duplicação.

### DES-002: RadarStatus vs SignalType
- `SignalType` (existente): `care-urgent | care-attention | care-ok` — usado nos alertas e UI
- `RadarStatus` (novo): `verde | amarelo | vermelho` — modelo interno de cálculo
- Mapeamento: `verde → care-ok`, `amarelo → care-attention`, `vermelho → care-urgent`

### DES-003: Trigger do job
- Trigger inicial: manual via `RadarJobService.enqueueRadarCalculation()`
- Não implementar schedule automático nesta story (fora do escopo residual)
- O pastoral.service.ts pode chamar o enqueue após atualizar alertas

## Critérios de aceitação (verificáveis)

- [ ] `prisma migrate status` mostra migration aplicada
- [ ] `pnpm prisma generate` sem erro após schema change
- [ ] Unit tests do cálculo passam (75%→verde, 50-74%→amarelo, <50%→vermelho)
- [ ] Unit tests de inatividade passam (14+→amarelo, 21+→vermelho)
- [ ] RLS spec: dados de tenant A não vazam para tenant B
- [ ] Snapshot test das constantes de threshold
- [ ] SemaforoPill renderiza tooltip acessível
- [ ] `pnpm turbo build` sem erros
- [ ] `pnpm lint` sem erros

## Out of scope

- Dashboard page React completo (já existe `gestao/radar` page)
- Schedule automático de recálculo (story futura)
- Cálculo baseado em trilhas/conteúdo (Epic 8)
- Notificações push de mudança de status

## Clarifications

Esta spec é derivada do escopo residual da RECONCILIACAO-EPIC6.md — o módulo pastoral já existe, o componente SemaforoPill já existe, o foco é na engine de cálculo assíncrono e persistência.
