# Contract — GET /api/v1/reports/tenant-summary

Relatório agregado por tenant. Lê `mv_tenant_report` (períodos fixos) ou query ao
vivo (custom). **admin_tenant only.**

## Request

`GET /api/v1/reports/tenant-summary`

| Query param | Tipo | Obrigatório | Notas |
|-------------|------|-------------|-------|
| `period` | `7d`\|`30d`\|`90d`\|`custom` | sim | `custom` exige `startDate`+`endDate` |
| `startDate` | ISO date | se custom | |
| `endDate` | ISO date | se custom | `startDate < endDate` |
| `groupId` | uuid | não | filtra um grupo específico |
| `status` | `verde`\|`amarelo`\|`vermelho` | não | filtra grupos por semáforo |

Guard: `@Roles(Role.ADMIN_TENANT)`. Validação: `ZodValidationPipe(TenantSummaryQuerySchema)`.

## Isolamento (CRÍTICO)

Query roda em `withTenantTx`; `SET LOCAL app.current_tenant_id` + filtro explícito
`WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`
na leitura da MV. `tenant_id` NUNCA aparece no payload.

## Response 200

```json
{
  "data": {
    "groups": [
      { "groupId": "uuid", "groupName": "GC Centro", "leaderName": "Ana",
        "attendanceAvgPercent": 0.82, "trailProgressAvgPercent": 64,
        "riskCount": 2, "activeParticipants": 18, "semaforo": "amarelo" }
    ],
    "summary": {
      "totalGroups": 12, "totalLeaders": 10, "totalParticipants": 210,
      "overallAttendancePercent": 0.79, "overallTrailProgressPercent": 61,
      "totalRiskCount": 7
    }
  },
  "meta": {
    "period": "30d", "startDate": null, "endDate": null,
    "lastRefreshAt": "2026-06-18T01:00:00Z", "stale": false,
    "fromMaterializedView": true
  }
}
```

- `semaforo` por grupo = MAIORIA do status dos participantes, **floor amarelo se
  `riskCount > 0`** (dec-011).
- `stale = (now() - lastRefreshAt) > 20min` (dec-012).
- `period=custom` → `fromMaterializedView: false` (query ao vivo).

## Erros

| Status | Quando |
|--------|--------|
| 400 | `period=custom` sem datas / `startDate>=endDate` / status inválido |
| 403 | role ≠ admin_tenant |
