# Contract — GET /api/v1/meetings/:id/report (visão líder/FR63)

**Estende** o endpoint existente (Story 5.6) em
`apps/api/src/meetings/reports/report.controller.ts`. **Não cria** rota nova.

## Request
```
GET /api/v1/meetings/{meetingId}/report
Authorization: Bearer <keycloak-jwt>
```
- `meetingId`: path param, UUID (`ParseUUIDPipe`).
- Guards: `KeycloakAuthGuard`, `RolesGuard`.
- `@Roles(Role.LIDER, 'pastor', 'admin', Role.ADMIN_TENANT, Role.PARTICIPANTE)`
  (inalterado — herança Story 5.6).
- Tenant: resolvido por `AsyncLocalStorage`/`RequestContext` (RLS). Nunca param.

## Autorização (canSeeFull)
- realm role `admin_tenant` → `canSeeFull=true` (todas as reuniões do tenant; RLS
  isola tenant) — dec-010.
- `GroupMember{role ∈ lider|admin}` do grupo da reunião → `canSeeFull=true` — dec-007.
- caso contrário (Participante) → `canSeeFull=false` → visão `personal`.

## Response 200 — visão FULL (líder/admin)
```json
{
  "data": {
    "meetingId": "uuid",
    "date": "2026-06-10T19:30:00.000Z",
    "groupName": "Célula Centro",
    "title": "Estudo de Romanos 8",
    "metrics": {
      "totalParticipants": 12,
      "presentCount": 9,
      "partialCount": 1,
      "absentCount": 2,
      "attendanceRate": 0.83,
      "avgEngagementScore": 0.71,
      "avgEngagementLevel": "medio"
    },
    "participants": [
      {
        "userId": "uuid",
        "name": "Ana Souza",
        "email": "ana@exemplo.com",
        "presenceStatus": "present",
        "joinTime": "2026-06-10T19:31:00.000Z",
        "leaveTime": "2026-06-10T20:58:00.000Z",
        "durationSeconds": 5220,
        "engagementScore": 0.87,
        "engagementLevel": "alto"
      }
    ]
  },
  "meta": { "view": "full", "generatedAt": "2026-06-10T21:05:00.000Z" }
}
```

## Response 200 — visão PERSONAL (Participante) — herança Story 5.6, enriquecida
```json
{
  "data": {
    "meetingId": "uuid",
    "attendee": {
      "userId": "uuid", "name": "Ana Souza", "presenceType": "integral",
      "durationSeconds": 5220, "cameraSeconds": 4000, "focusScore": 0.8,
      "engagementScore": 0.87, "engagementLevel": "alto"
    },
    "generatedAt": "2026-06-10T21:05:00.000Z"
  },
  "meta": { "view": "personal" }
}
```

## Edge / Error
| Situação | Status | Corpo |
|----------|--------|-------|
| Reunião sem dados de presença | 200 | `participants:[]`, métricas zeradas, `attendanceRate:0`, `avgEngagementScore:null` |
| Report ainda não gerado | 404 | `{statusCode:404,error:"Not Found",message:"Report not generated yet"}` |
| Participante sem linha de presença (personal) | 404 | `message:"No attendance record for requester"` |
| Token sem identidade | 403 | `message:"Missing user identity"` |
| Tenant diferente | (RLS) | reunião não encontrada → 404 (nunca vaza outro tenant) |

## Convenções
- Datas: ISO 8601 string. Nulls explícitos. camelCase no payload (Zod ambos lados).
- Validação: response validada por `MeetingLeaderReportResponseSchema` /
  `MeetingReportPersonalSchema` (estendido) em `packages/types`.
