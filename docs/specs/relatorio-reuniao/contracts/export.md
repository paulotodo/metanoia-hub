# Contract — Export CSV assíncrono do relatório de reunião (FR-06/FR-07)

Reusa a infraestrutura BullMQ do módulo `apps/api/src/reports/` (trilhas).
Fila compartilhada `queue:reports`. Novo job name `export-meeting-csv`.

## 1) POST /api/v1/meetings/:id/report/export  → 202
Adicionado ao `ReportController` (`meetings/reports/`).
```
POST /api/v1/meetings/{meetingId}/report/export
Authorization: Bearer <jwt>
```
- Guards: `KeycloakAuthGuard`, `RolesGuard`.
- `@Roles(Role.LIDER, Role.ADMIN_TENANT, 'pastor', 'admin')` — **sem** `PARTICIPANTE`.
- Autorização: exige `canSeeFull=true`. Se `false` → **403 Forbidden** (Decision 5:
  o CSV é a visão completa com PII de todos; não há export pessoal no FR63).
- Ação: gera `jobId` (`generateId()`), grava status `processing` em
  `cache:reports:export-job:<jobId>`, enfileira job `export-meeting-csv` com
  payload `{kind:'meeting', jobId, tenantId, meetingId, requesterUserId, canSeeFull}`.

### Response 202
```json
{ "data": { "jobId": "rep_xxx", "message": "Exportação em processamento. Consulte o status pelo jobId." } }
```
Schema: `ExportJobAcceptedSchema` (existente).

### Idempotência
Sem dedup (dec): cada POST gera um jobId independente.

## 2) GET /api/v1/reports/jobs/:jobId  → 200 (polling) — REUSO do endpoint existente
Servido por `ReportsController` (`reports/`), já implementado. O jobId é opaco;
a mesma chave Redis `cache:reports:export-job:*` serve meeting e trilha.
- `@Roles(Role.ADMIN_TENANT, Role.LIDER)`.

### Response 200
```json
{ "data": {
    "jobId": "rep_xxx",
    "status": "processing|completed|failed",
    "signedUrl": "https://minio/.../exports/meeting-...csv?X-Amz-...",
    "expiresAt": "2026-06-10T22:05:00.000Z",
    "failureReason": null
} }
```
Schema: `ExportJobStatusSchema` (existente). `signedUrl`/`expiresAt` só em
`completed`; `failureReason` só em `failed`.

| Situação | status | Notas |
|----------|--------|-------|
| Job inexistente / TTL expirado | (404) | `NotFoundException('Job não encontrado')` |
| Falha de geração | `failed` | `failureReason` preenchido; líder reenvia export |
| Concluído | `completed` | `signedUrl` válida 1h (dec-008) |

## 3) Processamento do job (worker — `reports.processor.ts`)
Adicionar branch ao worker existente:
```
if (job.name === 'export-meeting-csv')
  await reportsService.processMeetingExportJob(job.data)  // novo método
```
`processMeetingExportJob` (novo, em `meetings/reports` ou delegado ao
`ReportsService`):
1. `withTenantTx({tenantId})` → lê summary + attendance + join User (nome/email).
2. Monta linhas CSV (colunas P2), aplica `engagementScore`/`engagementLevel`.
3. `csv = REPORTS_CSV_BOM + header + rows.join('\r\n')`.
4. `objectKey = exports/meeting-<meetingId>-<YYYY-MM-DD>-<jobId>.csv`.
5. `storage.upload(objectKey, Buffer.from(csv,'utf-8'), 'text/csv; charset=utf-8')`.
6. `signedUrl = storage.getSignedUrl(objectKey, REPORTS_JOB_TTL_SECONDS)`.
7. `setJobStatus(jobId,'completed',signedUrl,expiresAt)`.
8. erro → `setJobStatus(jobId,'failed',null,null,err.message)` + rethrow.

## CSV — layout
```
﻿"Nome","Email","Status","Hora de entrada","Hora de saída","Duração (min)","Score de engajamento"
"Ana Souza","ana@exemplo.com","Presente","19:31","20:58","87","0.87"
```
- BOM UTF-8 (`REPORTS_CSV_BOM`). Aspas escapadas (`"` → `""`).
- Reunião sem presentes → apenas o cabeçalho (P2 edge case).
- `Status` PT-BR: Presente/Parcial/Ausente.

## Segurança (gate owasp-security)
- PII no CSV (nome/email/horários) → export restrito a gestão (403 p/ Participante).
- Link via signed URL temporária (1h); sem ACL pública no bucket.
- jobId opaco; status legível por LIDER/ADMIN_TENANT (RLS isola tenant; mas o
  jobId não embute meetingId — ver risco "IDOR no polling" no plan.md §Riscos).
