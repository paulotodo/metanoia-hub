# Spec: Melhoria das Mensagens de Limite de Plano

**Feature**: upgrade-prompt-limites  
**Status**: Clarified  
**Criado em**: 2026-06-14  
**Gerado por**: pipeline feature-00c (specify)

---

## Contexto

Quando um tenant atinge o limite de recursos do seu plano (grupos, membros por grupo, líderes por tenant), o sistema exibe mensagens de erro ao usuário. As mensagens atuais:

- Estão em inglês no backend (`Plan ${plan} allows up to ${limit} ${resource}; current count: ${current}.`)
- Usam termos técnicos/corporativos ("resource", "plan", "count") ao invés de vocabulário pastoral
- Não indicam claramente o que o usuário pode fazer para desbloquear a capacidade
- A mensagem genérica PT-BR existente (`"Limite do plano atingido. Fale com o administrador para upgrade."`) não diferencia o tipo de recurso nem orienta com tom cuidadoso

> Decisões de infraestrutura: N/A (feature stateless, sem scheduling, sem dados persistentes novos).

---

## User Scenarios & Testing

### P1 — Admin vê mensagem clara ao atingir limite de grupos

**Como** administrador de uma igreja no plano Free,  
**Quando** tento criar um novo grupo além do limite do plano,  
**Quero** ver uma mensagem em PT-BR com vocabulário pastoral que explique o limite atual, quantos grupos já possuo, e como ampliar minha capacidade,  
**Para que** eu entenda o que aconteceu e saiba o próximo passo sem precisar contatar suporte.

**Acceptance Criteria:**
- A mensagem identifica o tipo de recurso afetado com linguagem pastoral ("comunidades de cuidado", não "grupos")
- A mensagem informa os valores atual e máximo (ex: "3 de 3")
- A mensagem sugere ação concreta (contato para upgrade, ou rota para planos)
- O tom é acolhedor, não punitivo

**Edge Cases:**
- Tenant com override de limites (limite customizado pelo super-admin): mensagem usa o valor real, não o padrão do plano
- Tenant enterprise (limite Infinity): nunca exibe mensagem de limite — este cenário não deve ocorrer

### P2 — Admin vê mensagem contextualizada ao atingir limite de membros por grupo

**Como** líder de grupo,  
**Quando** tento adicionar um novo membro além do limite por grupo,  
**Quero** ver uma mensagem que identifique que o limite é do grupo específico (não da conta toda) e sugira alternativa,  
**Para que** eu não confunda com limite geral de plano.

**Acceptance Criteria:**
- Mensagem diferencia "capacidade do grupo" de "limite da conta"
- Sugere falar com o administrador para upgrade de plano (a funcionalidade "dividir grupo" não existe no sistema e não faz parte do escopo desta feature)
- Valores atual/máximo visíveis

### P3 — Admin vê mensagem ao atingir limite de líderes por tenant

**Como** administrador,  
**Quando** tento designar um novo líder além do limite do plano,  
**Quero** ver mensagem que explique o limite de líderes ativos e oriente o próximo passo,  
**Para que** eu saiba que não é um erro técnico, mas uma restrição do plano.

**Acceptance Criteria:**
- Mensagem usa "pastores/líderes ativos" ao invés de "leaders"
- Indica limite do plano atual e sugere upgrade

### P4 — Mensagem genérica de fallback quando detalhes não estão disponíveis

**Como** usuário que recebe um erro 403 sem detalhes estruturados,  
**Quero** ver uma mensagem genérica pastoral e acionável,  
**Para que** nunca veja placeholders literais como `{current}` ou `{resource}` na tela.

**Acceptance Criteria:**
- Sistema nunca exibe strings com `{` não interpoladas ao usuário
- Fallback é claro, pastoral e acionável
- Cobre todos os casos em que o backend não envia `details` estruturado

---

## Requirements

### Functional Requirements

**FR-001** — As mensagens de limite exibidas ao usuário final DEVEM estar em PT-BR com vocabulário pastoral, sem termos técnicos (sem "resource", "plan", "count", "PlanLimitReached").

**FR-002** — Cada tipo de recurso limitado (grupos, membros por grupo, líderes por tenant) DEVE ter mensagem distinta com contexto específico do que foi atingido.

**FR-003** — Toda mensagem de limite DEVE informar os valores atual e máximo do recurso afetado, quando disponíveis nos detalhes do erro.

**FR-004** — Toda mensagem de limite DEVE incluir orientação de ação concreta: contato para upgrade de plano, ou indicação de rota para mais informações.

**FR-005** — O sistema DEVE garantir que nenhum placeholder não-interpolado (`{current}`, `{limit}`, `{resource}`) seja exibido ao usuário, caindo no fallback genérico quando detalhes estiverem ausentes.

**FR-006** — A mensagem interna do backend (campo `message` no JSON de erro) DEVE permanecer em inglês (é dado técnico de log/debug — conforme constitution §III e regra de linguagem do projeto: código, logs e comentários em inglês), mas os `details` retornados DEVEM conter chaves estruturadas suficientes para o frontend interpolar a mensagem localizada correta.

**FR-007** — Os `details` do erro 403 de limite DEVEM incluir pelo menos: `{ resource, plan, current, limit }` onde `resource` é um dos valores canônicos: `groups`, `membersPerGroup`, `leadersPerTenant`.

**FR-008** — O frontend DEVE mapear cada valor de `resource` para uma mensagem PT-BR pastoral distinta, sem expor o valor técnico ao usuário.

**FR-009** — Mensagens DEVEM usar tom acolhedor e não punitivo: orientar em vez de bloquear, sugerir próximos passos em vez de apenas negar.

**FR-010** — A melhoria DEVE ser coberta por testes unitários que verifiquem: interpolação correta, fallback sem placeholders visíveis, e mapeamento por tipo de recurso.

### Key Entities

**Recurso limitado** (`PlanLimitedResource`): um dos três tipos — grupos (`groups`), membros por grupo (`membersPerGroup`), líderes por tenant (`leadersPerTenant`).

**Mensagem de limite**: texto PT-BR com vocabulário pastoral que descreve o recurso afetado, os valores atual/máximo, e a ação recomendada.

**Detalhes do erro**: payload estruturado `{ resource, plan, current, limit }` retornado no campo `details` do contrato de erro padrão, usado pelo frontend para interpolar a mensagem correta.

---

## Success Criteria

1. **100% das exibições de limite** ao usuário estão em PT-BR com vocabulário pastoral — zero strings em inglês ou placeholders literais visíveis.

2. **Usuários entendem o próximo passo**: após ver a mensagem de limite, o usuário sabe o que fazer (contato para upgrade, ou dividir recurso) sem precisar contatar suporte para interpretar o erro.

3. **Cobertura por recurso**: as 3 mensagens distintas (grupos, membros, líderes) têm texto diferente e contextualizado — verificável por testes snapshot do mapeamento.

4. **Nenhuma regressão**: todos os testes existentes do `PlanLimitsGuard`, `PlanLimitsService` e `resolveError` continuam passando após a mudança.

5. **Fallback resiliente**: quando `details` não inclui `resource` reconhecido, a mensagem genérica pastoral é exibida sem placeholders — verificável por teste de unidade.

---

## Clarifications

> Resolvido em pipeline feature-00c (clarify, onda-002, 2026-06-14). Todas as ambiguidades resolvidas autonomamente via asker/answerer (score ≥ 1 em todas as perguntas; nenhum bloqueio humano).

### Decisões tomadas na clarify (dec-007 a dec-011)

**Q1 — Termos pastorais canônicos por recurso (score 2, dec-007)**
- `groups` → "comunidades de cuidado"
- `membersPerGroup` → "participantes do grupo"
- `leadersPerTenant` → "pastores/líderes ativos"

Evidência: literais extraídos dos ACs de P1 e P3 na própria spec. Constitution III MUST vocabulário pastoral.

**Q2 — Remover "dividir grupo" do AC de P2 (score 1, dec-008)**
- A funcionalidade `splitGroup`/dividir-grupo **não existe** no código (`apps/api/src`, `apps/web/src` — busca confirmada).
- AC de P2 corrigido: mensagem sugere falar com administrador para upgrade de plano.
- Manter referência a funcionalidade inexistente criaria confusão de UX sem suporte técnico.

**Q3 — Campo `message` do 403 DEVE permanecer em inglês (score 3, dec-009)**
- FR-006 corrigido de "PODE" para "DEVE".
- Três fontes convergem: briefing §7 ("código/log em inglês"), constitution §III (MUST), spec FR-006 ("dado técnico de log/debug").
- Frontend interpola PT-BR pastoral exclusivamente a partir de `details.resource` — nunca exibe `message` ao usuário.

**Q4 — Ação de upgrade: texto orientativo sem link (score 1, dec-010)**
- Mensagens usam texto orientativo: "fale com o administrador para ampliar o plano" (sem link para /planos ou /configuracoes).
- Rota `/planos` existe (PR #65, contexto marketing), mas misturar contexto marketing em erro autenticado aumenta blast radius sem ganho claro.
- FR-004 aceita "contato para upgrade" como orientação suficiente.

**Q5 — Escopo: apenas strings em pt-BR.json (score 2, dec-011)**
- A feature cobre apenas `pt-BR.json` e `error-messages.ts`.
- O mecanismo de exibição (toast) já existe e não é alterado.
- Constitution §VII (PRs focados) e spec FR-010 (testes de interpolação) confirmam escopo cirúrgico.

### Decisões mantidas da specify

- **Backend message em inglês**: mantida e reforçada (ver Q3 acima).
- **Nenhum novo endpoint**: a feature é puramente de melhoria de mensagens sobre infraestrutura existente (guard + pt-BR.json + error-messages.ts).
