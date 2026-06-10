# Plan: 6-3 — Indicadores de Tendência & Alertas

## Ordem de Implementação

### Fase 1 — Branch + Prisma Schema (additive migration)

1. `git checkout -b feat/story-6-3-trend-alerts` a partir de `dev`
2. Estender `PastoralAlert` em `schema.prisma` com 5 colunas nullable
3. `pnpm exec prisma migrate dev --name 6-3-pastoral-alerts-trend`
4. Criar RLS policy migration para `pastoral_alerts` (se não existir)
5. Criar RLS spec `apps/api/test/migrations/pastoral-alerts-rls.spec.ts`

### Fase 2 — Backend: Alert Repository + Service

6. Criar `apps/api/src/pastoral/alerts/alerts.repository.ts`
   - `createAlert(data)` — com dedup check
   - `findByGroup(groupId)` — alertas ativos
   - `markRead(id)` — set readAt
   - `dismiss(id)` — set dismissedAt

7. Criar `apps/api/src/pastoral/alerts/alerts.service.ts`
   - `processTransition(tenantId, groupId, participantId, prev, next, trend)` — lógica negativa/positiva
   - `getGroupAlerts(groupId)` — lista
   - `markRead(alertId)` — delega repo
   - `dismiss(alertId)` — delega repo

### Fase 3 — Integrar no Motor Radar

8. Estender `RadarCalculatorService.recalculate()`:
   - Após `statusRepo.upsert()`, chamar `alertsService.processTransition()`
   - Buscar status ANTERIOR do banco ANTES do upsert (para comparação real, não só da onda)

9. Atualizar `RadarModule` / `PastoralModule` para incluir `AlertsService` + `AlertsRepository`

### Fase 4 — Controller de Alertas

10. Criar `apps/api/src/pastoral/alerts/alerts.controller.ts`
    - `GET /api/v1/groups/:groupId/alerts`
    - `PATCH /api/v1/alerts/:id/read`
    - `PATCH /api/v1/alerts/:id/dismiss`

11. Criar DTOs em `apps/api/src/pastoral/alerts/dto/`

### Fase 5 — Types (packages/types)

12. Criar `packages/types/src/pastoral/alert.schema.ts`
    - `TrendTypeSchema` (z.enum melhorando/estavel/declinio)
    - `PastoralAlertWithTrendSchema`
    - `AlertListResponseSchema`

13. Exportar de `packages/types/src/pastoral/index.ts`

14. Criar `packages/types/src/__tests__/trend-alert.snapshot.spec.ts`

### Fase 6 — Frontend TrendIndicator

15. Criar `apps/web/app/(authenticated)/app/gestao/radar/_components/trend-indicator.tsx`
    - Props: `trend: 'melhorando' | 'estavel' | 'declinio'`
    - Tooltip acessível
    - Cores: care-ok / text-secondary / care-urgent

16. Integrar `TrendIndicator` em `participant-card.tsx` (opcional se card já suportar)

### Fase 7 — Testes

17. `radar-calculator.service.spec.ts` — adicionar cenários de trend
18. `apps/api/src/pastoral/alerts/alerts.service.spec.ts` — unit tests
19. `apps/api/test/rls/pastoral-alerts.rls.spec.ts` — RLS isolation
20. `trend-alert.snapshot.spec.ts` — tipos Zod

## Arquivos Tocados

| Arquivo | Operação |
|---------|----------|
| `apps/api/prisma/schema.prisma` | Edit — 5 colunas em PastoralAlert |
| `apps/api/prisma/migrations/*/migration.sql` | Create — migration additive + RLS |
| `apps/api/src/pastoral/alerts/alerts.repository.ts` | Create |
| `apps/api/src/pastoral/alerts/alerts.service.ts` | Create |
| `apps/api/src/pastoral/alerts/alerts.controller.ts` | Create |
| `apps/api/src/pastoral/alerts/dto/alert.dto.ts` | Create |
| `apps/api/src/pastoral/radar/radar-calculator.service.ts` | Edit — integrar alertsService |
| `apps/api/src/pastoral/radar/radar.module.ts` | Edit — adicionar AlertsModule |
| `apps/api/src/pastoral/pastoral.module.ts` | Edit — import AlertsModule |
| `apps/api/src/pastoral/radar/radar-calculator.service.spec.ts` | Edit — novos cenários |
| `apps/api/test/rls/pastoral-alerts.rls.spec.ts` | Create |
| `packages/types/src/pastoral/alert.schema.ts` | Create |
| `packages/types/src/pastoral/index.ts` | Edit — export |
| `packages/types/src/__tests__/trend-alert.snapshot.spec.ts` | Create |
| `apps/web/app/(authenticated)/app/gestao/radar/_components/trend-indicator.tsx` | Create |

## Riscos

- **Invariante CASCADE**: PastoralAlert não adiciona FKs → sem risco
- **updated_at NOT NULL**: RLS spec usa raw INSERT → incluir `updated_at = now()`
- **Dedup de alertas**: query de verificação precisa ser dentro da mesma transação tenant para evitar race condition
