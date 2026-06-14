# Research: upgrade-prompt-limites

**Gerado por**: pipeline feature-00c (plan / Phase 0), 2026-06-14

Sem NEEDS CLARIFICATION pendentes (clarify resolveu dec-007..011). Esta pesquisa
consolida as decisões de design a partir do código REAL inspecionado.

---

## Decision D1 — Localização do mapeamento `resource → texto pastoral`

**Decision**: o mapeamento `resource` (en) → texto PT-BR pastoral ocorre no
**frontend** (`apps/web/src/lib/errors/error-messages.ts` + `pt-BR.json`), não no
backend.

**Rationale**: FR-006 / dec-009 — o campo `message` do 403 é dado técnico de log e
DEVE permanecer em inglês. Constitution §III: mensagens user-facing são
centralizadas em `apps/web/messages/pt-BR.json`. O backend já envia `details.resource`
canônico (`groups`/`membersPerGroup`/`leadersPerTenant`); traduzir é
responsabilidade do FE. Verificado em `plan-limits.guard.ts:48-53`.

**Alternatives considered**:
- *Backend retornar `details.errorKey` PT-BR pré-resolvido*: rejeitado — acopla
  i18n ao backend, contraria §III, e o `resolveError` já tem caminho `errorKey`
  só para casos onde o BE conhece a chave (não é o caso aqui).
- *Backend traduzir `message` para PT-BR*: rejeitado — viola dec-009 (message é log).

---

## Decision D2 — Estrutura das chaves PT-BR

**Decision**: chaves por recurso aninhadas sob `error.plan.limit.<resource>` +
uma genérica `error.plan.limitGeneric` para fallback.

**Rationale**: respeita a convenção de namespacing existente em `pt-BR.json`
(`error.<area>.<key>`, ex: `error.notFound.group`). Uma chave por recurso satisfaz
FR-002 (mensagens distintas) e permite snapshot test por recurso (SC-3). Evita o
anti-padrão atual de interpolar `{resource}` cru (que renderiza o token inglês).

**Alternatives considered**:
- *Manter chave única `limitReached` com `{resource}` interpolado*: rejeitado — é
  exatamente o bug que viola FR-001/FR-008 (mostra `groups` em inglês).
- *Mapa `resource → substantivo` + template único*: viável, mas menos legível para
  tradutores e impede frases específicas por recurso (P2 precisa diferenciar
  "capacidade do grupo" de "limite da conta"). Rejeitado em favor de textos
  completos por recurso.

---

## Decision D3 — Forma do mapa no código (tipagem + fallback)

**Decision**: `resolveError` resolve um `errorKey` por recurso via mapa tipado
(`Record<PlanLimitedResource, string>` espelhando o enum do backend). `resource`
ausente/desconhecido OU template com `{` remanescente → `error.plan.limitGeneric`.

**Rationale**: Constitution §II (`strict: true`). FR-005 exige que nenhum
placeholder vaze; o guard de `{` remanescente (já existente no `resolveError`,
linhas 82-91) é reutilizado/estendido. Tenant override é coberto automaticamente:
`details.current/limit` já carregam os valores resolvidos por `hasCapacity`
(override > plano > fallback), então a mensagem usa o valor real (Edge Case da spec).

**Alternatives considered**:
- *Switch/case sobre `resource`*: equivalente, mas mapa é mais declarativo e
  testável por snapshot.
- *Validar `resource` com Zod*: rejeitado — scope creep (dec-011 limita a 2
  arquivos); narrowing `typeof` + fallback é suficiente e seguro.

---

## Decision D4 — Ação acionável: texto orientativo sem link (dec-010)

**Decision**: cada mensagem inclui "Fale com o administrador para ampliar o plano"
— texto orientativo, SEM link para `/planos` ou `/configuracoes`.

**Rationale**: dec-010 — a rota `/planos` existe (PR #65, contexto marketing), mas
misturar contexto marketing em um erro de área autenticada aumenta blast radius sem
ganho claro. FR-004 aceita "contato para upgrade" como orientação suficiente.

**Alternatives considered**:
- *Link para `/planos`*: rejeitado por dec-010 (blast radius + contexto misto).
- *CTA "Fazer upgrade" com ação*: fora de escopo (dec-011: sem mudança no mecanismo
  de exibição/toast).

---

## Decision D5 — Atualização do teste existente (não é regressão)

**Decision**: o teste `error-messages.spec.ts` que passa `resource: 'grupos'` (PT
manual) e espera `'3/3 grupos'` será ATUALIZADO para o contrato real: o backend
envia `resource: 'groups'` (en) e a saída esperada é o texto pastoral
("comunidades de cuidado").

**Rationale**: o teste atual afirma um comportamento INCORRETO (assume que o
backend envia o substantivo PT pronto, o que `plan-limits.guard.ts:52` desmente — ele
envia `resource` canônico em inglês). SC-4 ("no regression") refere-se a preservar
comportamento CORRETO; corrigir um teste que mascarava bug não é regressão. Os demais
testes de `resolveError` (permission, notFound, network, unknown, statusCode,
"never echoes raw message") são preservados intactos.

**Alternatives considered**:
- *Manter o teste antigo + adicionar novos*: rejeitado — manteria asserção falsa
  sobre o contrato e poderia passar por acidente (alias retrocompat), escondendo o bug.

---

## Inspeção empírica (código real consultado)

- `apps/api/src/common/plan-limits/plan-limits.guard.ts:48-53` — throw 403 com
  `details: { resource, plan, current, limit }`, `resource` canônico em inglês.
- `apps/api/src/common/plan-limits/plan-limits.config.ts` — `PlanLimitedResource =
  'groups' | 'membersPerGroup' | 'leadersPerTenant'`; `PLAN_LIMITS_FALLBACK`.
- `apps/api/src/common/plan-limits/plan-limits.service.ts:161-202` — `hasCapacity`
  resolve `limit` dinâmico (override > plano > fallback) sob `withTenantTx`.
- `apps/api/src/group-members/group-members.service.ts` — lança `membersPerGroup` /
  `leadersPerTenant` com a MESMA estrutura de `details` (não via decorator).
- `apps/api/src/common/filters/http-exception.filter.ts` — preserva `details`;
  `'PlanLimitReached' ∈ ALLOWED_DOMAIN_ERRORS`.
- `apps/web/src/lib/errors/error-messages.ts` — `resolveError`; `ERROR_NAME_TO_KEY`
  mapeia `PlanLimitReached → plan.limitReached`; `interpolate` deixa `{key}` quando
  valor ausente; guard de `{` remanescente cai em `*Generic`.
- `apps/web/messages/pt-BR.json:1056-1059` — `error.plan.limitReached` (com bug
  `{resource}`) + `limitReachedGeneric`.
- `apps/web/src/lib/errors/__tests__/error-messages.spec.ts` — teste com
  `resource: 'grupos'` (a corrigir, D5).
