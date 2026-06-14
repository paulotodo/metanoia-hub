# Contrato — Policies API (Story 11-3)

Endpoints REST `/api/v1/tenants/me/policies`. Admin-only
(`KeycloakAuthGuard` + `RolesGuard(@ADMIN_TENANT)`). Envelope `{ data }`.

Schemas Zod compartilhados: `packages/types/src/policies/tenant-policies.ts`.

```ts
TenantPoliciesSchema = {
  focusMonitoring, mandatoryCamera, sequentialTrailAccess,
  autoPresenceTracking, expressMode  // todos z.boolean()
}
UpdatePoliciesSchema = TenantPoliciesSchema.partial()
PoliciesResponseSchema = {
  policies: TenantPoliciesSchema,
  policyVersion: z.number().int().positive(),
  tierInfo: { <toggle>: { requiresPlan: z.literal('pro'|'free') } }
}
```

---

## GET /api/v1/tenants/me/policies

Retorna SEMPRE 200 com `tierInfo` completo (dec-012). `focusMonitoring` reflete
`tenant.focusIndicatorEnabled` (estado do tenant, não filtra por usuário — dec-008).

**Request:** sem body.

**Response 200:**
```jsonc
{
  "data": {
    "policies": {
      "focusMonitoring": false,
      "mandatoryCamera": false,
      "sequentialTrailAccess": false,
      "autoPresenceTracking": true,
      "expressMode": true
    },
    "tierInfo": {
      "focusMonitoring": { "requiresPlan": "pro" },
      "mandatoryCamera": { "requiresPlan": "pro" },
      "sequentialTrailAccess": { "requiresPlan": "free" },
      "autoPresenceTracking": { "requiresPlan": "free" },
      "expressMode": { "requiresPlan": "free" }
    }
  }
}
```
**Header:** `X-Policy-Version: <int>`.

**Erros:** 401 (não autenticado), 403 (não ADMIN_TENANT). NÃO há 403 por tier no GET.

---

## PATCH /api/v1/tenants/me/policies

Atualização parcial (partial). Incrementa `policyVersion` em todo PATCH (dec-010).

**Request body** (`UpdatePoliciesSchema`, validado por `ZodValidationPipe`):
```jsonc
{ "mandatoryCamera": true, "expressMode": false }   // qualquer subconjunto
```

**Response 200:**
```jsonc
{
  "data": {
    "policies": { /* estado merged completo */ },
    "policyVersion": 2
  }
}
```
**Header:** `X-Policy-Version: <novo int>`.

**Erros:**
| Código | Causa |
|--------|-------|
| 400 | body falha `UpdatePoliciesSchema` (`ZodValidationPipe`). |
| 401 | não autenticado. |
| 403 (role) | não ADMIN_TENANT. |
| 403 (tier) | tenant Free tentando ativar toggle Pro (`focusMonitoring`/`mandatoryCamera`). Mensagem acionável (i18n `upgradePrompt`). EXCLUSIVO do PATCH. |

**Efeitos colaterais:**
1. `focusMonitoring` → `UPDATE tenants SET focus_indicator_enabled`.
2. Demais toggles → UPSERT `tenant_policies.policies` (JSONB merge).
3. Redis write-through `SET cache:policies:{tenantId}` `{policies, policyVersion}` `EX 3600`.
4. Audit: `createEvent(action='policy_change', payload={previousState, newState})`.
5. `focusMonitoring` OFF→ON → `EventEmitter2.emit('focus-monitoring.enabled')`
   (aciona transparency banner via consumer de reuniões — dec-009).

---

## Convenção de case
Todo o payload (request/response) e keys do JSONB são **camelCase** (Zod é a
fonte da verdade). Header `X-Policy-Version` é Train-Case. Colunas DB são
snake_case (mapeadas por Prisma `@map`). Ver plan.md §Convenções de Borda.
