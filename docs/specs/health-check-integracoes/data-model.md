# Data Model (Phase 1): health-check-integracoes

## Entity: IntegrationHealthLog (persistido — PostgreSQL)

Tabela **platform-level** (SEM `tenant_id`, ver plan.md §Complexity Tracking / D-001).
Registra um ponto histórico de saúde por integração por check (a cada 5 min).

### Prisma model
```prisma
/// IntegrationHealthLog — platform-level (sem tenant_id, ver D-001).
/// Worker escreve via createPrivilegedClient() (BYPASSRLS). Endpoint lido por Super Admin via guard.
model IntegrationHealthLog {
  id              String   @id @db.Uuid
  integrationName String   @map("integration_name") @db.VarChar(64)
  status          IntegrationHealthStatus
  latencyMs       Int      @map("latency_ms")
  message         String?  @db.Text
  checkedAt       DateTime @default(now()) @map("checked_at") @db.Timestamptz

  @@index([integrationName, checkedAt(sort: Desc)], name: "integration_health_log_name_checked_idx")
  @@map("integration_health_log")
}

enum IntegrationHealthStatus {
  healthy
  degraded
  unhealthy

  @@map("integration_health_status")
}
```

### Campos
| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `id` | UUID (v7) | sim | Gerado por `uuidv7()` no worker — NUNCA `@default(uuid())` (Princípio II). |
| `integrationName` | string (varchar 64) | sim | `resend` \| `keycloak` \| `minio` \| `redis` \| `postgresql`. |
| `status` | enum `IntegrationHealthStatus` | sim | `healthy` \| `degraded` \| `unhealthy`. |
| `latencyMs` | int (≥0) | sim | Latência medida com `performance.now()` (sem setup de conexão reutilizada). |
| `message` | text | não (`null`) | Mensagem sanitizada em erro/degradação — sem stack/secret/IP interno. `null` explícito quando healthy. |
| `checkedAt` | timestamptz | sim | `DEFAULT now()`; ISO 8601 na serialização. |

### Index
- `integration_health_log_name_checked_idx` em `(integration_name, checked_at DESC)` —
  serve a query de histórico (sparkline, FR-004) e a leitura do último status por integração.

### RLS (toca policy → exige RLS isolation spec, Princípio VI)
```sql
ALTER TABLE integration_health_log ENABLE ROW LEVEL SECURITY;

-- Leitura: visibilidade global (tabela de plataforma; sem filtragem por tenant).
CREATE POLICY platform_read ON integration_health_log
  FOR SELECT USING (true);

-- Escrita: SOMENTE via cliente privilegiado (DATABASE_URL → metanoia_admin BYPASSRLS).
-- Nenhuma policy de INSERT/UPDATE para roles não-privilegiadas (negado por default sob RLS).
-- NÃO usar SET LOCAL app.current_role (GUC inexistente).
```

RLS spec: `apps/api/prisma/rls/integration-health-log.rls-spec.ts` — assertions:
1. Cliente privilegiado (DATABASE_URL) **escreve** com sucesso.
2. Sessão de tenant normal (DATABASE_APP_URL) **lê** (USING true permite) — esperado, pois autz
   real é no guard de app, não no banco.
3. Sessão de tenant normal **NÃO escreve** (sem policy de INSERT → negado sob RLS).

### State transitions (status efetivo, fora da tabela — em Redis)
Cada linha é imutável (append-only). A transição de status é computada pelo debounce em Redis:
```
healthy ──(novo check >5s ou erro, 1x)──▶ candidato=unhealthy (NÃO notifica)
candidato=unhealthy ──(2º check consecutivo unhealthy)──▶ baseline=unhealthy + NOTIFICA
candidato=unhealthy ──(volta a healthy antes do 2º)──▶ reset (NÃO notifica)
```

---

## Entity: HealthCheckDebounceState (efêmero — Redis, NÃO persistido em DB)

Chave: `rt:health-check:debounce:{integrationName}` (TTL 30 min).

| Campo | Tipo | Notas |
|-------|------|-------|
| `baselineStatus` | enum | Último status "estável" (já notificado / inicial). |
| `candidateStatus` | enum | Status novo sob observação. |
| `consecutiveCount` | int | Quantos checks consecutivos o candidato persistiu. |
| `firstSeenAt` | ISO 8601 | Quando o candidato apareceu. |

Notifica quando `candidateStatus != baselineStatus` E `consecutiveCount >= 2`. Após notificar,
`baselineStatus = candidateStatus`.

---

## Entity: HealthCheckLock (efêmero — Redis)

Chave: `rt:health-check:lock:integration` — `SET NX EX 270`. Mutex de single-execution do
worker repeatable. Sem campos (valor sentinela `1`).

---

## Entity: IntegrationStatusChangedEvent (efêmero — Redis pub/sub)

Evento de domínio emitido na notificação (FR-007). Canal:
`rt:notifications:integration-status-changed`. Schema completo em
`contracts/integration-status-changed-event.md`. `tenantId: null` (evento de plataforma).

---

## Resumo de schemas Zod (`packages/types/src/integration-health.ts`)

| Schema | Campos | Uso |
|--------|--------|-----|
| `IntegrationHealthStatusSchema` | enum `healthy/degraded/unhealthy` | base |
| `IntegrationHealthItemSchema` | `name, status, latencyMs, lastChecked, message?` | item do endpoint live |
| `IntegrationHealthSummarySchema` | `total, healthy, degraded, unhealthy` | resumo agregado |
| `IntegrationHealthResponseSchema` | `data: { integrations[], summary }` | resposta de `GET /integrations` |
| `IntegrationHealthHistoryPointSchema` | `checkedAt, status, latencyMs, message?` | ponto do sparkline |

Snapshot test obrigatório (Princípio VI — gate contra breaking change silencioso).
