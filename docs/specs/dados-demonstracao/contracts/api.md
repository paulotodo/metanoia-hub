# API Contracts: dados-demonstracao (Story 10-2)

> Todos os endpoints sob `/api/v1/`. Auth: `KeycloakAuthGuard` (JWT Bearer).
> Response: `{ data: T }` sucesso, `{ statusCode, error, message, details? }` erro.
> `tenant_id` resolvido via `AsyncLocalStorage`/`getRequestContext()`.

---

## DELETE /api/v1/onboarding/demo-data

Remove todos os registros `isDemoData=true` do tenant corrente.

**Auth:** `admin_tenant` role (guard: `@Roles('admin_tenant')`)

**Request:** sem corpo.

**Response (success):** `204 No Content` — sem corpo.

**Response (error):**
- `401 Unauthorized` — token ausente ou inválido
- `403 Forbidden` — role insuficiente
- `500 Internal Server Error` — falha parcial na transação

**Comportamento:**
- Idempotente: se não há dados demo, retorna 204 igualmente.
- Transacional (`prisma.$transaction`): tudo ou nada.
- Ordem de deleção (filhos antes de pais, respeitando FKs):
  1. `meeting_attendance` WHERE is_demo_data = true AND tenant_id = ctx
  2. `meeting_telemetry` WHERE is_demo_data = true AND tenant_id = ctx
  3. `meetings` WHERE is_demo_data = true AND tenant_id = ctx
  4. `module_progress` WHERE is_demo_data = true AND tenant_id = ctx
  5. `trail_progress` WHERE is_demo_data = true AND tenant_id = ctx
  6. `pastoral_actions` WHERE is_demo_data = true AND tenant_id = ctx
  7. `group_members` WHERE is_demo_data = true AND tenant_id = ctx
  8. `lessons` WHERE is_demo_data = true AND tenant_id = ctx (cascade → lesson_progress)
  9. `modules` WHERE is_demo_data = true AND tenant_id = ctx
  10. `trails` WHERE is_demo_data = true AND tenant_id = ctx
  11. `groups` WHERE is_demo_data = true AND tenant_id = ctx
  12. `users` WHERE is_demo_data = true AND tenant_id = ctx

---

## GET /api/v1/onboarding/demo-status

Retorna status dos dados de demonstração do tenant corrente.

**Auth:** `admin_tenant` role.

**Response (200):**
```json
{
  "data": {
    "hasDemoData": true,
    "hasRealData": false,
    "nudgeDismissed": false,
    "demoRecordCount": 13
  }
}
```

**Zod schema:** `DemoStatusResponseSchema` em `packages/types/src/onboarding.ts`.

**Implementação:**
- `hasDemoData`: `COUNT(*) > 0` em `groups WHERE tenant_id = ctx AND is_demo_data = true`
- `hasRealData`: `COUNT(*) > 0` em `groups WHERE tenant_id = ctx AND is_demo_data = false`
- `nudgeDismissed`: `tenant.metadata.demoDismissedAt != null`
- `demoRecordCount`: soma de counts nas 12 tabelas (ou só `groups` como proxy; custo computacional aceitável para admin)

---

## PATCH /api/v1/onboarding/demo-nudge-dismiss

Marca o nudge como dispensado permanentemente.

**Auth:** `admin_tenant` role.

**Request:** sem corpo (ou `{}`).

**Response (204):** sem corpo. Idempotente.

**Implementação:** `prisma.tenant.update` com `metadata: { ...existing, demoDismissedAt: new Date().toISOString() }` para o tenant do contexto. Usa `NULLIF` no RLS — só atualiza o próprio tenant.

---

## Módulo existente estendido: `OnboardingController`

```
Endpoints existentes (não modificar):
  GET /api/v1/onboarding/demo-radar   → onboarding wizard step 5

Endpoints novos desta story:
  DELETE /api/v1/onboarding/demo-data
  GET    /api/v1/onboarding/demo-status
  PATCH  /api/v1/onboarding/demo-nudge-dismiss
```

---

## Seed function (não é endpoint HTTP)

```typescript
// apps/api/src/onboarding/seed/demo-data.seed.ts
export async function seedDemoData(tenantId: string): Promise<void>
```

Chamada internamente por `DemoDataService.seedDemoData(tenantId)` injetado no provisioning.

CLI: `pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id <uuid>`
