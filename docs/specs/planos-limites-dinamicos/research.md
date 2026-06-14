# Research: Planos de Assinatura & Limites Dinâmicos (Story 11-1)

Decisões técnicas e investigação de código real. As decisões de infraestrutura
(RECONCILIACAO-EPIC11 §10) e clarify (dec-008..dec-012) já estão FIXADAS — aqui
documentamos o aterramento no código e os pontos resolvidos em IMPL-TIME.

## R1 — Evolução vs recriação do módulo plan-limits

**Decisão:** EVOLUIR `apps/api/src/common/plan-limits/` (Story 3-3).
**Aterramento:** `plan-limits.config.ts` já tem `PLAN_LIMITS` com shape
`{ groups, membersPerGroup, leadersPerTenant }` por tier; `plan-limits.service.ts`
já tem `hasCapacity`/`getPlan` usando `withTenantTx`; Guard + decorator já existem
e são exportados pelo `plan-limits.module.ts`.
**Plano:** renomear `PLAN_LIMITS` → `PLAN_LIMITS_FALLBACK` (preserva o shape, vira
o 3º nível do triplo fallback). Adicionar `getLimits(tenantId)`. `hasCapacity` passa
a chamar `getLimits` em vez de `getLimit(plan, resource)` hardcoded.
**Rejeitado:** novo módulo paralelo → duplicaria Guard/decorator e quebraria as
rotas que já usam `@PlanLimit('groups')`.

## R2 — SubscriptionPlan global (sem RLS por tenant)

**Decisão (FR-INFRA-06):** tabela `subscription_plans` GLOBAL, `@@map`, sem `tenant_id`.
**Aterramento:** o model `User` já é global no schema (sem `tenant_id` mandatório;
multi-tenant via join `UserTenant`). Super-admin lê via `this.prisma.client` direto
(bypass RLS) — `super-admin-tenants.repository.ts` é o precedente.
**Autorização:** `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.SUPER_ADMIN)`
(role enum value `'super_admin'`). O isolamento relevante é authz de escrita, não RLS.

## R3 — tenants.plan_limits_override (coluna nova, tenant-scoped)

**Decisão (FR-INFRA-02):** `plan_limits_override Json? @map("plan_limits_override")`
no model `Tenant`. Herda a RLS existente de `tenants`.
**Aterramento:** model `Tenant` já tem `metadata Json`, `provisioningState Json?`,
`onboardingProgress Json?` — mesmo padrão de coluna JSONB nullable com `@map`.
RLS de `tenants` já habilitada (migration `20260414120000_add_invites_and_tenant_rls`
é referência do padrão `SET LOCAL app.current_tenant_id`).

## R4 — getLimits: triplo fallback (Redis → DB → PLAN_LIMITS_FALLBACK)

**Decisão (C3, FR-INFRA-03, US2):**
- Read order: `cache:plan-limits:{tenantId}` → DB (`SubscriptionPlan` via `tenants.plan`
  + merge `plan_limits_override`) → `PLAN_LIMITS_FALLBACK`. Nunca 500.
- Cold read do DB → write-through `SET` no Redis.
- Tabela vazia OU erro DB → `PLAN_LIMITS_FALLBACK` + `logger.warn` (Pino).
- `null` no JSONB de limite → `Infinity` no retorno (campos `number`).
**Aterramento:** `RedisService` é `@Global()` e exporta. `withTenantTx`/`prisma.client`
disponíveis. `PlanLimitsService` ctor passa a injetar `RedisService` além de `PrismaService`.
**Contagem permanece direta no DB** (FR-INFRA-03): cache cobre só os VALORES de limite,
nunca a contagem (sem Redis INCR).

## R5 — Write-through síncrono via pipeline (C2/dec-009)

**Decisão:** PATCH de `SubscriptionPlan` → itera tenants do plano, `SET cache:plan-limits:{tenantId}`
em **pipeline Redis** (batch). PATCH de override → `SET` do valor merged do tenant.
**Proibido:** `DEL`/invalidação. Síncrono na request (200 após pipeline). Sem BullMQ.
**Aterramento:** `RedisService` expõe cliente ioredis; pipeline via `.pipeline()...exec()`.

## R6 — Dois schemas Zod de override (C1/dec-008)

- `PlanLimitsOverrideSchema` (persistência): `{maxGroups, maxMembersPerGroup, maxLeadersPerTenant}`
  cada `number > 0` OU `null`. Shape salvo/lido do banco.
- `PlanLimitsOverrideInputSchema` (input PATCH): valida body; negativos/não-numéricos → erro
  (vira 422 via `ZodValidationPipe`). `{}` permitido (zera override → null, C5).
- `PlanLimitsSchema` (limites de plano): numéricos ou null.
- `SubscriptionPlanSchema`: `{id, name, tier: TenantPlanSchema, limits, features, metadata, isActive}`.
**Reuso (FR-INFRA-08):** `TenantPlanSchema` de `super-admin-tenant.ts`. Não recriar enum.
**Localização:** `packages/types/src/plans/subscription.ts`; re-export em `index.ts`; snapshots.

## R7 — AUDIT_ACTIONS extensível (FR-INFRA-09)

**Decisão:** adicionar `'plan_limits_override'` ao array `AUDIT_ACTIONS` em
`packages/types/src/audit/index.ts` + regenerar snapshot.
**Aterramento:** array atual `['create','update','delete','login','logout','auth_failure','config_change','export','import']` (snake_case).
`AuditService.createEvent({action, resource, resourceId, ...})` usa `withTenantTx`;
tenant resolvido via AsyncLocalStorage (não passar como param). Fire-and-forget.

## R8 — Seed idempotente + guard CLI (FR-INFRA-05)

**Decisão:** `apps/api/prisma/seeds/subscription-plans-seed.ts`, upsert por `tier`,
script `db:seed:plans`, guard `if (process.argv[1]?.includes('subscription-plans-seed')) void main()`.
**Valores canônicos (C4):** free 3/30/5, pro 25/100/50, enterprise null/null/null.
metadata preços: Free R$0, Pro R$99/mês, Enterprise "Sob consulta".
**JSONB extra (FR-INFRA-04):** storage/recording/simultaneous-users no JSONB mas
NÃO enforçados (sem contador) — documentar como futuro.
**Aterramento:** `demo-seed.ts` usa `prisma.tenant.upsert({where:{id}, ...})`; mesmo
padrão. `uuidv7()` para `id` dos planos (nunca `@default(uuid())`).

## R9 — DI graph (gotcha de boot crash, §8)

| Provider | Módulo dono | Exportado? | Quem injeta na story |
|----------|-------------|-----------|----------------------|
| `PrismaService` | `PrismaModule` (`@Global`) | sim | todos os serviços |
| `RedisService` | `RedisModule` (`@Global`) | sim | `PlanLimitsService`, `super-admin-plans.service`, `super-admin-tenants.service` |
| `PlanLimitsService` | `PlanLimitsModule` | sim | `super-admin-plans.service` (write-through), `super-admin-tenants.service` (override) |
| `AuditService` | `AuditModule` | (verificar export) | `super-admin-*.service` (mudança plano/override) |

**Regra:** o módulo super-admin que injeta `PlanLimitsService` DEVE importar
`PlanLimitsModule`. `RedisModule`/`PrismaModule` são globais mas importar explicitamente
onde usado (defesa contra refactor que remova `@Global`). `AuditModule` deve exportar
`AuditService` — **VERIFICAR em IMPL-TIME** (se não exporta, adicionar export).
Boot crash de provider não-exportado só aparece no E2E → smoke de boot obrigatório.

## R10 — Direção do shape de getLimits (resolvido)

`getLimits(tenantId)` retorna o shape do **contrato JSONB** (`{maxGroups,
maxMembersPerGroup, maxLeadersPerTenant}`, valores `number` com `Infinity` para null),
alinhado aos Independent Tests da US2. `hasCapacity(tenantId, resource)` traduz
`PlanLimitedResource` interno (`groups`→`maxGroups`...) ao comparar. Tabela de
mapeamento no `plan.md` §Convenções de Borda. create-tasks fixa task de tradução.

## Unknowns resolvidos (nenhum NEEDS-CLARIFICATION pendente)

- Shape JSONB: `maxX` (spec C4). ✔
- Override null semantics: field null = default; {} = zera (C1/C5). ✔
- Infinity mapping: null→Infinity em runtime (C3). ✔
- Cache strategy: write-through SET pipeline, nunca DEL (C2). ✔
- Valores do seed: spec.md autoritativa (C4). ✔
- membersPerGroup: short-circuit no Guard, enforce manual 10-4 preservado. ✔
- Direção do shape getLimits: contrato JSONB (R10). ✔
