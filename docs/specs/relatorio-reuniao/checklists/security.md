# SECURITY Checklist: Relatório por Reunião (FR63)

**Purpose**: Valida a QUALIDADE dos requisitos de segurança (authZ, BOLA/IDOR, exposição de PII, input/CSV injection, isolamento multi-tenant). Não testa código.
**Created**: 2026-06-17
**Feature**: [spec.md](../spec.md) · gate owasp-security (dec-016) · resolução S1 (dec-017)

## Controle de acesso / BOLA (mitigação S1 — prioridade máxima)

- [x] CHK001 - O requisito de autorização do polling de export está expresso de forma testável (bind tenantId + requesterUserId), e não apenas como guarda de papel? [Completude, Spec §FR-07.1] {auto} — Resolvido: FR-07.1 mandata bind `tenantId`+`requesterUserId` e afirma "A guarda de role isolada não satisfaz este requisito".
- [x] CHK002 - A chave Redis do job de status está especificada com prefixo de tenant em todos os artefatos (spec + contrato)? [Consistência, Spec §FR-07; contracts/export.md §1-2] {auto} — Resolvido: `cache:reports:export-job:<tenantId>:<jobId>` em spec.md L158/L161 e contracts/export.md L17/L33.
- [x] CHK003 - O comportamento de resposta a acesso cruzado (job de outro tenant/requester) está definido de forma não-vazante e testável? [Clareza, Spec §FR-07.1, §SC-08] {auto} — Resolvido: retorna 404 (não 403), "sem vazar a existência do job".
- [x] CHK004 - Existe critério de sucesso mensurável que prove o isolamento do polling (líder A não acessa jobId de líder B nem cross-tenant)? [Mensurabilidade, Spec §SC-08] {auto} — Resolvido: SC-08 define teste de autorização determinístico A↔B intra e cross-tenant.
- [x] CHK005 - A origem do tenantId para a leitura está especificada como contexto de autenticação (nunca parâmetro de requisição)? [Clareza, Spec §FR-07.1; contracts/export.md §2] {auto} — Resolvido: "derivando tenantId do RequestContext/AsyncLocalStorage, nunca de parâmetro".

## Autorização do relatório e do export

- [x] CHK006 - O requisito de visão por papel (Líder/Admin full, Participante personal) está definido sem ambiguidade entre 403 e resposta filtrada? [Consistência, Spec §FR-01] {auto} — Resolvido: FR-01 define Participante → resposta filtrada (não 403); contracts/meeting-report.md detalha canSeeFull.
- [x] CHK007 - O requisito deny-by-default do POST export para Participante (canSeeFull=false → 403) está expresso? [Completude, contracts/export.md §1; plan §Gate S2] {auto} — Resolvido: export.md §1 "canSeeFull=false → 403 Forbidden (Decision 5)".
- [ ] CHK008 - O apetite de risco para ADMIN_TENANT ler qualquer job do próprio tenant (sem bind por requester) reflete a política do produto? [Risco] {humano} — Decisão de produto: contrato define que ADMIN_TENANT lê qualquer job do mesmo tenant; confirmar se aceitável.

## Proteção de dados / PII

- [x] CHK009 - O requisito de proteção da signed URL (validade temporária, sem ACL pública, sem upload a terceiros) está especificado? [Completude, contracts/export.md §Segurança; plan §Riscos S3] {auto} — Resolvido: URL assinada 1h (dec-008), sem ACL pública, link local apenas.
- [x] CHK010 - O requisito anti CSV/fórmula injection (S4) está expresso como critério verificável sobre campos de texto livre? [Completude, contracts/export.md §CSV; plan §Gate S4] {auto} — Resolvido: prefixo `'` para células iniciando com `= + - @` TAB CR (Nome/Email).
- [x] CHK011 - Os campos de PII expostos no CSV estão enumerados (escopo de exposição conhecido)? [Clareza, contracts/export.md §CSV-layout] {auto} — Resolvido: Nome, Email, Status, horários, duração, score listados no layout.

## Isolamento multi-tenant (RLS)

- [x] CHK012 - O requisito de isolamento absoluto por tenant via contexto (sem tenant_id como parâmetro) está especificado e é mensurável? [Mensurabilidade, Spec §FR-05, §SC-05] {auto} — Resolvido: FR-05 + SC-05 ("testes de isolamento RLS com dois tenants distintos").
- [x] CHK013 - O comportamento de tenant diferente no GET report (404, nunca vaza) está definido? [Cobertura, contracts/meeting-report.md §Edge/Error] {auto} — Resolvido: "Tenant diferente | (RLS) | reunião não encontrada → 404".

## Notes

- Items `{auto}` resolvidos com citação; `{humano}` aguardam dono do produto.
- Resultado: a mitigação S1 (dec-017) passou de risco documentado a REQUISITO testável (FR-07.1 + SC-08 + contrato endurecido) — gap fechado nesta onda.
