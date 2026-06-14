# Contract: Super-Admin Plans API (Story 11-1)

Prefixo: `/api/v1/admin/super`. Auth: `KeycloakAuthGuard` + `RolesGuard` +
`@Roles(Role.SUPER_ADMIN)`. Erros no shape constitution IV:
`{ statusCode, error, message, details? }`. Sucesso `{ data }`.

Controller novo: `super-admin-plans.controller.ts` (`@Controller('api/v1/admin/super/plans')`).
PATCH de override reusa `super-admin-tenants.controller.ts` existente (estendido).

---

## GET `/api/v1/admin/super/plans`

Lista os 3 planos com contagem de tenants por plano.

- **Auth:** SUPER_ADMIN. ADMIN_TENANT/outros → **403**.
- **200 Response:**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "name": "Free",
        "tier": "free",
        "limits": { "maxGroups": 3, "maxMembersPerGroup": 30, "maxLeadersPerTenant": 5 },
        "features": {},
        "metadata": { "priceBRL": 0 },
        "isActive": true,
        "tenantCount": 12
      }
      // pro, enterprise...
    ]
  }
  ```
- `tenantCount`: derivado (`COUNT(tenants WHERE plan = tier)`), não persistido.
- enterprise `limits.maxGroups = null` (ilimitado) é serializado como `null` no JSON
  (NÃO `Infinity` — o mapeamento `null→Infinity` é interno ao `getLimits`, não na API de planos).

**Acceptance:** US4 AC#1 (lista 3 + tenantCount), AC#2 (403 para não-SUPER_ADMIN).

---

## PATCH `/api/v1/admin/super/plans/:planId`

Edita limites/features/metadata de um plano. Write-through Redis para todos os
tenants do plano.

- **Auth:** SUPER_ADMIN.
- **Body** (validado por `ZodValidationPipe` com `PlanLimitsInputSchema`/parcial):
  ```json
  { "limits": { "maxGroups": 5 } }
  ```
  Aceita atualização parcial de `limits` (merge com o existente), `features`, `metadata`, `isActive`.
- **200 Response:** `{ "data": { "id", "tier", "limits", "features", "metadata", "isActive" } }`
- **422** quando `limits.maxGroups = -1` (ou qualquer numérico inválido): Zod error em `details`.
- **Efeito colateral (C2):** para cada tenant com `plan = plano.tier`, recomputa
  `getLimits` merged e faz `SET cache:plan-limits:{tenantId}` via **pipeline Redis**
  (batch, síncrono). Nunca `DEL`. Sem BullMQ.
- **Audit:** evento `{ action: 'plan_limits_override', resource: 'subscription-plan', resourceId: planId, newState }`.

**Acceptance:** US4 AC#3 (DB+Redis write-through), AC#4 (422 em -1).

---

## PATCH `/api/v1/admin/super/tenants/:id` (estendido)

O controller existente passa a aceitar `planLimitsOverride` no body.

- **Auth:** SUPER_ADMIN.
- **Body** (`TenantPatchInputSchema` estendido com `planLimitsOverride?: PlanLimitsOverrideInputSchema`):
  ```json
  { "planLimitsOverride": { "maxGroups": 10 } }
  ```
- **200 Response:** `{ "data": TenantDetail }` (TenantDetail inclui `planLimitsOverride` para leitura).
- **Semântica:**
  - `{ planLimitsOverride: { maxGroups: 10 } }` → persiste override; merge override>plano; Redis `SET` do valor merged.
  - `{ planLimitsOverride: { maxGroups: null } }` → campo usa default do plano (não remove o objeto).
  - `{ planLimitsOverride: {} }` → persiste `plan_limits_override = null` (C5/dec-012): zera override.
  - campo inválido (`{ maxGroups: -5 }`) → **422** (`PlanLimitsOverrideInputSchema` rejeita negativos).
- **Efeito colateral:** `SET cache:plan-limits:{id}` com valor merged (write-through). Nunca DEL.
- **Audit:** `{ action: 'plan_limits_override', resource: 'tenant', resourceId: id, newState: { planLimitsOverride } }`.

**Acceptance:** US5 AC#1 (override+audit+Redis), AC#2 (422 em -5), AC#3 (`{}`→200 sem override), AC#4 (precedência override).

---

## Códigos de status (constitution IV)

| Operação | Sucesso | Erro auth | Erro validação |
|----------|---------|-----------|----------------|
| GET plans | 200 | 403 | — |
| PATCH plan | 200 (mutação) | 403 | 422 |
| PATCH tenant override | 200 | 403 | 422 |
