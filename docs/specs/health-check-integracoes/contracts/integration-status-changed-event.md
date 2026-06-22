# Contract: Domain Event — system.integration.status-changed

Emitido pelo `health-check.processor.ts` quando o debounce confirma uma mudança de status
(2 checks consecutivos, FR-006). Canal Redis pub/sub: `rt:notifications:integration-status-changed`.
Evento de **plataforma** → `tenantId: null`. Formato de evento de domínio do projeto
(Princípio IV): `{ eventId, eventType, version, tenantId, timestamp, data, metadata }`.

```json
{
  "eventId": "<uuidv7>",
  "eventType": "system.integration.status-changed",
  "version": 1,
  "tenantId": null,
  "timestamp": "<ISO 8601>",
  "data": {
    "integrationName": "resend",
    "previousStatus": "healthy",
    "newStatus": "unhealthy",
    "latencyMs": 5432,
    "consecutiveChecks": 2
  },
  "metadata": { "correlationId": "<uuidv7>" }
}
```

| Campo (`data`) | Tipo | Notas |
|----------------|------|-------|
| `integrationName` | string | uma das 5 integrações |
| `previousStatus` | enum | baseline antes da mudança |
| `newStatus` | enum | status confirmado pelo debounce |
| `latencyMs` | int | latência do check que confirmou |
| `consecutiveChecks` | int | sempre ≥ 2 (debounce) |

## Efeitos colaterais da emissão (FR-007)

1. **Notificação por Super Admin** (resolvidos via `KeycloakAdminService.getUsersByRealmRole('super_admin')`
   → mapear keycloakId→userId local): `NotificationsService.dispatch({ userId, type: 'system',
   channels: ['in_app'], title: '⚠️ {integrationName} está {status}', body: 'Latência: {latencyMs}ms |
   Verificado: {lastChecked}', metadata: { correlationId } })` — **dentro de** `requestContext.run({
   tenantId: <tenant do destinatário>, userId: 'system', requestId, correlationId }, cb)`.
2. **Audit** (`AuditService.create`): `action: 'INTEGRATION_STATUS_CHANGED'`, `resource:
   'integration_health'`, `resourceId: integrationName`, `userId: null` (sistema), `newState:
   { integrationName, previousStatus, newStatus, latencyMs }`, `correlation_id`.

Vocabulário pastoral PT-BR nos textos user-facing (título/corpo via `pt-BR.json`
`health.integrations.*`).
