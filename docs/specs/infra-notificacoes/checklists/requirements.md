# Requirements Quality Checklist: Infraestrutura de Notificações & Channel Router

**Purpose**: Quality gate dos REQUISITOS (não do código) da feature `infra-notificacoes` (Story 14.1 / FR77, Epic 14). "Unit tests for English": valida cobertura, clareza, consistência, mensurabilidade e cobertura de edge-cases dos requisitos, com foco nos domínios api, security, performance e data-model/RLS multi-tenancy.
**Created**: 2026-06-20
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [data-model.md](../data-model.md) · [contracts/](../contracts/)
**Domain**: requirements (infra/backend) — clusters: api · security · performance · data-model/multi-tenancy

> Convenção: `{auto}` resolvido pelo agente com citação de evidência (`[x]`) ou marcador de gap (`[ ]`). `{humano}` = decisão de produto/risco, fica `[ ]` aguardando dono.

## Multi-tenancy & RLS (data-model)

- [x] CHK001 - É o requisito de derivação de `tenant_id` (sempre do RequestContext, nunca parâmetro) definido explicitamente? [Completude, Spec §FR-001 + Decisões Infra "Context rebuild"] {auto}
- [x] CHK002 - É a proteção RLS da coluna `tenant_id` especificada como requisito (não só implementação)? [Completude, Spec §FR-003 + data-model §RLS] {auto}
- [x] CHK003 - É o requisito de isolamento cross-tenant mensurável/verificável? [Mensurabilidade, Spec §SC-001 "teste RLS com 2 tenants distintos"] {auto}
- [x] CHK004 - A política RLS define o comportamento de escrita (INSERT/UPDATE), não só leitura? [Cobertura, data-model §RLS "WITH CHECK espelha USING"] {auto}
- [x] CHK005 - É a ausência de linhas globais (sem ramo `IS NULL`) declarada como decisão de design consciente? [Clareza, data-model §RLS nota vs evasion_job_log + research Decision 4] {auto}
- [x] CHK006 - É o rebuild de contexto de tenant fora de request HTTP (jobs assíncronos) coberto pelos requisitos? [Cobertura, Spec §US1 AC2 + §FR-001 + Decisões Infra] {auto}
- [ ] CHK007 - O comportamento para tenant deletado antes da entrega está definido de forma não-ambígua quanto ao destino do job (failed vs descarte)? [Ambiguity, Spec §Edge Cases item 5] {auto}

## API & Contratos

- [x] CHK008 - São formatos de request/response definidos para todos os endpoints REST expostos? [Completude, contracts/notifications-api.md GET + PATCH] {auto}
- [x] CHK009 - É a estratégia de versionamento de API especificada? [Clareza, contracts/notifications-api.md "/api/v1/" + plan §Constraints] {auto}
- [x] CHK010 - É o contrato do serviço interno `dispatch()` (input shape) definido e compartilhado FE/BE? [Completude, Spec §FR-013 + contracts NotificationDispatchSchema] {auto}
- [x] CHK011 - É o shape de `payload`/`result` da interface `NotificationChannel.send()` especificado sem ambiguidade? [Clareza, Spec §Clarifications Q1 + contracts §send] {auto}
- [x] CHK012 - São os snapshots de schema requeridos como gate contra breaking changes silenciosos? [Completude, Spec §FR-013 + contracts §Snapshot test] {auto}
- [x] CHK013 - É a estratégia de paginação da listagem definida com limites (page/perPage, max)? [Clareza, contracts/notifications-api.md "perPage default 20, max 100"] {auto}
- [x] CHK014 - É o formato de envelope de sucesso/erro consistente com o padrão do projeto? [Consistência, contracts/notifications-api.md §Padrões + CLAUDE.md] {auto}
- [x] CHK015 - São os eventos de domínio (created/sent/failed/digested) definidos com envelope padronizado? [Completude, contracts/notifications-api.md §Padrões] {auto}
- [ ] CHK016 - É o contrato de resposta do `dispatch()` ao chamador (void vs 202 vs id) definido sem ambiguidade? [Ambiguity, contracts §Dispatch "retorna void/202-style internamente"] {auto}

## Security

- [x] CHK017 - São os requisitos de autorização (Keycloak roles → guards → RLS) especificados para os endpoints? [Cobertura, contracts/notifications-api.md §Padrões "Guards Keycloak → RLS"] {auto}
- [x] CHK018 - É o vetor BOLA/IDOR (acesso a notificação de outro usuário/tenant) tratado nos requisitos? [Cobertura, contracts/notifications-api.md §BOLA/IDOR em GET e PATCH] {auto}
- [x] CHK019 - É o requisito de não-vazamento de existência (404 em vez de 403 cross-tenant) explícito? [Clareza, contracts/notifications-api.md PATCH "404 (não 403)"] {auto}
- [x] CHK020 - É a ausência de superfície HTTP pública para `dispatch` arbitrário declarada como mitigação? [Cobertura, contracts/notifications-api.md nota final "NÃO há endpoint público de dispatch"] {auto}
- [x] CHK021 - São os requisitos de validação de input (Zod/ZodValidationPipe) definidos para a entrada do dispatch e da query? [Completude, Spec §FR-013 + plan §Validação Zod] {auto}
- [x] CHK022 - É o requisito de não vazar stack trace / dados sensíveis em erro ao FE definido? [Cobertura, plan §Constitution Check VI "sem stack trace ao FE"] {auto}
- [x] CHK023 - O isolamento de subscriber no canal Redis SSE (tenantId+userId no nome do canal) está especificado? [Completude, Spec §Clarifications Q2 + contracts §SSE "rt:notifications:{tenantId}:{userId}"] {auto}
- [ ] CHK024 - É o limite máximo de tamanho de payload (title max 200 definido; body sem max) uma decisão consciente de risco? [Risco, contracts NotificationDispatchSchema "body: z.string().min(1)" sem max] {humano}

## Performance & Resiliência

- [x] CHK025 - É o target de latência de `pastoral_alert` quantificado e mensurável? [Mensurabilidade, Spec §SC-004 "< 2 segundos"] {auto}
- [x] CHK026 - É o requisito de consulta performática do notification center suportado por índice especificado? [Clareza, Spec §FR-012 + data-model §Índices "notifications_user_status_created_idx"] {auto}
- [x] CHK027 - É a política de retry quantificada (nº de tentativas + delays de backoff)? [Clareza, Spec §FR-009 "3 tentativas 30s/60s/120s" + data-model §Job] {auto}
- [x] CHK028 - É a retenção do failed set (não descarte) declarada como requisito? [Completude, Spec §FR-010 + data-model "removeOnFail: false"] {auto}
- [x] CHK029 - É a janela de digest configurável via env sem redeploy, e isso é verificável? [Mensurabilidade, Spec §FR-008 + §SC-007 + Clarifications Q3] {auto}
- [x] CHK030 - É a idempotência do digest em ambiente multi-pod especificada (job key determinística)? [Clareza, Spec §Clarifications Q3 + data-model §Digest "digest:{userId}:{type}:{epoch}"] {auto}
- [x] CHK031 - É o comportamento sob race condition de dois jobs delayed do mesmo bucket definido? [Cobertura, Spec §Edge Cases item 4 "digest idempotente — única notificação"] {auto}
- [x] CHK032 - O comportamento quando o Redis (fila) está indisponível no dispatch está definido (sem persistência parcial)? [Cobertura, Spec §Edge Cases item 3] {auto}

## Completude funcional & cenários

- [x] CHK033 - Todos os tipos de notificação relevantes estão enumerados nos requisitos? [Completude, data-model §enum NotificationType (5 valores)] {auto}
- [x] CHK034 - São as transições de status (pending→sent/failed→read) definidas sem lacuna? [Clareza, data-model §State transitions] {auto}
- [x] CHK035 - É a regra de `pastoral_alert` NUNCA agrupado consistente entre spec, requisitos e edge cases? [Consistência, Spec §FR-007 + §US4 AC3 + §Edge Cases item 2] {auto}
- [x] CHK036 - É a extensibilidade de canais (novo canal sem alterar router/dispatch) um requisito mensurável? [Mensurabilidade, Spec §FR-005 + §SC-006] {auto}
- [x] CHK037 - É o requisito de roteamento 1 job por canal (2 canais → 2 jobs) mensurável? [Mensurabilidade, Spec §SC-002] {auto}
- [x] CHK038 - O comportamento do EmailChannel como stub funcional (mesma interface) está especificado? [Clareza, Spec §US3 + data-model §EmailChannel.send] {auto}
- [ ] CHK039 - É o conteúdo agregado do digest (texto/contagem/contexto pastoral) especificado o suficiente para implementação sem nova decisão? [Ambiguity, Spec §US4 AC1 + data-model §Digest — exemplo dado, formato exato em aberto] {auto}

## Premissas, dependências & julgamento de produto

- [x] CHK040 - As dependências de infra reusada (BullMQ/Redis/RequestContext/withTenantTx) estão documentadas como premissa? [Assumption, plan §Summary + §Project Structure "REUSADO"] {auto}
- [ ] CHK041 - O escopo MVP (infra + endpoints mínimos, notification center completo = Story 14.2x) reflete a prioridade de produto correta? [Risco, contracts/notifications-api.md nota de escopo] {humano}
- [ ] CHK042 - A profundidade de resiliência (3 retries / janela 5min default) atende o SLA pastoral esperado pelo produto? [Risco, Spec §FR-009 + §FR-008 — valores default propostos] {humano}

## Notes

- Items `{auto}` vêm resolvidos: `[x]` com evidência citada, ou `[ ]` com marcador de gap.
- Items `{humano}` ficam `[ ]` aguardando decisão do dono do produto.
- Gaps abertos (`[Ambiguity]`): CHK007, CHK016, CHK039.
- Decisões de produto (`{humano}`): CHK024, CHK041, CHK042.
