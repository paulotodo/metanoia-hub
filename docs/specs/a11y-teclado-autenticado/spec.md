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

