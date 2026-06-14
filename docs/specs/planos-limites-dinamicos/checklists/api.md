# Checklist: API — planos-limites-dinamicos (Story 11-1)

**Gerado por**: fase `checklist` (onda-004)
**Foco**: endpoints super-admin (`/api/v1/admin/super/plans` e override via `/admin/super/tenants/:id`)
**Fonte**: `contracts/super-admin-plans-api.md`, `spec.md §US4/US5`, `plan.md §Constitution Check IV`
**Legenda**: `[x]` resolvido | `[Gap]` sem cobertura | `[Ambiguity]` ambíguo | `[ ]` humano

---

## Rota 1: GET `/api/v1/admin/super/plans`

### API-1.1 — Prefixo e autenticação corretos

- [x] **Prefixo**: `@Controller('api/v1/admin/super/plans')` no controller novo `super-admin-plans.controller.ts`.
  - Evidência: `[Spec §FR-INFRA-01]` "Endpoints super-admin sob /api/v1/admin/super/plans"; `[contracts/super-admin-plans-api.md]` "Prefixo: /api/v1/admin/super".

- [x] **Autenticação em 3 camadas**: `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.SUPER_ADMIN)`.
  - Evidência: `[plan.md §Technical Context]` "Auth: Keycloak → KeycloakAuthGuard + RolesGuard + @Roles(Role.SUPER_ADMIN)"; `[contracts/super-admin-plans-api.md]` "Auth: KeycloakAuthGuard + RolesGuard + @Roles(Role.SUPER_ADMIN)".

### API-1.2 — Shape de resposta 200

- [x] **Sucesso `{data:[...]}`**: lista de 3 planos com campos `{id, name, tier, limits, features, metadata, isActive, tenantCount}`.
  - Evidência: `[Spec §US4-AC1]`; `[contracts/super-admin-plans-api.md §GET]` JSON de exemplo com todos os campos.

- [x] **`tenantCount`** derivado por `COUNT(tenants WHERE plan = tier)`, não persistido.
  - Evidência: `[contracts/super-admin-plans-api.md §GET]` nota explícita.

- [x] **Enterprise `limits.maxGroups=null`** serializado como `null` (NÃO `Infinity`) na resposta JSON.
  - Evidência: `[contracts/super-admin-plans-api.md §GET]` "enterprise limits.maxGroups = null ... é serializado como null no JSON (NÃO Infinity — o mapeamento null→Infinity é interno ao getLimits, não na API de planos)".

### API-1.3 — Erro 403 para não-SUPER_ADMIN

- [x] **ADMIN_TENANT** e qualquer role não-SUPER_ADMIN recebem 403 no `GET /plans`.
  - Evidência: `[Spec §US4-AC2]`; `[contracts/super-admin-plans-api.md §GET]` "ADMIN_TENANT/outros → 403".

### API-1.4 — Shape de erro (constitution IV)

- [x] **403 shape**: `{statusCode:403, error:"Forbidden", message:"...", details?}`.
  - Evidência: `[plan.md §Constitution Check IV]` "Contratos Zod em packages/types/src/plans/subscription.ts. Sucesso {data}; erro estruturado {statusCode, error, message, details}".

---

## Rota 2: PATCH `/api/v1/admin/super/plans/:planId`

### API-2.1 — Corpo da requisição e validação

- [x] **Body validado** por `ZodValidationPipe` com `PlanLimitsInputSchema` parcial.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH plan]` "Body validado por ZodValidationPipe com PlanLimitsInputSchema/parcial".

- [x] **Atualização parcial** de `limits`, `features`, `metadata`, `isActive` (não substitui o JSONB inteiro).
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH plan]` "Aceita atualização parcial de limits (merge com o existente), features, metadata, isActive".

- [x] **422** em `limits.maxGroups=-1` com `details` de Zod.
  - Evidência: `[Spec §US4-AC4]`; `[contracts/super-admin-plans-api.md §PATCH plan]` "422 quando limits.maxGroups = -1 (ou qualquer numérico inválido)".

### API-2.2 — Resposta 200 do PATCH

- [x] **Shape de resposta**: `{data:{id, tier, limits, features, metadata, isActive}}`.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH plan]` "200 Response: {data: {id, tier, limits, ...}}".

- [x] **Status HTTP 200** (não 201 — é mutação de recurso existente).
  - Evidência: `[plan.md §Constitution Check IV]` "PATCH retorna 200 (mutação de recurso existente, não 201)"; `[contracts/super-admin-plans-api.md §Códigos de status]`.

### API-2.3 — Write-through Redis (C2 / dec-009)

- [x] **Pipeline Redis**: para cada tenant com `plan=plano.tier`, faz `SET cache:plan-limits:{tenantId}` em batch síncrono.
  - Evidência: `[Spec §C2]` / `[dec-009]` score 3; `[contracts/super-admin-plans-api.md §PATCH plan §Efeito colateral]` "faz SET cache:plan-limits:{tenantId} via pipeline Redis (batch, síncrono). Nunca DEL. Sem BullMQ".

- [x] **Proibido `DEL`** (só `SET`).
  - Evidência: `[Spec §C2]`; `[plan.md §Convenções de Borda]` "Cache key: ... SET write-through, nunca DEL (C2)".

### API-2.4 — Audit evento no PATCH de plano

- [x] **Evento audit** gravado: `{action:'plan_limits_override', resource:'subscription-plan', resourceId:planId, newState}`.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH plan §Audit]` literal; `[Spec §FR-INFRA-09]` "'plan_limits_override' em AUDIT_ACTIONS".

- [Ambiguity] **`AuditService.createEvent` é fire-and-forget** — mas o contrato da API não especifica se falha de audit deve impedir a resposta 200. Padrão arquitetural existente em `plan.md §Technical Context` diz "fire-and-forget; nunca throw ao caller". **Ação**: create-tasks deve explicitar "audit não bloqueia 200" na task de integration test.

---

## Rota 3: PATCH `/api/v1/admin/super/tenants/:id` (estendida)

### API-3.1 — Campo `planLimitsOverride` no body

- [x] **`TenantPatchInputSchema` estendido** com `planLimitsOverride?: PlanLimitsOverrideInputSchema`.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH tenant]` "Body (TenantPatchInputSchema estendido com planLimitsOverride?: PlanLimitsOverrideInputSchema)"; `[plan.md §Project Structure]` "super-admin-tenant.ts [EDIT: TenantPatchInputSchema + planLimitsOverride]".

- [x] **Controller existente `super-admin-tenants.controller.ts` é estendido** (não recriado).
  - Evidência: `[Spec §FR-INFRA-01]` "Override por-tenant via PATCH no controller super-admin existente"; `[plan.md §Project Structure]` "super-admin-tenants.controller.ts [EDIT]".

### API-3.2 — Semântica dos 4 casos do override (C1/C5 / dec-008/dec-012)

- [x] **`{planLimitsOverride:{maxGroups:10}}`** → persiste override, Redis `SET` do valor merged (override>plano).
  - Evidência: `[Spec §US5-AC1]`; `[contracts/super-admin-plans-api.md §PATCH tenant §Semântica]` case 1.

- [x] **`{planLimitsOverride:{maxGroups:null}}`** → campo usa default do plano (override parcial sem aquele campo).
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH tenant §Semântica]` case 2; `[Spec §Technical Constraints]` "Override: null no campo = usar default do plano".

- [x] **`{planLimitsOverride:{}}`** → persiste `plan_limits_override=null`, tenant usa plano base integralmente.
  - Evidência: `[Spec §US5-AC3]`; `[Spec §C5]` / `[dec-012]` score 2; `[contracts/super-admin-plans-api.md §PATCH tenant §Semântica]` case 3.

- [x] **`{planLimitsOverride:{maxGroups:-5}}`** → 422.
  - Evidência: `[Spec §US5-AC2]`; `[contracts/super-admin-plans-api.md §PATCH tenant §Semântica]` case 4 "campo inválido → 422".

### API-3.3 — Resposta 200 do PATCH de tenant

- [x] **Shape**: `{data: TenantDetail}` onde `TenantDetail` inclui `planLimitsOverride` para leitura.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH tenant]` "200 Response: {data: TenantDetail} (TenantDetail inclui planLimitsOverride para leitura)"; `[plan.md §Project Structure]` "TenantDetailSchema + planLimitsOverride leitura".

### API-3.4 — Audit e Redis no PATCH de tenant

- [x] **Audit shape**: `{action:'plan_limits_override', resource:'tenant', resourceId:id, newState:{planLimitsOverride}}`.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH tenant §Audit]` literal.

- [x] **Redis `SET`** do valor merged — nunca DEL.
  - Evidência: `[contracts/super-admin-plans-api.md §PATCH tenant]` "SET cache:plan-limits:{id} ... Nunca DEL".

---

## Transversais de API

### API-T1 — Versionamento e prefixo correto

- [x] **Prefixo `/api/v1/`** em todos os endpoints desta story.
  - Evidência: `[CLAUDE.md]` "API versioned: /api/v1/ prefix from MVP"; `[Spec §FR-INFRA-01]` paths com `/api/v1/`.

### API-T2 — Não existem endpoints conflitantes

- [x] **Path `/api/v1/admin/super/plans`** não colide com path existente `/api/v1/admin/super/tenants`.
  - Evidência: `[Spec §FR-INFRA-01]` ambos documentados como distintos; `[plan.md §Technical Context]` "super-admin-tenants.controller.ts (@Controller('api/v1/admin/super/tenants'))".

### API-T3 — `TenantDetailSchema` inclui `planLimitsOverride` após esta story

- [x] **`packages/types/src/super-admin-tenant.ts`** estendido para leitura de `planLimitsOverride`.
  - Evidência: `[plan.md §Project Structure]` "super-admin-tenant.ts [EDIT: TenantPatchInputSchema + planLimitsOverride; TenantDetailSchema + planLimitsOverride leitura]".

### API-T4 — Não existe endpoint de remoção de override

- [x] **Remoção de override** feita via PATCH com `{}` (C5) — não há `DELETE /overrides`.
  - Evidência: `[Spec §C5]` "Não existe endpoint separado de 'remover override'; é via PATCH com {} ou campos nulos".

---

## Sumário API

| Rota | Itens | Resolvidos | Gaps | Ambiguidades |
|------|-------|-----------|------|-------------|
| GET /plans | 5 | 5 | 0 | 0 |
| PATCH /plans/:id | 5 | 5 | 0 | 1 Amb. |
| PATCH /tenants/:id | 7 | 7 | 0 | 0 |
| Transversais | 4 | 4 | 0 | 0 |
| **TOTAL** | **21** | **21** | **0** | **1** |

**Rastreabilidade: 100% (zero gaps). 1 ambiguidade** (API-2.4 — audit fire-and-forget) documentada para create-tasks.
