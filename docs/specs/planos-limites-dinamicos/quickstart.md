# Quickstart: Planos de Assinatura & Limites Dinâmicos (Story 11-1)

Validação manual end-to-end após a implementação. Backend-only.

## Pré-requisitos

```bash
docker compose up -d            # postgres + redis + keycloak
pnpm --filter @metanoia/api prisma migrate dev   # aplica migration 11-1
pnpm --filter @metanoia/api db:seed:plans        # 3 planos idempotente
```

## 1. Seed idempotente (US1)

```bash
pnpm --filter @metanoia/api db:seed:plans
# repetir: ainda 3 rows
psql -c "SELECT tier, limits, is_active FROM subscription_plans ORDER BY tier;"
```
Esperado: `enterprise` (null/null/null), `free` (3/30/5), `pro` (25/100/50), todos `is_active=true`.

## 2. Boot sem crash com tabela vazia (US1 AC#4)

```bash
psql -c "TRUNCATE subscription_plans;"
pnpm --filter @metanoia/api start   # NÃO crasha; warning Pino no log
```
Esperado: log `"SubscriptionPlan table empty, using fallback defaults"`; API sobe.
Re-seed depois: `pnpm --filter @metanoia/api db:seed:plans`.

## 3. getLimits parity + cache (US2)

Tenant Free sem override → `getLimits` retorna `{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}`.
```bash
redis-cli GET "cache:plan-limits:<tenantId>"   # escrito no cold read
```

## 4. Guard parity (US3)

```bash
# Tenant Free com 3 grupos; criar o 4º:
curl -X POST .../api/v1/groups -H "Authorization: Bearer <tenantFree>" -d '{...}'
# Esperado 403:
# { "statusCode":403, "error":"PlanLimitReached",
#   "details":{ "resource":"groups","plan":"free","current":3,"limit":3 } }
```

## 5. Editar limite de plano via super-admin (US4)

```bash
# Listar (SUPER_ADMIN):
curl .../api/v1/admin/super/plans -H "Authorization: Bearer <superAdmin>"
# -> 3 planos com tenantCount

# ADMIN_TENANT -> 403:
curl .../api/v1/admin/super/plans -H "Authorization: Bearer <adminTenant>"   # 403

# Subir maxGroups do Free para 5:
curl -X PATCH .../api/v1/admin/super/plans/<freePlanId> \
  -H "Authorization: Bearer <superAdmin>" -d '{"limits":{"maxGroups":5}}'
# -> 200; redis-cli GET cache:plan-limits:<tenantFreeId> reflete maxGroups:5

# Agora o 4º grupo do tenant Free é PERMITIDO (limite 5).

# Inválido:
curl -X PATCH .../api/v1/admin/super/plans/<freePlanId> -d '{"limits":{"maxGroups":-1}}'   # 422
```

## 6. Override por-tenant + audit (US5)

```bash
curl -X PATCH .../api/v1/admin/super/tenants/<tenantId> \
  -H "Authorization: Bearer <superAdmin>" -d '{"planLimitsOverride":{"maxGroups":10}}'
# -> 200; plan_limits_override salvo; getLimits -> maxGroups:10
psql -c "SELECT action, resource, resource_id FROM audit_events WHERE action='plan_limits_override' ORDER BY timestamp DESC LIMIT 1;"
redis-cli GET "cache:plan-limits:<tenantId>"   # valor merged

# Zerar override:
curl -X PATCH .../api/v1/admin/super/tenants/<tenantId> -d '{"planLimitsOverride":{}}'
# -> 200; plan_limits_override = null; volta ao plano base

# Inválido:
curl -X PATCH .../api/v1/admin/super/tenants/<tenantId> -d '{"planLimitsOverride":{"maxGroups":-5}}'   # 422
```

## 7. Contratos + snapshot (US6)

```bash
pnpm --filter @metanoia/types test   # snapshots de SubscriptionPlanSchema, PlanLimits*, AUDIT_ACTIONS passam
```

## 8. Suites obrigatórias antes de done (constitution VI)

```bash
pnpm --filter @metanoia/api test                      # unit (plan-limits.service.spec)
pnpm --filter @metanoia/api test:integration          # super-admin-plans integration
pnpm --filter @metanoia/api test:rls                  # subscription-plans (authz) + tenant-plan-override (isolamento)
pnpm lint && pnpm build                               # CI gate
```

Critério de done: todas as suites verdes + smoke de boot (DI sem crash) + paridade
do Guard confirmada (item 4 antes vs depois).
