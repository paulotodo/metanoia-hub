# Contract — GET /api/v1/reports/leader-summary (FR79 / Story 13.2a)

Adicionado ao `ReportsController` existente
(`apps/api/src/reports/reports.controller.ts`, `@Controller('api/v1/reports')`).

## Request
```
GET /api/v1/reports/leader-summary?period=30d
GET /api/v1/reports/leader-summary?period=custom&startDate=2026-05-01T00:00:00Z&endDate=2026-06-01T00:00:00Z
GET /api/v1/reports/leader-summary?period=30d&groupId=<uuid>
Authorization: Bearer <keycloak-jwt>
```
- Guards: `KeycloakAuthGuard, RolesGuard, TenantGuard`.
- `@Roles(Role.LIDER, Role.ADMIN_TENANT)`.
- Query validada por `LeaderSummaryQuerySchema` (Zod via `ZodValidationPipe`).
- Tenant resolvido por `AsyncLocalStorage`/`RequestContext` (RLS) — **nunca** param.
- `period` default `30d` (aplicado no controller se ausente).

### Query params
| Param | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| period | `7d`\|`30d`\|`90d`\|`custom` | sim (default 30d) | — |
| startDate | ISO 8601 | sse custom | offset obrigatório |
| endDate | ISO 8601 | sse custom | `startDate < endDate` |
| groupId | uuid | não | drill-down 1 grupo (dec-011) |

## Autorização (universo de grupos)
- `lider`: grupos onde `ctx.userId` é `GroupMember.role='lider'`.
- `admin_tenant`: todos os grupos do tenant.
- `groupId` é FILTRO sobre o universo já restrito ao requester, **nunca**
  seletor que amplia acesso (Decision 5 / research.md). `groupId` alheio →
  `groups: []` + summary zerado (sem 403, sem vazar existência).

## Response 200 (`{ data, meta }`)
```json
{
  "data": {
    "groups": [
      {
        "groupId": "0190...uuid",
        "groupName": "Célula Centro",
        "avgAttendancePercent": 82.5,
        "avgTrailProgressPercent": 64.0,
        "atRiskCount": 2,
        "activeParticipantsCount": 11
      },
      {
        "groupId": "0190...uuid2",
        "groupName": "Célula Norte (sem reuniões no período)",
        "avgAttendancePercent": null,
        "avgTrailProgressPercent": 0,
        "atRiskCount": 0,
        "activeParticipantsCount": 6
      }
    ],
    "summary": {
      "totalGroups": 2,
      "totalParticipants": 15,
      "overallAttendancePercent": 82.5,
      "overallTrailCompletionPercent": 40.0
    }
  },
  "meta": { "period": "30d", "startDate": "2026-05-18T00:00:00Z", "endDate": "2026-06-17T00:00:00Z" }
}
```
- `avgAttendancePercent: null` distingue "sem reunião no período" de "0%" (dec-008).
- `overallAttendancePercent` ponderado por `activeParticipantsCount` (dec-009);
  `null` se todos os grupos sem reuniões.
- `totalParticipants` deduplicado por `userId` (DEC-INF-04).
- Validado por `LeaderSummaryResponseSchema` em `packages/types`.

## Edge / Error
| Caso | Resposta |
|------|----------|
| Líder sem grupos | 200 `{ data:{ groups:[], summary:{ totalGroups:0, totalParticipants:0, overallAttendancePercent:null, overallTrailCompletionPercent:0 } }, meta }` |
| `period=custom` sem datas | 400 `{ statusCode, error, message, details }` (Zod refinement) |
| `startDate >= endDate` | 400 (Zod refinement) |
| `groupId` não-UUID | 400 (Zod) |
| `groupId` de outro líder/tenant | 200 `groups: []` (escopo-vazio; não 403) |
| role ≠ lider/admin_tenant | 403 (RolesGuard) |
| Sem JWT / tenant | 401 |

## Convenções
- Datas: ISO 8601 string. Nulls explícitos (nunca `undefined`). camelCase no payload.
- Validação Zod em ambos os lados (BE valida response antes de retornar; FE
  `.parse` no fetch).
- Logging estruturado (dec-012): `{ duration_ms, groupCount, totalParticipants }`
  em log de info (inglês, Princípio III) ao final de `getLeaderSummary()`.

## Fora deste contrato (fronteiras)
- Materialized view de agregação → Story 13.2b (separada).
- Export CSV deste relatório → não previsto neste FR.
