# Contracts: Audit Events (auditoria-log)

Contratos de interface externa da feature 9-3. Schemas Zod compartilhados em
`packages/types/src/audit/index.ts` (fonte da verdade FE+BE), com snapshot test.
Envelope de sucesso `{ data, meta? }`; erro `{ statusCode, error, message, details? }`.
Prefixo `/api/v1/`. Payloads em **camelCase**. Query params em **camelCase**
(ver `plan.md` §Convenções de Borda — decisão: camelCase para alinhar com o Zod
de `packages/types`, evitando uma camada de mapper kebab→camel).

---

## GET /api/v1/audit/events — Listar eventos (paginado, server-side)

**Method**: GET /api/v1/audit/events
**Auth**: Required (Keycloak JWT). Tenant-scoped por RLS (`withTenantTx`).
Para o viewer Super Admin cross-tenant, ver rota dedicada abaixo.

### Query params (camelCase)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| page | number | no | int ≥ 1, default 1 |
| perPage | number | no | int 1..50, default 50 (FR-005: 50/página) |
| action | enum | no | `create\|update\|delete\|login\|export\|config_change` |
| userId | string | no | filtra por usuário |
| dateFrom | string | no | ISO 8601 datetime com offset |
| dateTo | string | no | ISO 8601 datetime com offset |
| severity | enum | no | `info\|warning\|critical` |
| q | string | no | texto livre (busca em `resource`/descrição) |

> Todos os filtros aplicados **server-side** (FR-006). Filtros persistem entre
> páginas no FE (sticky filters — responsabilidade do viewer, não do contrato).

### Response (200)

```json
{
  "data": [ /* array de AuditEvent */ ],
  "meta": { "page": 1, "perPage": 50, "total": 1234, "totalPages": 25 }
}
```

`AuditEvent` (camelCase):

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | ID imutável do evento (UUID v7) |
| tenantId | uuid | Tenant do evento |
| userId | string | Usuário que originou a ação |
| action | enum | create\|update\|delete\|login\|export\|config_change |
| resource | string | Tipo da entidade |
| resourceId | string \| null | ID do recurso (null em bulk sem ID) |
| ipAddress | string | IP do cliente |
| userAgent | string | User agent |
| previousState | object \| null | Estado anterior (null em creates) |
| newState | object \| null | Estado posterior (null em deletes) |
| timestamp | string | ISO 8601 com timezone |
| severity | enum | info\|warning\|critical |

> **Contrato de null**: `resourceId`, `previousState`, `newState` SEMPRE
> presentes no payload, com valor `null` quando não aplicável (constitution §II:
> nunca `undefined`, null explícito).

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Query param inválido (Zod) |
| 401 | UNAUTHORIZED | Sem JWT válido |
| 403 | FORBIDDEN | Sem role para acessar audit |

---

## GET /api/v1/admin/super/audit/events — Viewer Super Admin (cross-tenant)

**Method**: GET /api/v1/admin/super/audit/events
**Auth**: `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.SUPER_ADMIN)`.
Cross-tenant via `prisma.client` direto (padrão `super-admin/` — research.md
Decision 3; **spike de 15min na FASE 0 do create-tasks confirma o mecanismo**).

### Query params

Mesmos do `GET /api/v1/audit/events` + `tenantId` opcional (filtrar por um tenant
específico no cross-tenant). Coluna `tenant` exibida na tabela do viewer (FR-005).

### Response (200)

Mesmo envelope `{ data: AuditEvent[], meta }`. `tenantId` sempre presente em cada
linha (necessário para a coluna "tenant" do viewer cross-tenant).

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | UNAUTHORIZED | Sem JWT |
| 403 | FORBIDDEN | Não é SUPER_ADMIN |

---

## POST /api/v1/admin/super/audit/export — Iniciar export assíncrono

**Method**: POST /api/v1/admin/super/audit/export
**Auth**: `@Roles(Role.SUPER_ADMIN)`. Padrão `reports/` (8-7): 202 + jobId.

### Request (camelCase)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| format | enum | yes | `csv\|json` |
| filters | object | no | Mesmos campos dos query params de listagem |

### Response (202 Accepted)

```json
{ "data": { "jobId": "0191...", "message": "Exportação em processamento. Consulte o status pelo jobId." } }
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | format ausente/inválido |
| 403 | FORBIDDEN | Não é SUPER_ADMIN |

---

## GET /api/v1/admin/super/audit/jobs/:jobId — Polling do status do export

**Method**: GET /api/v1/admin/super/audit/jobs/:jobId
**Auth**: `@Roles(Role.SUPER_ADMIN)`.

### Response (200)

```json
{
  "data": {
    "jobId": "0191...",
    "status": "processing | completed | failed",
    "signedUrl": "https://... | null",
    "expiresAt": "2026-06-12T19:00:00Z | null",
    "failureReason": "string | null"
  }
}
```

- `signedUrl`/`expiresAt` preenchidos quando `status = completed`. Validade da URL
  ≥ 24h (`AUDIT_EXPORT_TTL_SECONDS = 86400`, SC-006).
- Arquivo exportado contém **TODOS** os campos do `AuditEvent` (não só os
  visíveis na tabela — FR-007 AC#3).

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 404 | NOT_FOUND | jobId inexistente/expirado |
| 403 | FORBIDDEN | Não é SUPER_ADMIN |

---

## Evento de domínio (interno, não exposto)

Não há evento de domínio publicado por esta feature — o `AuditEvent` é o produto
final (registro persistido), não um evento de broker. O `AuditInterceptor` é a
fonte; o consumo é via os endpoints de leitura acima.

## Constantes compartilhadas (packages/types/src/audit/index.ts)

| Constante | Valor | Notas |
|-----------|-------|-------|
| AUDIT_EVENTS_PAGE_SIZE | 50 | FR-005 |
| AUDIT_EXPORT_QUEUE_NAME | `audit-export` | BullMQ (namespace `queue:*`) |
| AUDIT_EXPORT_TTL_SECONDS | 86400 | 24h (SC-006) |
| AUDIT_PAYLOAD_TRUNCATE_BYTES | 65536 | 64KB/campo (Edge Case) |
| AUDIT_ACTIONS | enum | create/update/delete/login/export/config_change |
| AUDIT_SEVERITIES | enum | info/warning/critical |
