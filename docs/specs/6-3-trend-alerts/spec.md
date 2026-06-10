# Spec: 6-3 — Indicadores de Tendência & Alertas

**short_name**: `6-3-trend-alerts`
**status**: specified
**depends_on**: 6-1 (vocabulary), 6-2 (BullMQ radar engine)

## Escopo

Estende o motor de cálculo do Radar Pastoral (Story 6-2) com:

1. **Cálculo de tendência** persistido em `ParticipantRadarStatus.trend` — usa histórico de status (melhorando / estavel / declinio).
2. **Detecção de transição** negativa → cria `PastoralAlert`; positiva → emite domain event (Story 6-5 consumer).
3. **Dedup de alertas** — 1 alerta ativo por participante/grupo enquanto status não muda.
4. **Endpoints** de alertas: listar, marcar lido, dispensar.
5. **Componente `TrendIndicator`** no dashboard radar com tooltip acessível.
6. **Tipos Zod** em `packages/types` + snapshot tests.

## Bounded Context

Pastoral (core domain) — repository pattern, AsyncLocalStorage, RLS obrigatório.

## Schema Changes (additive)

### PastoralAlert — colunas novas

Modelo existente em `apps/api/prisma/schema.prisma`. Adicionar:

| Campo | Tipo Prisma | DB | Nullable |
|-------|------------|-----|---------|
| `previousStatus` | `RadarStatus?` | `previous_status "RadarStatus"` | sim |
| `newStatus` | `RadarStatus?` | `new_status "RadarStatus"` | sim |
| `trend` | `RadarTrend?` | `trend "RadarTrend"` | sim |
| `readAt` | `DateTime?` | `read_at` | sim |
| `dismissedAt` | `DateTime?` | `dismissed_at` | sim |

**Invariantes**: sem FK nova → invariante CASCADE não é afetada. Relações existentes intactas.

## Lógica de Negócio

### Cálculo de Tendência

Baseado na comparação status anterior → status atual (já implementada em `RadarCalculatorService.calculateTrend`):
- `verde(3) > amarelo(2) > vermelho(1)`
- Atual > Anterior → `melhorando`
- Atual < Anterior → `declinio`
- Atual == Anterior → `estavel`
- Sem anterior → `estavel`

O cálculo JÁ existe. A 6-3 **adiciona** a persistência/leitura do status anterior do banco (não apenas da memória da onda).

### Alertas

- Transição NEGATIVA (`verde→amarelo`, `amarelo→vermelho`): criar alerta.
- Transição POSITIVA (`vermelho→amarelo`, `amarelo→verde`): emitir domain event `pastoral.participant.status_improved`.
- Transição sem mudança (`verde→verde`, etc.): nenhuma ação.
- **Dedup**: antes de criar alerta, verificar se existe alerta ativo (`dismissedAt IS NULL AND readAt IS NULL`) para mesmo `(tenantId, groupId, participantId)` com mesmos `previousStatus + newStatus`. Se sim, não criar.

### Ciclo de Vida do Alerta

`created → read (readAt) → dismissed (dismissedAt)`

## API

```
GET    /api/v1/groups/:groupId/alerts     — listar alertas ativos do grupo
PATCH  /api/v1/alerts/:id/read            — marcar lido (set readAt)
PATCH  /api/v1/alerts/:id/dismiss         — dispensar (set dismissedAt)
```

Response success: `{ data: ..., meta? }` | Error: `{ statusCode, error, message }`

## Frontend

`TrendIndicator` component em `apps/web/app/(authenticated)/app/gestao/radar/_components/trend-indicator.tsx`:
- `melhorando` → ↑ + cor care-ok
- `estavel` → → + cor text-secondary
- `declinio` → ↓ + cor care-urgent
- Tooltip acessível via `aria-describedby`

## Testes Requeridos

- Unit: `RadarCalculatorService.calculateTrend` (todos os cenários de transição)
- Unit: `AlertsService` — transição negativa → alerta, positiva → sem alerta, dedup
- RLS isolation: `pastoral_alerts` (tenant_a não vê dados de tenant_b)
- Snapshot: `TrendTypeSchema`, `PastoralAlertWithTrendSchema` em `packages/types`

## Não-Escopo (deferido)

- Story 6-5 `CelebrationBanner` — apenas emitir o domain event, não implementar o consumer.
- Paginação dos alertas (MVP lista simples, limite 50).
