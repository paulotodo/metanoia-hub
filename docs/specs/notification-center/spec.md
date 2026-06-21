# Feature Specification: Notification Center UI

**Feature**: `notification-center`
**Created**: 2026-06-20
**Status**: Draft
**Story**: 14-2b (Epic 14 — Notificações)
**Requirement Reference**: FR77

## User Scenarios & Testing

### User Story 1 - Badge de notificações no cabeçalho (Priority: P1)

Como usuário logado na plataforma, quero ver um ícone de sino no cabeçalho que
indique visualmente quantas notificações não lidas tenho, para que eu saiba
imediatamente quando há algo novo que exige minha atenção — sem precisar abrir
nenhum painel.

**Why this priority**: É a porta de entrada para todo o centro de notificações.
Sem o badge visível no cabeçalho, o usuário nunca descobrirá organicamente que
tem notificações pendentes. Valor imediato e independente: mesmo sem o dropdown,
o badge já resolve o problema de visibilidade.

**Independent Test**: Acessar a aplicação com uma conta que tenha notificações
não lidas e verificar que o sino mostra o contador correto sem abrir nenhum
dropdown.

**Acceptance Scenarios**:

1. **Given** o usuário está logado e tem 3 notificações não lidas,
   **When** visualiza qualquer página autenticada,
   **Then** um ícone de sino aparece no cabeçalho com um badge mostrando "3" e o badge possui descrição acessível "3 notificações não lidas".

2. **Given** o usuário tem 100 ou mais notificações não lidas,
   **When** visualiza o cabeçalho,
   **Then** o badge exibe "99+" e a descrição acessível indica "99 ou mais notificações não lidas".

3. **Given** o usuário não tem notificações não lidas,
   **When** visualiza o cabeçalho,
   **Then** o sino é exibido sem badge numérico (estado neutro).

4. **Given** uma nova notificação chega em tempo real,
   **When** o sistema a recebe,
   **Then** o badge atualiza o contador imediatamente e uma região de anúncio acessível informa "Nova notificação: {título da notificação}" sem interromper o foco do usuário.

---

### User Story 2 - Visualização e leitura de notificações (Priority: P2)

Como usuário logado, quero clicar no sino para abrir um painel com minhas
notificações não lidas, ver o que cada uma diz e navegar para o conteúdo
relacionado, para que eu possa agir sobre o que requer minha atenção de forma
rápida e contextualizada.

**Why this priority**: Complemento imediato ao P1 — o badge mostra que há
notificações; este painel permite ver e agir sobre elas. Dependência direta
da infraestrutura já entregue (Story 14-1) e do endpoint SSE (Story 14-2a),
tornando-o viável neste momento.

**Independent Test**: Clicar no sino com notificações pendentes, verificar
que a lista aparece com ícone por tipo, título, prévia do corpo e tempo
relativo; clicar em uma e confirmar que ela some da lista (marcada como lida)
e que a navegação ocorre.

**Acceptance Scenarios**:

1. **Given** o usuário clica no sino e tem notificações não lidas,
   **When** o painel de notificações abre,
   **Then** a lista mostra até 20 notificações não lidas, cada uma com ícone correspondente ao tipo, título completo, prévia do corpo (até 100 caracteres) e tempo relativo ("há 5 min", "há 2h").

2. **Given** o painel está aberto,
   **When** o usuário clica em uma notificação,
   **Then** a notificação é marcada como lida, some da lista de não lidas e a navegação acontece para a página relacionada ao conteúdo da notificação.

3. **Given** o usuário não tem nenhuma notificação não lida,
   **When** abre o painel,
   **Then** é exibido um estado vazio com mensagem pastoral: "Tudo tranquilo por aqui! Suas notificações aparecerão aqui." e uma ilustração contextual — sem erros, sem lista vazia crua.

---

### User Story 3 - Marcar todas as notificações como lidas (Priority: P3)

Como usuário com múltiplas notificações pendentes, quero poder marcar todas
como lidas de uma só vez, para limpar minha fila de notificações sem precisar
clicar em cada uma individualmente.

**Why this priority**: Conveniência importante quando o usuário acumula muitas
notificações (ex.: voltou de férias). Requer um endpoint novo no backend, mas
o padrão de uso é baixo o suficiente para ser P3 — o fluxo individual (P2)
já resolve o essencial.

**Independent Test**: Com 5 notificações não lidas abertas no painel, acionar
"Marcar todas como lidas" e verificar que o badge vai a zero, a lista fica
vazia e nenhum erro é exibido.

**Acceptance Scenarios**:

1. **Given** o painel está aberto com múltiplas notificações não lidas,
   **When** o usuário aciona "Marcar todas como lidas",
   **Then** todas as notificações não lidas são marcadas como lidas em lote, a lista do painel fica vazia, e o badge no cabeçalho vai a zero.

2. **Given** a ação de marcar todas está em progresso,
   **When** ocorre um erro de rede,
   **Then** o sistema exibe feedback de erro claro e o estado anterior das notificações é mantido (nenhuma marcação parcial persiste sem confirmação do servidor).

---

### User Story 4 - Controle de alertas de notificações (Priority: P4)

Como usuário, quero poder silenciar os alertas visuais/sonoros de novas
notificações neste dispositivo, para que em momentos de foco eu não seja
interrompido por avisos, sem perder as notificações que chegam.

**Why this priority**: Controle de atenção é importante para o usuário, mas
é uma preferência pessoal e local — as notificações continuam sendo recebidas
e estarão disponíveis quando o usuário reabrir o painel. Sincronização
multi-dispositivo é Post-MVP (FR78).

**Independent Test**: Habilitar "Silenciar notificações", receber uma
notificação via SSE e confirmar que o badge atualiza mas nenhum alerta visual
ou sonoro acontece; desabilitar e confirmar que os alertas voltam.

**Acceptance Scenarios**:

1. **Given** o usuário habilita "Silenciar notificações" no painel,
   **When** uma nova notificação chega via tempo real,
   **Then** o badge é atualizado com o novo contador, mas nenhum alerta visual ou sonoro é disparado.

2. **Given** o toggle "Silenciar" está habilitado,
   **When** o usuário fecha e reabre o navegador,
   **Then** a preferência é mantida (persistida localmente neste dispositivo).

3. **Given** o usuário desabilita o "Silenciar",
   **When** uma nova notificação chega,
   **Then** os alertas visuais/sonoros voltam a ocorrer normalmente.

---

### Edge Cases

- O que acontece quando a conexão SSE é perdida? O badge deve mostrar o último valor conhecido e o painel deve indicar quando os dados podem estar desatualizados.
- O que acontece quando `metadata.actionUrl` está ausente ou inválido em uma notificação? Clicar na notificação deve ainda marcá-la como lida; a navegação falha graciosamente sem erro exposto.
- O que acontece quando o usuário abre o painel e, antes de fechá-lo, chega uma nova notificação via SSE? A lista deve atualizar automaticamente sem fechar o painel.
- O que acontece quando o usuário tem exatamente 99 e chega mais uma? O badge deve transicionar de "99" para "99+" sem flickering.
- O que acontece se a requisição de "marcar como lida" falhar para uma notificação individual? A notificação deve permanecer na lista (não ser removida prematuramente) e o usuário deve poder tentar novamente.
- O que acontece quando o usuário está com o painel aberto em duas abas simultaneamente? Cada aba atualiza independentemente via SSE.

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE exibir um ícone de sino no cabeçalho da aplicação para usuários autenticados, com um indicador numérico do total de notificações não lidas, limitado ao máximo visual de "99+" quando o total supera 99.

- **FR-002**: O indicador do sino DEVE ser acessível: possuir descrição alternativa legível por tecnologias assistivas que informe o número exato de notificações não lidas (ou "99 ou mais" quando limitado), e uma região da página dedicada ao anúncio de novas notificações em tempo real, sem interromper o foco do usuário.

- **FR-003**: O sistema DEVE sincronizar o contador de não lidas em tempo real via canal de eventos já provido pela Story 14-2a, atualizando o badge imediatamente ao receber um novo evento sem necessidade de recarga de página.

- **FR-004**: Ao clicar no sino, o sistema DEVE abrir um painel listando as notificações não lidas mais recentes (limite: 20), recuperadas via serviço de listagem existente da Story 14-1, filtradas por status não lido.

- **FR-005**: Cada entrada na lista de notificações DEVE apresentar: ícone visual correspondente ao tipo da notificação, título completo, prévia do corpo da mensagem truncada em 100 caracteres, e tempo relativo de quando a notificação foi criada (ex.: "há 5 min", "há 2h", "há 3 dias").

- **FR-006**: Ao clicar em uma notificação individual, o sistema DEVE atualizar o status para "lida" via serviço existente da Story 14-1 e direcionar o usuário para a página ou recurso relacionado indicado pela notificação — sem expor erros técnicos caso a URL de destino seja inválida.

- **FR-007**: O painel DEVE exibir um estado vazio com ilustração e mensagem pastoral quando não há notificações não lidas. A mensagem DEVE utilizar vocabulário pastoral e ser centralizada no arquivo de mensagens de internacionalização PT-BR do projeto.

- **FR-008**: O sistema DEVE prover uma ação "Marcar todas como lidas" que, ao ser acionada, envia uma requisição em lote ao backend para marcar todas as notificações não lidas do usuário autenticado como lidas. O backend DEVE aplicar isolamento por tenant automaticamente, sem exposição do identificador de tenant na interface.

- **FR-009**: O endpoint de lote "marcar todas como lidas" DEVE ser validado por schema de contrato compartilhado (FE e BE consomem o mesmo contrato), garantindo que breaking changes sejam detectados automaticamente por testes de snapshot.

- **FR-010**: O sistema DEVE oferecer um controle de "Silenciar notificações" que, quando habilitado, mantém a recepção de eventos em tempo real e atualiza o badge, mas suprime qualquer alerta visual ou sonoro para o usuário. A preferência DEVE ser persistida localmente no dispositivo. Sincronização desta preferência entre dispositivos não é escopo desta feature.

- **FR-011**: A sincronização em tempo real DEVE utilizar o canal SSE da Story 14-2a como fonte de eventos; ao receber um evento, o sistema DEVE invalidar o cache local de notificações para que a próxima abertura do painel reflita os dados mais recentes do servidor.

- **FR-012**: Todos os fluxos do centro de notificações DEVEM ser navegáveis por teclado e DEVEM cumprir os critérios de acessibilidade WCAG AA, incluindo contraste adequado, foco visível em todos os elementos interativos e rótulos descritivos para elementos sem texto visível.

- **FR-013**: O sistema DEVE ter cobertura de testes ponta-a-ponta cobrindo: badge com contador, abertura do painel, visualização de notificação, marcação como lida com navegação, estado vazio, ação em lote e comportamento do toggle de silenciar.

### Key Entities

- **Notificação**: Representa um aviso dirigido a um usuário específico de um tenant. Possui tipo (que determina o ícone exibido), título, corpo, status (não lida / lida), momento de criação, e referência opcional ao recurso relacionado na plataforma.

- **Preferência de silêncio**: Configuração local ao dispositivo que controla se alertas visuais/sonoros são disparados ao receber novas notificações em tempo real. Não é sincronizada entre dispositivos.

> Decisões de infraestrutura: N/A para esta feature no que tange scheduling e
> key rotation. O canal SSE (Story 14-2a) e os endpoints de leitura/escrita
> (Story 14-1) já possuem suas próprias políticas de infraestrutura definidas.
> O endpoint novo (marcar todas como lidas) é stateless e sem scheduling.

## Success Criteria

### Measurable Outcomes

- **SC-001**: O badge de notificações atualiza em até 2 segundos após o recebimento de um evento em tempo real, em condições de rede normais.

- **SC-002**: O painel de notificações carrega e exibe a lista em até 1,5 segundos após o clique no sino, em condições de rede normais.

- **SC-003**: A ação "Marcar todas como lidas" completa em até 3 segundos para acúmulos de até 200 notificações não lidas, sem erro retornado ao usuário.

- **SC-004**: 100% dos elementos interativos do centro de notificações (sino, painel, itens da lista, botão de ação em lote, toggle de silenciar) são operáveis exclusivamente por teclado, sem dependência de mouse ou toque.

- **SC-005**: O badge e todos os controles do painel passam na auditoria de acessibilidade WCAG AA — zero violações de contraste, zero elementos interativos sem rótulo acessível, zero regiões dinâmicas sem anúncio adequado.

- **SC-006**: A ação de marcar uma notificação individual como lida e navegar para o destino ocorre em até 1 segundo após o clique, em condições de rede normais.

- **SC-007**: A mensagem de estado vazio utiliza vocabulário pastoral e é exibida sem erros ou mensagens técnicas quando o usuário não tem notificações não lidas.

- **SC-008**: A preferência de silenciar persiste após fechamento e reabertura do navegador no mesmo dispositivo, sem exigir ação do usuário.

- **SC-009**: A suíte de testes ponta-a-ponta cobre todos os fluxos descritos nos cenários de aceitação (P1 a P4), com zero testes ignorados ou marcados como pendentes no CI ao entregar a story.
