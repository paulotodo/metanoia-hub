# Research — Relatório por Reunião (FR63)

**Feature**: relatorio-reuniao | **Fase**: Phase 0 (Research)
**Spec**: `docs/specs/relatorio-reuniao/spec.md` (status: Clarified)

Todos os NEEDS CLARIFICATION foram resolvidos na sessão de clarify (dec-006 a
dec-010) e/ou por sondagem empírica do código real durante o read-back loop
(dec-012). Este documento consolida as decisões técnicas com Rationale e
Alternatives.

---

## Decision 1 — Estender (não duplicar) o módulo `meetings/reports/`

**Decision**: A visão de líder/FR63 ESTENDE o endpoint existente
`GET /api/v1/meetings/:id/report` em `apps/api/src/meetings/reports/`
(Story 5.6). Não se cria um novo controller nem se move o endpoint.

**Rationale** (sonda empírica — read-back loop):
- `report.controller.ts` já implementa a autorização role-shaped exigida pelo
  FR63: `@Roles(Role.LIDER, 'pastor', 'admin', Role.ADMIN_TENANT, Role.PARTICIPANTE)`,
  `adminShortcut` (admin_tenant → `canSeeFull=true`), e
  `userIsLiderOrAdminOfGroup()` para o líder. Membro comum recebe `kind:'personal'`
  (não 403). Isso é exatamente o contrato dos dec-007 e dec-010.
- `report.service.ts::findForUser(meetingId, requesterUserId, canSeeFull)` já
  retorna a união discriminada `{kind:'full',...} | {kind:'personal',...}`,
  consumindo `MeetingReport.summary` (JSON persistido).
- A fonte de duração de presença já é `MeetingAttendance.totalDurationSeconds`
  (dec-006): `report.repository.ts::listAttendanceTelemetry()` lê
  `meetingAttendance` + `meetingTelemetry`; `report.service.ts` mapeia
  `a.totalDurationSeconds → durationSeconds`.

**Alternatives considered**:
- Criar novo módulo `meetings/leader-report/` — REJEITADO: duplicaria
  autorização, RLS e o cálculo de summary; viola DRY e o princípio de
  "estender, não recriar" do épico 13.
- Mover endpoint para o módulo `reports/` (trilhas) — REJEITADO: aquele módulo
  é supporting subdomain de trilhas com semântica de universo-de-participantes
  diferente; o relatório de reunião pertence ao bounded context Meetings.

---

## Decision 2 — Classificação de engajamento por-participante (gap do schema)

**Decision**: Adicionar ao contrato de resposta FR63 um campo derivado por
participante: `engagementScore` (ratio simples `durationSeconds /
meetingDurationSeconds`, clamp 0..1) e `engagementLevel`
(`alto` ≥0.75 | `medio` 0.50–0.74 | `baixo` <0.50). Ausentes → score 0.0,
nível `baixo`. Este é um campo DERIVADO no serviço (não persistido no JSON
do summary), computado a partir de `attendees[].durationSeconds` +
`summary.totalDurationMinutes` no momento do `findForUser`.

**Rationale**:
- `MeetingReportSummary` (em `packages/types/src/meeting-report.ts`) já tem
  `attendees[]` (`durationSeconds`, `presenceType`, `cameraSeconds`,
  `focusScore`) e um `avgEngagementScore` AGREGADO — mas esse agregado é um
  *blend ponderado* (`0.5*presence + 0.25*camera + 0.25*focus`), que NÃO é a
  definição FR63 (ratio simples de presença, dec-006/FR-03).
- Não há classificação por-participante (alto/médio/baixo) no schema atual.
- O `name` ainda é `null` no summary (comentário literal:
  `name: null // wire via users join in Epic 13 reports`). FR63 (Epic 13) é
  exatamente onde o join de nomes deve ser ligado.

**Conclusão de design**: o `engagementScore`/`engagementLevel` FR63 são
campos de APRESENTAÇÃO derivados pelo serviço a partir do summary persistido
(Story 5.3/5.6), NÃO alteram o JSON gravado em `MeetingReport.summary`. Isso
evita migration de dados e mantém o `avgEngagementScore` blend existente
intacto. O `groupName`/`name` são resolvidos via join (Group, GroupMember/User)
no caminho de leitura do relatório de líder.

**Alternatives considered**:
- Reescrever `computeReportSummary` para gravar o ratio simples no JSON —
  REJEITADO: quebraria o contrato Story 5.6 e exigiria reprocessar relatórios
  já persistidos; o blend ponderado é usado por outros consumidores (radar).
- Persistir `engagementLevel` no summary — REJEITADO: dado derivável de
  campos já presentes; persistir duplicaria fonte da verdade.

---

## Decision 3 — Export CSV: reusar o padrão BullMQ de `reports/` (trilhas)

**Decision**: O export `export-meeting-csv` reusa integralmente a
infraestrutura assíncrona do módulo `apps/api/src/reports/`:
- Fila BullMQ compartilhada `REPORTS_QUEUE_NAME = 'reports'` (queue:reports).
- Novo job name `export-meeting-csv` adicionado ao `reports.processor.ts`
  (que hoje só trata `export-trail-csv`).
- Status do job em Redis-only: chave `cache:reports:export-job:<jobId>`,
  TTL `REPORTS_JOB_TTL_SECONDS + 300` (dec-009; alinhado à URL assinada de 1h).
- CSV gravado via `StorageService.upload(objectKey, buffer, mime)` no bucket
  único `metanoia-storage` (CONTENT_BUCKET), prefixo `exports/`
  (objectKey `exports/meeting-<meetingId>-<date>-<jobId>.csv`).
- URL assinada via `StorageService.getSignedUrl(objectKey, REPORTS_JOB_TTL_SECONDS)`
  (3600s = 1h, dec-008).
- BOM UTF-8 via `REPORTS_CSV_BOM` (Excel), linhas `\r\n` (padrão existente).

**Rationale** (sonda empírica):
- `reports.service.ts::processExportJob()`, `setJobStatus()`, `getJobStatus()`,
  `buildCsv()` já existem e definem exatamente esse fluxo para trilhas.
- `reports.processor.ts` faz dispatch por `job.name` — adicionar um branch
  `export-meeting-csv` é incremento mínimo.
- `ExportJobAcceptedSchema`, `ExportJobStatusSchema`, `ReportExportJobPayload`
  já existem em `packages/types/src/reports/index.ts`.

**Alternatives considered**:
- Fila dedicada `queue:meeting-reports` — REJEITADO (dec-008): a fila
  `queue:reports` já existe e é o padrão Epic 8; fila nova é overhead.
- Persistir ExportJob em DB — REJEITADO (dec-009): Redis-only com TTL alinhado
  à URL é suficiente; o link expira em 1h, sem necessidade de histórico.
- Export síncrono inline (como trilhas pequenas) — descartado como caminho
  primário; FR-06 exige fluxo assíncrono 202+polling. (Inline opcional para
  reuniões com pouquíssimos participantes pode ser nice-to-have futuro.)

---

## Decision 4 — Onde colocar o endpoint de export e polling

**Decision**:
- `POST /api/v1/meetings/:id/report/export` → **202** `{data:{jobId, message}}`,
  no `ReportController` existente (`meetings/reports/`). Enfileira job na
  `queue:reports` com payload `{jobId, tenantId, meetingId, requesterUserId,
  canSeeFull}`.
- Polling: reusar o endpoint **existente** `GET /api/v1/reports/jobs/:jobId`
  do `ReportsController` (trilhas), que já lê `cache:reports:export-job:*` e
  retorna `{data: ExportJobStatusInner}`. O jobId é opaco; a mesma chave Redis
  serve ambos os tipos de job.

**Rationale**: evita criar um terceiro endpoint de polling duplicado. O
contrato de status (`ExportJobStatusInnerSchema`) é idêntico. A spec
menciona `GET /api/v1/exports/:exportId` como ideia; o padrão JÁ
IMPLEMENTADO é `/reports/jobs/:jobId` — adotá-lo é menos código e zero
divergência. Documentado como decisão de plano (ver plan.md §Decisões).

**Alternatives considered**:
- Novo `GET /api/v1/exports/:exportId` — REJEITADO: duplicaria a leitura
  Redis já feita por `ReportsService.getJobStatus`. Se o produto exigir a URL
  literal `/exports/:id` por UX, é um alias fino delegando ao mesmo serviço
  (registrado como nice-to-have, fora do MVP).

---

## Decision 5 — Autorização do export (paridade com o GET report)

**Decision**: O `POST .../report/export` aplica o MESMO modelo de autorização
do GET: `@Roles(LIDER, ADMIN_TENANT, ...)` + cálculo `canSeeFull`. Um
Participante comum NÃO pode exportar o CSV do grupo (o CSV é a visão completa,
PII de todos os participantes); export é restrito a quem tem `canSeeFull=true`.
Se `canSeeFull=false` → **403 Forbidden** (diferente do GET, que filtra para
`personal`). Justificativa: o CSV é inerentemente a visão agregada; não há
"CSV pessoal" no escopo FR63.

**Rationale**: dec-007 estabelece resposta filtrada para o GET (leitura de
uma linha é benigna), mas o EXPORT gera um arquivo com PII de TODOS os
participantes (nome, email, horários) — exportar deve exigir papel de gestão.
Alinhado a OWASP (controle de acesso a função sensível) e ao princípio de
mínimo privilégio. Será destacado no gate `owasp-security`.

**Alternatives considered**:
- Permitir export pessoal (CSV de 1 linha) para Participante — REJEITADO:
  fora do escopo FR63 e adiciona superfície sem valor pastoral claro.

---

## Decision 6 — Resolução de nomes/email dos participantes (join de usuários)

**Decision**: No caminho de leitura do relatório de líder e na geração do CSV,
resolver `name`/`email` a partir do bounded context de usuários
(`User`/`GroupMember`) via `withTenantTx` (RLS isola tenant), juntando por
`userId`. Persistência do summary NÃO muda; o enriquecimento é no read-path.

**Rationale**: FR-02 exige nome do participante no relatório e o CSV exige
nome+email (P2). O summary persistido tem `name:null` por design da Story 5.6.
Epic 13 (esta feature) é o ponto designado para "wire via users join".

**Risco/PII**: nome e email são PII. O CSV os expõe — daí Decision 5 (export
restrito a gestão) e signed URL de 1h (dec-008). Sem upload do relatório a
terceiros; link local apenas (FR blast-radius).

**Alternatives considered**:
- Snapshot do nome no `MeetingParticipantRecord.name` (já existe `name` lá) —
  considerado como FALLBACK quando o join de User falhar (usuário removido):
  usar `MeetingParticipantRecord.name` como nome de exibição se o join vier
  vazio. Adotado como fallback, não como fonte primária.
