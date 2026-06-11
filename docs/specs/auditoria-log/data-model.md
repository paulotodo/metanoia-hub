# Data Model: Log de Auditoria Imutável (auditoria-log)

## Entity: AuditEvent

Tabela `audit_events` (NOVA). Persistência: PostgreSQL com RLS append-only.
DB columns em snake_case via `@map`/`@@map`; DTO/Zod em camelCase (ver
`plan.md` §Convenções de Borda).

| Field (DTO camelCase) | DB column (snake_case) | Type | Constraints | Notes |
|-----------------------|------------------------|------|-------------|-------|
| id | id | UUID | PK | UUID v7 via `generateId()` (app-gerado, NÃO `@default(uuid())`) |
| tenantId | tenant_id | UUID | NOT NULL, scoping RLS | Resolvido via RequestContext, nunca param |
| userId | user_id | string (text) | NOT NULL | Identificador do usuário que originou a ação |
| action | action | enum string | NOT NULL, CHECK | `create \| update \| delete \| login \| export \| config_change` |
| resource | resource | string (text) | NOT NULL | Tipo da entidade (ex: "group", "user", "trail") |
| resourceId | resource_id | string (text) | NULL | ID do recurso afetado (null em bulk sem ID único) |
| ipAddress | ip_address | string (text/inet) | NOT NULL | IP do cliente no momento da ação |
| userAgent | user_agent | string (text) | NOT NULL | User agent do cliente |
| previousState | previous_state | JSONB | NULL | Snapshot antes da mudança; **null para creates**; truncado a 64KB |
| newState | new_state | JSONB | NULL | Snapshot após a mudança; **null para deletes**; truncado a 64KB |
| timestamp | timestamp | timestamptz | NOT NULL | ISO 8601 com timezone; momento exato da ação |
| severity | severity | enum string | NOT NULL, CHECK | `info \| warning \| critical` |

### Índices

- `idx_audit_events_tenant_timestamp` em `(tenant_id, timestamp DESC)` —
  obrigatório (FR-012), garante paginação server-side performática (SC-003:
  10k eventos, primeira página < 2s).

### RLS — append-only (imutável)

```sql
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

-- SOMENTE INSERT + SELECT. SEM UPDATE. SEM DELETE.
CREATE POLICY audit_events_tenant_insert ON audit_events
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY audit_events_tenant_select ON audit_events
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

- **Imutabilidade**: sem policy `FOR UPDATE`/`FOR DELETE`, o role da app não
  pode modificar/remover linhas — bloqueado pelo DB (US2, SC-002).
- **Isolamento**: SELECT tenant-scoped retorna só eventos do próprio tenant
  (US2 AC#3, SC-007). Super Admin lê cross-tenant via `prisma.client` direto
  (ver `research.md` Decision 3).

### Severity mapping (lógica de aplicação, não DB)

| Condição | severity |
|----------|----------|
| action = delete OU config_change | `critical` |
| action = update de papel/permissão (resource ∈ roles/permissions) | `warning` |
| action = create OU export OU update padrão OU login | `info` |

### Regras de captura (FR-001, FR-011)

- Capturar: POST, PUT, PATCH, DELETE de usuário **autenticado** (userId presente).
- NUNCA capturar: GET, HEAD, OPTIONS.
- NUNCA capturar: requests sem userId (endpoints públicos / pré-auth — Edge Case).
- Bulk: 1 request afetando N recursos → N audit events (1 por recurso), não agregado.
- `previousState` truncado a 64KB/campo com log de aviso; idem `newState`.

### State Transitions

Nenhuma. `AuditEvent` é **append-only e imutável**: criado uma vez, nunca
transiciona de estado. Retenção PERMANENTE (FR-INFRA-01 — nenhum auto-delete).

---

## Entity: AuditExportJob (derivado do padrão `reports/`)

NÃO é tabela persistida em PostgreSQL — estado do job vive em **Redis** com TTL
(espelha `reports/`). Representa um export assíncrono do log filtrado.

| Field (camelCase) | Type | Constraints | Notes |
|-------------------|------|-------------|-------|
| jobId | UUID | PK lógico | UUID v7 via `generateId()` |
| status | enum string | NOT NULL | `processing \| completed \| failed` |
| format | enum string | NOT NULL | `csv \| json` |
| filters | object (JSON) | NOT NULL | Filtros aplicados no momento do export (snapshot) |
| signedUrl | string | NULL | URL de download (MinIO/storage) quando `completed` |
| expiresAt | ISO 8601 string | NULL | Validade da signedUrl; mínimo 24h (SC-006) |
| failureReason | string | NULL | Preenchido quando `status = failed` |

### Relationships

- `AuditExportJob` referencia logicamente um conjunto de `AuditEvent` (via
  `filters`), mas NÃO há FK — o job é efêmero (Redis TTL), os eventos são
  permanentes (PostgreSQL).

### State Transitions

```
processing → completed   (worker termina, signedUrl gerada, expiresAt setado)
processing → failed      (worker falha após até 3 tentativas; failureReason setado)
```

- TTL Redis do registro de status ≥ TTL da signedUrl (`AUDIT_EXPORT_TTL_SECONDS
  = 86400` / 24h) + margem, espelhando `reports/` (`REPORTS_JOB_TTL_SECONDS + 300`).
- Até 3 tentativas em falha (FR-INFRA-03; BullMQ `attempts: 3`).

---

## Nota cross-story (fora de escopo, ver research.md Decision 8)

A Story 9-2 (anonimização LGPD) precisará substituir `user_id` por
`anonymous-<hash>` em `audit_events` — operação que conflita com a
imutabilidade append-only. **Resolvido na 9-2**, não aqui. O design da 9-3
não usa trigger BEFORE UPDATE para não impedir um futuro caminho privilegiado
(SECURITY DEFINER restrito a `user_id`, ou flag lógica `is_anonymized`).
