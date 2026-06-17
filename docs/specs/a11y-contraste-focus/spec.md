# Spec: a11y-contraste-focus

**Feature:** Contraste WCAG AA & Focus Visible Consolidado
**Short name:** `a11y-contraste-focus`
**Referencia autoritativa:** `_bmad-output/implementation-artifacts/12-3-contraste-wcag-aa-focus-visible-nfr-a2-ux-dr19.md`
**NFR:** NFR-A2 (acessibilidade WCAG 2.1 AA)
**UX:** DR19
**Epic:** 12 (Acessibilidade)
**Status:** ready-for-clarify
**Data:** 2026-06-17

---

## Contexto e Motivacao

A Story 12.1 (Navegacao por Teclado nos Fluxos Publicos) entregou skip-nav, focus-trap e aria-labels. O baseline axe capturado nessa story revelou tech debt pre-existente fora do escopo da 12.1:

- `/` (home-marketing): `color-contrast` serious, 25 nodes
- `/login`: `link-in-text-block` serious, 1 node ("Esqueceu a senha?")

Alem disso, a auditoria estatica dos tokens de design (`packages/config/tailwind.preset.css`) identificou pares de cores que nao atingem WCAG AA. O presente escopo resolve esses tres eixos: (1) debt do axe-baseline, (2) tokens de contraste, (3) padronizacao do focus-ring.

**Evidencia empirica (WCAG 2.1 formula, calculada em 2026-06-17):**

| Token (FG) | Superficie (BG) | Ratio | Normal (4.5:1) | Grafico (3:1) |
|---|---|---|---|---|
| `care-attention` #d4a24c | `surface-base` #fafaf8 | 2.22:1 | FAIL | FAIL |
| `care-attention` #d4a24c | `surface-elevated` #ffffff | 2.31:1 | FAIL | FAIL |
| `care-ok` #7ba38a | `surface-base` #fafaf8 | 2.70:1 | FAIL | FAIL |
| `care-ok` #7ba38a | `surface-elevated` #ffffff | 2.82:1 | FAIL | FAIL |
| `care-urgent` #c1666b | `surface-base` #fafaf8 | 3.73:1 | FAIL | PASS |
| `care-neutral` #8e8d8a | `surface-base` #fafaf8 | 3.18:1 | FAIL | PASS |
| `text-muted` #8e8d8a | `surface-base` #fafaf8 | 3.18:1 | FAIL | PASS |
| `text-muted` #8e8d8a | `surface-sunken` #f2f0ed | 2.92:1 | FAIL | FAIL |
| `brand-teal-light` #3aafa9 | `surface-base` #fafaf8 | 2.55:1 | FAIL | FAIL |
| `brand-terracotta` #c1666b | `surface-base` #fafaf8 | 3.73:1 | FAIL | PASS |
| `text-inverse` #fafaf8 | `care-attention` #d4a24c | 2.22:1 | FAIL | FAIL |
| `text-primary` #17252a | `care-urgent` #c1666b | 4.03:1 | FAIL | PASS |
| `brand-teal` #2b7a78 (ring) | `surface-elevated` #ffffff | 5.05:1 | PASS (foco) | - |

Tokens que PASSAM em todos os usos pretendidos: `text-primary` (15.06:1), `text-secondary` (6.58:1), `brand-teal` como texto/icone sobre surface, `text-primary on care-attention` (6.80:1), `text-primary on care-ok` (5.58:1).

**Focus-ring atual:** 46 ocorrencias de `focus-visible` com ring no codebase com 3 variantes:
- `ring-interactive-focus` (meetings, onboarding -- usa token `--color-interactive-focus: #2b7a78`)
- `ring-[var(--ring)]` (forms: password-input, day-of-week, terms-checkbox -- usa CSS var shadcn)
- `ring-ring` (catalog-search, trails -- alias shadcn)

As tres variantes apontam funcionalmente para `brand-teal` mas via caminhos distintos, gerando inconsistencia de manutencao.

---

## User Stories

### US-1: Resolver violacoes axe-baseline herdadas da Story 12.1

**Como** usuario que navega no site publico
**Quero** que o texto da pagina inicial tenha contraste suficiente e que o link "Esqueceu a senha?" seja distinguivel sem depender de cor
**Para que** eu possa ler o conteudo e identificar links mesmo com baixa visao ou daltonismo

**Criterios de Aceite (US-1):**

- SC-1.1: Todos os 25 nodes `color-contrast` serious na rota `/` resolvidos -- axe-core reporta 0 violacoes `color-contrast` na home-marketing apos a implementacao.
- SC-1.2: O link "Esqueceu a senha?" em `/login` nao depende exclusivamente de cor para ser distinguivel -- possui underline permanente ou indicador visual nao-cromatico; axe reporta 0 violacoes `link-in-text-block` em `/login`.
- SC-1.3: Evidenciado por teste E2E Playwright + axe-core em `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts` cobrindo `/` e `/login`.

---

### US-2: Corrigir pares de tokens de contraste que falham WCAG AA

**Como** designer e desenvolvedor do metanoia-hub
**Quero** que a paleta de design tokens em `packages/config/tailwind.preset.css` tenha todos os pares texto/superficie acima de 4.5:1 (texto normal) ou 3:1 (texto grande e componentes graficos)
**Para que** qualquer combinacao de tokens no design system respeite WCAG 2.1 AA por construcao, sem depender de verificacao manual caso a caso

**Criterios de Aceite (US-2):**

- SC-2.1: `text-muted` atinge >= 4.5:1 sobre `surface-base` e `surface-elevated`. Ratio atual: 3.18:1 -- necessita ajuste do token ou restricao de uso.

- SC-2.2: `care-attention` (#d4a24c, amber) atinge >= 3:1 sobre surfaces quando usado como fundo de badge/indicador grafico (criterio grafico WCAG 2.1 SC 1.4.11). Ratio atual: 2.22:1 -- fail inclusivo no criterio grafico.

  > NEEDS_CLARIFICATION NC-1: A estrategia de remediacao para `care-attention` e `care-ok`:
  > **Opcao A** -- Ajustar os valores dos tokens no preset para versoes com maior contraste (ex: escurecer care-attention para ~#b8860b).
  > **Opcao B** -- Manter os tokens atuais e exigir que badges care-* usem SEMPRE `text-primary` (#17252a) como texto interno (que ja passa: text-primary on care-attention = 6.80:1), documentando que o token de cor da badge nao deve ser usado como texto isolado.
  > **Opcao C** -- Adicionar borda obrigatoria nos badges care-* com contraste 3:1 sobre a superficie pai (WCAG SC 1.4.11 permite boundary via borda).
  > A opcao escolhida afeta `packages/config/tailwind.preset.css` e possivelmente `packages/ui/`. Decisao de produto/design necessaria antes do plan.

- SC-2.3: `care-ok` (#7ba38a, verde) atinge >= 3:1 sobre surfaces quando usado como fundo de badge. Ratio atual: 2.70:1 -- fail no criterio grafico. (Mesma ambiguidade de NC-1.)

- SC-2.4: `care-urgent` (#c1666b) passa o criterio grafico 3:1 (atual: 3.73:1 -- PASS). Nenhum ajuste necessario para uso como indicador grafico; para uso como texto, documentar restricao a tamanho grande (>=24px regular ou >=18px bold).

- SC-2.5: `brand-teal-light` (#3aafa9) nao e usado como cor de texto sobre surfaces claras (atual: 2.55:1 -- FAIL). Restricao documentada em comments no preset.

- SC-2.6: Todos os ajustes de tokens preservam a identidade visual pastoral (teal, terracotta, care palette) -- sem alteracao de hue, apenas ajuste de lightness conforme necessario.

- SC-2.7: Script de auditoria de contraste automatizado valida os pares criticos no CI.

  > NEEDS_CLARIFICATION NC-2: O `tailwind.preset.css` usa `@theme` com valores hex. A spec autoritativa 12-3 menciona "22/35 pares falhando" -- a auditoria empirica desta spec encontrou um conjunto de pares criticos confirmados, mas o total "35 pares" pressupoe uma matriz mais ampla que pode incluir dark mode e variantes nao presentes no preset light. Confirmar: o escopo de auditoria inclui dark mode tokens (`packages/ui/styles/tokens.css`) ou apenas o preset light?

---

### US-3: Padronizar o focus-ring em um unico token e utilitario

**Como** desenvolvedor front-end
**Quero** que todos os elementos interativos do metanoia-hub usem exatamente um padrao de focus-ring
**Para que** o comportamento de foco seja consistente visualmente, facil de manter e facilmente auditavel via grep

**Criterios de Aceite (US-3):**

- SC-3.1: O CSS variable `--ring` do shadcn theme e configurado para apontar para `brand-teal` (#2b7a78) em `packages/ui/styles/globals.css` ou equivalente.

- SC-3.2: O utilitario canonico de focus-ring adotado e: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 focus-visible:ring-offset-2`. Nenhum outro padrao de ring e aceito em novos componentes.

- SC-3.3: As 3 variantes pre-existentes (`ring-interactive-focus`, `ring-[var(--ring)]`, `ring-ring`) sao unificadas no padrao canonico em todos os componentes existentes em `apps/web/src/` e `packages/ui/`.

  > NEEDS_CLARIFICATION NC-3: Ha 46 ocorrencias de `focus-visible` com ring no codebase. A migracao pode ser feita via sed/codemod global ou exige revisao manual componente a componente (verificar que nenhum componente tem ring customizado por razao semantica valida, ex: componente de alerta/perigo com ring vermelho). Confirmar se a migracao global automatizada e aceita ou se cada arquivo deve ter revisao manual.

- SC-3.4: `focus-visible` e usado em todos os casos (nao `:focus`) -- comportamento correto: nao exibe ring em cliques de mouse, apenas em navegacao por teclado.

- SC-3.5: O contraste do focus-ring (`brand-teal` #2b7a78) sobre fundos claros atinge >= 3:1 (WCAG SC 1.4.11 para indicadores de foco). Evidencia empirica: brand-teal sobre white = 5.05:1 (PASS).

- SC-3.6: Comportamento verificado manualmente nos 3 browsers: Chrome, Firefox, Safari -- focus ring visivelmente identico.

- SC-3.7: Teste jest-axe em componentes Button, Input, Select, Checkbox, Link verifica 0 violacoes de focus-related.

---

### US-4: Garantir que semaforo pastoral (care-*) nunca usa cor como unico indicador

**Como** usuario do Pastoral Radar com deficiencia de percepcao de cores
**Quero** que os indicadores de status pastoral (urgente, atencao, ok) sempre exibam icone e texto acompanhando a cor
**Para que** eu compreenda o status mesmo sem distinguir as cores vermelha/ambar/verde

**Criterios de Aceite (US-4):**

- SC-4.1: `care-urgent` e sempre exibido com icone de aviso + texto "precisa de cuidado" (ou equivalente em PT-BR) -- cor nao e o unico indicador (WCAG SC 1.4.1).
- SC-4.2: `care-attention` e sempre exibido com icone de olho + texto "merece atencao" -- cor nao e o unico indicador.
- SC-4.3: `care-ok` e sempre exibido com icone de check + texto "esta bem" -- cor nao e o unico indicador.
- SC-4.4: Auditoria realizada nos componentes de semaforo/badge apos Epic 7 estar entregue (pre-requisito: os componentes care-* nao existem no codebase atual -- validavel somente apos Epic 7).
- SC-4.5: Teste jest-axe nos componentes de badge/semaforo verifica 0 violacoes relacionadas a uso exclusivo de cor.

---

### US-5: Instrumentar cobertura de contraste e foco com testes automatizados

**Como** time de engenharia
**Quero** que as correcoes de contraste e focus-ring sejam protegidas por testes automatizados no CI
**Para que** nenhuma regressao de acessibilidade seja introduzida silenciosamente em PRs futuros

**Criterios de Aceite (US-5):**

- SC-5.1: Teste Playwright axe-core em `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts` cobrindo rotas: `/` (home-marketing), `/login`, `/dashboard` (autenticado se possivel), listagem de grupos.
- SC-5.2: Cada rota no E2E verifica 0 violacoes axe de `color-contrast`, `link-in-text-block` com limiar WCAG AA (runOnly: wcag2aa).
- SC-5.3: Testes jest-axe unitarios adicionados em: Button, Input, Select, Checkbox, Radio, Tab, Link.
- SC-5.4: Script de auditoria de tokens (`scripts/check-contrast-tokens.js` ou similar) integrado ao CI -- falha se ratio de par critico cair abaixo do limiar.
- SC-5.5: Todos os testes passam no pipeline CI (GitHub Actions) sem modificar variaveis de ambiente de producao.

---

## Functional Requirements

| ID | Descricao | US |
|---|---|---|
| FR-01 | Corrigir texto da home-marketing (`/`) para 0 violacoes `color-contrast` no axe (25 nodes atuais) | US-1 |
| FR-02 | Corrigir link "Esqueceu a senha?" em `/login` para ser distinguivel sem cor (`link-in-text-block`) | US-1 |
| FR-03 | Auditar e ajustar `--color-text-muted` (#8e8d8a) para >= 4.5:1 sobre surfaces (hoje 3.18:1) | US-2 |
| FR-04 | Remediar `--color-care-attention` (#d4a24c) -- 2.22:1 -- via estrategia definida em NC-1 | US-2 |
| FR-05 | Remediar `--color-care-ok` (#7ba38a) -- 2.70:1 -- via estrategia definida em NC-1 | US-2 |
| FR-06 | Documentar restricao de uso de `--color-brand-teal-light` (#3aafa9, 2.55:1) como texto | US-2 |
| FR-07 | Configurar `--ring` shadcn = `brand-teal` em globals.css | US-3 |
| FR-08 | Migrar todas as ocorrencias de `ring-interactive-focus`, `ring-[var(--ring)]`, `ring-ring` para utilitario canonico `ring-brand-teal/30` | US-3 |
| FR-09 | Verificar que todos os elementos interativos usam `focus-visible` (nao `:focus`) | US-3 |
| FR-10 | Auditar componentes semaforo/badge care-* para garantir icon+texto acompanhando cor (pos Epic 7) | US-4 |
| FR-11 | Criar `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts` com axe-core nas rotas criticas | US-5 |
| FR-12 | Adicionar testes jest-axe nos componentes interativos core (Button, Input, Select, Checkbox, Link) | US-5 |
| FR-13 | Criar script CI de auditoria de tokens de contraste | US-5 |

---

## Non-Functional Requirements

- **NFR-A2 (WCAG 2.1 AA):** Todos os pares texto/superficie >= 4.5:1 (normal) ou 3:1 (grande/grafico). Indicadores de foco >= 3:1. Cor nao e unico indicador de informacao.
- **NFR-PERF:** Ajuste de tokens CSS nao introduz overhead de runtime (CSS variables sao estaticos no preset).
- **NFR-COMPAT:** Focus-ring verificado em Chrome, Firefox, Safari (ultimas 2 versoes).
- **NFR-MANUT:** Apos esta feature, `grep -rn 'ring-interactive-focus' apps/web/src` retorna 0 resultados (exceto comentarios).
- **NFR-CI:** Score zero de violacoes axe `color-contrast` e `link-in-text-block` nas rotas publicas no pipeline CI.

---

## Out of Scope

- Dark mode: tokens.css de dark mode auditado separadamente (NC-2 a esclarecer).
- Epic 7 (semaforo): US-4 / FR-10 dependem de Epic 7 -- testes de semaforo sao stub ate entrega.
- Novos componentes de UI nao existentes no codebase atual.
- Contraste em emails/notificacoes.
- WCAG AAA (limiar 7:1) -- escopo e AA apenas.

---

## Dependencias

- Story 12.1 concluida (skip-nav, focus-trap, infra de testes axe) -- PRE-REQUISITO.
- Epic 7 concluido -- pre-requisito SOMENTE para US-4/SC-4.x.
- Epic 1 Story 1.7 (design tokens) -- tokens fonte em `tailwind.preset.css` ja entregues.
- `@axe-core/playwright` ja instalado (Story 12.1).
- `jest-axe` a confirmar se ja instalado em `packages/ui/`.

---

## NEEDS_CLARIFICATION (resumo)

| ID | Pergunta | Impacto |
|---|---|---|
| NC-1 | Estrategia de remediacao para `care-attention` e `care-ok`: (A) ajustar tokens hex, (B) restringir uso a texto escuro interno, ou (C) adicionar borda obrigatoria em badges? | Define se `tailwind.preset.css` muda os valores hex ou se e policy de uso |
| NC-2 | Escopo da auditoria inclui dark mode (`packages/ui/styles/tokens.css`) ou apenas o preset light? A spec 12-3 menciona "22/35 pares" que implica matriz mais ampla. | Define se dark mode entra no escopo desta story ou e story separada |
| NC-3 | A migracao das 46 ocorrencias de focus-ring pode ser global automatizada (sed/codemod) ou exige revisao manual por componente? | Define estimativa de esforco e risco de regressao |

---

## Notas de Implementacao

- **Fonte de tokens CRITICA:** `packages/config/tailwind.preset.css` (@theme com hex values), NAO o `.ts`. Todos os tokens sao hex puros (sem oklch() no arquivo atual).
- **Formula WCAG:** luminance relativa via sRGB linearizacao (IEC 61966-2-1).
- **Arquivos principais:** `packages/config/tailwind.preset.css`, `packages/ui/styles/globals.css`, `packages/ui/src/components/`, `apps/web/src/components/`, `apps/web/e2e/a11y/`.
- **Guardrail de identidade visual:** Nao alterar hue das cores care-* (identidade pastoral do produto); ajustar apenas lightness.
- **Compatibilidade shadcn:** `--ring` e a CSS variable canonical do shadcn para focus; configurar no `:root` do globals.css e suficiente para afetar todos os componentes shadcn.
- **Tokens que NAO necessitam ajuste:** `text-primary` (15.06:1), `text-secondary` (6.58:1), `brand-teal` (5.05:1 como texto, 5.05:1 como ring), `care-urgent` (3.73:1 -- passa grafico).

---

*Spec gerada por agente-00c-feature-orchestrator em 2026-06-17. Spec autoritativa de referencia: `_bmad-output/implementation-artifacts/12-3-contraste-wcag-aa-focus-visible-nfr-a2-ux-dr19.md`.*
