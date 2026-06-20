# Contract — Platform Metrics API (Super Admin / FR67)

Base: `GET /api/v1/admin/platform-metrics`
Guards: `KeycloakAuthGuard` + `RolesGuard` · `@Roles(Role.SUPER_ADMIN)`.
Não-`super_admin` → **403** `{ statusCode:403, error:'Forbidden', message:'Insufficient role permissions' }`.
Não autenticado → **401**.

## GET /api/v1/admin/platform-metrics/summary

Totais agregados de plataforma. Cache Redis `cache:platform-metrics:summary` TTL 300s.

**200**:
```json
{
  "data": {
    "totalTenants": 42,
    "totalUsers": 1380,
    "activeUsers": 902,
    "totalGroups": 210,
    "meetingsHeld": 5567,
    "storageBytesUsed": 10737418240,
    "newTenants": 3,
    "churnedTenants": 1,
    "netGrowth": 2,
    "refreshedAt": "2026-06-20T03:00:00.000Z"
  }
}
```
Zod: `PlatformMetricsSummarySchema`. Todos os campos presentes (sem `undefined`);
datas ISO 8601; `storageBytesUsed` é `number`.

## GET /api/v1/admin/platform-metrics/tenants

Lista paginada, uma linha por tenant.

**Query params** (validados por `PlatformMetricsTenantsQuerySchema`):
| Param | Tipo | Default | Notas |
|-------|------|---------|-------|
| `page` | int >=1 | 1 | |
| `limit` | int 1..100 | 20 | |
| `sortBy` | enum | `tenantName` | **whitelist** `PlatformMetricsTenantsSortFieldSchema` (anti SQL-injection) |
| `sortDir` | `asc`\|`desc` | `asc` | |
| `status` | `TenantStatusSchema` opcional | — | filtro por status do tenant |

`sortBy` ∈ `['tenantName','totalUsers','activeUsers','totalGroups','meetingsHeld','storageBytesUsed','tenantCreatedAt']`.
**NUNCA** interpolar `sortBy` bruto no SQL: mapear o enum validado → coluna fixa
(`Prisma.sql`/`Prisma.raw` somente sobre o nome de coluna pré-validado da whitelist).
Valores (`page`/`limit`/`status`) via `$queryRaw` tagged-template (parametrizado).

**200**:
```json
{
  "data": [
    {
      "tenantId": "0191...uuid-v7",
      "tenantName": "Igreja Exemplo",
      "tenantStatus": "active",
      "tenantCreatedAt": "2026-01-15T12:00:00.000Z",
      "totalUsers": 33,
      "activeUsers": 21,
      "totalGroups": 5,
      "meetingsHeld": 140,
      "storageBytesUsed": 524288000
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```
Zod: `PlatformMetricsTenantListSchema` (item) + envelope `{data:[], meta}`.

## Erros
- 400: query param inválido (ex: `sortBy` fora da whitelist) → `ZodValidationPipe`.
- 401 / 403: ver acima.
