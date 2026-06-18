# Contract — POST /api/v1/reports/tenant-summary/refresh

Dispara refresh on-demand da MV. Rate-limited 1/5min/tenant. **admin_tenant only.**

## Request

`POST /api/v1/reports/tenant-summary/refresh` (sem body).
Guard: `@Roles(Role.ADMIN_TENANT)`.

## Rate-limit

Chave Redis `rate:tenant-report-refresh:{tenantId}`, TTL 300s, set atômico (NX).
Dentro da janela → 429.

## Response 202 (aceito)

```json
{ "data": { "accepted": true, "jobId": "uuid" }, "meta": { "retryAfter": null } }
```
Enfileira job `refresh-tenant-views` em `queue:reports`.

## Response 429 (rate-limited)

Header `Retry-After: <segundos>`.
```json
{ "data": { "accepted": false, "jobId": null }, "meta": { "retryAfter": 215 } }
```
UI mostra toast PT-BR: "Atualização disponível em X minutos".

## Erros

| Status | Quando |
|--------|--------|
| 403 | role ≠ admin_tenant |
| 429 | rate-limit (1/5min/tenant) |
