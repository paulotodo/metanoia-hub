# Plano de Implementação: Melhoria das Mensagens de Limite de Plano

**Feature**: upgrade-prompt-limites
**Spec**: `docs/specs/upgrade-prompt-limites/spec.md` (Clarified)
**Gerado por**: pipeline feature-00c (plan), onda-003, 2026-06-14

---

## Summary

**Requisito primário**: substituir as mensagens de limite de plano (hoje em inglês com termos técnicos) por mensagens **PT-BR com vocabulário pastoral, distintas por recurso e acionáveis**, sem placeholders literais vazando para o usuário.

**Abordagem técnica**: a infraestrutura ponta-a-ponta JÁ EXISTE e está testada — o backend (`PlanLimitsGuard`, Story 3-3; `group-members.service`, Story 4-2) já lança 403 com `details: { resource, plan, current, limit }`, o `AllExceptionsFilter` (Story 7-3) já preserva `details`, e o frontend `resolveError` (`error-messages.ts`) já interpola a partir de `details`. A feature é **cirúrgica e single-conceptual**: o trabalho concentra-se em (a) `apps/web/messages/pt-BR.json` — adicionar chaves PT-BR pastorais por recurso + fallback genérico; e (b) `apps/web/src/lib/errors/error-messages.ts` — fazer `resolveError` **mapear `details.resource` (valor técnico em inglês) para a chave/texto pastoral correto**, em vez de interpolar `{resource}` cru (bug latente atual). Backend não muda (o `details.resource` já é canônico). Cobertura por testes unit (`error-messages.spec.ts`) + snapshot do mapeamento.

**Bug latente descoberto** (justifica a feature além da spec): hoje `error.plan.limitReached` = `"Limite do plano atingido ({current}/{limit} {resource}). ..."`. O `{resource}` interpola o valor BRUTO do backend (`groups`/`membersPerGroup`/`leadersPerTenant` — inglês técnico). Logo a mensagem renderizada hoje seria `"... (3/3 groups). ..."` — viola FR-001 (sem termos técnicos) e Constitution §III (vocabulário pastoral). O teste existente mascara isso passando `resource: 'grupos'` (PT manual), que o backend nunca envia.

---

## Constitution Check

*GATE: deve passar antes do design. Re-checado pós-design (ETAPA 7).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | N/A | Feature não toca DB, RLS, policies nem `tenant_id`. Nenhuma query, nenhuma migration. O backend que lança o erro já roda sob `withTenantTx` (inalterado). |
| II. Type-Safety & IDs | PASS | `strict: true` mantido; sem `uuid`, sem datas. Mapeamento `resource → key` será tipado (`Record<PlanLimitedResource, string>` ou união literal). |
| III. Idioma & Vocabulário Pastoral | PASS (é o objeto da feature) | Backend `message` permanece inglês (dado de log — dec-009/FR-006). User-facing 100% PT-BR pastoral em `pt-BR.json`. Glossário canônico (dec-007): `groups`→"comunidades de cuidado", `membersPerGroup`→"participantes do grupo", `leadersPerTenant`→"pastores/líderes ativos". |
| IV. Contratos de API Padronizados | PASS | Contrato de erro `{ statusCode, error, message, details? }` inalterado. `details: { resource, plan, current, limit }` já existe e é mantido. Sem novo endpoint, sem mudança de schema Zod no payload de request/response. |
| V. Separação de Estado FE | N/A | `resolveError` é função pura, sem TanStack/Zustand. Consumida onde o erro é capturado (toast já existente — dec-011). |
| VI. Qualidade Verificável | PASS | Testes unit de interpolação + fallback + mapeamento por recurso (FR-010); snapshot do mapa `resource→texto` (SC-3). Sem mudança de RLS → sem RLS spec. WCAG: texto apenas, sem novo componente visual (dec-011). CI verde obrigatório. |
| VII. Processo de Entrega Auditável | PASS | 1 feature = 1 PR focado (dec-011, escopo cirúrgico em 2 arquivos + 1 spec de teste). Commits PT-BR. |

**Resultado do gate**: PASS — nenhuma violação MUST. Prosseguir.

---

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript (`strict: true`) — frontend Next.js 16 (App Router) |
| Runtime alvo | Browser (Client Components) — `resolveError` é chamada onde o erro do fetch é tratado |
| Deps relevantes | Nenhuma nova. Reusa `messages/pt-BR.json` (i18n via import estático) + `ApiError` (`apps/web/src/lib/api/client.ts`) |
| Backend afetado | **Nenhum** — `details.resource` já é canônico em inglês. Sem mudança em `apps/api`. |
| Armazenamento | N/A — feature stateless, sem dados persistidos |
| Testes | Vitest (`*.spec.ts`) — `apps/web/src/lib/errors/__tests__/error-messages.spec.ts` |
| Constraints | (1) sem termo técnico ao usuário; (2) sem `{` literal na tela; (3) `message` backend inglês intacto; (4) nenhuma regressão nos testes BE existentes |
| NEEDS CLARIFICATION | 0 — todas resolvidas na clarify (dec-007..011) |

---

## Phase 0 — Research

Sem unknowns técnicos pendentes (clarify resolveu dec-007..011). Decisões de design consolidadas em `research.md`. Síntese:

- **D1 — Onde mapear `resource → texto pastoral`**: no frontend (`error-messages.ts`), NÃO no backend. Razão: FR-006/dec-009 (backend `message` em inglês, é log); a localização é responsabilidade do FE (Constitution §III: user-facing centralizado em `pt-BR.json`). O backend já envia `resource` canônico — basta o FE traduzir.
- **D2 — Estrutura das chaves PT-BR**: chaves por recurso aninhadas sob `error.plan.limit.*` (uma por `resource`) + uma genérica de fallback. Mantém a convenção de namespacing existente (`error.<area>.<key>`). Evita o anti-padrão de interpolar `{resource}` cru.
- **D3 — Forma do mapa no código**: `Record<PlanLimitedResource, errorKey>` tipado, com `resource` desconhecido → fallback genérico (FR-005). Cobre tenant override (mensagem usa `current`/`limit` reais do `details`, não default do plano — Edge Case da spec já satisfeito, pois `details` carrega os valores resolvidos pelo `hasCapacity`).
- **D4 — Ação acionável (dec-010)**: texto orientativo "fale com o administrador para ampliar o plano" — SEM link/rota (evita misturar contexto marketing em erro autenticado).
- **D5 — Compat do teste existente**: o teste `error-messages.spec.ts` que hoje passa `resource: 'grupos'` (PT) e espera `'3/3 grupos'` será ATUALIZADO para refletir o contrato real (`resource: 'groups'` → texto pastoral "comunidades de cuidado"). Isto é correção de teste que mascarava bug, não regressão funcional (SC-4 fala de "no regression" sobre comportamento correto; o teste antigo afirmava comportamento incorreto).

---

## Phase 1 — Design

### Modelo de Dados

Sem entidades persistidas novas (feature stateless). As "entidades" são conceituais (ver `data-model.md`):

- **`PlanLimitedResource`** (tipo já existente em `apps/api/src/common/plan-limits/plan-limits.config.ts`): união `'groups' | 'membersPerGroup' | 'leadersPerTenant'`. O frontend define sua própria união literal espelhando esses 3 valores (não importa do backend — pacote separado; espelhamento documentado).
- **`details` do erro 403** (em trânsito, não persistido): `{ resource: string, plan: string, current: number, limit: number }`. Inalterado.
- **Mapa de localização** (config FE): `resource (en) → errorKey PT-BR pastoral`.

### Contratos de Interface

Sem novo endpoint. O contrato relevante é o **shape do `details` do erro 403** (consumido pelo FE) — documentado em `contracts/error-details.md`. Já implementado no backend; o plano apenas o congela como contrato de borda BE↔FE.

### Quickstart / Cenários

Ver `quickstart.md`. Inclui cenário roundtrip conceitual (FE recebe payload real do guard) cobrindo os 3 recursos + fallback.

---

## Convenções de Borda

Feature atravessa BE (lança 403 com `details`) ↔ FE (mapeia para PT-BR). Fonte da verdade de cada convenção:

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| Backend `message` (403) | inglês técnico, livre | nenhuma (é log) | `apps/api/src/common/plan-limits/plan-limits.guard.ts:51` (inalterado) |
| Backend `details.resource` | camelCase canônico em inglês (`groups`/`membersPerGroup`/`leadersPerTenant`) | tipo `PlanLimitedResource` | `apps/api/src/common/plan-limits/plan-limits.config.ts` (fonte da verdade do enum) |
| API payload de erro | camelCase (`{ statusCode, error, message, details }`) | `AllExceptionsFilter` molda; `error: 'PlanLimitReached'` ∈ `ALLOWED_DOMAIN_ERRORS` | `apps/api/src/common/filters/http-exception.filter.ts` |
| FE `ApiError.details` | camelCase (espelha payload) | `unknown` → cast em `resolveError` | `apps/web/src/lib/api/client.ts` |
| Texto user-facing | PT-BR pastoral, chaves `error.plan.*` | lookup em `resolveError` | `apps/web/messages/pt-BR.json` |
| Mapa `resource → errorKey` | chave camelCase en → string PT-BR | `Record` tipado + fallback | `apps/web/src/lib/errors/error-messages.ts` |

**Mapper layer (BE `resource` en ↔ FE texto PT-BR)**: localização = `apps/web/src/lib/errors/error-messages.ts` (novo mapa `RESOURCE_TO_KEY` ou lógica equivalente dentro de `resolveError`). Responsável: frontend. ORM auto-mapping: N/A.

**Validação Zod**: borda = response (erro). O `details` do erro NÃO possui schema Zod hoje (`details?: unknown` no FE, `Record<string, unknown>` no BE) — e a feature **não introduz** um (escopo dec-011 = só `pt-BR.json` + `error-messages.ts`). Decisão: manter `details` não-validado por Zod (consistente com o estado atual; introduzir schema seria scope creep e exigiria snapshot Zod novo). O FE faz narrowing defensivo (`typeof`/fallback) — ver §Segurança.

---

## Project Structure

### Documentação (feature dir)

```
docs/specs/upgrade-prompt-limites/
├── spec.md            (existente, Clarified)
├── plan.md            (este arquivo)
├── research.md        (decisões D1–D5)
├── data-model.md      (entidades conceituais)
├── quickstart.md      (cenários P1–P4 + roundtrip)
└── contracts/
    └── error-details.md  (contrato do details 403, congelado)
```

### Source code (arquivos REAIS afetados)

```
apps/web/
├── messages/pt-BR.json                              [MODIFICAR] +chaves error.plan.limit.* + genérica
└── src/lib/errors/
    ├── error-messages.ts                            [MODIFICAR] resolveError mapeia resource→key pastoral
    └── __tests__/error-messages.spec.ts             [MODIFICAR] atualizar teste que usa resource:'grupos';
                                                                  +casos por recurso + snapshot do mapa

# REFERÊNCIA (não modificar — fontes da verdade / regressão a preservar):
apps/api/src/common/plan-limits/plan-limits.guard.ts          (throw 403 + details — inalterado)
apps/api/src/common/plan-limits/plan-limit.decorator.ts       (enum resource — inalterado)
apps/api/src/common/plan-limits/plan-limits.config.ts         (PlanLimitedResource — fonte do enum)
apps/api/src/common/plan-limits/plan-limits.service.ts        (hasCapacity resolve limit dinâmico — inalterado)
apps/api/src/group-members/group-members.service.ts           (lança membersPerGroup/leadersPerTenant — inalterado)
apps/api/src/common/filters/http-exception.filter.ts          (preserva details — inalterado)
apps/web/src/lib/api/client.ts                                (ApiError carrega details — inalterado)
```

### Mapeamento concreto do FR → mudança

| FR | Onde | O quê |
|----|------|-------|
| FR-001, FR-008 | `error-messages.ts` + `pt-BR.json` | mapear `resource` → texto pastoral; nunca interpolar `{resource}` cru |
| FR-002 | `pt-BR.json` | 3 chaves distintas: `error.plan.limit.groups`, `.membersPerGroup`, `.leadersPerTenant` |
| FR-003 | `pt-BR.json` | cada chave interpola `{current}`/`{limit}` (valores reais do `details`, cobre override) |
| FR-004, dec-010 | `pt-BR.json` | cada texto inclui "fale com o administrador para ampliar o plano" (sem link) |
| FR-005 | `error-messages.ts` + `pt-BR.json` | `resource` desconhecido/ausente OU `{` remanescente → `error.plan.limitGeneric` |
| FR-006, dec-009 | BE (inalterado) | `message` permanece inglês; FE nunca exibe `message` |
| FR-007 | BE (inalterado) | `details: { resource, plan, current, limit }` já garantido |
| FR-009 | `pt-BR.json` | tom acolhedor em todos os textos |
| FR-010 | `error-messages.spec.ts` | unit: interpolação correta, fallback sem `{`, mapa por recurso, snapshot |

### Chaves PT-BR propostas (`error.plan.*` — texto final na implementação)

Estrutura (texto exato é decisão da `/execute-task`; aqui a forma + glossário):

```
error.plan.limit.groups          → "Você alcançou o limite de comunidades de cuidado do seu plano ({current}/{limit}). Fale com o administrador para ampliar o plano."
error.plan.limit.membersPerGroup → "Esta comunidade de cuidado já reúne o máximo de participantes do grupo ({current}/{limit}) permitido no plano. Fale com o administrador para ampliar o plano."
error.plan.limit.leadersPerTenant→ "Você alcançou o limite de pastores/líderes ativos do seu plano ({current}/{limit}). Fale com o administrador para ampliar o plano."
error.plan.limitGeneric          → "Você alcançou um limite do seu plano. Fale com o administrador para ampliar o plano."
```

> Nota: as chaves existentes `error.plan.limitReached` / `limitReachedGeneric` podem ser (a) mantidas como alias retrocompat OU (b) substituídas pelas novas. Decisão recomendada: **substituir** `limitReached` (cuja interpolação `{resource}` é o bug) e manter `limitReachedGeneric` semanticamente como `limitGeneric`. A `/execute-task` decide a transição mantendo todos os callers consistentes (única referência conhecida é `resolveError`).

---

## Segurança (avaliação para gate owasp-security)

Superfície analisada:

- **Vazamento cross-tenant de limites**: o `details.current/limit` vem de `hasCapacity(tenantId, ...)` sob `withTenantTx` (RLS). São os limites DO PRÓPRIO tenant que recebeu o 403 — exibi-los ao próprio admin não é vazamento (é o dado dele). Sem risco de exposição de outro tenant; a feature FE não acessa dados de tenant nenhum.
- **Exposição de `message` técnico**: FR-006/dec-009 garante que o FE NUNCA renderiza `message` (inglês/log). `resolveError` só usa `details` + chaves PT-BR. Teste existente (`'never echoes the raw backend message'`) já protege isso e deve ser mantido.
- **Injeção via `details`**: `details` é dado do backend confiável, não input do usuário. Ainda assim o FE faz narrowing (`typeof`) e fallback — sem `eval`/`dangerouslySetInnerHTML` (texto puro em toast). Sem XSS.
- **Placeholders vazando** (FR-005): mitigado pelo fallback genérico quando `resource` desconhecido ou `{` remanescente.

**Conclusão**: superfície de segurança mínima; nenhum endpoint, nenhum dado novo, nenhuma mudança de autorização/RLS. Gate owasp-security esperado PASS (sem findings critical/high).

---

## Complexity Tracking

Nenhuma violação de constitution. Nenhuma complexidade não-justificada (escopo cirúrgico, 2 arquivos de produção + 1 de teste). Tabela vazia.

---

## Re-check de Constitution (pós-design)

| Princípio | Status pós-design | Nota |
|-----------|-------------------|------|
| III. Idioma & Pastoral | PASS reforçado | mapa `resource→texto` elimina o `{resource}` cru; 100% PT-BR pastoral |
| IV. Contratos | PASS | nenhuma mudança de contrato; `details` congelado como borda |
| VI. Qualidade | PASS | plano de teste cobre os 3 recursos + fallback + snapshot |

Design não introduziu camada/serviço novo. Gate final PASS.

---

## Artefatos

| Arquivo | Status |
|---------|--------|
| docs/specs/upgrade-prompt-limites/plan.md | Criado |
| docs/specs/upgrade-prompt-limites/research.md | Criado |
| docs/specs/upgrade-prompt-limites/data-model.md | Criado |
| docs/specs/upgrade-prompt-limites/contracts/error-details.md | Criado |
| docs/specs/upgrade-prompt-limites/quickstart.md | Criado |

**NEEDS CLARIFICATION restantes**: 0

### Próximos passos

1. `/checklist` — quality gate antes de implementar
2. `/create-tasks` — decompor em backlog executável
