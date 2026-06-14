# Contract: PlanLimitsService — getLimits dinâmico (Story 11-1)

Contrato interno do serviço evoluído em `apps/api/src/common/plan-limits/`.
Núcleo do **contrato de paridade**: comportamento idêntico ao hardcoded de 3-3
para o caso base.

## Assinaturas

```ts
// NOVO — limites dinâmicos com cache + fallback + merge de override
getLimits(tenantId: string): Promise<{
  maxGroups: number;            // Infinity = sem cap
  maxMembersPerGroup: number;
  maxLeadersPerTenant: number;
}>

// EVOLUÍDO — usa getLimits em vez de getLimit(plan, resource) hardcoded
hasCapacity(tenantId: string, resource: PlanLimitedResource): Promise<{
  allowed: boolean; current: number; limit: number; plan: TenantPlan;
}>

// PRESERVADO
getPlan(tenantId: string): Promise<TenantPlan>
```

Constructor passa a injetar `RedisService` além de `PrismaService`.

## getLimits — algoritmo (triplo fallback, NUNCA 500)

1. **Redis** `GET cache:plan-limits:{tenantId}`. Hit → parse JSON → return.
2. **DB**:
   - `plan = getPlan(tenantId)` (lê `tenants.plan`).
   - `subscriptionPlan = prisma.client.subscriptionPlan.findUnique({ where: { tier: plan } })`.
   - `override = tenants.plan_limits_override` (lido no mesmo read do tenant).
   - se `subscriptionPlan` ausente OU erro DB → ir ao passo 3.
   - merge por campo: `raw[k] = override?.[k] ?? subscriptionPlan.limits[k]`.
   - `null → Infinity` por campo.
   - **write-through**: `SET cache:plan-limits:{tenantId}` com o resultado.
   - return.
3. **`PLAN_LIMITS_FALLBACK`** (= `PLAN_LIMITS` de 3-3, renomeado):
   - `logger.warn("SubscriptionPlan table empty, using fallback defaults")`.
   - return `{ maxGroups: fb.groups, maxMembersPerGroup: fb.membersPerGroup, maxLeadersPerTenant: fb.leadersPerTenant }`
     com `Infinity` já presente para enterprise.

> Mapeamento chaves internas↔contrato: `groups↔maxGroups`,
> `membersPerGroup↔maxMembersPerGroup`, `leadersPerTenant↔maxLeadersPerTenant`.
> `getLimits` retorna o shape `maxX` (contrato); `hasCapacity` traduz ao comparar.

## hasCapacity — comportamento

```
limits = getLimits(tenantId)
limit  = limits[mapInternalToContract(resource)]   // ex: 'groups' -> limits.maxGroups
se resource === 'membersPerGroup':
  return { allowed: true, current: 0, limit, plan }   // short-circuit (US3 AC#4)
current = contagem DIRETA no DB via withTenantTx:
  groups            -> tx.group.count({ where: { tenantId } })
  leadersPerTenant  -> tx.userTenant.count({ where: { tenantId, role: 'lider' } })
allowed = current < limit            // Infinity > qualquer número
return { allowed, current, limit, plan }
```

- Contagem **direta no DB** (FR-INFRA-03) — sem Redis INCR.
- `membersPerGroup` curto-circuita `allowed:true`; enforce real continua manual em
  `group-members.service` (10-4) — **NÃO regredir**.

## Contratos de paridade (testes obrigatórios)

| Cenário | Esperado | Acceptance |
|---------|----------|-----------|
| Free, sem override, tabela vazia | `{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}` | US2 AC#1 / US3 AC#1,AC#3 |
| Cold read DB | chave `cache:plan-limits:{tenantId}` escrita | US2 AC#2 |
| Redis down | lê DB sem falhar; DB down → fallback; sem 500 | US2 AC#3 |
| override `{maxGroups:10}` | `{maxGroups:10, maxMembersPerGroup:30, maxLeadersPerTenant:5}` | US2 AC#4 |
| override `{maxGroups:null}` | `{maxGroups:3, ...}` | US2 AC#5 |
| enterprise | `maxGroups = Infinity` | US2 AC#6 |
| Free 3 grupos, 4º POST /groups | 403 `PlanLimitReached` details `{resource:groups, plan:free, current:3, limit:3}` | US3 AC#1 |
| plano Free `maxGroups`→5 via PATCH | 4º grupo PERMITIDO | US3 AC#2 |
| `hasCapacity('membersPerGroup')` | `{allowed:true}` | US3 AC#4 |

## Erro do Guard (preservado, constitution IV)

```json
{ "statusCode": 403, "error": "PlanLimitReached",
  "message": "...", "details": { "resource": "groups", "plan": "free", "current": 3, "limit": 3 } }
```

## DI

`PlanLimitsModule` importa `RedisModule` (além de `PrismaModule`) e continua
exportando `PlanLimitsService` + `PlanLimitsGuard`.
