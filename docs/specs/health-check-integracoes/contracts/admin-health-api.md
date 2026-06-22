# Contract: Admin Health API

Endpoints REST do dashboard de health-check. Prefixo `/api/v1/` (Princípio IV).
Auth: `KeycloakAuthGuard` + `RolesGuard(@Roles('super_admin'))` → **403** para qualquer
outro role autenticado. Envelope `{ data, meta? }`. Case: camelCase. Validação: Zod
(`packages/types/src/integration-health.ts`).

---

## GET /api/v1/admin/health/integrations

Executa as 5 probes **on-demand** (dados frescos ao abrir o dashboard), em paralelo
(`Promise.all`, NFR-I5 < 6s total). NÃO lê o status imediato do banco (o banco é fonte
do histórico/sparkline, não do status live).

**Request:** sem body, sem query obrigatória.

**Auth:** super_admin. 403 caso contrário.

**Response 200:**
```json
{
  "data": {
    "integrations": [
      { "name": "resend",     "status": "healthy",   "latencyMs": 142,  "lastChecked": "2026-06-22T03:44:08Z", "message": null },
      { "name": "keycloak",   "status": "healthy",   "latencyMs": 88,   "lastChecked": "2026-06-22T03:44:08Z", "message": null },
      { "name": "minio",      "status": "degraded",  "latencyMs": 2310, "lastChecked": "2026-06-22T03:44:08Z", "message": "High latency" },
      { "name": "redis",      "status": "healthy",   "latencyMs": 4,    "lastChecked": "2026-06-22T03:44:08Z", "message": null },
      { "name": "postgresql", "status": "healthy",   "latencyMs": 11,   "lastChecked": "2026-06-22T03:44:08Z", "message": null }
    ],
    "summary": { "total": 5, "healthy": 4, "degraded": 1, "unhealthy": 0 }
  }
}
```

**Response 403:**
```json
{ "statusCode": 403, "error": "Forbidden", "message": "Acesso negado" }
```

**Classificação (server-side):**
- `healthy`: `latencyMs < 1000`
- `degraded`: `1000 <= latencyMs <= 5000`
- `unhealthy`: `latencyMs > 5000` **ou** qualquer erro/timeout

**Schema (Zod):** `IntegrationHealthResponseSchema`.

**NFR-SEC-001:** `message` é sanitizado — sem stack trace, sem URL/host interno, sem `RESEND_API_KEY`.

---

## GET /api/v1/admin/health/integrations/history

Histórico de uma integração (sparkline 24h). Lê de `integration_health_log` ordenado por
`checkedAt DESC`, usando o index `(integration_name, checked_at DESC)`.

**Query params:**
| Param | Tipo | Obrigatório | Default | Notas |
|-------|------|-------------|---------|-------|
| `integration` | string | sim | — | `resend\|keycloak\|minio\|redis\|postgresql` |
| `hours` | int | não | 24 | máx 72; limite de pontos = `hours * 12` |

**Auth:** super_admin. 403 caso contrário.

**Response 200:**
```json
{
  "data": {
    "integration": "resend",
    "points": [
      { "checkedAt": "2026-06-22T03:44:00Z", "status": "healthy", "latencyMs": 142, "message": null }
    ]
  },
  "meta": { "total": 288, "integration": "resend", "hours": 24 }
}
```

**Validação de query:** `ZodValidationPipe` com `IntegrationHistoryQuerySchema`
(`integration` enum, `hours` int 1..72). `integration` inválido → 400.

**Schema do ponto (Zod):** `IntegrationHealthHistoryPointSchema`.

---

## Códigos de status

| Situação | Status |
|----------|--------|
| Sucesso (leitura) | 200 |
| Role não super_admin | 403 |
| Query param inválido (`/history`) | 400 |
| Não autenticado | 401 |
