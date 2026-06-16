# Feature Specification: Keyboard Navigation — Public Flows & Infrastructure

**Feature**: `a11y-teclado-publico`
**Created**: 2026-06-16
**Status**: Draft
**Epic**: Epic 12 - Hardening de Acessibilidade & Qualidade UX
**NFR**: NFR-A1 (WCAG 2.1 AA - Keyboard Navigation)

> Decisoes de infraestrutura: N/A (feature stateless - zero scheduling,
> zero criptografia persistente, zero token externo, sem estado cross-pod).
> Toda a mudanca e de componentes UI e testes E2E.

---

## Clarifications

Decisoes de clarify aplicadas em 2026-06-16 (block-001 respondido):

- **Q1 — Cross-browser testing strategy** (dec-012, score 3):
  SC-008 e verificado via CHECKLIST MANUAL (Task 9) em Chrome, Firefox e
  Safari. O `playwright.config.ts` NAO e expandido com projetos Firefox/WebKit
  no CI — a automatizacao E2E permanece apenas em Chromium. Qualquer finding
  residual cross-browser deve ser classificado como blocker/major/minor no
  checklist manual da Task 9.

- **Q2 — Focus edge case after post-login redirect** (dec-013, score 3):
  O cenario de foco apos redirect pos-login e TECH DEBT desta story. Sera
  documentado no relatorio axe (Task 8.3) e DEFERIDO para a Story 12.2
  (fluxos autenticados). Esta story NAO adiciona FR, AC nem teste E2E para
  esse cenario. Ver secao "Tech Debt Deferido" ao final desta spec.

- **Q3 — US5 Dropdowns e sidebar** (dec-009, score 2):
  Menus dropdown e sidebar usam Radix UI via shadcn (DropdownMenu, NavigationMenu).
  A abordagem e validacao E2E + correcao pontual de gaps no comportamento Radix
  existente — NAO implementacao custom de comportamento de teclado.

---

## User Scenarios & Testing

### User Story 1 - Skip Navigation Link (Priority: P1)

Um usuario que navega apenas com o teclado (deficiencia motora, preferencia
por teclado, ou tecnologia assistiva) precisa poder pular blocos repetitivos
de navegacao (sidebar, navbar) e ir direto ao conteudo principal sem pressionar
Tab dezenas de vezes a cada carregamento de pagina.

**Why this priority**: E o mecanismo de bypass mais basico exigido pelo WCAG
2.1 AA (criterio 2.4.1 - Bypass Blocks). Sem ele, qualquer outro esforco de
acessibilidade por teclado perde impacto para usuarios de teclado ou leitor
de tela. E infraestrutura global: implementada uma vez no layout raiz, beneficia
todas as paginas.

**Independent Test**: Abrir qualquer pagina da aplicacao, pressionar Tab como
primeira acao - um link "Ir para conteudo" deve aparecer visualmente. Ativar
o link (Enter) deve mover o foco para a area de conteudo principal,
verificavel com `document.activeElement`.

**Acceptance Scenarios**:

1. **Given** qualquer pagina carregada, **When** o usuario pressiona Tab como
   primeiro input, **Then** o primeiro elemento a receber foco e o link
   "Ir para conteudo" - visualmente oculto em estado inativo, visivel
   ao receber foco (fundo solido opaco sobre qualquer conteudo, z-index
   superior a todos os elementos, contraste de texto >= 4.5:1 WCAG AA).

2. **Given** o link "Ir para conteudo" visivel e com foco, **When** o usuario
   pressiona Enter, **Then** o foco move para a area de conteudo principal
   (<main>), pulando sidebar e navegacao superior.

3. **Given** qualquer pagina, **When** o usuario navega com mouse (sem Tab
   inicial), **Then** o link "Ir para conteudo" permanece invisivel e nao
   ocupa espaco no layout.

---

### User Story 2 - Login Flow Keyboard Navigation (Priority: P1)

Um usuario com deficiencia motora precisa completar o fluxo de login
(e-mail -> senha -> enviar) usando apenas o teclado, com uma ordem de
tabulacao previsivel e feedback visual claro ao focar em cada campo.

**Why this priority**: O login e a primeira barreira de acesso ao produto.
Se nao for navegavel por teclado, o usuario nao acessa nenhuma funcionalidade.
Junto com a story de registro, representa o ponto de entrada mais critico.

**Independent Test**: Abrir a pagina de login sem interacao de mouse. Pressionar
Tab sequencialmente e verificar que cada campo e o botao de envio recebem
foco na ordem visual (cima -> baixo). Verificar que Enter submete o formulario.

**Acceptance Scenarios**:

1. **Given** a pagina de login, **When** o usuario navega com Tab, **Then** a
   ordem de foco segue a ordem visual: campo e-mail -> campo senha -> botao
   de entrar. Nenhum elemento fora dessa sequencia recebe foco antes do botao.

2. **Given** qualquer campo interativo no login, **When** o campo recebe foco
   via teclado, **Then** um anel de foco visivel aparece ao redor do elemento
   (:focus-visible com contraste suficiente para distinguir do fundo).

3. **Given** o foco no botao de entrar, **When** o usuario pressiona Enter,
   **Then** o formulario e enviado - o mesmo comportamento de um clique com mouse.

4. **Given** o campo de senha, **When** existe um toggle de visibilidade de senha
   e o usuario Tab-navega ate ele, **Then** o toggle recebe foco visivel;
   Space ou Enter alterna a visibilidade.

---

### User Story 3 - Registration Flow Keyboard Navigation (Priority: P1)

Um usuario que cria uma conta nova precisa navegar por todos os campos do
formulario de registro (nome, e-mail, senha, confirmacao de senha, enviar)
e pelo toggle de visibilidade de senha, sem usar mouse.

**Why this priority**: Par do login - ambos compoem a barreira de entrada do
produto. Inclui campo adicional (confirmacao de senha) e o mesmo requisito de
toggle de visibilidade.

**Independent Test**: Abrir a pagina de registro sem mouse. Navegar com Tab
por todos os campos em ordem sequencial. Verificar que o toggle de senha
responde a Space/Enter. Verificar que Tab nunca pula nem repete campos.

**Acceptance Scenarios**:

1. **Given** a pagina de registro, **When** o usuario navega com Tab, **Then** a
   ordem de foco e sequencial: nome -> e-mail -> senha -> confirmacao de senha ->
   botao de criar conta. Nenhum campo e omitido ou duplicado.

2. **Given** o foco no toggle de visibilidade de senha (em qualquer campo de
   senha), **When** o usuario pressiona Space ou Enter, **Then** a visibilidade
   do campo alterna entre texto e oculto.

3. **Given** qualquer campo interativo no registro, **When** recebe foco via
   teclado, **Then** anel de foco visivel aparece.

---

### User Story 4 - Modal Dialog Focus Trap Validation (Priority: P2)

Um usuario que navega por teclado e abre um dialogo modal precisa ter o foco
confinado dentro do modal enquanto ele esta aberto, e recuperar o foco no
elemento que o abriu quando o modal e fechado.

**Why this priority**: Focus trap e criterio WCAG 2.1 AA (2.1.2 - No Keyboard
Trap com excecao de dialogos modais). Sem ele, o usuario de teclado "escapa"
do modal sem perceber e perde o contexto. A plataforma ja usa Radix Dialog,
que implementa focus trap nativamente - esta story valida que a integracao
funciona corretamente em todos os modais existentes, nao reimplementa.

**Independent Test**: Abrir pelo menos 3 modais distintos da aplicacao via
teclado. Em cada um: verificar Tab cicla apenas pelos elementos do modal,
verificar Escape fecha o modal e retorna foco ao trigger.

**Acceptance Scenarios**:

1. **Given** um modal aberto, **When** o usuario pressiona Tab repetidamente,
   **Then** o foco cicla exclusivamente entre os elementos interativos do modal
   (nao alcanca elementos externos enquanto o modal esta visivel).

2. **Given** um modal aberto, **When** o usuario pressiona Escape, **Then** o
   modal fecha e o foco retorna para o elemento que o acionou.

3. **Given** qualquer modal, **When** ele renderiza, **Then** role="dialog" e
   aria-modal="true" estao presentes na marcacao, permitindo que leitores de
   tela anunciem corretamente o contexto de dialogo.

4. **Given** os modais: dialogo de confirmacao, modal de criar grupo, modal de
   configuracoes (3 minimos), **When** cada um e testado, **Then** os tres
   cenarios acima passam em todos eles.

---

### User Story 5 - Dropdown & Menu Keyboard Navigation (Priority: P2)

Um usuario que navega por teclado precisa interagir com menus dropdown e
o sidebar de navegacao usando setas, Enter e Escape, sem depender do mouse.

**Why this priority**: Menus de navegacao e acao sao pontos de interacao
recorrentes. Sem navegacao por setas, o usuario seria forcado a usar Tab
por todos os itens de cada menu a cada acesso - inviavel em listas longas.

**Independent Test**: Focar no trigger de um menu dropdown ou item do sidebar.
Pressionar Arrow Down/Up e verificar o movimento de foco entre itens. Pressionar
Enter para selecionar. Pressionar Escape para fechar sem selecionar.

**Acceptance Scenarios**:

1. **Given** foco no trigger de um dropdown ou menu de acoes, **When** o usuario
   pressiona Arrow Down, **Then** o menu abre e o foco move para o primeiro item.

2. **Given** um menu aberto com foco em algum item, **When** o usuario pressiona
   Arrow Down/Up, **Then** o foco move para o proximo/anterior item da lista.

3. **Given** foco em um item de menu, **When** o usuario pressiona Enter,
   **Then** o item e selecionado/ativado e o menu fecha.

4. **Given** um menu aberto, **When** o usuario pressiona Escape, **Then** o
   menu fecha e o foco retorna ao trigger.

---

### User Story 6 - Loading States Focus Stability (Priority: P3)

Um usuario que navega por teclado durante carregamentos de pagina ou
hidratacao SSR precisa que a ordem de tabulacao permaneca estavel - o foco
nao deve saltar para elementos inesperados enquanto o conteudo e carregado.

**Why this priority**: Estados de carregamento instaveis quebram a orientacao
do usuario de teclado - o foco salta e ele perde a posicao. E a story de menor
impacto imediato porque afeta edge cases de timing, mas e criterio de qualidade
necessario para a experiencia ser verdadeiramente confiavel.

**Independent Test**: Iniciar navegacao por teclado imediatamente apos carregar
uma pagina com skeleton screens. Verificar que os skeletons nao recebem foco
Tab. Verificar que apos a hidratacao o foco permanece no elemento esperado.

**Acceptance Scenarios**:

1. **Given** uma pagina com skeletons de carregamento visiveis, **When** o
   usuario pressiona Tab, **Then** os skeletons nao recebem foco - apenas
   elementos interativos reais sao focaveis.

2. **Given** foco em um elemento durante a hidratacao SSR, **When** o conteudo
   hidrata e o elemento real substitui o skeleton, **Then** o foco permanece
   no elemento esperado, sem saltos para outras partes da pagina.

---

### User Story 7 - Accessibility Scan Baseline & Final Report (Priority: P1)

A equipe de desenvolvimento precisa de um relatorio baseline de violacoes de
acessibilidade (antes de qualquer correcao) e um relatorio final (apos todas
as correcoes), para medir o progresso real e documentar o que foi resolvido,
o que melhorou e o que foi aceito como divida tecnica.

**Why this priority**: Sem medicao quantitativa antes e depois, nao e possivel
demonstrar que as correcoes reduziram violacoes. O baseline protege contra
regressao futura e serve de referencia para as stories 12.2-12.6.

**Independent Test**: Executar o scan de acessibilidade automatizado nos fluxos
publicos antes de qualquer mudanca desta story e salvar o resultado. Ao fim,
executar novamente e comparar - o numero de violacoes deve ser igual ou menor.

**Acceptance Scenarios**:

1. **Given** o ambiente com a ferramenta de scan instalada, **When** executada
   antes de qualquer correcao, **Then** um relatorio baseline e gerado e salvo
   em _bmad-output/implementation-artifacts/a11y/axe-baseline-public.json.

2. **Given** todas as correcoes desta story aplicadas, **When** o scan e
   executado novamente, **Then** um relatorio final e gerado e salvo; a
   comparacao documenta: violacoes resolvidas, violacoes novas introduzidas
   (deve ser zero), violacoes aceitas como divida tecnica.

---

### Edge Cases

> **Note (CHK028)**: Edge cases below are documented as **informative context**, not
> normative requirements. They guide implementation awareness but do not generate
> explicit FRs or ACs in this story. Formal treatment for cases requiring FR-level
> coverage will be addressed in Story 12.2 (authenticated flows) or future iterations.

- O que acontece se o usuario pressionar Shift+Tab (tabulacao reversa)? A ordem
  de foco deve ser o inverso da ordem de tabulacao para frente (WCAG 2.1 AA 2.4.3).
- O que acontece se o usuario fechar um modal com Escape e o trigger original
  nao existir mais no DOM? O foco deve mover para o elemento mais proximo
  significativo, sem errar silenciosamente.
- O que acontece se a pagina tiver multiplos menus abertos simultaneamente (ex:
  dropdown dentro de modal)? Apenas o menu mais interno deve capturar Escape.
- O que acontece em paginas com redirect automatico apos login? O foco deve
  estar em um elemento significativo da pagina de destino, nao perdido no body.
- Skeletons parciais: alguns itens ja hidrataram, outros ainda sao skeletons -
  o Tab nao deve misturar focaveis reais com placeholders.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a skip navigation link as the first focusable
  element on every page, visually hidden at rest and visible on focus, pointing
  to the main content area (<main>).

- **FR-002**: System MUST ensure the login form fields receive keyboard focus in
  visual reading order (top-to-bottom) with no focusable gaps or repetitions.

- **FR-003**: System MUST ensure the registration form fields receive keyboard
  focus in sequential order covering all required fields and the submit action.

- **FR-004**: All interactive elements across public and authenticated flows MUST
  display a visible focus indicator when receiving keyboard focus (:focus-visible
  compliant with WCAG 2.1 AA - not suppressed for keyboard users).

- **FR-005**: Password visibility toggles MUST be keyboard-accessible and respond
  to Space or Enter to toggle the field between obscured and visible.

- **FR-006**: Modal dialogs MUST confine keyboard focus within the dialog while
  open (focus trap) and restore focus to the trigger element when closed.

- **FR-007**: Pressing Escape on any open modal MUST close it and return focus
  to the triggering element without side effects on the rest of the page.

- **FR-008**: All modal dialogs MUST carry the semantic attributes role="dialog"
  and aria-modal="true" to communicate dialog context to assistive technologies.

- **FR-009**: Dropdown menus MUST support Arrow Down/Up to move focus between
  items, Enter to activate the focused item, and Escape to close without activation.

- **FR-010**: Skeleton loading placeholders MUST NOT be keyboard-focusable.
  They must carry either tabindex="-1" or aria-hidden="true".

- **FR-011**: The tab order of the page MUST remain stable during SSR hydration -
  focus must not move to an unexpected element as interactive content replaces
  placeholders.

- **FR-012**: System MUST generate an automated accessibility scan baseline report
  of all public flows before any fix is applied, and a final report after all
  corrections, stored as versioned artifacts.

- **FR-013**: Modal focus trap validation MUST cover at minimum 3 distinct modal
  dialogs in the application (confirmation dialog, create-group modal, settings
  modal or equivalent).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user navigating with keyboard only can reach the main content
  area of any page in at most 2 Tab presses from page load (via skip navigation).

- **SC-002**: The login flow is completable end-to-end (field-fill -> submit ->
  result) using only keyboard, with zero mouse interactions required.

- **SC-003**: The registration flow is completable end-to-end using only keyboard,
  including password visibility toggle.

- **SC-004**: 100% of tested modal dialogs (minimum 3) trap focus correctly and
  return focus to trigger on close.

- **SC-005**: Zero skeleton placeholder elements are reachable via Tab during
  any loading state across all audited pages.

- **SC-006**: The automated accessibility scan final report shows zero new
  violations introduced by this story's changes (regressions = zero).
  Pre-existing violations found in the axe baseline report are accepted as tech debt
  and must be documented in the axe-delta-report.md without blocking story completion.

- **SC-007**: All 6 functional areas (skip nav, login, register, modals, dropdowns,
  skeletons) have corresponding automated E2E keyboard interaction tests that pass
  in CI (Chromium only — single-browser automated CI per Q1 decision dec-012).

- **SC-008**: Cross-browser verification (Chrome, Firefox, Safari) is performed via
  MANUAL CHECKLIST in Task 9 — NOT automated multi-browser CI. All keyboard
  navigation scenarios must pass the manual checklist with documented severity
  classification (blocker / major / minor) for any residual finding.
  Gate criterion: zero blockers = pass; majors must be documented as tech debt
  with a ticket opened; minors are acceptable with written justification.
  (Decision dec-012, score 3 — human answer Q1=A, 2026-06-16)

---

## Tech Debt Deferido

### TD-001 — Focus management after post-login redirect

**Scope**: After the login form submits and redirects to the authenticated area,
the browser focus position is undefined — it may land on `body` or be lost
entirely, disorienting keyboard users.

**Why deferred**: This story covers PUBLIC flows (pre-auth) only. The redirect
target is an authenticated page (Story 12.2 scope). Adding FR/AC/E2E tests for
this edge case here would expand the scope beyond public flows and create coupling
between stories.

**Action**: Document in the axe audit report (Task 8.3) under "Known Issues /
Accepted Tech Debt". Assign to Story 12.2 (authenticated flows, keyboard
navigation).

**Reference**: block-001 Q2=A, dec-013, score 3.
