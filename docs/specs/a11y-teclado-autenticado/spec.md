# Feature Specification: Navegação por Teclado — Fluxos Autenticados

**Feature**: `a11y-teclado-autenticado`
**Created**: 2026-06-16
**Status**: Draft
**Origem**: Story 12.2 (Epic 12 — Acessibilidade NFR-A1)
**Dependência**: Story 12.1 (a11y-teclado-publico) — infraestrutura de skip nav e focus management já entregue.

---

## User Scenarios & Testing

### User Story 1 — Navegação pelo Dashboard com 3 Experiências (Priority: P1)

Como usuária com deficiência motora, quero navegar pelo dashboard completo
(experiências Consumo, Gestão e Admin) usando apenas o teclado, para que eu
possa acessar minha jornada pastoral, métricas do grupo e configurações sem
depender de mouse.

**Why this priority**: O dashboard é a tela de entrada de todos os papéis (Participante,
Líder, Admin). Sem navegação funcional aqui, nenhum outro fluxo autenticado é acessível.

**Independent Test**: Carregar o dashboard logado e navegar até uma ação de cada seção
(sidebar → conteúdo principal → botão de ação) usando apenas Tab, Enter e Arrow keys,
sem toque no mouse.

**Acceptance Scenarios**:

1. **Given** um usuário logado no dashboard, **When** pressiona Tab a partir do topo,
   **Then** o foco segue: link "Pular para conteúdo" → itens do menu lateral → área
   de conteúdo principal → botões de ação, nessa ordem.
2. **Given** o foco no menu lateral, **When** pressiona Arrow Up/Down,
   **Then** o foco move entre os itens do menu sem sair do grupo.
3. **Given** um tenant com múltiplas experiências (Consumo/Gestão/Admin), **When** o
   usuário navega via teclado até o seletor de experiência, **Then** pode alternar entre
   experiências usando teclado.
4. **Given** qualquer ponto do dashboard, **When** pressiona Tab, **Then** nenhum
   elemento focável fica oculto ou com foco preso (sem armadilha de foco).

---

### User Story 2 — Foco Pós-Login (TD-001) (Priority: P1)

Como usuária de teclado, quero que o foco seja posicionado corretamente ao ser
redirecionada após o login, para que eu saiba imediatamente onde estou na página
sem precisar navegar desde o início.

**Why this priority**: Tech debt obrigatório deferido da Story 12.1. Sem gerenciamento
de foco pós-redirect, o foco é perdido no topo do documento a cada autenticação —
tornando a experiência desorientadora para quem usa apenas teclado ou leitor de tela.

**Independent Test**: Completar o fluxo de login e verificar que o foco está posicionado
no primeiro elemento interativo do dashboard (ex: o menu lateral ou o título principal),
sem que o usuário precise pressionar Tab para "encontrar" onde está.

**Acceptance Scenarios**:

1. **Given** um usuário que completa o login com sucesso, **When** o redirect para
   o dashboard ocorre, **Then** o foco está posicionado no primeiro elemento interativo
   significativo da página (não no `<body>` ou num elemento não-visível).
2. **Given** um usuário que já está logado e é redirecionado por expiração de sessão
   seguida de re-login, **When** retorna ao dashboard, **Then** o foco é posicionado
   corretamente.
3. **Given** um redirect para uma rota profunda (ex: `/groups/123`), **When** o foco
   é restaurado, **Then** está no conteúdo da rota de destino, não na raiz do dashboard.

---

### User Story 3 — CRUD de Grupos e Convite de Membros (Priority: P2)

Como líder com preferência por teclado, quero criar, editar, excluir grupos e
convidar membros usando apenas o teclado, para que eu possa gerenciar minha
comunidade pastoral sem depender de mouse.

**Why this priority**: Grupos são a unidade central de discipulado. Líderes gerenciam
grupos frequentemente; falhas de acessibilidade aqui excluem diretamente líderes
com deficiência motora.

**Independent Test**: Completar o ciclo completo de CRUD de grupo (criar → editar nome
→ convidar membro por email → excluir com confirmação) usando apenas teclado.

**Acceptance Scenarios**:

1. **Given** o usuário na tela de grupos, **When** navega pelo formulário de criação
   via Tab, **Then** todos os campos (nome, descrição, tipo) são alcançáveis e editáveis
   por teclado.
2. **Given** um diálogo de confirmação de exclusão aberto, **When** o usuário pressiona
   Tab, **Then** o foco fica preso dentro do diálogo (focus trap) e Escape fecha o diálogo.
3. **Given** o formulário de convite de membro, **When** o usuário tab até o botão de
   upload de CSV, **Then** o botão é focável e ativável via Enter/Space.
4. **Given** qualquer ação de grupo (criar/editar/excluir), **When** a ação é concluída,
   **Then** o foco retorna a um elemento significativo da lista de grupos (não se perde).

---

### User Story 4 — Builder de Trilhas com Alternativa de Teclado ao Drag-and-Drop (Priority: P2)

Como administradora de conteúdo com limitação motora, quero criar e reorganizar
trilhas, módulos e lições usando apenas o teclado, incluindo a reordenação de
itens sem drag-and-drop, para que eu possa estruturar o conteúdo formativo de forma
independente.

**Why this priority**: O builder de trilhas é a principal ferramenta de criação de
conteúdo. Drag-and-drop sem alternativa exclui completamente usuários de teclado
dessa funcionalidade central.

**Independent Test**: Criar uma trilha com 3 módulos, reordenar os módulos usando
botões de mover (sem mouse), e salvar — tudo via teclado.

**Acceptance Scenarios**:

1. **Given** o builder de trilhas, **When** o usuário tab até um módulo reordenável,
   **Then** botões "Mover para cima" e "Mover para baixo" estão disponíveis e focáveis
   para cada item.
2. **Given** botões de reordenação focados, **When** o usuário pressiona Enter,
   **Then** o item se move e o foco permanece no botão correspondente do item movido.
3. **Given** formulários de criação/edição de módulo ou lição, **When** navegados
   via Tab, **Then** todos os campos de texto, dropdowns e ações são acessíveis.
4. **Given** um builder com drag-and-drop disponível, **When** o usuário usa teclado,
   **Then** a funcionalidade é equivalente à experiência com mouse (não degradada).

---

### User Story 5 — Catálogo de Trilhas e Busca (Priority: P2)

Como participante que usa teclado, quero buscar e filtrar trilhas e ativar
resultados usando apenas teclado, para que eu possa descobrir e iniciar jornadas
de formação de forma independente.

**Why this priority**: O catálogo é o ponto de entrada do participante no conteúdo.
Sem navegação por teclado, participantes com deficiência motora não conseguem
acessar nenhuma trilha.

**Independent Test**: Realizar uma busca com filtro e abrir uma trilha usando apenas
teclado (Tab + Enter).

**Acceptance Scenarios**:

1. **Given** o catálogo de trilhas, **When** o usuário tab até o campo de busca,
   **Then** o campo é focável e aceita digitação por teclado.
2. **Given** filtros disponíveis no catálogo, **When** acessados via Tab,
   **Then** dropdowns de filtro são abríveis (Enter/Space) e navegáveis (Arrow Up/Down).
3. **Given** resultados de busca exibidos, **When** o usuário tab pelos cards,
   **Then** cada card é focável e abrível com Enter.
4. **Given** paginação presente, **When** o usuário chega ao fim da lista,
   **Then** os controles de paginação são alcançáveis e ativáveis por teclado.

---

### User Story 6 — Configuração do Tenant e Branding (Priority: P3)

Como administradora de tenant que usa teclado, quero editar configurações do tenant
(incluindo upload de logo e cores de branding) usando apenas teclado, para que eu
possa personalizar a plataforma de forma independente.

**Why this priority**: Fluxo menos frequente, mas crítico para configuração inicial.
Admins técnicos com deficiência motora devem ter autonomia na configuração.

**Independent Test**: Editar o nome do tenant, fazer upload de logo e definir cor
primária usando apenas teclado.

**Acceptance Scenarios**:

1. **Given** a tela de configurações, **When** navegada via Tab, **Then** todos os
   campos do formulário (nome, descrição, configurações gerais) são alcançáveis.
2. **Given** um seletor de cor presente, **When** o usuário não consegue usar o
   seletor visual, **Then** um campo de input hexadecimal alternativo está disponível
   e focável.
3. **Given** o botão de upload de logo, **When** o usuário pressiona Tab para
   alcançá-lo e Enter para ativar, **Then** o diálogo de arquivo do sistema é aberto.
4. **Given** qualquer alteração salva, **When** o foco retorna, **Then** está em
   um elemento informativo (mensagem de sucesso ou campo editado), não perdido.

---

### User Story 7 — Gestão de Planos e Upgrade (Priority: P3)

Como administradora de tenant que usa teclado, quero visualizar planos disponíveis,
comparar funcionalidades e iniciar upgrade usando apenas teclado, para que eu possa
tomar decisões de plano de forma independente.

**Why this priority**: Fluxo comercial crítico. Excluir usuários de teclado do processo
de upgrade é falha de negócio e acessibilidade simultaneamente.

**Independent Test**: Navegar pela tabela de comparação de planos e acionar o CTA
de upgrade usando apenas teclado.

**Acceptance Scenarios**:

1. **Given** a página de gestão de planos, **When** navegada via Tab, **Then** os
   cards de plano são individualmente focáveis.
2. **Given** um card de plano focado, **When** o usuário pressiona Enter,
   **Then** os detalhes do plano são expandidos/exibidos.
3. **Given** CTAs "Assinar Pro" e "Falar com vendas" visíveis, **When** alcançados
   via Tab, **Then** são focáveis e ativáveis com Enter.
4. **Given** o fluxo de upgrade iniciado, **When** navegado via Tab, **Then** todos
   os passos do fluxo (confirmação, pagamento se aplicável) são navegáveis por teclado.

---

### Edge Cases

- O que acontece quando um modal é aberto via teclado e o usuário pressiona Escape?
  O foco deve retornar ao elemento que abriu o modal.
- Como o sistema lida com conteúdo dinâmico (ex: resultados de busca carregados via
  SPA)? O foco não deve ser redefinido para o topo da página.
- O que ocorre quando o foco chega ao último item de uma lista navegável? Não deve
  "vazar" para fora do componente sem intenção.
- Como o sistema trata focus trap em diálogos de confirmação de ações destrutivas
  (ex: excluir grupo)? O foco deve ficar preso no diálogo até resolução.
- O que acontece quando uma operação assíncrona (ex: salvar configurações) termina?
  Uma mensagem de status deve ser anunciável por leitores de tela e o foco deve
  estar em posição útil.

---

## Requirements

### Functional Requirements

**Baseline e Auditoria:**

- **FR-001**: O sistema DEVE gerar um relatório de baseline de acessibilidade
  automático (via ferramenta de análise estática de acessibilidade) para todos
  os fluxos autenticados antes de qualquer correção.
- **FR-002**: O sistema DEVE gerar um relatório final após todas as correções,
  comparando com o baseline, classificando problemas como: bloqueador, maior ou menor.

**Dashboard (US1):**

- **FR-003**: A ordem de foco no dashboard DEVE seguir a sequência: link de saltar
  para conteúdo → navegação lateral → conteúdo principal → botões de ação.
- **FR-004**: O menu lateral DEVE ser navegável com teclas de seta (Arrow Up/Down)
  entre seus itens.
- **FR-005**: O seletor de experiência (Consumo/Gestão/Admin) DEVE ser acessível
  via teclado quando presente.

**Foco Pós-Login (TD-001, US2):**

- **FR-006**: Após redirect de autenticação bem-sucedido, o foco DEVE ser
  programaticamente movido para o primeiro elemento interativo significativo
  do destino, não para o topo do documento.
- **FR-007**: O gerenciamento de foco pós-redirect DEVE funcionar para rotas
  diretas (ex: `/dashboard`) e rotas profundas (ex: `/groups/123`).

**CRUD de Grupos (US3):**

- **FR-008**: Todos os formulários de grupo (criar, editar) DEVEM ter todos os
  campos navegáveis por Tab na ordem lógica visual.
- **FR-009**: Diálogos de confirmação de ações destrutivas DEVEM implementar
  focus trap: Tab mantém o foco dentro do diálogo; Escape cancela e retorna o
  foco ao elemento que abriu o diálogo.
- **FR-010**: O botão de upload de CSV no convite de membros DEVE ser focável
  e ativável via Enter e Space.
- **FR-011**: Após conclusão de ação de grupo (criar/editar/excluir), o foco
  DEVE retornar a um elemento significativo na lista de grupos.

**Builder de Trilhas (US4):**

- **FR-012**: Cada item reordenável no builder de trilhas DEVE ter botões
  explícitos de "mover para cima" e "mover para baixo" com rótulos descritivos.
- **FR-013**: Após ativação de botão de reordenação, o foco DEVE permanecer
  no botão correspondente do item que foi movido (não no topo da lista).
- **FR-014**: Todos os formulários de criação/edição de módulo e lição DEVEM
  ser completamente navegáveis por Tab.

**Catálogo e Busca (US5):**

- **FR-015**: O campo de busca DEVE ser o primeiro elemento focável da seção
  de busca.
- **FR-016**: Dropdowns de filtro DEVEM ser abríveis com Enter/Space e
  navegáveis com Arrow Up/Down.
- **FR-017**: Cards de resultado DEVEM ser focáveis e ativáveis com Enter.
- **FR-018**: Controles de paginação DEVEM ser alcançáveis e ativáveis por teclado.

**Configurações do Tenant (US6):**

- **FR-019**: Todos os campos de configuração do tenant DEVEM ser alcançáveis
  via Tab na ordem lógica do formulário.
- **FR-020**: Qualquer seletor visual de cor DEVE ter um campo de input textual
  alternativo (ex: hexadecimal) navegável por teclado.
- **FR-021**: O botão de upload de arquivos (logo) DEVE ser focável e ativar
  o diálogo do sistema via Enter.

**Gestão de Planos (US7):**

- **FR-022**: Cards de plano DEVEM ser individualmente focáveis via Tab.
- **FR-023**: Detalhes de plano DEVEM ser expandíveis via Enter quando o card
  está focado.
- **FR-024**: Todos os CTAs de ação de plano (ex: "Assinar", "Contato") DEVEM
  ser focáveis e ativáveis por teclado.

**Testes Automatizados:**

- **FR-025**: Cada fluxo autenticado auditado DEVE ter ao menos um teste
  automatizado E2E exercitando a navegação por teclado (Tab, Enter, Arrow keys).
- **FR-026**: Componentes novos adicionados para acessibilidade (ex: botões de
  reordenação) DEVEM ter testes unitários validando sua acessibilidade semântica.

**Verificação Cross-browser:**

- **FR-027**: A navegação por teclado DEVE ser verificada manualmente em
  Chrome, Firefox e Safari, com checklist documentado por browser e fluxo,
  classificando falhas por severidade (bloqueador/maior/menor).

> Decisões de infraestrutura: N/A — feature é puramente de front-end e
> acessibilidade. Sem scheduling, sem persistência de dados, sem novos
> endpoints de API, sem rotação de chaves, sem mutex multi-pod.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos 7 fluxos autenticados auditados permitem completar sua
  tarefa principal usando apenas teclado (Tab, Enter, Arrow keys, Escape), sem
  mouse.
- **SC-002**: Após o redirect de login, o foco está em um elemento interativo
  significativo em 100% dos casos testados (zero instâncias de foco perdido no
  `<body>`).
- **SC-003**: O builder de trilhas oferece alternativa de teclado funcional ao
  drag-and-drop: reordenação de N itens completa via teclado em no máximo N×2
  interações (uma tecla por direção).
- **SC-004**: O relatório final de acessibilidade não contém nenhum problema
  classificado como "bloqueador" nos fluxos auditados.
- **SC-005**: Testes automatizados E2E cobrem os 7 fluxos autenticados e passam
  no CI (Chromium) sem falhas intermitentes.
- **SC-006**: O checklist de verificação manual cross-browser (Chrome, Firefox,
  Safari) não contém nenhum item classificado como "bloqueador" ao final da story.
- **SC-007**: Qualquer diálogo de confirmação de ação destrutiva implementa focus
  trap funcional: Tab não deixa o foco escapar do diálogo; Escape fecha e restaura
  o foco ao elemento de origem.

---

## Clarifications

> Seção gerada após resolução de bloqueios humanos (dec-014, dec-015) e decisões
> autônomas (dec-010, dec-011, dec-012) na fase clarify. Todas as ambiguidades
> da spec original foram endereçadas antes da fase plan.

### CL-001 — Foco Pós-Login: Hook no Layout Raiz Autenticado (TD-001 / US2)

**Decisão (dec-010):** O gerenciamento de foco pós-redirect de autenticação DEVE
ser implementado via hook centralizado no layout raiz da área autenticada
(`apps/web/app/(authenticated)/layout.tsx`), não disperso em cada página individual.

**Impacto nas FRs:**

- **FR-006** (refinado): O hook `useFocusOnRouteChange()` escuta `usePathname()`
  do Next.js e, após cada navegação de autenticação, move o foco programaticamente
  para o primeiro elemento interativo significativo da página de destino. O hook
  vive no layout raiz autenticado para garantir cobertura uniforme de todas as rotas.
- **FR-007** (refinado): A lógica do hook cobre rotas diretas (`/dashboard`) e
  rotas profundas (`/groups/123`) igualmente — não requer configuração por rota.

**Rationale:** Centralizar no layout raiz evita que novos desenvolvedores esqueçam
de adicionar o gerenciamento em cada nova página. Um único `useEffect` no layout
raiz autenticado garante consistência via padrão Next.js App Router.

---

### CL-002 — Diálogos: shadcn/ui Dialog (Radix UI) para Focus Trap (US3, US6, US7)

**Decisão (dec-011):** Todos os diálogos de confirmação e modais da área autenticada
DEVEM usar o componente `Dialog` de `packages/ui` (que importa `@radix-ui/react-dialog`).
Não implementar focus trap manualmente.

**Impacto nas FRs:**

- **FR-009** (refinado): O focus trap em diálogos de grupos é provido nativamente
  pelo Radix UI Dialog — Tab e Shift+Tab ficam confinados ao diálogo; Escape chama
  `onOpenChange(false)` e restaura o foco ao `trigger`. Zero código adicional para
  focus trap.
- **US6 / US7 (diálogos de configuração e planos):** Mesma premissa — usar
  `packages/ui/components/dialog.tsx` com as props `open` e `onOpenChange`.

**Rationale:** Evidência empírica: `packages/ui/components/dialog.tsx` já importa
`@radix-ui/react-dialog`, e `end-confirm-dialog.tsx` o usa em produção na Story 12.1.
Reutilizar infraestrutura existente; não reinventar a roda.

---

### CL-003 — Sidebar: Roving Tabindex para Navegação com Arrow Keys (US1)

**Decisão (dec-012):** O menu lateral (sidebar) DEVE implementar o padrão
`roving tabindex` para navegação com Arrow Up/Down, conforme o padrão WAI-ARIA APG
para `Listbox` e menus de navegação.

**Impacto nas FRs:**

- **FR-003** (refinado): A sidebar mantém `tabindex="0"` apenas no item atualmente
  ativo; demais itens têm `tabindex="-1"`. Ao pressionar Arrow Up/Down, o foco é
  movido pelo JavaScript para o item anterior/seguinte, que recebe `tabindex="0"`
  e o item anterior passa para `tabindex="-1"`. Tab sai do grupo inteiro para o
  próximo landmark.
- **FR-005** (sem alteração): O seletor de experiência usa a mesma abordagem de
  roving tabindex quando apresentado como lista de opções.

**Rationale:** US1 Acceptance Scenario 2 descreve exatamente o comportamento
"Arrow Up/Down move foco entre itens sem sair do grupo", que é a definição canônica
de roving tabindex. O padrão está documentado no WAI-ARIA APG (Listbox Pattern).

---

### CL-004 — Builder de Trilhas: Botões de Reordenação Sempre Visíveis (US4 / FR-012)

**Decisão (dec-014, operador):** Os botões "Mover para cima" e "Mover para baixo"
em cada item do builder de trilhas DEVEM ser **sempre visíveis** (não apenas em
`:focus-within` ou hover). Cada botão DEVE ter `aria-label` descritivo incluindo o
título do item.

**Impacto nas FRs:**

- **FR-012** (refinado): Cada item reordenável renderiza dois botões explícitos,
  sempre visíveis:
  ```
  <button aria-label={`Mover "${titulo}" para cima`}>↑</button>
  <button aria-label={`Mover "${titulo}" para baixo`}>↓</button>
  ```
  O botão "Mover para cima" do primeiro item e "Mover para baixo" do último item
  ficam `disabled` e com `aria-disabled="true"`.
- **FR-013** (sem alteração): Após ativação, o foco permanece no botão do item
  movido — o item se moveu na lista, mas o botão correspondente (no novo índice)
  mantém o foco via `useEffect(() => ref.current?.focus(), [order])`.

**Rationale:** Máxima descobribilidade: botões sempre visíveis são encontrados por
usuários de teclado sem necessidade de hover/focus prévio para revelá-los. O
`aria-label` descritivo anuncia o contexto correto ao leitor de tela, evitando
"↑ botão" sem contexto.

---

### CL-005 — Foco Assíncrono: Manter Origem + aria-live (US1, US5, US6)

**Decisão (dec-015, operador):** Após qualquer operação assíncrona na área
autenticada (busca, salvar configuração, reordenação), o foco DEVE **permanecer no
elemento de origem** (campo de busca, botão de salvar, botão de mover). O resultado
da operação DEVE ser anunciado via região `role="status" aria-live="polite"`.
O foco NÃO deve ser movido automaticamente para os resultados. Padrão uniforme para
todos os loads assíncronos.

**Impacto nas FRs:**

- **FR-017** (refinado): Cards de resultado do catálogo são focáveis via Tab
  manualmente, mas o foco não é movido para eles automaticamente após a busca. Um
  `<div role="status" aria-live="polite">` anuncia "N resultados encontrados para
  [termo]" — o usuário decide quando Tab para os resultados.
- **US5 (busca)**: Campo de busca retém foco após submit. Região `aria-live` anuncia
  contagem de resultados.
- **US6 (salvar config)**: Botão "Salvar" retém foco após a operação bem-sucedida.
  Região `aria-live` anuncia "Configurações salvas com sucesso."
- **FR-013 (builder)**: Após reordenação, foco retorna ao botão do item movido
  (foco de origem), não para o topo da lista.

**Implementação uniforme:** Criar um hook `useAsyncAnnouncer()` (ou usar o
`aria-live` region já presente na Story 12.1 se disponível) que aceita uma mensagem
e a injeta na região `role="status"` global do layout autenticado. Todos os
componentes assíncronos usam esse hook — sem duplicação de regiões `aria-live`.

**Rationale:** Padrão WAI-ARIA APG explícito: mover o foco para resultados de busca
desoriente o usuário sobre sua posição na página. O padrão correto é manter o foco
e anunciar o resultado. Decisão do operador confirma esse padrão como requisito de
produto.

---

### Resumo das Decisões de Clarify

| ID | Assunto | Decisão | FRs Afetadas |
|----|---------|---------|--------------|
| dec-010 | Foco pós-login | Hook `useFocusOnRouteChange()` no layout raiz autenticado | FR-006, FR-007 |
| dec-011 | Focus trap em diálogos | shadcn/ui Dialog (Radix UI) — sem implementação manual | FR-009, US6, US7 |
| dec-012 | Sidebar Arrow keys | Roving tabindex (WAI-ARIA APG Listbox Pattern) | FR-003, FR-005 |
| dec-014 | Builder botões Up/Down | Sempre visíveis + `aria-label` com título do item | FR-012, FR-013 |
| dec-015 | Foco após async | Manter na origem + anunciar via `aria-live="polite"` | FR-013, FR-017, US5, US6 |

