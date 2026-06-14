# Checklist: Security — planos-limites-dinamicos (Story 11-1)

**Gerado por**: fase `checklist` (onda-004)
**Foco**: autorização SUPER_ADMIN, RLS de `subscription_plans` (global) e `tenants.plan_limits_override` (tenant-scoped), validação de input (422/override negativo), segurança do override
**Fontes**: `spec.md §FR-INFRA-01/06`, `plan.md §Constitution Check I/VI`, `contracts/super-admin-plans-api.md`, `docs/constitution.md`
**Legenda**: `[x]` resolvido | `[Gap]` sem cobertura | `[Ambiguity]` ambíguo | `[ ]` humano

---

## SEC-1 — Autorização: role SUPER_ADMIN

### SEC-1.1 — Endpoints de planos são exclusivos de SUPER_ADMIN

- [x] **`GET /api/v1/admin/super/plans`** e **`PATCH /api/v1/admin/super/plans/:planId`** exigem `Role.SUPER_ADMIN` via `RolesGuard`.
  - Evidência: `[Spec §FR-INFRA-01]` "role SUPER_ADMIN"; `[contracts/super-admin-plans-api.md]` "Auth: KeycloakAuthGuard + RolesGuard + @Roles(Role.SUPER_ADMIN)".

- [x] **`PATCH /api/v1/admin/super/tenants/:id`** (estendido com `planLimitsOverride`) mantém a autenticação existente de SUPER_ADMIN.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH tenant]` "Auth: SUPER_ADMIN"; `[plan.md §Technical Context]` "super-admin-tenants.controller.ts (@UseGuards(KeycloakAuthGuard, RolesGuard), @Roles(Role.SUPER_ADMIN))".

- [x] **ADMIN_TENANT e roles inferiores** recebem 403 — testado por integration spec.
  - Evidência: `[Spec §US4-AC2]` "autenticado como ADMIN_TENANT (não SUPER_ADMIN) → retorna 403"; `[plan.md §Project Structure]` `super-admin-plans.integration-spec.ts [CREATE: GET 200/403, PATCH 200/422, write-through]`.

### SEC-1.2 — Sem bypass de role por path manipulation

- [x] **Tabela `subscription_plans` é GLOBAL** (sem RLS por tenant) — proteção de escrita é EXCLUSIVAMENTE via `RolesGuard` (não RLS de linha).
  - Evidência: `[Spec §FR-INFRA-06]` "SubscriptionPlan é tabela GLOBAL (sem tenant_id; sem RLS por tenant). Apenas SUPER_ADMIN escreve (autorização via RolesGuard)"; `[plan.md §Constitution Check §Exceção C-I]`.

- [x] **RLS spec `subscription-plans.rls-spec.ts`** testa autorização de role (não isolamento de linha) — padrão correto para tabela global.
  - Evidência: `[plan.md §GOTCHAS]` "subscription_plans é GLOBAL → spec testa autorização SUPER_ADMIN (não isolamento de linha por tenant)"; `[plan.md §Project Structure]` `subscription-plans.rls-spec.ts [CREATE]`.

### SEC-1.3 — Keycloak → `RolesGuard` como cadeia de validação

- [x] **Cadeia de 3 camadas preservada**: Keycloak token (`sub`) → `KeycloakAuthGuard` (autenticação) → `RolesGuard` (role) → controller.
  - Evidência: `[plan.md §Technical Context]` "Auth: Keycloak → KeycloakAuthGuard + RolesGuard + @Roles(Role.SUPER_ADMIN)"; `[docs/constitution.md]` "3-layer: roles → guards → RLS".

---

## SEC-2 — RLS: `tenants.plan_limits_override` (tenant-scoped)

### SEC-2.1 — Coluna `plan_limits_override` herda RLS de `tenants`

- [x] **`plan_limits_override` é coluna NOVA na tabela `tenants`** (tenant-scoped) — herda a RLS existente de `tenants` automaticamente.
  - Evidência: `[Spec §FR-INFRA-02]` "tenants.plan_limits_override é COLUNA NOVA (migration nesta story)"; `[Spec §Technical Constraints]` "SubscriptionPlan é global ... tenants.plan_limits_override é tenant-scoped (coberto pela RLS existente de tenants)".

- [x] **Nenhum tenant pode ler/escrever `plan_limits_override` de outro tenant** via RLS.
  - Evidência: `[plan.md §Constitution Check §I]` "A coluna NOVA tenants.plan_limits_override É tenant-scoped e herda a RLS existente de tenants".

### SEC-2.2 — RLS spec `tenant-plan-override.rls-spec.ts`

- [x] **Spec de isolamento** criada: `SET LOCAL app.current_tenant_id = :tenantId`, verifica que tenant A não acessa `plan_limits_override` de tenant B.
  - Evidência: `[plan.md §GOTCHAS]` "tenants.plan_limits_override é tenant-scoped → spec de isolamento usa o nome real de coluna plan_limits_override e o padrão SET LOCAL app.current_tenant_id".

- [x] **Timestamps NOT NULL** preenchidos na inserção de rows no RLS spec.
  - Evidência: `[plan.md §GOTCHAS]` "updated_at/created_at NOT NULL em RLS specs: ao inserir rows em specs, popular timestamps (gotcha conhecida do Radar W1b.4a)".

### SEC-2.3 — Leitura de `plan_limits_override` pelo super-admin não vaza cross-tenant

- [x] **`super-admin-tenants.repository.ts`** usa `this.prisma.client` direto (bypass RLS intencionado para super-admin) — já é o padrão existente da story 9-x.
  - Evidência: `[plan.md §Technical Context]` "super-admin-tenants.repository.ts (usa this.prisma.client direto — bypass RLS para queries cross-tenant)". Bypass é intencional e limitado ao repositório super-admin.

---

## SEC-3 — Validação de input e rejeição de valores inválidos

### SEC-3.1 — Campos negativos rejeitados com 422

- [x] **`PlanLimitsOverrideInputSchema`** rejeita `maxGroups < 0`, `maxMembersPerGroup < 0`, `maxLeadersPerTenant < 0` → 422.
  - Evidência: `[Spec §US5-AC2]` "retorna 422 (PlanLimitsOverrideSchema rejeita negativos)"; `[contracts/super-admin-plans-api.md §PATCH tenant §Semântica]` case 4.

- [x] **`PlanLimitsInputSchema`** (PATCH de plano base) rejeita `limits.maxGroups=-1` → 422.
  - Evidência: `[Spec §US4-AC4]` "retorna 422 com details de validação Zod"; `[contracts/super-admin-plans-api.md §PATCH plan]` "422 quando limits.maxGroups = -1".

### SEC-3.2 — Dois schemas distintos (C1 / dec-008) previnem confusão input×storage

- [x] **`PlanLimitsOverrideSchema`** (persistência/leitura): aceita `null` (= usar default do plano).
  - Evidência: `[Spec §C1]` "PlanLimitsOverrideSchema = persistência/leitura — representa o shape salvo no banco. Campos: numéricos > 0 ou null".

- [x] **`PlanLimitsOverrideInputSchema`** (validação de borda PATCH): rejeita negativos, pode ter coerção adicional.
  - Evidência: `[Spec §C1]` "PlanLimitsOverrideInputSchema: schema de validação de input do endpoint PATCH. Campos inválidos (negativos, não-numéricos) → 422".

- [x] **`ZodValidationPipe`** customizado (sem libs 3rd-party) é o mecanismo de validação.
  - Evidência: `[CLAUDE.md]` "Custom ZodValidationPipe (~20 lines) — no third-party validation libs"; `[plan.md §Technical Context]` "Validação input: ZodValidationPipe custom (sem libs 3rd-party)".

### SEC-3.3 — `null` em override ≠ ilimitado (dupla semântica de `null`)

- [x] **Dois usos de `null` documentados** e claramente diferenciados:
  - (a) `plan_limits_override.field = null` → usar default do plano (não remover todo o override).
  - (b) `subscriptionPlan.limits.field = null` → ilimitado (enterprise) → mapeado para `Infinity` em `getLimits`.
  - Evidência: `[plan.md §GOTCHAS]` "null overload: dois usos distintos de null — (a) override field null = usar default do plano; (b) JSONB do plano null = ilimitado (→Infinity). Não confundir".

### SEC-3.4 — ID de plano no path (`planId`) deve ser UUID válido

- [Gap] **Spec não especifica** se `planId` no path de `PATCH /plans/:planId` é validado como UUID (formato). Sem validação, um path injection `PATCH /plans/../tenants` poderia explorar path traversal. **Recomendação**: create-tasks deve incluir validação `z.string().uuid()` para `planId` no pipe de validação do controller.

---

## SEC-4 — Cache Redis: confidencialidade e integridade

### SEC-4.1 — Namespace de cache segregado por tenant

- [x] **Chave `cache:plan-limits:{tenantId}`** segrega os limites por tenant no Redis.
  - Evidência: `[Spec §Technical Constraints]` "Cache namespace: cache:plan-limits:{tenantId} — write-through via SET (nunca DEL)".

### SEC-4.2 — Write-through (`SET`) proíbe stale data por `DEL` (C2)

- [x] **Proibição de `DEL`** previne janela de stale (cache-aside) onde outro processo poderia ler do DB com limites desatualizados após mudança de plano.
  - Evidência: `[Spec §C2]` / `[dec-009]` score 3 "SET obrigatorio (nao DEL), sincrono na request"; `[plan.md §Complexity Tracking]` "Cache write-through (não cache-aside c/ DEL) ... mudança reflete imediatamente, sem janela de stale".

### SEC-4.3 — Fallback de cache não expõe dados de outro tenant

- [x] **Fallback DB** usa `tenantId` como filtro (não lê todos os tenants); fallback final usa constantes hardcoded (não dados de runtime de outro tenant).
  - Evidência: `[contracts/plan-limits-service.md §getLimits]` "plan = getPlan(tenantId) (lê tenants.plan)" — isolado por `tenantId`; `[plan.md §Convenções de fallback]` "PLAN_LIMITS_FALLBACK (= os PLAN_LIMITS atuais de 3-3)".

### SEC-4.4 — Pipe síncrono de Redis (PATCH de plano) não escala dados de um tenant para outro

- [x] **Pipeline itera tenants DO plano** (não todos os tenants): `SET cache:plan-limits:{tenantId}` para tenants com `plan = plano.tier` apenas.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH plan §Efeito colateral]` "para cada tenant com plan = plano.tier, recomputa getLimits merged e faz SET cache:plan-limits:{tenantId}".

---

## SEC-5 — Downgrade não-destrutivo (dados existentes protegidos)

### SEC-5.1 — Guard só bloqueia criação, não deleta

- [x] **Guard** verifica `current < limit` — bloqueia criação quando limite atingido, mas nunca deleta ou desabilita recursos existentes.
  - Evidência: `[Spec §FR-INFRA-07]` "Downgrade NÃO-destrutivo: bloqueia criação de novos recursos; mantém acesso leitura aos excedentes"; `[contracts/plan-limits-service.md §hasCapacity]` "allowed = current < limit".

### SEC-5.2 — `membersPerGroup` short-circuit não cria bypass de segurança

- [x] **`hasCapacity('membersPerGroup')` → `{allowed:true}`** é comportamento PRESERVADO (não novo). O enforce real de `membersPerGroup` continua em `group-members.service` (story 10-4) — nenhuma regressão.
  - Evidência: `[Spec §US3-AC4]`; `[plan.md §GOTCHAS]` "Não regredir enforce manual por-grupo da 10-4"; `[contracts/plan-limits-service.md §hasCapacity]` "se resource === 'membersPerGroup': return {allowed:true,...} // short-circuit (US3 AC#4)".

---

## SEC-6 — Auditabilidade das mutações

### SEC-6.1 — Toda mudança de limite/override é auditada

- [x] **PATCH de plano base** → evento audit `{action:'plan_limits_override', resource:'subscription-plan', resourceId:planId}`.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH plan §Audit]`.

- [x] **PATCH de override por-tenant** → evento audit `{action:'plan_limits_override', resource:'tenant', resourceId:tenantId, newState:{planLimitsOverride}}`.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH tenant §Audit]`.

### SEC-6.2 — `AUDIT_ACTIONS` snapshot previne adição silenciosa de ação não-auditada

- [x] **Snapshot de `AUDIT_ACTIONS`** com `'plan_limits_override'` incluído — mudança futura quebra o snapshot (gate ativo).
  - Evidência: `[Spec §FR-INFRA-09]` "adicionar 'plan_limits_override' ao array existente em packages/types/src/audit/index.ts + snapshot"; `[plan.md §Project Structure]` `audit.snapshot.spec.ts [EDIT/CREATE]`.

---

## Sumário Security

| Categoria | Itens | Resolvidos | Gaps | Ambiguidades |
|-----------|-------|-----------|------|-------------|
| Autorização SUPER_ADMIN | 5 | 5 | 0 | 0 |
| RLS tenant-scoped | 4 | 4 | 0 | 0 |
| Validação de input | 5 | 4 | 1 Gap | 0 |
| Cache Redis | 4 | 4 | 0 | 0 |
| Downgrade não-destrutivo | 2 | 2 | 0 | 0 |
| Auditabilidade | 2 | 2 | 0 | 0 |
| **TOTAL** | **22** | **21** | **1** | **0** |

**Rastreabilidade: 95% (21/22). 1 gap** (SEC-3.4 — validação UUID do `planId` no path) → create-tasks deve incluir task de validação de path param.
