# Quickstart — Story 13.3: Detecção de Risco de Evasão (FR66)

## Pré-requisitos
- Branch a partir de `dev` (`feat/risco-evasao` ou story-aligned).
- `docker compose up` (Postgres + Redis) + `pnpm install`.

## Ordem de execução
1. Migrations + `pnpm --filter @metanoia/api exec prisma generate`.
2. Estender `UpdateGroupRequestSchema` + `pnpm --filter @metanoia/types test -- --run` (snapshot).
3. `LastSeenInterceptor` (registro global em app.module).
4. `EvasionRiskRepository` + `EvasionDetectionService` + `RadarStatusRepository.upsertRisk`.
5. `DetectEvasionRiskProcessor` (cron, privileged client p/ tenants, batch 100).
6. `PastoralRiskEventPublisher`.
7. `GroupsService.update` (recesso/auto-resume).
8. Radar UI (riskReason card + a11y).

## Verificação local
```bash
# Schema válido
pnpm --filter @metanoia/api exec prisma validate

# Tipos
pnpm --filter @metanoia/api typecheck && pnpm --filter @metanoia/types typecheck

# Testes (incluindo RLS por migration)
pnpm --filter @metanoia/api test
pnpm --filter @metanoia/api test -- test/rls

# Snapshot Zod
pnpm --filter @metanoia/types test -- --run

# Suíte web (a11y)
pnpm --filter @metanoia/web test
```

## Disparar o job manualmente (dev)
- Adicionar um trigger temporário ou usar BullMQ board para enfileirar `detect-evasion-risk` na queue `queue:reports`.
- Verificar logs Pino: `job.duration_ms`, `job.tenants_processed`, `job.participants_flagged`.

## Critérios de aceite críticos
- [ ] Job lista tenants via cliente privilegiado e processa cada um sob RLS (`withTenantTx`/`RequestContext.run`).
- [ ] Falha de um tenant não aborta o lote (skip + retry isolado).
- [ ] `last_seen_at` populado com debounce Redis 15min (não impacta latência).
- [ ] Recesso exclui ausências da contagem; auto-resume após `breakUntil`.
- [ ] Domain event sem PII; dedup por dia.
- [ ] Não sobrescreve decisão manual do líder nas últimas 24h.
- [ ] Migrations com teste RLS; UUID v7; sem `@default(uuid())`.
- [ ] Radar UI: cor + ícone + texto, aria-live (a11y).
