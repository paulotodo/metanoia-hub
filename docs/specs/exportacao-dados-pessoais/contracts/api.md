# API Contracts: exportacao-dados-pessoais

**Feature:** Story 9-1 — Exportação de Dados Pessoais / Portabilidade LGPD
**Prefixo:** `/api/v1/privacy`
**Auth:** Bearer JWT (Keycloak) — todos os endpoints exigem usuário autenticado
**Data:** 2026-06-12

---

## POST /api/v1/privacy/export

**Descrição:** Solicita exportação de todos os dados pessoais do usuário autenticado.

**Request:**
```json
{
  "format": "json" | "pdf"
}
```

**Response 202 — Accepted:**
```json
{
  "data": {
    "jobId": "01906a12-0abc-7def-0123-456789abcdef",
    "status": "accepted",
    "estimatedCompletionHours": 24
  }
}
```

**Response 409 — Conflict (export duplicado):**
```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Export em andamento. Aguarde a conclusão antes de solicitar novo export."
}
```

**Response 429 — Rate Limited:**
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Limite de requisições atingido."
}
```

**Guard:** `PrivacyRateLimitGuard` (existente no módulo privacy)
**Validação:** `ZodValidationPipe` + `PrivacyExportRequestSchema`

---

## GET /api/v1/privacy/export/:jobId

**Descrição:** Polling do status de um job de export.

**Path param:** `jobId` — UUID v7

**Response 200 — Polling:**
```json
{
  "data": {
    "jobId": "01906a12-0abc-7def-0123-456789abcdef",
    "status": "processing",
    "signedUrl": null,
    "expiresAt": null,
    "failureReason": null
  }
}
```

**Response 200 — Completed:**
```json
{
  "data": {
    "jobId": "01906a12-0abc-7def-0123-456789abcdef",
    "status": "completed",
    "signedUrl": "https://minio.metanoia.app/exports/privacy/...",
    "expiresAt": "2026-06-14T12:00:00Z",
    "failureReason": null
  }
}
```

**Response 200 — Failed:**
```json
{
  "data": {
    "jobId": "01906a12-0abc-7def-0123-456789abcdef",
    "status": "failed",
    "signedUrl": null,
    "expiresAt": null,
    "failureReason": "Timeout after 3 attempts"
  }
}
```

**Response 404 — Job não encontrado (Redis TTL expirou):**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Export não encontrado ou expirado."
}
```

**Fonte de dados:** Redis `cache:privacy:export-job:<jobId>` (somente)
**Nota:** O endpoint NÃO verifica se o jobId pertence ao usuário autenticado via DB — confia no TTL + UUID v7 como segurança suficiente para o MVP (job ID gerado pelo servidor, não previsível).

---

## BullMQ Job Payload (interno — não exposto na API)

**Queue:** `queue:privacy-export`
**Job name:** `'export-personal-data'`

```typescript
interface PrivacyExportJobPayload {
  jobId: string;           // UUID v7
  userId: string;          // UUID v7 do titular
  allTenantIds: string[];  // Todos os tenants do usuário no momento da solicitação
  format: 'json' | 'pdf';
  requestedAt: string;     // ISO 8601
}
```

**BullMQ options:**
```typescript
{
  attempts: 3,
  backoff: {
    type: 'fixed',
    delay: 60_000   // 1m entre tentativas (conforme spec FR-02)
  },
  removeOnComplete: 100,
  removeOnFail: 50
}
```

---

## Convencoes de Borda

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | migration + Prisma `@map` | `apps/api/prisma/schema.prisma` |
| Backend DTO (NestJS) | camelCase | Zod (`ZodValidationPipe`) | `packages/types/src/privacy/export.ts` |
| Frontend DTO (Next.js) | camelCase | Zod parse no fetch | `packages/types/src/privacy/export.ts` (re-export) |
| API payload (req/res) | camelCase | Zod em ambos os lados | `contracts/api.md` |
| URL path params | kebab-case | NestJS router | `privacy.controller.ts` |

**Mapper layer (DB → DTO):** mapeamento inline nos métodos de `PrivacyExportService` (sem repository pattern — supporting subdomain). Datas: `.toISOString()`.

**Zod compartilhado:** sim — `packages/types/src/privacy/export.ts` é a fonte única. Frontend e backend importam do mesmo pacote.
