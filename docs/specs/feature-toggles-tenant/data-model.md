# Data Model — feature-toggles-tenant (Story 11-3)

## Entity: TenantPolicies

Tabela nova `tenant_policies`. Relação 0..1 com `Tenant` (uma linha por tenant,
opcional — defaults em código quando ausente).

| Campo | Tipo (Prisma) | Coluna DB | Notas |
|-------|---------------|-----------|-------|
| `id` | `String @db.Uuid` | `id` | PK. Gerado via `uuidv7()` no service (NÃO `@default(uuid())`). |
| `tenantId` | `String @db.Uuid` | `tenant_id` | `@unique`. FK→`tenants.id`. |
| `policies` | `Json` | `policies` (jsonb) | Só os 4 toggles novos. `DEFAULT '{}'`. |
| `policyVersion` | `Int @default(1)` | `policy_version` | Incrementa em TODO PATCH (dec-010). |
| `createdAt` | `DateTime @default(now())` | `created_at` (timestamptz) | |
| `updatedAt` | `DateTime @updatedAt` | `updated_at` (timestamptz) | Via Prisma `@updatedAt`, SEM `trigger_set_timestamp`. |

### Relacionamentos
- `Tenant 1 ──0..1 TenantPolicies` via `tenantId @unique`.
- FK: `ON DELETE CASCADE ON UPDATE CASCADE` (FK→tenants; invariante cascade-users
  não se aplica, mas mantém o padrão do projeto).
- `Tenant` recebe `policies TenantPolicies?` no schema.

### RLS
- `ALTER TABLE tenant_policies ENABLE ROW LEVEL SECURITY`.
- Policy `tenant_policies_isolation`:
  `USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)`.
- Acesso via `withTenantTx` (seta `SET LOCAL app.current_tenant_id`).
- RLS isolation spec obrigatória: `apps/api/test/rls/tenant-policies.rls-spec.ts`.

### JSONB `policies` — shape (4 toggles novos)
```jsonc
{
  "mandatoryCamera": false,        // Pro
  "sequentialTrailAccess": false,  // Free
  "autoPresenceTracking": true,    // Free
  "expressMode": true              // Free
}
```
`focusMonitoring` NÃO entra no JSONB — ver mapeamento abaixo.

---

## Mapeamento: `focusMonitoring` ↔ `tenant.focus_indicator_enabled`

Coluna `tenant.focusIndicatorEnabled Boolean @default(false)` JÁ existe
(schema.prisma:274, Epic 5 — fonte de verdade). Nenhuma migration a toca.

| Operação | Comportamento |
|----------|---------------|
| GET policies | lê `tenant.focusIndicatorEnabled` → expõe como `focusMonitoring` no payload. |
| PATCH policies com `focusMonitoring` | `UPDATE tenants SET focus_indicator_enabled = $1` (não toca JSONB). |

Tier: `focusMonitoring` requer Pro.

---

## Defaults (convention-over-config — dec D4)
```ts
const POLICY_DEFAULTS = {
  focusMonitoring: false,        // via tenant.focusIndicatorEnabled
  mandatoryCamera: false,        // JSONB
  sequentialTrailAccess: false,  // JSONB
  autoPresenceTracking: true,    // JSONB
  expressMode: true,             // JSONB
};
```
Merge no GET: `{ ...POLICY_DEFAULTS, ...(row?.policies ?? {}), focusMonitoring: tenant.focusIndicatorEnabled }`.

---

## State transitions (policyVersion)
- Linha ausente → defaults; `policyVersion` lógico = 1.
- Cada PATCH bem-sucedido → `policyVersion += 1` (incondicional, dec-010).
- FE compara `X-Policy-Version` da resposta vs cache → invalida query se difere.

---

## Migration (esboço)
```sql
CREATE TABLE "tenant_policies" (
  "id"             uuid NOT NULL,
  "tenant_id"      uuid NOT NULL UNIQUE,
  "policies"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "policy_version" integer NOT NULL DEFAULT 1,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_policies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "tenant_policies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_policies_isolation" ON "tenant_policies"
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
```
Guardrail: SEM `trigger_set_timestamp()` (updatedAt via Prisma `@updatedAt`).

---

## Audit (entidade de evento)
- Nova action `'policy_change'` em `AUDIT_ACTIONS` (`packages/types/src/audit/index.ts`).
- `createEvent({ userId, action:'policy_change', resource:'tenant_policies', resourceId, payload:{ previousState, newState } })`.
- `tenantId` resolvido pelo AuditService via RequestContext (não no payload).
- Severidade: default `info` (não é mudança de role).
