# Data Model — Métricas de Plataforma (FR67)

## Entity: TenantStorageUsage (tabela `tenant_storage_usage`)

Model Prisma novo (auto-mapping via `@map`). Por-tenant, COM RLS.

| Campo (Prisma) | Coluna DB | Tipo | Null | Notas |
|----------------|-----------|------|------|-------|
| `tenantId` | `tenant_id` | `String @db.Uuid` | não | **PK** (uma linha por tenant) |
| `bytesUsed` | `bytes_used` | `BigInt` | não | default `0`; incrementado no hook de upload |
| `updatedAt` | `updated_at` | `DateTime @db.Timestamptz` | não | default `now()`, atualizado no UPSERT |

```prisma
model TenantStorageUsage {
  tenantId  String   @id @map("tenant_id") @db.Uuid
  bytesUsed BigInt   @default(0) @map("bytes_used")
  updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamptz

  @@map("tenant_storage_usage")
}
```

**RLS**: `ENABLE` + `FORCE ROW LEVEL SECURITY`; policy `tenant_isolation` closed-by-default
(`tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`) em USING e
WITH CHECK. **Isolation spec obrigatório** (`tenant-storage-usage.rls-spec.ts`).

**Serialização**: `BigInt` não é JSON-nativo → o service converte para `number` (bytes
cabem em `Number.MAX_SAFE_INTEGER` para o MVP) ou `string` no DTO. Decisão: **`number`**
(storage por tenant << 9 PB). Documentado no contrato.

## Entity: mv_platform_metrics (materialized view — NÃO é model Prisma)

Cross-tenant, SEM RLS, refreshed por privileged client. Uma linha por tenant.

| Coluna | Tipo | Origem |
|--------|------|--------|
| `tenant_id` | uuid | `tenants.id` (UNIQUE INDEX) |
| `tenant_name` | text | `tenants.name` |
| `tenant_status` | varchar | `tenants.status` |
| `tenant_created_at` | timestamptz | `tenants.created_at` |
| `total_users` | int | `COUNT(users)` por tenant |
| `active_users` | int | users com `last_seen_at` no mês corrente |
| `total_groups` | int | `COUNT(groups)` |
| `meetings_held` | int | meetings `status IN ('ended','realizado')` |
| `storage_bytes_used` | bigint | `COALESCE(tenant_storage_usage.bytes_used, 0)` |
| `active_current_month` | bool | flag p/ churn |
| `active_prev_month` | bool | flag p/ churn |
| `refreshed_at` | timestamptz | `now()` no refresh |

Lida no service via `$queryRaw` (snake_case) → mapeada para DTO camelCase.

## Derived: PlatformMetricsSummary (computado, não persistido)

Agregação SQL sobre `mv_platform_metrics` (ver research Decision 2): `totalTenants`,
`totalUsers`, `activeUsers`, `totalGroups`, `meetingsHeld`, `storageBytesUsed`,
`churnedTenants`, `newTenants`, `netGrowth` (= `newTenants - churnedTenants`),
`refreshedAt`. Cacheado em Redis 300s.

## State transitions

- `TenantStorageUsage`: criada no 1º upload do tenant (UPSERT); `bytes_used` monotônico
  crescente no MVP (decremento = follow-up no `delete()`).
- `mv_platform_metrics`: estado materializado; transição = `REFRESH CONCURRENTLY` a cada
  15min (child job). Sem mutação direta.
