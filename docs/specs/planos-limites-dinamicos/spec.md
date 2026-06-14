# Feature Specification: Planos de Assinatura & Limites Dinâmicos

**Short Name**: `planos-limites-dinamicos`
**Epic**: Epic 11 — Planos, Limites & Feature Gating
**Story**: 11-1
**Status**: Draft
**Actors**: Super Admin (gerencia planos/overrides), Tenant Admin (opera dentro dos limites), Sistema (Guard aplica limites dinamicamente)

> Decisões de infraestrutura (RECONCILIACAO-EPIC11 §10 — FIXADAS, não reabrir):
> - `FR-INFRA-01`: Endpoints super-admin sob `/api/v1/admin/super/plans` e `/api/v1/admin/super/plans/:planId` (role SUPER_ADMIN). Override por-tenant via PATCH no controller super-admin existente.
> - `FR-INFRA-02`: `tenants.plan_limits_override` é COLUNA NOVA (migration nesta story) — não pré-existe do Epic 3.
> - `FR-INFRA-03`: Contagem de recursos permanece DIRETA no DB (Prisma, dentro de `withTenantTx`) — sem Redis INCR/contador. Cache Redis write-through APENAS para os VALORES DE LIMITE (`cache:plan-limits:{tenantId}`), não para contagem.
> - `FR-INFRA-04`: Guard enforça SOMENTE `groups`/`membersPerGroup`/`leadersPerTenant` (os 3 recursos contáveis). Storage/recording/simultaneous-users: armazenados no JSONB mas NÃO enforçados (sem contador existente) — documentados como não-enforçados/futuro.
> - `FR-INFRA-05`: Seed em `apps/api/prisma/seeds/subscription-plans-seed.ts` (idempotente, upsert por tier) + script `db:seed:plans` + guard CLI. Valores REAIS de 3-3: free 3/30/5, pro 25/100/50, enterprise ∞.
> - `FR-INFRA-06`: `SubscriptionPlan` é tabela GLOBAL (sem tenant_id; sem RLS por tenant). Apenas SUPER_ADMIN escreve (autorização via RolesGuard).
> - `FR-INFRA-07`: Downgrade NÃO-destrutivo: bloqueia criação de novos recursos; mantém acesso leitura aos excedentes. Banner é Story 11-4, não aqui.
> - `FR-INFRA-08`: Reusar `TenantPlanSchema` (free/pro/enterprise) de `packages/types/src/super-admin-tenant.ts`. Não recriar enum.
> - `FR-INFRA-09`: AUDIT_ACTIONS: adicionar `'plan_limits_override'` ao array existente em `packages/types/src/audit/index.ts` + snapshot.

---

## User Scenarios & Testing

### User Story 1 — SubscriptionPlan: tabela global com 3 tiers (Priority: P0)

Como **Super Admin**,
Quero que a plataforma tenha uma tabela `subscription_plans` com os 3 tiers (free, pro, enterprise) configurados com limites numéricos JSONB,
Para que o sistema possa ler os limites dinamicamente do banco em vez de usar constantes hardcoded.

**Why this priority**: Fundação da Epic 11. Sem a tabela e o seed, nenhuma outra story da epic funciona. O `PlanLimitsGuard` precisa de uma fonte dinâmica.

**Independent Test**: Executar `pnpm db:seed:plans` → verificar 3 rows em `subscription_plans` com `tier` IN ('free','pro','enterprise') e `is_active = true`. Rodar seed novamente → apenas 3 rows (idempotência via upsert). O boot da API NÃO crasha se o seed não rodou (fallback ativo).

**Acceptance Scenarios**:

1. **Given** a migration 11-1 aplicada, **When** o banco é inspecionado, **Then** a tabela `subscription_plans` existe com colunas: `id` (uuid, PK), `name` (varchar), `tier` (enum: free/pro/enterprise), `limits` (jsonb), `features` (jsonb), `metadata` (jsonb), `is_active` (boolean), `created_at`, `updated_at`. Coluna `plan_limits_override` (jsonb nullable) adicionada ao model `tenants`.

2. **Given** o seed `db:seed:plans` executado, **When** consulto `subscription_plans`, **Then** existem exatamente 3 planos ativos:
   - **Free**: `limits.maxGroups=3, limits.maxMembersPerGroup=30, limits.maxLeadersPerTenant=5`; `metadata.priceBRL=0`
   - **Pro**: `limits.maxGroups=25, limits.maxMembersPerGroup=100, limits.maxLeadersPerTenant=50`; `metadata.priceBRL=99`
   - **Enterprise**: `limits.maxGroups=null, limits.maxMembersPerGroup=null, limits.maxLeadersPerTenant=null` (null = ilimitado); `metadata.price="Sob consulta"`

3. **Given** o seed rodado duas vezes (idempotência), **When** consulto a contagem de rows, **Then** ainda são 3 (upsert por `tier`).

4. **Given** a tabela `subscription_plans` vazia (seed não rodou), **When** `PlanLimitsService.getLimits()` é chamado, **Then** o serviço usa `PLAN_LIMITS_FALLBACK` (= `PLAN_LIMITS` atuais de 3-3), loga warning Pino `"SubscriptionPlan table empty, using fallback defaults"` e NUNCA retorna 500.

---

### User Story 2 — getLimits dinâmico com cache e fallback (Priority: P0)

Como **sistema**,
Quero que `PlanLimitsService.getLimits(tenantId)` leia o limite do `SubscriptionPlan` do tenant + aplique `plan_limits_override` + use cache Redis write-through,
Para que o Guard aplique limites corretos de forma resiliente e performática.

**Why this priority**: Sem `getLimits` dinâmico, o Guard continua hardcoded. É o core técnico da story.

**Independent Test**: Criar tenant Free → chamar `getLimits(tenantId)` → receber `{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}`. Verificar que a chave `cache:plan-limits:{tenantId}` foi escrita no Redis. Limpar Redis → chamar `getLimits` novamente → retorna mesmos valores (DB fallback). Setar `plan_limits_override` = `{maxGroups:10}` no tenant → `getLimits` retorna `{maxGroups:10, maxMembersPerGroup:30, maxLeadersPerTenant:5}` (override parcial).

**Acceptance Scenarios**:

1. **Given** um tenant com `plan=free` e sem `plan_limits_override`, **When** `getLimits(tenantId)` é chamado, **Then** retorna `{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}` — idêntico ao comportamento hardcoded anterior (contrato de paridade).

2. **Given** o resultado de `getLimits`, **When** a chave `cache:plan-limits:{tenantId}` é consultada no Redis, **Then** o valor foi escrito (write-through no cold read).

3. **Given** Redis indisponível, **When** `getLimits(tenantId)` é chamado, **Then** o serviço lê do DB sem falhar; se DB também falhar, usa `PLAN_LIMITS_FALLBACK` — sem 500.

4. **Given** `plan_limits_override = {maxGroups: 10}` no tenant, **When** `getLimits(tenantId)` é chamado, **Then** retorna `{maxGroups:10, maxMembersPerGroup:30, maxLeadersPerTenant:5}` — override tem precedência sobre o plano default para os campos não-nulos.

5. **Given** `plan_limits_override = {maxGroups: null}` no tenant, **When** `getLimits(tenantId)` é chamado, **Then** retorna `{maxGroups:3, ...}` — null no override = usar default do plano.

6. **Given** um tenant com `plan=enterprise`, **When** `getLimits(tenantId)` é chamado para `maxGroups`, **Then** retorna `Infinity` (sem cap).

---

### User Story 3 — Guard com limites dinâmicos (contract de paridade) (Priority: P0)

Como **sistema**,
Quero que `PlanLimitsGuard` use `getLimits(tenantId)` em vez de `getLimit(plan, resource)` hardcoded,
Para que limites atualizados no banco reflitam imediatamente nas decisões do Guard.

**Why this priority**: Sem essa refatoração, a tabela `SubscriptionPlan` existe mas não é usada. É o contrato central de paridade: comportamento IDÊNTICO antes e depois para o caso base.

**Independent Test** (contract test): Criar tenant Free → tentar criar 4 grupos (o 4° deve ser rejeitado com 403 `PlanLimitReached`) → verificar que o comportamento é idêntico ao que existia antes da migração para limites dinâmicos.

**Acceptance Scenarios**:

1. **Given** tenant Free com 3 grupos, **When** tenta criar o 4° grupo via `POST /api/v1/groups` (com `@PlanLimit('groups')`), **Then** o Guard retorna 403 com body `{statusCode:403, error:"PlanLimitReached", message:"...", details:{resource:"groups", plan:"free", current:3, limit:3}}`.

2. **Given** o plano Free com `maxGroups` atualizado para 5 no banco (via PATCH super-admin), **When** tenant Free tenta criar o 4° grupo, **Then** o Guard PERMITE (limite agora é 5, não mais 3 hardcoded).

3. **Given** o Guard chamando `getLimits`, **When** o fallback é ativo (tabela vazia), **Then** o Guard aplica os mesmos limites hardcoded de 3-3 (contrato de fallback).

4. **Given** o enforce manual de `membersPerGroup` existente na camada de 10-4 (`group-members.service`), **When** a story 11-1 é entregue, **Then** esse enforce manual NÃO é regredido — `hasCapacity('membersPerGroup')` ainda retorna `{allowed:true}` no Guard (o enforce real permanece no serviço de membros, como estava).

---

### User Story 4 — Endpoints super-admin: listar e editar planos (Priority: P1)

Como **Super Admin**,
Quero endpoints REST para listar planos com contagem de tenants e editar limites de um plano,
Para que eu possa ajustar os limites do produto sem deploy.

**Why this priority**: Sem os endpoints, o admin não pode operar os planos. Cache write-through é crítico para que mudanças reflitam imediatamente.

**Independent Test**: `GET /api/v1/admin/super/plans` autenticado como SUPER_ADMIN → lista 3 planos com `tenantCount` por plano. `PATCH /api/v1/admin/super/plans/{id}` com `{limits:{maxGroups:5}}` → 200 + Redis atualizado para todos os tenants no plano (write-through).

**Acceptance Scenarios**:

1. **Given** autenticado como SUPER_ADMIN, **When** `GET /api/v1/admin/super/plans`, **Then** retorna `{data: [{id, name, tier, limits, features, metadata, isActive, tenantCount}, ...]}` com os 3 planos.

2. **Given** autenticado como ADMIN_TENANT (não SUPER_ADMIN), **When** `GET /api/v1/admin/super/plans`, **Then** retorna 403.

3. **Given** autenticado como SUPER_ADMIN, **When** `PATCH /api/v1/admin/super/plans/{id}` com `{limits:{maxGroups:5}}`, **Then** o banco é atualizado, o Redis `cache:plan-limits:{tenantId}` de TODOS os tenants no plano é atualizado (write-through), e a resposta é `{data: {id, tier, limits, ...}}`.

4. **Given** o `PATCH` de plano, **When** `limits.maxGroups` é definido como `-1` (inválido), **Then** retorna 422 com details de validação Zod.

---

### User Story 5 — Override por-tenant e audit log (Priority: P1)

Como **Super Admin**,
Quero poder definir overrides de limite para um tenant específico via PATCH no controller super-admin de tenants,
Para que eu possa customizar limites individualmente sem alterar o plano base.

**Why this priority**: Requisito de negócio para clientes enterprise com acordos customizados.

**Independent Test**: `PATCH /api/v1/admin/super/tenants/{id}` com `{planLimitsOverride:{maxGroups:10}}` → 200 + `tenants.plan_limits_override` salvo + evento audit com `action=plan_limits_override` gravado + Redis atualizado com o valor merged.

**Acceptance Scenarios**:

1. **Given** autenticado como SUPER_ADMIN, **When** `PATCH /api/v1/admin/super/tenants/{id}` com `{planLimitsOverride:{maxGroups:10}}`, **Then** o campo `plan_limits_override` do tenant é atualizado, um evento audit `{action:"plan_limits_override", resource:"tenant", resourceId:tenantId}` é gravado, e Redis `cache:plan-limits:{tenantId}` é escrito com o valor merged (override > plano).

2. **Given** `planLimitsOverride` com campo inválido (ex: `{maxGroups: -5}`), **When** o PATCH é enviado, **Then** retorna 422 (`PlanLimitsOverrideSchema` rejeita negativos).

3. **Given** `planLimitsOverride = {}` (sem campos), **When** o PATCH é enviado, **Then** retorna 200 (sem override — usa plano base).

4. **Given** o override salvo, **When** `getLimits(tenantId)` é chamado, **Then** o override tem precedência: `{maxGroups: override ?? planDefault}` por campo.

---

### User Story 6 — Contratos Zod + snapshot (Priority: P1)

Como **time de desenvolvimento**,
Quero schemas Zod em `packages/types` para `SubscriptionPlan` e `PlanLimitsOverride`,
Para garantir type-safety entre FE e BE e prevenir breaking changes silenciosos.

**Why this priority**: Contrato de interface. Snapshot tests são o gate contra regressões de schema.

**Independent Test**: `pnpm test --filter=@metanoia/types` → snapshot de `SubscriptionPlanSchema` e `PlanLimitsOverrideSchema` passam. Mudar um campo → snapshot falha (gate funciona).

**Acceptance Scenarios**:

1. **Given** `packages/types/src/plans/subscription.ts`, **When** importado, **Then** exporta: `PlanLimitsSchema` (campos numéricos ou null), `PlanLimitsOverrideSchema` (campos numéricos > 0 ou null; inválido → Zod error), `SubscriptionPlanSchema` (id, name, tier usando `TenantPlanSchema` existente, limits, features, metadata, isActive), `PlanLimitsOverrideInputSchema` (para validação de input do PATCH).

2. **Given** os schemas exportados, **When** os snapshot tests rodam, **Then** os snapshots existem e passam.

3. **Given** `packages/types/src/index.ts`, **When** inspecionado, **Then** os novos schemas estão re-exportados.

---

## Clarifications

> (Seção reservada para respostas do clarify — não há perguntas pendentes. Todas as decisões foram resolvidas na RECONCILIACAO-EPIC11 §10.)

---

## Technical Constraints

- `SubscriptionPlan` é global (sem `tenant_id`, sem RLS por tenant). `tenants.plan_limits_override` é tenant-scoped (coberto pela RLS existente de `tenants`).
- IDs: UUID v7 via `uuidv7()` — nunca `@default(uuid())`.
- Cache namespace: `cache:plan-limits:{tenantId}` — write-through (SET, não só DEL).
- Triplo fallback: Redis → DB → `PLAN_LIMITS_FALLBACK` (nunca 500).
- Contagem de recursos: direta no DB via `withTenantTx` (sem Redis INCR).
- Override: `null` no campo = usar default do plano. Override inválido (negativo, não-numérico) = 422.
- `AUDIT_ACTIONS` extensível: adicionar `'plan_limits_override'` ao array + regenerar snapshot.
- Seed: `apps/api/prisma/seeds/subscription-plans-seed.ts` + guard CLI `if (process.argv[1]?.includes('subscription-plans-seed')) void main()`.
- DI: `PlanLimitsModule` precisa importar `RedisModule` (para cache) + exportar `PlanLimitsService`.
- Reuso: `TenantPlanSchema` de `super-admin-tenant.ts`; `super-admin-tenants.controller.ts` e `.module.ts` existentes são estendidos (não recriados).
- Downgrade non-destructive: bloqueia criação, não deleta existentes. Banner = Story 11-4.
- `membersPerGroup` curto-circuita em `hasCapacity` (retorna `allowed:true`) — manter comportamento; enforce manual de 10-4 NÃO regredir.

---

## Out of Scope (Story 11-1)

- Banner de downgrade/upgrade (Story 11-4)
- Branding por tenant (Story 11-2)
- Feature toggles/policies (Story 11-3)
- Workflow de upgrade-request (Story 11-4)
- 403 acionável com `suggestedPlan` no Guard (Story 11-4)
- Contagem real de `membersPerGroup` no Guard (decisão IMPL-TIME)
- Storage/recording/simultaneous-users: armazenados no JSONB mas NÃO enforçados aqui
