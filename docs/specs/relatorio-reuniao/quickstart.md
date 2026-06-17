# Quickstart / Cenários de Teste — Relatório por Reunião (FR63)

Cada cenário no formato `Passo → Passo → **Expected**`. Cobrem happy path +
error cases + o roundtrip end-to-end obrigatório (borda backend↔frontend).

---

## C1 — Líder visualiza relatório de reunião concluída (happy path)
1. Reunião `completed` com `MeetingReport` gerado (flush Story 5.6) e
   `MeetingAttendance` populado.
2. Líder do grupo autentica (JWT com `GroupMember.role='lider'`).
3. `GET /api/v1/meetings/{id}/report`.
→ **Expected**: 200, `meta.view='full'`, `data.metrics` com counts corretos,
   `data.participants[]` com `engagementScore` (= durationSeconds/meetingDuration,
   clamp) e `engagementLevel` (alto≥0.75 / medio 0.50–0.74 / baixo<0.50),
   `name`/`email` resolvidos via join (ou fallback `MeetingParticipantRecord.name`).

## C2 — Admin Tenant vê qualquer reunião do tenant (dec-010)
1. Usuário com realm role `admin_tenant`, NÃO membro do grupo da reunião.
2. `GET /api/v1/meetings/{id}/report`.
→ **Expected**: 200, `meta.view='full'` (adminShortcut → canSeeFull=true).
   Reunião de OUTRO tenant → 404 (RLS isola; nunca vaza).

## C3 — Participante comum recebe visão filtrada, não 403 (dec-007)
1. Participante comum (sem role de gestão) com linha em `MeetingAttendance`.
2. `GET /api/v1/meetings/{id}/report`.
→ **Expected**: 200, `meta.view='personal'`, `data.attendee` = só a própria
   linha, enriquecida com `engagementScore`/`engagementLevel`. Sem lista do grupo.

## C4 — Reunião sem dados de presença (edge FR-04)
1. Reunião `completed`, summary com `attendees:[]`.
2. `GET /api/v1/meetings/{id}/report` como líder.
→ **Expected**: 200, `participants:[]`, métricas zeradas,
   `attendanceRate:0`, `avgEngagementScore:null`, `avgEngagementLevel:null`.

## C5 — Report ainda não gerado
1. Reunião `completed` sem `MeetingReport`.
2. `GET /api/v1/meetings/{id}/report`.
→ **Expected**: 404 `{message:"Report not generated yet"}`.

## C6 — Export CSV assíncrono: solicitar (FR-06)
1. Líder em C1.
2. `POST /api/v1/meetings/{id}/report/export`.
→ **Expected**: 202 `{data:{jobId, message}}`; chave
   `cache:reports:export-job:<jobId>` em Redis com `status:'processing'`.

## C7 — Export: Participante comum é barrado (Decision 5 / segurança)
1. Participante comum (canSeeFull=false).
2. `POST /api/v1/meetings/{id}/report/export`.
→ **Expected**: 403 Forbidden (CSV expõe PII de todos; export é só de gestão).

## C8 — Polling até conclusão (FR-07)
1. Após C6, worker `export-meeting-csv` processa o job.
2. `GET /api/v1/reports/jobs/{jobId}` em loop.
→ **Expected**: eventualmente 200 `status:'completed'`, `signedUrl` não-nula,
   `expiresAt` ≈ now+1h. Download da URL retorna CSV com BOM UTF-8 e colunas P2.

## C9 — Export: job falha
1. Storage indisponível durante o processamento.
→ **Expected**: `GET .../jobs/{jobId}` → `status:'failed'`, `failureReason`
   preenchido; líder pode reenviar (novo jobId).

## C10 — Link expirado (edge P2)
1. Job `completed`; aguarda > TTL (`REPORTS_JOB_TTL_SECONDS`).
2. `GET .../jobs/{jobId}`.
→ **Expected**: 404 (chave Redis expirou) — UI orienta solicitar novo export.

## C11 — CSV de reunião sem presentes (edge P2)
1. Reunião com 0 presentes; export solicitado por líder.
→ **Expected**: CSV gerado só com o cabeçalho (1 linha).

## C12 — Isolamento multi-tenant (RLS — obrigatório constitution)
1. Tenant A gera relatório/export; Tenant B tenta `GET`/`POST` no mesmo `meetingId`.
→ **Expected**: 404 para Tenant B (RLS bloqueia leitura cross-tenant). Teste em
   `apps/api/test/rls/` espelhando `meeting-reports.rls-spec.ts`.

## C13 — UI acessível (FR-08, WCAG AA) — E2E
1. Navegar `/app/gestao/reunioes/{meetingId}/relatorio` como líder.
→ **Expected**: summary card (total, %presença, engajamento médio + badge),
   lista de participantes com ícone+texto (status nunca só por cor), CTA "Cuidar"
   nos ausentes, empty state. Reusa `FormField` (apps/web/src/components/forms/),
   token `text-secondary` (NUNCA `text-muted`). axe-core sem violações críticas.

## C14 — Roundtrip End-to-End (OBRIGATÓRIO — borda BE↔FE)
1. Chamada REAL ao backend `GET /api/v1/meetings/{id}/report` (sem mock/fixture).
2. Capturar o payload de resposta.
3. Comparar o shape contra `MeetingLeaderReportResponseSchema` (Zod `.parse`).
→ **Expected**: parse OK — todas as chaves em **camelCase**, datas ISO 8601,
   nenhum campo `undefined`. Garante zero drift snake_case↔camelCase entre o
   serializer NestJS e o consumidor Next.js. Idem para o payload de
   `/reports/jobs/:jobId` contra `ExportJobStatusSchema`.

## C15 — Sparkline tendência (NICE-TO-HAVE / P4 — não bloqueia MVP)
1. Relatório de líder com ≥1 reunião anterior do grupo.
→ **Expected**: sparkline das últimas 5 reuniões COM `aria-label` + tabela
   acessível equivalente dos dados. Ausência de dados → gráfico oculto, sem erro.
