# Data Model: Planos de Assinatura & Limites Dinâmicos (Story 11-1)

## Entidade nova: `SubscriptionPlan` (tabela GLOBAL)

Tabela de configuração de produto. SEM `tenant_id`, SEM RLS por tenant
(FR-INFRA-06). Escrita apenas por SUPER_ADMIN (autorização via RolesGuard).

**Prisma model** (`@@map("subscription_plans")`):

| Campo (TS) | Coluna DB (`@map`) | Tipo | Notas |
|-----------|---------------------|------|-------|
| `id` | `id` | `String @id @db.Uuid` | `uuidv7()` — nunca `@default(uuid())` |
| `name` | `name` | `String @db.VarChar(80)` | nome de exibição (inglês no seed; user-facing futuro) |
| `tier` | `tier` | `String @db.VarChar(20)` | `free`/`pro`/`enterprise` — valida via `TenantPlanSchema`; `@unique` (1 plano por tier) |
| `limits` | `limits` | `Json @db.JsonB` | shape: `{ maxGroups, maxMembersPerGroup, maxLeadersPerTenant }` (number ou null) |
| `features` | `features` | `Json @default("{}") @db.JsonB` | feature flags por plano (futuro: Story 11-3) |
| `metadata` | `metadata` | `Json @default("{}") @db.JsonB` | `{ priceBRL?, price? }` etc. |
| `isActive` | `is_active` | `Boolean @default(true)` | plano ativo/inativo |
| `createdAt` | `created_at` | `DateTime @default(now()) @db.Timestamptz` | |
| `updatedAt` | `updated_at` | `DateTime @updatedAt @db.Timestamptz` | |

Índices: `@@unique([tier])`, `@@index([isActive])`.

**Shape de `limits` (JSONB) por tier (seed canônico — C4):**

| tier | maxGroups | maxMembersPerGroup | maxLeadersPerTenant | metadata |
|------|-----------|--------------------|---------------------|----------|
| free | 3 | 30 | 5 | `{ priceBRL: 0 }` |
| pro | 25 | 100 | 50 | `{ priceBRL: 99 }` |
| enterprise | `null` | `null` | `null` | `{ price: "Sob consulta" }` |

> `null` = ilimitado → `getLimits` mapeia para `Infinity`. JSONB pode conter
> chaves não-enforçadas (storage/recording/simultaneousUsers) — documentadas mas
> sem contador (FR-INFRA-04).

## Entidade alterada: `Tenant` (+ coluna nova, tenant-scoped)

| Campo (TS) | Coluna DB (`@map`) | Tipo | Notas |
|-----------|---------------------|------|-------|
| `planLimitsOverride` | `plan_limits_override` | `Json? @map("plan_limits_override") @db.JsonB` | **NOVA** (FR-INFRA-02). Nullable. Shape: `PlanLimitsOverrideSchema` (subset de `limits`, cada campo number>0 ou null). `null` = sem override. Coberto pela RLS existente de `tenants`. |

Sem novos índices (acesso sempre por `id`/`tenant_id` já indexado).

## Semântica de merge (override × plano)

`getLimits(tenantId)`:

```
plan      = SubscriptionPlan do tenant (via tenants.plan)
override  = tenants.plan_limits_override  (pode ser null)

para cada k em [maxGroups, maxMembersPerGroup, maxLeadersPerTenant]:
  raw[k] = (override?.[k] ?? plan.limits[k])     # null no override = usar default do plano
  result[k] = (raw[k] === null) ? Infinity : raw[k]   # null do plano = ilimitado
```

- Override field `null` → usa default do plano (C1, US2 AC#5).
- Override field `number>0` → tem precedência (US2 AC#4).
- `plan_limits_override = {}` no PATCH → persiste `null` (C5/dec-012): tenant volta ao plano base integral.
- Plano `limits[k] = null` → `Infinity` (C3, US2 AC#6).

## Validação (Zod — `packages/types/src/plans/subscription.ts`)

- `PlanLimitsSchema`: `{ maxGroups: number|null, maxMembersPerGroup: number|null, maxLeadersPerTenant: number|null }` (limites de plano; null permitido).
- `PlanLimitsOverrideSchema` (persistência/leitura): cada campo `number().positive()` OU `null`; objeto parcial.
- `PlanLimitsOverrideInputSchema` (input PATCH): valida body; negativos/não-numéricos → erro→422; `{}` válido (zera override).
- `SubscriptionPlanSchema`: `{ id: uuid, name, tier: TenantPlanSchema, limits: PlanLimitsSchema, features, metadata, isActive: boolean }` (+ `tenantCount` no DTO de listagem, derivado — não persistido).

## Audit

Evento gravado em mudança de plano (PATCH plans) e de override (PATCH tenant):

```
action: 'plan_limits_override'   # novo membro de AUDIT_ACTIONS
resource: 'tenant' | 'subscription-plan'
resourceId: tenantId | planId
newState: { ...valores aplicados }
```

## RLS / autorização (testes)

| Tabela | Tipo | Teste obrigatório |
|--------|------|-------------------|
| `subscription_plans` | GLOBAL (sem RLS) | spec de **autorização**: SUPER_ADMIN escreve; ADMIN_TENANT → 403. NÃO testar isolamento de linha. |
| `tenants.plan_limits_override` | tenant-scoped | spec de **isolamento RLS**: tenant A não lê/escreve override do tenant B; usar nome real `plan_limits_override` + `SET LOCAL app.current_tenant_id`. |

## Invariantes

- `subscription_plans` tem exatamente 3 rows após seed (1 por tier; upsert idempotente).
- `getLimits` nunca retorna 500 (triplo fallback).
- Paridade: tenant Free sem override, tabela vazia → `{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}`.
- `hasCapacity('membersPerGroup')` → `{allowed:true}` (short-circuit; enforce manual 10-4 preservado).
- Mudança de limite → Redis de todos os tenants do plano reescrito (write-through, nunca stale por DEL).
