# Quickstart / Cenários de Teste — feature-toggles-tenant (Story 11-3)

Cenários críticos. Mapeiam aos testes obrigatórios da spec §9 e aos AC §12.

---

## Cenário 1 — GET retorna defaults (happy, sem linha)

1. Tenant Pro sem linha `tenant_policies`, `focus_indicator_enabled = false`.
2. `GET /api/v1/tenants/me/policies` como ADMIN_TENANT.
3. **Expected:** 200, `data.policies` = POLICY_DEFAULTS
   (`focusMonitoring:false, mandatoryCamera:false, sequentialTrailAccess:false, autoPresenceTracking:true, expressMode:true`),
   `tierInfo` completo, header `X-Policy-Version: 1`.

## Cenário 2 — GET merge com linha parcial

1. `tenant_policies.policies = { "mandatoryCamera": true }`; resto ausente.
2. `GET /me/policies`.
3. **Expected:** `mandatoryCamera:true`, demais via defaults; `focusMonitoring` =
   `tenant.focusIndicatorEnabled` (não do JSONB).

## Cenário 3 — PATCH happy + write-through + version bump

1. Tenant Pro, `policyVersion` atual = 1.
2. `PATCH /me/policies` body `{ "expressMode": false }`.
3. **Expected:** 200, `data.policyVersion = 2`, header `X-Policy-Version: 2`;
   Redis `cache:policies:{tenantId}` recebe `SET` com version 2; audit
   `createEvent(action='policy_change')` chamado com `previousState`/`newState`.

## Cenário 4 — Tier gating 403 no Free (error)

1. Tenant **Free** (`getPlan() === 'free'`).
2. `PATCH /me/policies` body `{ "mandatoryCamera": true }` (toggle Pro).
3. **Expected:** 403 `ForbiddenException`, mensagem acionável de upgrade;
   nenhuma escrita em banco/Redis; nenhum audit.

## Cenário 5 — focusMonitoring escreve na coluna tenants (não JSONB)

1. `PATCH /me/policies` body `{ "focusMonitoring": true }` (tenant Pro).
2. **Expected:** `UPDATE tenants SET focus_indicator_enabled = true`;
   `tenant_policies.policies` NÃO contém `focusMonitoring`; transita OFF→ON →
   `EventEmitter2.emit('focus-monitoring.enabled')`.

## Cenário 6 — Consent exemption (runtime, não no endpoint)

1. focusMonitoring ON no tenant; usuário U com
   `hasActiveWithdrawal(U, 'focus_monitoring') === true`.
2. **Expected (endpoint):** GET ainda retorna `focusMonitoring: true`
   (estado do tenant, dec-008). **Expected (runtime consumer):** feature de foco
   NÃO ativa para U; banner não exibido a U.

## Cenário 7 — RLS isolation

1. Linha de `tenant_policies` para Tenant A; sessão bound a Tenant B.
2. **Expected:** `findFirst` da linha de A → vazio para B; `update`/`insert`
   cross-tenant bloqueado; sem `SET LOCAL app.current_tenant_id` → resultado vazio
   (não erro). Pattern `group-members.rls-spec.ts`.

---

## Roundtrip End-to-End (obrigatório — borda BE↔FE)

1. PATCH **real** ao backend `PATCH /api/v1/tenants/me/policies` body
   `{ "autoPresenceTracking": false }` (tenant Pro autenticado).
2. Capturar payload de resposta REAL (não mock/fixture) + header.
3. **Expected:**
   - Body parseia contra `PoliciesResponseSchema` (`data.policies` camelCase,
     `data.policyVersion` int positivo).
   - Header `X-Policy-Version` === `data.policyVersion` (string).
   - `data.policies.autoPresenceTracking === false`.
   - Nenhum campo snake_case no payload (protege contra drift de case).
4. FE: `useUpdatePolicies` `onSuccess` lê header; se difere do cache →
   `invalidateQueries(['policies'])`.

---

## Snapshot gates

- `TenantPoliciesSchema` + `PoliciesResponseSchema` — snapshot test
  (`packages/types/src/policies/tenant-policies.spec.ts`).
- `AUDIT_ACTIONS` contém `'policy_change'` — snapshot inline atualizado.
