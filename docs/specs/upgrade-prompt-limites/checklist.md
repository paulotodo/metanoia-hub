# Quality Checklist: upgrade-prompt-limites

**Purpose**: Validar a QUALIDADE dos requisitos/plano (não da implementação) antes de `/create-tasks` — "unit tests for English". Cobre testabilidade, cobertura de FRs, alinhamento com a constitution (PT-BR user-facing / inglês log; multi-tenant; vocabulário pastoral) e edge cases.
**Created**: 2026-06-14
**Feature**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/error-details.md](./contracts/error-details.md)
**Gerado por**: pipeline feature-00c (checklist, onda-003)

> Items `{auto}` foram resolvidos contra os artefatos com evidência citável; `[x]` = satisfeito, `[ ]` + `[Gap]`/`[Ambiguity]`/`[Conflict]` = aberto. Items `{humano}` ficam `[ ]` aguardando o dono do produto.

---

## Completude de Requisitos

- [x] CHK001 - São os 3 recursos limitados (`groups`, `membersPerGroup`, `leadersPerTenant`) enumerados como conjunto fechado nos requisitos? [Completude, Spec §FR-007 / data-model §PlanLimitedResource] {auto} — Spec FR-007 lista os 3 valores canônicos; data-model.md tabela "PlanLimitedResource". Verificado contra o enum real: `apps/api/src/common/plan-limits/plan-limits.config.ts:41-47` (`PlanResourceLimits { groups; membersPerGroup; leadersPerTenant }`).
- [x] CHK002 - O requisito de fallback genérico (FR-005) define explicitamente os gatilhos (`resource` ausente, desconhecido, OU `{` remanescente)? [Completude, Spec §FR-005 / contracts §regra 4] {auto} — contracts/error-details.md regra 4 lista os 3 gatilhos; coerente com guard de `{` já existente em `error-messages.ts:80-91`.
- [x] CHK003 - O requisito que mantém o `message` do backend em inglês (FR-006) está documentado com a razão (dado de log)? [Completude, Spec §FR-006 / dec-009] {auto} — FR-006 + Clarifications Q3 (score 3, três fontes convergem).
- [x] CHK004 - O contrato do payload 403 (`{ resource, plan, current, limit }`) está documentado como borda BE↔FE congelada? [Completude, contracts/error-details.md] {auto} — contracts/error-details.md "Shape do envelope". Verificado contra `plan-limits.guard.ts:52` e `group-members.service.ts:153,170`.
- [x] CHK005 - Cada FR (001–010) tem mapeamento explícito para onde a mudança ocorre? [Completude, plan §"Mapeamento concreto do FR → mudança"] {auto} — plan.md tabela FR→mudança cobre FR-001..FR-010.

## Clareza de Requisitos (não-ambiguidade)

- [x] CHK006 - O glossário pastoral canônico está fixado sem ambiguidade por recurso? [Clareza, Spec §Clarifications Q1 / data-model] {auto} — `groups`→"comunidades de cuidado", `membersPerGroup`→"participantes do grupo", `leadersPerTenant`→"pastores/líderes ativos" (dec-007).
- [x] CHK007 - O termo "ação acionável" (FR-004) está concretizado em texto específico em vez de adjetivo vago? [Clareza, Spec §Clarifications Q4 / research D4] {auto} — dec-010 fixa "Fale com o administrador para ampliar o plano", SEM link.
- [x] CHK008 - O escopo "frontend-only, 2 arquivos de produção" está delimitado sem ambiguidade (o que muda e o que NÃO muda)? [Clareza, plan §Project Structure / dec-011] {auto} — plan.md lista `pt-BR.json` + `error-messages.ts` [MODIFICAR]; backend e `client.ts`/filtros como REFERÊNCIA (não modificar).
- [ ] CHK009 - A transição das chaves existentes `error.plan.limitReached` / `limitReachedGeneric` para as novas (`error.plan.limit.<resource>` + `limitGeneric`) está especificada de forma inequívoca, ou deixada como decisão da /execute-task? [Ambiguity, plan §"Chaves PT-BR propostas" nota] {auto} — plan.md explicita "a /execute-task decide a transição (substituir vs alias)". É deferimento DELIBERADO e documentado (não silencioso), mas a estrutura nova (`error.plan.limit.groups`) é INCOMPATÍVEL com o fallback atual `${mappedKey}Generic` de `error-messages.ts:84` — que produziria `plan.limit.groupsGeneric`, não `plan.limitGeneric`. Reconciliar esse mecanismo de fallback DEVE entrar como subtask explícita no /create-tasks. Marcado `[ ]` para forçar o follow-up; não é lacuna da spec, é detalhe de implementação a rastrear.

## Consistência de Requisitos (sem conflitos)

- [x] CHK010 - O requisito "message em inglês" (FR-006) é consistente com a regra do projeto (código/log inglês, user-facing PT-BR)? [Consistência, Spec §FR-006 / Constitution §III] {auto} — convergente; CLAUDE.md "Code/logs: English; user-facing: PT-BR".
- [x] CHK011 - O AC de P2 (membersPerGroup) é consistente após remoção de "dividir grupo"? [Consistência, Spec §P2 / Clarifications Q2] {auto} — dec-008: `splitGroup` não existe no código (busca confirmada); AC corrigido para "falar com administrador".
- [x] CHK012 - A decisão de NÃO validar `details` com Zod é consistente com o estado atual e com o escopo cirúrgico? [Consistência, plan §"Validação Zod" / dec-011] {auto} — plan.md: `details?: unknown` no FE hoje; introduzir Zod = scope creep + snapshot novo. Mantido.
- [x] CHK013 - O contrato congelado (`current`/`limit` já resolvidos por override) é consistente com o Edge Case de tenant override da spec? [Consistência, Spec §P1 Edge Case / data-model "Cobertura de override"] {auto} — `hasCapacity` resolve override>plano>fallback (`plan-limits.service.ts:161-202` ref. em research); FE usa valor real.

## Qualidade de Critérios de Aceite (mensurabilidade)

- [x] CHK014 - Os Success Criteria (SC-1..SC-5) são objetivamente verificáveis? [Mensurabilidade, Spec §Success Criteria] {auto} — SC-1 "zero strings inglês/placeholder" (verificável por teste de `{` e por inspeção de texto), SC-3 "3 mensagens distintas" (snapshot), SC-4 "sem regressão" (suíte BE), SC-5 "fallback sem placeholder" (unit). SC-2 é qualitativo mas suportado por dec-010 (texto de ação fixo).
- [x] CHK015 - O FR-010 (cobertura por testes) lista os 3 aspectos a verificar de forma mensurável? [Mensurabilidade, Spec §FR-010] {auto} — interpolação correta + fallback sem placeholders + mapeamento por recurso.
- [x] CHK016 - O critério "nunca exibe `{` literal" (FR-005) é binário/automatizável? [Mensurabilidade, Spec §FR-005 / contracts regra 4] {auto} — guard `interpolated.includes('{')` já existe (`error-messages.ts:80`); testável por `expect(r.message).not.toContain('{')`.

## Cobertura de Cenários e Edge Cases

- [x] CHK017 - Os 4 cenários (P1 grupos, P2 membros, P3 líderes, P4 fallback) cobrem os 3 recursos + o caminho sem details? [Cobertura, Spec §User Scenarios P1-P4] {auto} — P1/P2/P3 = 3 recursos; P4 = fallback genérico.
- [x] CHK018 - O edge case "resource desconhecido → fallback genérico" está coberto nos requisitos? [Cobertura/Edge, Spec §FR-005 / data-model "ResourceMessageMap" linha desconhecido] {auto} — mapa: "(desconhecido/ausente) → error.plan.limitGeneric".
- [x] CHK019 - O edge case "enterprise / limite Infinity nunca gera 403" está documentado como fora do alcance do FE? [Cobertura/Edge, Spec §P1 Edge Case / data-model "Cobertura enterprise"] {auto} — `hasCapacity` retorna `allowed:true` para Infinity; 403 não chega ao FE.
- [x] CHK020 - O edge case "tenant override → mensagem usa valor real, não default do plano" está coberto sem trabalho extra no FE? [Cobertura/Edge, Spec §P1 Edge Case / data-model] {auto} — `current`/`limit` já resolvidos no payload; FE só interpola.
- [x] CHK021 - O cenário de regressão (teste existente com `resource:'grupos'` PT que mascara o bug) está identificado e endereçado? [Cobertura, research §D5 / plan §FR-010] {auto} — research D5 + plan: teste `error-messages.spec.ts:21-34` será ATUALIZADO para o contrato real (`resource:'groups'` → texto pastoral). Verificado: o teste atual de fato afirma `r.message).toContain('3/3 grupos')` com `resource:'grupos'`.

## Requisitos Não-Funcionais (constitution / segurança)

- [x] CHK022 - O alinhamento com Constitution §III (PT-BR user-facing / inglês log) está validado no Constitution Check do plano? [NFR, plan §Constitution Check III] {auto} — PASS reforçado; mapa elimina `{resource}` cru.
- [x] CHK023 - O princípio Multi-tenancy (§I) está corretamente avaliado como N/A com justificativa? [NFR, plan §Constitution Check I] {auto} — feature não toca DB/RLS/policies/`tenant_id`; backend que lança o erro já roda sob `withTenantTx` (inalterado).
- [x] CHK024 - O princípio Type-Safety (§II `strict:true`) está mantido com mapa tipado? [NFR, plan §Constitution Check II / research D3] {auto} — `Record<PlanLimitedResource, string>`; sem `uuid`/datas.
- [x] CHK025 - A superfície de segurança (vazamento cross-tenant, exposição de `message`, injeção, placeholders) foi analisada para o gate owasp? [NFR/Segurança, plan §Segurança] {auto} — 4 vetores cobertos: limites são do próprio tenant; FE nunca renderiza `message` (teste 'never echoes raw message'); sem `eval`/`dangerouslySetInnerHTML`; fallback para `{`.
- [x] CHK026 - O contrato de erro padronizado (§IV) permanece inalterado? [NFR, plan §Constitution Check IV] {auto} — `{ statusCode, error, message, details? }` intacto; sem novo endpoint/schema Zod de request/response.

## Testabilidade (FR-010 + i18n)

- [x] CHK027 - O requisito de teste de mapeamento por recurso (3 recursos → 3 textos distintos) é especificado? [Testabilidade, Spec §FR-010 / SC-3 / plan FR-002 row] {auto} — snapshot do mapa `resource→texto`.
- [x] CHK028 - O requisito das 4 chaves novas em `pt-BR.json` está especificado e o arquivo é testável (JSON válido)? [Testabilidade, plan §"Chaves PT-BR propostas"] {auto} — 4 chaves: `error.plan.limit.{groups,membersPerGroup,leadersPerTenant}` + `error.plan.limitGeneric`. Verificado empiricamente: `node -e JSON.parse(pt-BR.json)` → "valid JSON". As chaves atuais existem em `pt-BR.json:1056-1058`.
- [x] CHK029 - O requisito de fallback sem placeholder visível é especificado como teste unitário (FR-010)? [Testabilidade, Spec §FR-010 / FR-005] {auto} — `expect(r.message).not.toContain('{')`.
- [x] CHK030 - A não-regressão dos testes existentes de `resolveError` (permission, notFound, network, unknown, statusCode, 'never echoes raw message') está documentada como invariante? [Testabilidade, research §D5 / SC-4] {auto} — research D5: demais testes preservados intactos. Verificado: 8 outros casos em `error-messages.spec.ts:43-94`.

## Dependências e Premissas

- [x] CHK031 - A premissa "infraestrutura ponta-a-ponta já existe e está testada" foi validada empiricamente contra o código real? [Premissa, plan §Summary / research §"Inspeção empírica"] {auto} — verificado nesta onda: guard (`plan-limits.guard.ts:48-52`), service (`group-members.service.ts:153,170`), config enum (`plan-limits.config.ts:41-47`), FE `resolveError` (`error-messages.ts`), bug `pt-BR.json:1057`.
- [x] CHK032 - A premissa "único caller de `resolveError` é conhecido" está registrada como dependência a confirmar na implementação? [Premissa, plan §"Chaves PT-BR propostas" nota] {auto} — plan.md: "única referência conhecida é resolveError" — a /execute-task deve manter callers consistentes.
- [x] CHK033 - A dependência do enum FE espelhar (não importar) o backend está documentada com a razão? [Premissa/Dependência, plan §Phase 1 / data-model invariante] {auto} — pacote separado; espelhamento documentado; backend é fonte da verdade.

## Itens de Julgamento (dono do produto)

- [ ] CHK034 - O texto pastoral proposto (esboço em plan §"Chaves PT-BR propostas") tem o tom acolhedor/não-punitivo adequado à marca, ou o copy final precisa de revisão de um pastor/UX writer antes do merge? [Risco/Tom, Spec §FR-009] {humano} — texto exato é decisão da /execute-task; validação de voz pastoral é julgamento humano.
- [ ] CHK035 - A decisão de OMITIR link para `/planos` (dec-010, só texto orientativo) atende ao apetite de UX do produto, ou o CTA acionável agrega valor suficiente para reavaliar o blast radius? [Risco/Negócio, Spec §Clarifications Q4 / research D4] {humano} — trade-off blast-radius × conversão; depende de preferência de produto.

## Notes

- `{auto}` resolvidos: 33 de 35 (`[x]` com citação). 1 aberto como `[Ambiguity]` (CHK009) deliberadamente, para forçar follow-up no /create-tasks.
- `{humano}` aguardando decisão: 2 (CHK034 tom/copy pastoral; CHK035 link vs texto).
- Nenhum `[Gap]` de requisito ausente, nenhum `[Conflict]`. A spec+plan estão completas e internamente consistentes; o único item aberto auto é um detalhe de implementação (reconciliação do fallback `${mappedKey}Generic`) que pertence ao /create-tasks, não à spec.

### Follow-up obrigatório (gaps viram ação)

| Item | Marcador | Destino |
|------|----------|---------|
| CHK009 | `[Ambiguity]` (impl detail) | `/create-tasks` — subtask explícita: reconciliar fallback `${mappedKey}Generic` com chaves nested `error.plan.limit.<resource>` + `limitGeneric`; e migrar/alias `limitReached` (caller único: `resolveError`). |
| CHK034 | `{humano}` | revisão de copy pastoral (UX writer/pastor) antes do merge |
| CHK035 | `{humano}` | decisão de produto: texto orientativo vs CTA com link |

### Próximos passos

- Decidir CHK034/CHK035 (dono do produto) — não bloqueiam `/create-tasks`, mas CHK034 deve ser resolvido antes do merge.
- `/create-tasks` — decompor em backlog, incluindo a subtask de reconciliação do fallback (CHK009).
