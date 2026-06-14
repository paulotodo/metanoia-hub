# Implementation Plan: Planos de Assinatura & Limites Dinâmicos

**Short Name**: `planos-limites-dinamicos`
**Epic / Story**: Epic 11 (Planos, Limites & Feature Gating) — Story 11-1
**Branch**: `feat/story-11-1-planos-limites-dinamicos`
**Spec**: `docs/specs/planos-limites-dinamicos/spec.md`
**Constitution**: `docs/constitution.md` (7 princípios)

> Esta story EVOLUI o módulo `apps/api/src/common/plan-limits/` da Story 3-3.
> NÃO recria. O contrato central é **paridade**: comportamento idêntico para o
> caso base (tabela vazia → fallback hardcoded), com fonte dinâmica quando o
> seed rodou.

---

## Constitution Check (gate PRÉ-design)

Avaliação dos 7 princípios MUST antes do design. Gate bloqueante: qualquer
violação de MUST sem mitigação documentada interrompe o avanço.

| Princípio | Aplicável? | Avaliação | Veredito |
|-----------|-----------|-----------|----------|
| **I. Multi-tenancy Absoluto (NON-NEGOTIABLE)** | Sim (parcial) | `SubscriptionPlan` é tabela **GLOBAL** intencional (sem `tenant_id`, sem RLS por tenant) — config de produto, escrita só por SUPER_ADMIN. Isso é uma EXCEÇÃO consciente análoga ao model `User` global existente (sem `tenant_id` mandatório). A coluna NOVA `tenants.plan_limits_override` É tenant-scoped e herda a RLS existente de `tenants`. Migration que toca policy → RLS isolation spec obrigatório (ver Quality). Autorização em 3 camadas preservada: Keycloak role `super_admin` → `RolesGuard` → (para `tenants`) RLS. | **PASS** (com exceção documentada §Exceção C-I) |
| **II. Type-Safety & IDs determinísticos (NON-NEGOTIABLE)** | Sim | `strict: true` mantido. `SubscriptionPlan.id` via `uuidv7()` (nunca `@default(uuid())`). Datas ISO 8601; `null` explícito (override `null` = usar default do plano, semântica explícita). Schemas Zod em `packages/types` são fonte de contrato. | **PASS** |
| **III. Idioma & Vocabulário Pastoral** | Sim | Código/logs/Swagger em inglês (warning Pino: `"SubscriptionPlan table empty, using fallback defaults"`). Mensagem user-facing do 403 (`PlanLimitReached`) já existe em PT-BR via camada de erro — não regredir. Sem UI nesta story (endpoints + serviço). | **PASS** |
| **IV. Contratos de API Padronizados** | Sim | Contratos Zod em `packages/types/src/plans/subscription.ts`. Sucesso `{ data }`; erro estruturado `{ statusCode, error, message, details }` (já é o shape do `PlanLimitReached`). PATCH inválido → 422 via `ZodValidationPipe`. Prefixo `/api/v1/admin/super/plans`. PATCH retorna 200 (mutação de recurso existente, não 201). | **PASS** |
| **V. Separação de Estado no Frontend** | Não | Story é backend-only (DB + serviço + endpoints + seed + contratos). Sem FE. | **N/A** |
| **VI. Qualidade Verificável** | Sim | Unit (`plan-limits.service.spec.ts`), integration (`*.integration-spec.ts` dos endpoints), RLS isolation spec para `tenants.plan_limits_override` (toca tenant-scoped) + spec de autorização SUPER_ADMIN para `subscription_plans` (global → testar gate de role, não isolamento). Snapshot tests dos schemas Zod + do `AUDIT_ACTIONS` (gate contra breaking change). CI verde antes de done. | **PASS** |
| **VII. Processo de Entrega Auditável** | Sim | 1 story = 1 branch (`feat/story-11-1-planos-limites-dinamicos`) = 1 PR. Conventional commits PT-BR. Reconciliação RECONCILIACAO-EPIC11 já feita (§10 FIXADO). Mudança de plano/override → evento `audit` (`plan_limits_override`). | **PASS** |

**Veredito do gate**: **PASS** — nenhuma violação de MUST. Uma exceção
consciente (C-I) ao Princípio I, alinhada ao padrão `User` global existente e
ratificada pela RECONCILIACAO-EPIC11 §10 (FR-INFRA-06).

### Exceção documentada C-I (Princípio I — Multi-tenancy)

`SubscriptionPlan` NÃO possui `tenant_id` e NÃO tem RLS por tenant. Justificativa:
é **configuração global de produto** (limites de tier), não dado de tenant. Apenas
SUPER_ADMIN escreve; tenants apenas leem (indiretamente, via `getLimits`). O
isolamento que importa é **autorização de escrita** (RolesGuard → `super_admin`),
não isolamento de linha. Mesmo padrão do model `User` global. A personalização
por-tenant vive em `tenants.plan_limits_override`, que É tenant-scoped sob a RLS
de `tenants`. Esta exceção exige nota no PR (Governance §Exceções).

---

## Technical Context

| Dimensão | Valor |
|----------|-------|
| Linguagem/Runtime | TypeScript `strict`, Node (NestJS 11.1.17) |
| Backend framework | NestJS — bounded contexts, repository pattern para domínios core |
| ORM / DB | Prisma v7 + PostgreSQL (+ pgvector). `PrismaService.client` getter; `withTenantTx(prisma, fn, {tenantId})` para queries RLS-aware |
| Cache | Redis (`RedisService`, `@Global()`) — namespace `cache:*`. Pipeline para batch SET |
| Auth | Keycloak → `KeycloakAuthGuard` + `RolesGuard` + `@Roles(Role.SUPER_ADMIN)` |
| Contratos | Zod 4.3.6 em `packages/types`, snapshot tests |
| Validação input | `ZodValidationPipe` custom (sem libs 3rd-party) |
| Testes | Vitest 4.1.2; RLS specs em `apps/api/test/rls/`; factories incluem `tenantId` |
| ID generation | `uuidv7()` (lib) — nunca Prisma `@default(uuid())` |
| Audit | `AuditService.createEvent(dto)` (fire-and-forget; nunca throw ao caller) |

**Pontos de integração reais (sondados no código):**

- `apps/api/src/common/plan-limits/` — 5 arquivos:
  - `plan-limits.config.ts`: `PLAN_LIMITS` (`Record<TenantPlan, PlanResourceLimits>`),
    interface `PlanResourceLimits { groups; membersPerGroup; leadersPerTenant }`,
    type `PlanLimitedResource`, fn `getLimit(plan, resource)`.
  - `plan-limits.service.ts`: classe `PlanLimitsService`, ctor injeta `PrismaService`;
    métodos `hasCapacity(tenantId, resource)`, `getPlan(tenantId)`; conta via
    `withTenantTx(this.prisma, tx => tx.group.count(...))` e
    `tx.userTenant.count({where:{tenantId, role:'lider'}})`.
  - `plan-limits.guard.ts`: `PlanLimitsGuard implements CanActivate`, lê metadata
    `PLAN_LIMIT_META`, lança `ForbiddenException` com `details:{resource,plan,current,limit}`.
  - `plan-limit.decorator.ts`: `PLAN_LIMIT_META = 'plan-limit:resource'`, decorator `PlanLimit(resource)`.
  - `plan-limits.module.ts`: importa `[PrismaModule]`, provê/exporta `[PlanLimitsService, PlanLimitsGuard]`.
- `apps/api/src/super-admin/` — `super-admin-tenants.controller.ts`
  (`@Controller('api/v1/admin/super/tenants')`, `@UseGuards(KeycloakAuthGuard, RolesGuard)`,
  `@Roles(Role.SUPER_ADMIN)`), `.service.ts`, `.repository.ts` (usa `this.prisma.client`
  direto — bypass RLS para queries cross-tenant), `.module.ts` (importa `[PrismaModule, OnboardingModule]`).
- `apps/api/prisma/schema.prisma` — model `Tenant` tem `plan String @default("free") @db.VarChar(20)`,
  `metadata Json`, `provisioningState`, `logoUrl`, `onboardingProgress`,
  `focusIndicatorEnabled`. **NÃO** tem `plan_limits_override` → criar. Model `User` é GLOBAL
  (sem `tenant_id` mandatório) — precedente para `SubscriptionPlan`.
- `packages/types/src/super-admin-tenant.ts` — `TenantPlanSchema = z.enum(['free','pro','enterprise'])`
  (REUSAR). `TenantPatchInputSchema` (estender com `planLimitsOverride`).
- `packages/types/src/audit/index.ts` — `AUDIT_ACTIONS` const array; adicionar `'plan_limits_override'`.
- `apps/api/prisma/seeds/` — `demo-seed.ts` (upsert idempotente; script `db:seed:demo`).
- DI: `PrismaModule` e `RedisModule` são **`@Global()`** e exportam seus serviços
  → disponíveis sem re-import. Porém `PlanLimitsModule` DEVE importar `RedisModule`
  explicitamente por clareza de contrato (defesa contra refactor que remova `@Global`).

---

## Project Structure (REAL — arquivos a criar/editar)

```
apps/api/
  prisma/
    schema.prisma                                  [EDIT: + model SubscriptionPlan; + tenants.planLimitsOverride]
    migrations/
      <YYYYMMDDHHMMSS>_11-1-subscription-plans/
        migration.sql                              [CREATE: tabela subscription_plans + col plan_limits_override + índices]
    seeds/
      subscription-plans-seed.ts                   [CREATE: upsert 3 tiers + guard CLI]
  src/
    common/plan-limits/
      plan-limits.config.ts                        [EDIT: renomear PLAN_LIMITS → PLAN_LIMITS_FALLBACK (mantém shape)]
      plan-limits.service.ts                       [EDIT: + getLimits(tenantId) dinâmico c/ cache+fallback; hasCapacity usa getLimits]
      plan-limits.module.ts                        [EDIT: importar RedisModule]
      plan-limits.service.spec.ts                  [CREATE/EDIT: unit getLimits (cache, fallback, override, Infinity)]
    super-admin/
      super-admin-plans.controller.ts              [CREATE: GET /plans, PATCH /plans/:planId]
      super-admin-plans.service.ts                 [CREATE: list+count, patch+write-through pipeline]
      super-admin-plans.repository.ts              [CREATE: prisma.client direto (global table)]
      super-admin-tenants.controller.ts            [EDIT: PATCH aceita planLimitsOverride]
      super-admin-tenants.service.ts               [EDIT: patch persiste override + audit + write-through]
      super-admin.module.ts (ou super-admin-tenants.module.ts) [EDIT: + providers/controllers de plans; importar PlanLimitsModule/RedisModule]
  test/
    rls/
      subscription-plans.rls-spec.ts               [CREATE: autorização SUPER_ADMIN p/ tabela global (não isolamento)]
      tenant-plan-override.rls-spec.ts             [CREATE: isolamento de tenants.plan_limits_override]
    integration/ (ou co-located)
      super-admin-plans.integration-spec.ts        [CREATE: GET 200/403, PATCH 200/422, write-through]

packages/types/src/
  plans/
    subscription.ts                                [CREATE: PlanLimitsSchema, PlanLimitsOverrideSchema, PlanLimitsOverrideInputSchema, SubscriptionPlanSchema]
  audit/index.ts                                   [EDIT: + 'plan_limits_override' em AUDIT_ACTIONS]
  super-admin-tenant.ts                            [EDIT: TenantPatchInputSchema + planLimitsOverride; TenantDetailSchema + planLimitsOverride leitura]
  index.ts                                         [EDIT: re-export plans/subscription]
  __tests__/
    plans-subscription.snapshot.spec.ts            [CREATE: snapshot dos novos schemas]
    audit.snapshot.spec.ts (ou existente)          [EDIT/CREATE: snapshot AUDIT_ACTIONS atualizado]

package.json (apps/api)                            [EDIT: script "db:seed:plans"]
```

---

## §Convenções de Borda (fonte da verdade por camada)

Feature multi-camada DB↔backend↔FE-contracts. Cada convenção tem UMA fonte da
verdade; as demais camadas adaptam. Declarado aqui para evitar drift silencioso.

| Convenção | Fonte da verdade | Camadas que adaptam |
|-----------|------------------|---------------------|
| **Nomes de coluna DB** | Prisma schema com `@map` snake_case (`plan_limits_override`, `subscription_plans`, `is_active`, `created_at`) | SQL da migration usa snake_case literal |
| **Nomes de campo DTO/TS** | camelCase no model Prisma + Zod (`planLimitsOverride`, `isActive`, `createdAt`) | Prisma `@map` faz a ponte camelCase↔snake_case |
| **Shape do JSONB de limites** | **spec.md C4 (autoritativo)** — chaves `maxGroups`, `maxMembersPerGroup`, `maxLeadersPerTenant` | DB JSONB grava essas chaves; `getLimits` MAPEIA para as chaves internas do serviço |
| **Chaves internas do serviço** | `plan-limits.config.ts` — `groups`, `membersPerGroup`, `leadersPerTenant` (`PlanLimitedResource`) | `getLimits` traduz JSONB `maxGroups`→`groups`, etc. (tabela de mapeamento abaixo) |
| **Enum de tier** | `packages/types/super-admin-tenant.ts` `TenantPlanSchema` (`free`/`pro`/`enterprise`) — REUSAR | seed, migration enum, Zod `SubscriptionPlanSchema` |
| **Validação de input PATCH** | `PlanLimitsOverrideInputSchema` (Zod, no `ZodValidationPipe`) — negativos→422 | controller; persistência usa `PlanLimitsOverrideSchema` |
| **Sentinela "ilimitado"** | DB JSONB grava `null`; `getLimits` mapeia `null → Infinity` (C3) | serviço/Guard recebem `number` (Infinity válido) |
| **Sentinela "usar default"** | override field `null` = usar default do plano (C1/C5) | merge: `override[k] ?? planDefault[k]` por campo |
| **Cache key** | `cache:plan-limits:{tenantId}` — SET write-through, nunca DEL (C2) | serviço de plans (pipeline batch) + PATCH de override |
| **Resposta API** | constitution IV: `{ data }` sucesso; `{ statusCode, error, message, details }` erro | controllers |
| **Audit action** | `AUDIT_ACTIONS` array em `packages/types/audit` + snapshot | `'plan_limits_override'` |

**Tabela de mapeamento JSONB ↔ serviço (load-bearing):**

| JSONB / contrato (spec) | chave interna serviço (`PlanLimitedResource`) |
|-------------------------|-----------------------------------------------|
| `maxGroups`             | `groups`                                      |
| `maxMembersPerGroup`    | `membersPerGroup`                             |
| `maxLeadersPerTenant`   | `leadersPerTenant`                            |

> Decisão de tradução: o serviço `getLimits` retorna o shape JSONB
> (`maxGroups`...) ou o shape interno (`groups`...)? **Resolução (IMPL-TIME,
> default proposto):** `getLimits` retorna o shape do contrato JSONB
> (`{maxGroups, maxMembersPerGroup, maxLeadersPerTenant}`) e `hasCapacity`
> traduz internamente para `PlanLimitedResource` ao comparar. Isso mantém o
> contrato de API/cache alinhado ao spec (Independent Tests US2 usam
> `maxGroups`). create-tasks fixa essa direção numa task explícita.

---

## §Convenções de fallback / paridade (núcleo do contrato)

Triplo fallback `getLimits(tenantId)` — **NUNCA 500**:

1. **Redis** `GET cache:plan-limits:{tenantId}` → hit: parse + return.
2. **DB**: `SubscriptionPlan` via `tenants.plan` (+ merge `plan_limits_override`).
   No cold read: write-through `SET` no Redis.
3. **`PLAN_LIMITS_FALLBACK`** (= os `PLAN_LIMITS` atuais de 3-3): se tabela vazia
   OU erro de DB → usa fallback + `logger.warn("SubscriptionPlan table empty, using fallback defaults")`.

Merge de override (por campo): `result[k] = override?.[k] ?? planDefault[k]`;
depois `null → Infinity` por campo. `{}` no override (C5) = `plan_limits_override = null`.

Contrato de paridade (US3 AC#1, AC#3): tenant Free sem override, tabela vazia →
`{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}` — idêntico ao
hardcoded. Teste de contrato garante 403 no 4º grupo, igual a antes.

`membersPerGroup` em `hasCapacity` curto-circuita `{allowed:true}` (US3 AC#4) —
enforce real continua manual em `group-members.service` (10-4). **NÃO regredir.**

---

## Phasing (ordem de implementação — fixada em create-tasks)

1. **Contratos** (`packages/types`): schemas Zod + AUDIT_ACTIONS + re-export + snapshots. (Independente, base de tipos.)
2. **DB**: model `SubscriptionPlan` + `tenants.planLimitsOverride` + migration + RLS specs.
3. **Seed**: `subscription-plans-seed.ts` + script `db:seed:plans` + guard CLI (idempotente).
4. **Serviço**: `getLimits` dinâmico (cache+fallback+merge+Infinity); `hasCapacity`/Guard usam `getLimits`; `PlanLimitsModule` importa `RedisModule`. Unit tests.
5. **Endpoints super-admin**: `super-admin-plans.{controller,service,repository}` (GET+PATCH, write-through pipeline) + PATCH de tenant com `planLimitsOverride` + audit. Integration tests.
6. **Wire-up DI + verificação**: módulo super-admin importa `PlanLimitsModule`/`RedisModule`; boot não crasha; contract test de paridade; CI verde.

---

## §8 GOTCHAS antecipados

- **DI boot crash (E2E-only):** o módulo super-admin novo injeta `PlanLimitsService`
  (para write-through em mudanças de plano/override) e `RedisService`. `PlanLimitsModule`
  exporta `PlanLimitsService`; o super-admin module DEVE importar `PlanLimitsModule`.
  `RedisModule` é `@Global()` mas importar explicitamente onde usado. Se um provider
  injetado não for exportado pelo módulo dono → crash só no boot E2E. **Mapeamento DI
  no `research.md` §DI graph.**
- **RLS spec com nomes reais:** `subscription_plans` é GLOBAL → spec testa
  **autorização SUPER_ADMIN** (não isolamento de linha por tenant).
  `tenants.plan_limits_override` é tenant-scoped → spec de isolamento usa o nome real
  de coluna `plan_limits_override` e o padrão `SET LOCAL app.current_tenant_id`.
- **Seed guard CLI:** `if (process.argv[1]?.includes('subscription-plans-seed')) void main()`
  — sem isso, importar o seed em testes dispara `main()`.
- **Write-through SET não DEL (C2):** PATCH de plano itera tenants do plano e faz
  `SET` em pipeline. DEL (invalidação) é PROIBIDO. PATCH de override faz `SET` do
  valor merged do tenant.
- **Não regredir enforce manual por-grupo da 10-4:** `hasCapacity('membersPerGroup')`
  retorna `{allowed:true}`; o enforce real fica em `group-members.service`.
- **Valores canônicos (C4):** free 3/30/5, pro 25/100/50, enterprise null/null/null.
  Ignorar o artifact 11-1 (que tinha 15/20 por erro). spec.md é autoritativa.
- **`null` overload:** dois usos distintos de `null` — (a) override field `null` =
  usar default do plano; (b) JSONB do plano `null` = ilimitado (→Infinity). Não confundir.
- **`updated_at`/`created_at` NOT NULL em RLS specs:** ao inserir rows em specs, popular
  timestamps (gotcha conhecida do Radar W1b.4a).

---

## Constitution Re-check (PÓS-design)

Re-avaliação após o design completo (research/data-model/contracts/quickstart):

- **I. Multi-tenancy:** design confirma `subscription_plans` global com exceção C-I
  documentada; `plan_limits_override` tenant-scoped com RLS spec. **PASS.**
- **II. Type-Safety/IDs:** `uuidv7()` no seed/serviço; `strict`; schemas Zod fonte de
  contrato; `null` explícito com semântica documentada. **PASS.**
- **III. Idioma:** logs/Swagger inglês; user-facing PT-BR preservado. **PASS.**
- **IV. Contratos API:** `{data}`/erro estruturado; 422 via Zod; `/api/v1/admin/super/plans`;
  PATCH→200. **PASS.**
- **V. FE state:** N/A (backend-only). **N/A.**
- **VI. Qualidade:** unit+integration+RLS specs (global=authz, tenant=isolamento)+snapshots;
  CI verde gate. **PASS.**
- **VII. Entrega:** 1 branch/1 PR; commits PT-BR; exceção C-I anotada no PR. **PASS.**

**Veredito final pós-design: PASS.** Nenhuma nova violação introduzida pelo design.
A exceção C-I permanece a única, documentada e ratificada (FR-INFRA-06).

---

## Complexity Tracking

| Item | Por que necessário | Alternativa rejeitada |
|------|--------------------|-----------------------|
| Tabela global sem RLS (`subscription_plans`) | Config de produto, não dado de tenant; escrita só SUPER_ADMIN | Tabela tenant-scoped → duplicaria limites por tenant; semântica errada |
| Cache write-through (não cache-aside c/ DEL) | RECONCILIACAO-EPIC11 §6 + C2: mudança reflete imediatamente, sem janela de stale | DEL/invalidação → primeiro read pós-PATCH bateria no DB; pipeline SET evita |
| Dois schemas Zod de override | C1/dec-008: persistência (`>0 ou null`) ≠ input (coerção, 422) | Schema único → mistura validação de borda com shape de storage |
| `null → Infinity` em runtime | C3/dec-010: paridade com 3-3; JSONB não armazena Infinity | Armazenar string "unlimited" → comparação `current < limit` quebraria |
