# Checklist: Requirements — planos-limites-dinamicos (Story 11-1)

**Gerado por**: fase `checklist` (onda-004)
**Rastreabilidade alvo**: ≥80% dos ACs com evidência literal
**Legenda**:
- `[x]` Auto-resolvido com evidência
- `[ ]` Pendente humano (`{humano}`)
- `[Gap]` Requisito sem cobertura suficiente na spec
- `[Ambiguity]` Item ambíguo que pode causar drift na implementação
- `[Conflict]` Contradição detectada entre artefatos

---

## Domínio: Tabela Global + Seed (US1)

### US1-AC1 — Estrutura da tabela `subscription_plans`

- [x] **Colunas obrigatórias**: `id` (uuid PK), `name` (varchar), `tier` (enum), `limits` (jsonb), `features` (jsonb), `metadata` (jsonb), `is_active` (boolean), `created_at`, `updated_at` existem no schema.
  - Evidência: `[Spec §US1-AC1]` lista explícita de colunas; `[plan.md §Project Structure]` `schema.prisma [EDIT: + model SubscriptionPlan]`.

- [x] **Coluna nova `tenants.planLimitsOverride`**: é migration desta story (não pré-existe).
  - Evidência: `[Spec §FR-INFRA-02]` "tenants.plan_limits_override é COLUNA NOVA (migration nesta story)"; `[plan.md §Technical Context]` "model Tenant tem ... NÃO tem plan_limits_override → criar".

- [x] **Enum de tier** reusa `TenantPlanSchema` existente (`free/pro/enterprise`).
  - Evidência: `[Spec §FR-INFRA-08]` "Reusar TenantPlanSchema de packages/types/src/super-admin-tenant.ts. Não recriar enum."; `[plan.md §Convenções de Borda]` "Enum de tier → TenantPlanSchema — REUSAR".

- [x] **ID via `uuidv7()`** — nunca `@default(uuid())` Prisma.
  - Evidência: `[Spec §Technical Constraints]` "IDs: UUID v7 via uuidv7() — nunca @default(uuid())."; `[plan.md §Constitution Check §II]`.

### US1-AC2 — Valores canônicos do seed (C4 / dec-011)

- [x] **Free**: `limits.maxGroups=3, limits.maxMembersPerGroup=30, limits.maxLeadersPerTenant=5`, `metadata.priceBRL=0`.
  - Evidência: `[Spec §US1-AC2]` tabela explícita; `[Spec §C4]` "free: maxGroups=3, maxMembersPerGroup=30, maxLeadersPerTenant=5 (artifact 11-1 tem 15 por erro — IGNORAR)". Valor 30 é canônico pós-RECONCILIACAO-EPIC11 §1.3.

- [x] **Pro**: `limits.maxGroups=25, limits.maxMembersPerGroup=100, limits.maxLeadersPerTenant=50`, `metadata.priceBRL=99`.
  - Evidência: `[Spec §US1-AC2]` tabela explícita; `[Spec §C4]` "pro: maxGroups=25 (artifact 11-1 tem 20 por erro — IGNORAR)".

- [x] **Enterprise**: `limits.maxGroups=null, limits.maxMembersPerGroup=null, limits.maxLeadersPerTenant=null` (`null` = ilimitado), `metadata.price="Sob consulta"`.
  - Evidência: `[Spec §US1-AC2]` "null = ilimitado"; `[Spec §C3]` / `[dec-010]` "Enterprise armazena null no JSONB".

### US1-AC3 — Idempotência do seed (upsert por tier)

- [x] **Seed idempotente**: executar 2× → ainda 3 rows.
  - Evidência: `[Spec §US1-AC3]` "Rodar seed novamente → apenas 3 rows (idempotência via upsert)"; `[plan.md §Technical Context]` "demo-seed.ts (upsert idempotente)"; `[Spec §FR-INFRA-05]` "idempotente, upsert por tier".

- [x] **Guard CLI** no seed: `if (process.argv[1]?.includes('subscription-plans-seed')) void main()`.
  - Evidência: `[Spec §FR-INFRA-05]` "seed em apps/api/prisma/seeds/ ... + guard CLI"; `[plan.md §GOTCHAS]` "Seed guard CLI: if (process.argv[1]?.includes('subscription-plans-seed')) void main()".

- [x] **Script `db:seed:plans`** adicionado ao `package.json` de `apps/api`.
  - Evidência: `[Spec §FR-INFRA-05]` "+ script db:seed:plans"; `[plan.md §Project Structure]` "package.json (apps/api) [EDIT: script "db:seed:plans"]".

### US1-AC4 — Fallback quando tabela vazia

- [x] **Boot da API não crasha** se seed não rodou.
  - Evidência: `[Spec §US1-AC4]` "boot da API NÃO crasha se o seed não rodou (fallback ativo)"; `[plan.md §Convenções de fallback]` "PLAN_LIMITS_FALLBACK ... se tabela vazia".

- [x] **Warning Pino** emitido: `"SubscriptionPlan table empty, using fallback defaults"`.
  - Evidência: `[Spec §US1-AC4]` literal da mensagem; `[contracts/plan-limits-service.md §getLimits]` step 3 literal.

---

## Domínio: getLimits dinâmico com cache (US2)

### US2-AC1 — Paridade de contrato (caso base Free sem override)

- [x] **`getLimits(tenantId)`** para Free sem override retorna `{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}`.
  - Evidência: `[Spec §US2-AC1]` "idêntico ao comportamento hardcoded anterior (contrato de paridade)"; `[contracts/plan-limits-service.md §Contratos de paridade]` row "Free, sem override, tabela vazia".

### US2-AC2 — Write-through no cold read

- [x] **Cold read** escreve `cache:plan-limits:{tenantId}` via Redis `SET`.
  - Evidência: `[Spec §US2-AC2]` "chave cache:plan-limits:{tenantId} ... foi escrita (write-through no cold read)"; `[contracts/plan-limits-service.md §getLimits]` step 2 "write-through: SET cache:plan-limits:{tenantId}".

### US2-AC3 — Triplo fallback (Redis down, DB down)

- [x] **Redis indisponível** → lê DB sem 500.
  - Evidência: `[Spec §US2-AC3]` "o serviço lê do DB sem falhar"; `[plan.md §Convenções de fallback]` "NUNCA 500".

- [x] **DB também falha** → usa `PLAN_LIMITS_FALLBACK` sem 500.
  - Evidência: `[Spec §US2-AC3]` "se DB também falhar, usa PLAN_LIMITS_FALLBACK — sem 500"; `[contracts/plan-limits-service.md §getLimits]` step 3.

### US2-AC4 — Override parcial tem precedência

- [x] **Override `{maxGroups:10}`** → retorna `{maxGroups:10, maxMembersPerGroup:30, maxLeadersPerTenant:5}`.
  - Evidência: `[Spec §US2-AC4]` literal; `[contracts/plan-limits-service.md]` "merge por campo: raw[k] = override?.[k] ?? subscriptionPlan.limits[k]".

### US2-AC5 — Override `null` em campo usa default do plano

- [x] **Override `{maxGroups:null}`** → retorna `{maxGroups:3, ...}` (default do plano).
  - Evidência: `[Spec §US2-AC5]` "null no override = usar default do plano"; `[Spec §Technical Constraints]` "Override: null no campo = usar default do plano".

### US2-AC6 — Enterprise retorna `Infinity` (C3 / dec-010)

- [x] **Enterprise `maxGroups`** → `Infinity` (não `null`, não `999999`).
  - Evidência: `[Spec §US2-AC6]` "retorna Infinity (sem cap)"; `[Spec §C3]` "null do banco (enterprise) mapeado para Infinity no serviço"; `[dec-010]` score 3.

---

## Domínio: Guard com limites dinâmicos (US3)

### US3-AC1 — 403 no 4º grupo (Free)

- [x] **Guard** retorna 403 com shape correto: `{statusCode:403, error:"PlanLimitReached", message:"...", details:{resource:"groups", plan:"free", current:3, limit:3}}`.
  - Evidência: `[Spec §US3-AC1]` shape completo; `[contracts/plan-limits-service.md §Erro do Guard]` JSON literal.

### US3-AC2 — Limite atualizado reflete imediatamente (via DB, sem deploy)

- [x] **Após PATCH do plano Free com `maxGroups=5`**, Guard permite o 4º grupo.
  - Evidência: `[Spec §US3-AC2]` "o Guard PERMITE (limite agora é 5, não mais 3 hardcoded)".

### US3-AC3 — Fallback ativo no Guard

- [x] **Guard com fallback** aplica mesmos limites hardcoded de 3-3.
  - Evidência: `[Spec §US3-AC3]` "o Guard aplica os mesmos limites hardcoded de 3-3 (contrato de fallback)"; `[plan.md §Convenções de fallback]` "Contrato de paridade".

### US3-AC4 — `membersPerGroup` curto-circuita `{allowed:true}`

- [x] **`hasCapacity('membersPerGroup')`** retorna `{allowed:true}` sem contar no DB.
  - Evidência: `[Spec §US3-AC4]` "hasCapacity('membersPerGroup') ainda retorna {allowed:true}"; `[contracts/plan-limits-service.md §hasCapacity]` "se resource === 'membersPerGroup': return {allowed:true,...}".

- [x] **Enforce real** permanece em `group-members.service` (10-4) — não regredir.
  - Evidência: `[Spec §Technical Constraints]` "membersPerGroup curto-circuita ... enforce manual de 10-4 NÃO regredir"; `[plan.md §GOTCHAS]` "Não regredir enforce manual por-grupo da 10-4".

---

## Domínio: Endpoints super-admin (US4)

### US4-AC1 — GET `/api/v1/admin/super/plans` retorna 3 planos com `tenantCount`

- [x] **Shape de resposta**: `{data:[{id, name, tier, limits, features, metadata, isActive, tenantCount},...]}`.
  - Evidência: `[Spec §US4-AC1]` shape completo; `[contracts/super-admin-plans-api.md §GET]` JSON exemplo.

- [x] **`tenantCount`** é COUNT derivado, não persistido.
  - Evidência: `[contracts/super-admin-plans-api.md §GET]` "`tenantCount`: derivado (COUNT(tenants WHERE plan = tier)), não persistido".

- [x] **Enterprise `limits.maxGroups=null`** na resposta da API (NÃO `Infinity`).
  - Evidência: `[contracts/super-admin-plans-api.md §GET]` "enterprise limits.maxGroups = null (ilimitado) é serializado como null no JSON (NÃO Infinity — o mapeamento null→Infinity é interno ao getLimits, não na API de planos)".

### US4-AC2 — 403 para não-SUPER_ADMIN

- [x] **ADMIN_TENANT** recebe 403 em `GET /api/v1/admin/super/plans`.
  - Evidência: `[Spec §US4-AC2]` "retorna 403"; `[contracts/super-admin-plans-api.md §GET]` "Auth: SUPER_ADMIN. ADMIN_TENANT/outros → 403".

### US4-AC3 — PATCH plano: DB + Redis write-through (pipeline, síncrono)

- [x] **Banco atualizado** + Redis `cache:plan-limits:{tenantId}` de TODOS os tenants do plano via pipeline síncrono.
  - Evidência: `[Spec §US4-AC3]` "banco é atualizado, o Redis ... de TODOS os tenants no plano é atualizado (write-through)"; `[Spec §C2]` / `[dec-009]` "síncrono na request; Redis pipeline; PROIBIDO usar DEL".

- [x] **Resposta PATCH plano**: `{data:{id, tier, limits, features, metadata, isActive}}`.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH plan]` "200 Response: {data: {id, tier, limits, ...}}".

### US4-AC4 — 422 em PATCH com `limits.maxGroups=-1`

- [x] **Validação Zod** retorna 422 com `details` para numérico inválido.
  - Evidência: `[Spec §US4-AC4]` "retorna 422 com details de validação Zod"; `[contracts/super-admin-plans-api.md §PATCH plan]` "422 quando limits.maxGroups = -1".

---

## Domínio: Override por-tenant + audit (US5)

### US5-AC1 — PATCH tenant salva override, audit e Redis

- [x] **`plan_limits_override`** do tenant atualizado.
  - Evidência: `[Spec §US5-AC1]` "campo plan_limits_override do tenant é atualizado".

- [x] **Audit** gravado: `{action:"plan_limits_override", resource:"tenant", resourceId:tenantId}`.
  - Evidência: `[Spec §US5-AC1]` shape de audit; `[Spec §FR-INFRA-09]` "adicionar 'plan_limits_override' ao array existente em packages/types/src/audit/index.ts".

- [x] **Redis `SET`** do valor merged (override>plano) — nunca DEL.
  - Evidência: `[Spec §US5-AC1]` "Redis cache:plan-limits:{tenantId} é escrito com o valor merged (override > plano)"; `[contracts/super-admin-plans-api.md §PATCH tenant]` "SET cache:plan-limits:{id} ... Nunca DEL".

### US5-AC2 — 422 em override com campo negativo

- [x] **`{maxGroups:-5}`** → 422 (`PlanLimitsOverrideInputSchema` rejeita negativos).
  - Evidência: `[Spec §US5-AC2]` "retorna 422 (PlanLimitsOverrideSchema rejeita negativos)"; `[contracts/super-admin-plans-api.md §PATCH tenant]` "campo inválido ({maxGroups:-5}) → 422".

### US5-AC3 — `{}` zera override (C5 / dec-012)

- [x] **`{planLimitsOverride:{}}`** → retorna 200, seta `plan_limits_override=null` no banco.
  - Evidência: `[Spec §US5-AC3]` "retorna 200 (sem override — usa plano base)"; `[Spec §C5]` / `[dec-012]` "PATCH com planLimitsOverride={} → seta plan_limits_override=null".

### US5-AC4 — Override tem precedência em `getLimits`

- [x] **Precedência**: `{maxGroups: override ?? planDefault}` por campo.
  - Evidência: `[Spec §US5-AC4]` "o override tem precedência: {maxGroups: override ?? planDefault} por campo"; `[plan.md §Convenções de Borda]` "Sentinela 'usar default': override field null = usar default do plano ... merge: override[k] ?? planDefault[k]".

---

## Domínio: Contratos Zod + snapshot (US6)

### US6-AC1 — Schemas exportados de `packages/types/src/plans/subscription.ts`

- [x] **`PlanLimitsSchema`** (campos numéricos ou null) exportado.
  - Evidência: `[Spec §US6-AC1]` lista explícita de exports.

- [x] **`PlanLimitsOverrideSchema`** (campos numéricos >0 ou null; inválido → Zod error) exportado.
  - Evidência: `[Spec §US6-AC1]`; `[Spec §C1]` / `[dec-008]` "PlanLimitsOverrideSchema = persistência/leitura".

- [x] **`PlanLimitsOverrideInputSchema`** (validação do PATCH body; 422 em negativos) exportado.
  - Evidência: `[Spec §US6-AC1]`; `[Spec §C1]` / `[dec-008]` "PlanLimitsOverrideInputSchema = validação input PATCH".

- [x] **`SubscriptionPlanSchema`** (id, name, tier via `TenantPlanSchema`, limits, features, metadata, isActive) exportado.
  - Evidência: `[Spec §US6-AC1]`; `[Spec §FR-INFRA-08]` "Reusar TenantPlanSchema".

### US6-AC2 — Snapshot tests passam

- [x] **Snapshots** de `SubscriptionPlanSchema` e `PlanLimitsOverrideSchema` existem e passam.
  - Evidência: `[Spec §US6-AC2]`; `[plan.md §Project Structure]` `plans-subscription.snapshot.spec.ts [CREATE]`.

### US6-AC3 — Re-export em `packages/types/src/index.ts`

- [x] **`index.ts`** re-exporta schemas novos.
  - Evidência: `[Spec §US6-AC3]`; `[plan.md §Project Structure]` `index.ts [EDIT: re-export plans/subscription]`.

---

## Domínio: Constraints transversais

### CT-1 — `AUDIT_ACTIONS` extensível

- [x] **`'plan_limits_override'`** adicionado ao array `AUDIT_ACTIONS` + snapshot regenerado.
  - Evidência: `[Spec §FR-INFRA-09]`; `[plan.md §Convenções de Borda]` "Audit action: 'plan_limits_override'"; `[plan.md §Project Structure]` `audit/index.ts [EDIT]` + `audit.snapshot.spec.ts [EDIT/CREATE]`.

### CT-2 — Downgrade não-destrutivo

- [x] **Guard bloqueia criação** de novos recursos; **não deleta** existentes ao ultrapassar limite.
  - Evidência: `[Spec §FR-INFRA-07]` "Downgrade NÃO-destrutivo: bloqueia criação de novos recursos; mantém acesso leitura aos excedentes".

### CT-3 — Storage/recording/simultaneous-users não-enforçados

- [x] **Campos não-enforçados** armazenados no JSONB mas sem contador → documentados como futuro.
  - Evidência: `[Spec §FR-INFRA-04]` "Storage/recording/simultaneous-users: armazenados no JSONB mas NÃO enforçados (sem contador existente)"; `[Spec §Out of Scope]`.

### CT-4 — RLS specs obrigatórias

- [x] **`subscription-plans.rls-spec.ts`**: testa autorização SUPER_ADMIN (não isolamento — tabela global).
  - Evidência: `[plan.md §GOTCHAS]` "subscription_plans é GLOBAL → spec testa autorização SUPER_ADMIN (não isolamento de linha por tenant)"; `[plan.md §Project Structure]` `subscription-plans.rls-spec.ts [CREATE]`.

- [x] **`tenant-plan-override.rls-spec.ts`**: testa isolamento de `tenants.plan_limits_override` (tenant-scoped).
  - Evidência: `[plan.md §GOTCHAS]` "tenants.plan_limits_override é tenant-scoped → spec de isolamento"; `[plan.md §Project Structure]` `tenant-plan-override.rls-spec.ts [CREATE]`.

### CT-5 — Índices de performance

- [Gap] Spec e data-model não especificam explicitamente quais índices criar na tabela `subscription_plans` (além da PK). O PATCH write-through itera `tenants WHERE plan = tier` — sem índice em `tenants.plan`, essa query pode ser lenta em produção com muitos tenants. **Ação sugerida**: create-tasks deve incluir task explícita de índice `CREATE INDEX idx_tenants_plan ON tenants(plan)` na migration.

### CT-6 — `updated_at`/`created_at` NOT NULL em RLS specs

- [x] **Gotcha conhecida**: ao inserir rows em RLS specs, popular timestamps.
  - Evidência: `[plan.md §GOTCHAS]` "updated_at/created_at NOT NULL em RLS specs: ao inserir rows em specs, popular timestamps (gotcha conhecida do Radar W1b.4a)".

---

## Sumário de rastreabilidade

| Domínio | ACs totais | Resolvidos `[x]` | Gaps/Ambiguidades | % cobertura |
|---------|-----------|-------------------|-------------------|------------|
| US1 (Tabela/Seed) | 9 | 9 | 0 | 100% |
| US2 (getLimits) | 7 | 7 | 0 | 100% |
| US3 (Guard) | 5 | 5 | 0 | 100% |
| US4 (Endpoints) | 6 | 6 | 0 | 100% |
| US5 (Override/Audit) | 4 | 4 | 0 | 100% |
| US6 (Contratos Zod) | 4 | 4 | 0 | 100% |
| Constraints transversais | 6 | 5 | 1 Gap | 83% |
| **TOTAL** | **41** | **40** | **1 Gap** | **98%** |

**Rastreabilidade: 98% > 80% — PASS.**

Gap único: CT-5 (índice em `tenants.plan`) — não bloqueia implementação mas deve ser task em create-tasks.
