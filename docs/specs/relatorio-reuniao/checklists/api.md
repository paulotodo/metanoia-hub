# API Checklist: Relatório por Reunião (FR63)

**Purpose**: Valida a QUALIDADE dos requisitos de contrato de API (envelope, status codes, erros, idempotência, versionamento, schema). Não testa endpoints.
**Created**: 2026-06-17
**Feature**: [spec.md](../spec.md) §FR-04/06/07 · contracts/

## Envelope e contrato de resposta

- [x] CHK025 - O envelope de sucesso (data/meta) está especificado para o GET report? [Completude, Spec §FR-04; contracts/meeting-report.md] {auto} — Resolvido: FR-04 define `{ data: {...}, meta: { generatedAt } }`.
- [x] CHK026 - Os schemas de request/response têm fonte canônica nomeada (Zod em packages/types)? [Clareza, data-model.md §DTOs] {auto} — Resolvido: MeetingLeaderReportResponse, MeetingReportMetrics, MeetingReportParticipant, ReportExportJobPayload definidos em packages/types.
- [x] CHK027 - O contrato snake_case↔camelCase BE↔FE tem requisito de consistência verificável? [Consistência, plan §Riscos] {auto} — Resolvido: plan §Riscos exige "Roundtrip E2E obrigatório (C14) com .parse do payload real".

## Status codes e erros

- [x] CHK028 - Os status codes assíncronos (202 no POST export, 200 no polling) estão especificados? [Completude, contracts/export.md §1-2] {auto} — Resolvido: POST → 202; GET polling → 200.
- [x] CHK029 - Os casos de erro do GET report (404 report não gerado, 404 sem presença personal, 403 sem identidade, 404 tenant diferente) estão enumerados de forma não-ambígua? [Cobertura, contracts/meeting-report.md §Edge/Error] {auto} — Resolvido: tabela Edge/Error cobre os 4 casos + 200 vazio.
- [x] CHK030 - Os casos de status do polling (job inexistente/TTL expirado → 404, failed com failureReason, completed com signedUrl) estão definidos? [Cobertura, contracts/export.md §2] {auto} — Resolvido: tabela de situações do polling enumera os 3 estados.
- [x] CHK031 - O formato de erro segue o padrão do projeto (statusCode/error/message, sem stack trace)? [Consistência, contracts/meeting-report.md §Edge/Error] {auto} — Resolvido: corpos de erro no formato `{statusCode,error,message}`.

## Idempotência e versionamento

- [x] CHK032 - O comportamento de idempotência do POST export (sem dedup, jobId único por solicitação) está especificado sem ambiguidade? [Clareza, Spec §Clarifications; contracts/export.md §Idempotência] {auto} — Resolvido: "cada POST gera um jobId independente; não há deduplicação automática".
- [x] CHK033 - O prefixo de versionamento /api/v1/ está presente em todos os endpoints do contrato? [Consistência, contracts/export.md, contracts/meeting-report.md] {auto} — Resolvido: todas as rotas usam `/api/v1/...`.

## Reuso de endpoint existente

- [x] CHK034 - O requisito de ESTENDER (não duplicar) o endpoint GET report existente da Story 5.6 está expresso? [Clareza, Spec §FR-01] {auto} — Resolvido: FR-01 "estender o endpoint existente ... sem duplicá-lo".
- [ ] CHK035 - A mudança de chave Redis para prefixo de tenant afeta jobs de TRILHA que reusam o mesmo getJobStatus — o requisito cobre a migração/compat do consumo existente? [Gap, contracts/export.md §2 ↔ Story trilhas] {auto} — [Gap]: o endpoint de polling é compartilhado com export de trilhas (kind:'track'). Mudar a chave para `<tenantId>:<jobId>` exige que o caminho de trilha também passe a gravar/ler com prefixo, senão quebra. Vira tarefa de requisito no create-tasks (escopo da mitigação S1 deve cobrir AMBOS os kinds ou isolar a chave do meeting).

## Notes

- 1 item aberto: CHK035 [Gap] → create-tasks (impacto cross-feature da mitigação S1 no polling compartilhado meeting/trilha). Importante para não quebrar export de trilhas.
