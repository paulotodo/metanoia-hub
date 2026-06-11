# Feature Specification: TrailPlaylist — Navegação de Conteúdo em Trilha

**Feature**: `trilhas-playlist`
**Created**: 2026-06-11
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Visualizar estrutura completa da trilha (Priority: P1)

Um participante abre a trilha que está cursando e vê imediatamente, em painel lateral (desktop) ou painel deslizante inferior (mobile), todos os módulos com seus percentuais de progresso e todas as aulas — cada uma com seu tipo de conteúdo, duração estimada e estado atual (não iniciada, em andamento, concluída ou bloqueada). A aula em andamento aparece em destaque visual. O progresso geral da trilha é visível no topo do painel.

**Why this priority**: É a jornada central da feature — sem visibilidade da estrutura, o participante não sabe onde está nem para onde ir. Tudo mais depende disto.

**Independent Test**: Acessar `/app/consumo/trilhas/[trailId]/` com dados de progresso populados. O painel lateral/bottom-sheet deve exibir todos os módulos, suas aulas e o estado correto de cada uma.

**Acceptance Scenarios**:

1. **Given** um participante com progresso parcial na trilha, **When** ele acessa a página da trilha no desktop, **Then** um painel lateral exibe os módulos colapsados por padrão, cada um com seu percentual de conclusão; ao expandir um módulo, as aulas aparecem com ícone de tipo de conteúdo, duração e status (✓ concluída / ◑ em andamento / ○ não iniciada / 🔒 bloqueada).
2. **Given** o mesmo participante em dispositivo mobile, **When** ele abre a mesma página, **Then** o painel aparece como bottom-sheet deslizante a partir da borda inferior, com o mesmo conteúdo estrutural.
3. **Given** uma aula em andamento, **When** o painel é exibido, **Then** essa aula é destacada visualmente em cor de marca (teal) e claramente identificada como a aula ativa.
4. **Given** a trilha sem progresso algum, **When** o painel é exibido, **Then** o progresso geral aparece como 0% e todas as aulas elegíveis aparecem como não iniciadas.

---

### User Story 2 - Navegar pela trilha com teclado e acessar aulas bloqueadas com clareza (Priority: P2)

Um participante que usa apenas teclado (ou tecnologia assistiva) consegue percorrer todos os módulos e aulas usando as teclas de seta (navegação entre itens), Enter (abrir/fechar módulo ou acessar aula) e Escape (fechar o bottom-sheet em mobile). Aulas bloqueadas exibem visualmente o cadeado e, ao receber foco, comunicam o motivo do bloqueio por voz (aria-label).

**Why this priority**: Acessibilidade é requisito não-negociável do projeto. Sem navegação por teclado e estados acessíveis, a feature falha nos critérios de qualidade definidos na constitution.

**Independent Test**: Usar teclado e rodar jest-axe sobre o componente renderizado com estados variados (incluindo aulas locked). Todos os itens devem ser focáveis, navegar com setas, e jest-axe não deve reportar violações.

**Acceptance Scenarios**:

1. **Given** o painel de playlist renderizado, **When** o usuário pressiona Tab até o painel e então usa as setas, **Then** o foco se move entre módulos e aulas de forma previsível e visível.
2. **Given** foco em um módulo colapsado, **When** o usuário pressiona Enter, **Then** o módulo expande e o foco permanece acessível.
3. **Given** foco em uma aula bloqueada, **When** leitor de tela anuncia o item, **Then** o motivo do bloqueio é comunicado (ex: "Bloqueado: complete o conteúdo anterior para desbloquear").
4. **Given** o bottom-sheet aberto em mobile, **When** o usuário pressiona Escape, **Then** o painel fecha.
5. **Given** qualquer estado do componente, **When** jest-axe é executado, **Then** nenhuma violação de acessibilidade é reportada.

---

### User Story 3 - Carregamento progressivo sem impacto visual (Priority: P3)

Um participante abre a página da trilha em conexão lenta. Durante o carregamento dos dados, vê esqueletos que ocupam exatamente o mesmo espaço que o conteúdo real ocupará — sem salto de layout (CLS zero). Módulos e aulas fora da área visível carregam sob demanda conforme o participante rola o painel, evitando download desnecessário.

**Why this priority**: Performance de carregamento impacta diretamente a experiência de discipulado contínuo. Sem skeletons e lazy load, participantes com conexão fraca abandonam antes de ver o conteúdo.

**Independent Test**: Renderizar o componente em estado de carregamento e medir deslocamento de layout (CLS deve ser 0). Verificar com IntersectionObserver que itens abaixo da dobra não são renderizados até estarem visíveis.

**Acceptance Scenarios**:

1. **Given** dados ainda carregando, **When** o painel é exibido, **Then** esqueletos animados (pulso suave, sem flash em usuários com preferência por movimento reduzido) ocupam o espaço exato dos módulos e aulas.
2. **Given** um participante que rola o painel até o fim, **When** módulos abaixo da dobra entram na área visível, **Then** eles carregam com esqueleto antes de exibir conteúdo real.
3. **Given** preferência do sistema por movimento reduzido ativada, **When** os esqueletos são exibidos, **Then** a animação de pulso não executa.

---

### User Story 4 - Dados de progresso sempre atualizados após interação (Priority: P4)

Após o participante completar uma aula ou avançar na leitura/vídeo, ao retornar ao painel de playlist ele vê o estado atualizado sem precisar recarregar a página. O progresso da aula reflete o estado mais recente em até 30 segundos; a estrutura da trilha (módulos, aulas, metadados) se mantém estável por até 5 minutos.

**Why this priority**: Dados desatualizados confundem o participante sobre o que já foi concluído. As duas janelas de staleness distintas equilibram frescor e carga de rede.

**Independent Test**: Registrar progresso via POST e depois abrir o painel. Após no máximo 30s de staleTime, o estado deve refletir o progresso registrado sem reload manual.

**Acceptance Scenarios**:

1. **Given** uma aula concluída recentemente, **When** o participante abre o painel de playlist, **Then** o status dessa aula aparece como concluída sem reload.
2. **Given** os dados de estrutura (módulos/aulas) carregados, **When** passam menos de 5 minutos, **Then** nenhuma nova requisição de estrutura é feita.
3. **Given** os dados de progresso carregados, **When** passam mais de 30 segundos, **Then** o progresso é revalidado automaticamente em background na próxima interação.

---

### Edge Cases

- O que acontece quando a trilha não tem módulos? O painel exibe estado vazio com mensagem pastoral em PT-BR.
- O que acontece quando todos os módulos estão bloqueados (acesso sequencial + participante sem progresso)? O primeiro módulo/aula deve aparecer acessível; apenas os demais bloqueados.
- O que acontece quando a conexão cai durante o carregamento? TanStack Query executa 3 tentativas com backoff exponencial; se todas falharem, exibir error boundary com mensagem pastoral "Não foi possível carregar a trilha. Verifique sua conexão e tente novamente." e botão "Tentar novamente" — sem crash silencioso.
- O que acontece no bottom-sheet quando o participante rola para cima (pull-to-close)? Comportamento padrão do sistema operacional / navegador; não deve travar o scroll da página principal.
- O que acontece com aulas sem duração estimada? O campo de duração é omitido (não exibir "null min").
- O que acontece quando o participante está em modo de leitura (apenas olhando o painel, sem acessar aula)? O painel deve ser observável sem exigir interação.

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE exibir um painel de playlist que lista todos os módulos da trilha com seus percentuais de progresso e, dentro de cada módulo, todas as aulas com tipo de conteúdo, duração estimada e status (não iniciada / em andamento / concluída / bloqueada).
- **FR-002**: O painel DEVE se adaptar ao contexto de uso: painel lateral fixo à direita em telas desktop (largura md:w-80 lg:w-96) e painel deslizante inferior (bottom-sheet, altura 60vh) em telas mobile/tablet.
- **FR-003**: A aula ativa (em andamento ou a continuar) DEVE ser destacada visualmente com a cor de marca principal da aplicação.
- **FR-004**: Módulos DEVEM ser colapsáveis/expansíveis individualmente, com o percentual de conclusão visível mesmo no estado colapsado.
- **FR-005**: Aulas bloqueadas (por acesso sequencial ou pré-requisitos não concluídos) DEVEM exibir indicador visual de bloqueio com texto explicativo acessível, integrando o componente de cadeado existente (introduzido na Story 8-5). O estado bloqueado é derivado no FE: se `módulo.lessonAccessMode === 'sequential'`, aula[i] está bloqueada quando aula[i-1] não possui `status === 'completed'`; a primeira aula de cada módulo sequencial nunca é bloqueada por regra de sequência. Módulos com `lessonAccessMode === 'free'` nunca bloqueiam aulas. Aulas bloqueadas não disparam navegação ao serem clicadas.
- **FR-006**: O painel DEVE exibir barra de progresso geral da trilha no topo, refletindo o percentual consolidado de conclusão.
- **FR-007**: Enquanto dados carregam, o sistema DEVE exibir esqueletos com dimensões equivalentes ao conteúdo real, sem causar deslocamento de layout após carregamento (CLS = 0).
- **FR-008**: A animação dos esqueletos DEVE respeitar a preferência do sistema por movimento reduzido (prefers-reduced-motion).
- **FR-009**: Módulos e aulas fora da área visível do painel DEVEM carregar sob demanda conforme entram no campo de visão do participante.
- **FR-010**: O progresso do participante DEVE ser revalidado automaticamente com janelas de staleness distintas: 5 minutos para estrutura da trilha (metadados do trail, módulos, aulas — fetches via GET /trails/:trailId, GET /trails/:trailId/modules, GET /trails/:trailId/modules/:moduleId/lessons) e 30 segundos para dados de progresso (GET /progress/trails/:trailId). Todos os fetches são queries TanStack Query independentes em Client Component — sem endpoint agregador.
- **FR-011**: O painel DEVE ser navegável inteiramente por teclado: setas para mover entre itens, Enter para abrir/fechar módulo ou navegar para aula desbloqueada (via `onLessonSelect` callback → `router.push`), Escape para fechar o bottom-sheet em mobile.
- **FR-012**: Todos os estados do componente DEVEM passar na validação automatizada de acessibilidade (sem violações), e áreas de toque DEVEM ter tamanho mínimo de 44×44px.
- **FR-013**: Campos opcionais ausentes (ex: duração estimada) DEVEM ser omitidos silenciosamente — nunca exibir valores nulos.
- **FR-014**: O painel DEVE exibir estado vazio com mensagem em linguagem pastoral quando a trilha não possuir módulos cadastrados.

> Decisões de infraestrutura: N/A — feature FE pura, stateless em termos de persistência. Sem scheduling, sem key rotation, sem mutex. Consome dados via cache TanStack Query com políticas de staleness definidas nos FRs 010.

### Key Entities

- **Trilha (Trail)**: Unidade de discipulado que o participante está cursando. Possui nome, percentual de progresso agregado, número de módulos concluídos e total.
- **Módulo (Module)**: Agrupamento temático de aulas dentro de uma trilha. Possui nome, modo de acesso (livre ou sequencial), percentual de conclusão e lista de aulas.
- **Aula (Lesson)**: Unidade atômica de conteúdo. Possui nome, tipo de conteúdo (vídeo, texto rico, PDF, link externo), duração estimada em minutos (opcional) e status de progresso do participante.
- **Status de Aula**: Estado do progresso do participante em uma aula — não iniciada, em andamento (com percentual parcial) ou concluída.
- **Estado de Bloqueio**: Condição em que uma aula ou módulo não está acessível por requisito de sequência ou pré-requisito não concluído. Inclui razão textual em linguagem pastoral.

## Success Criteria

### Measurable Outcomes

- **SC-001**: O painel de playlist carrega e exibe todos os módulos e aulas em menos de 2,5 segundos em conexão 4G padrão.
- **SC-002**: O deslocamento de layout acumulado (CLS) durante o carregamento do painel é igual a zero — nenhum elemento muda de posição após os dados chegarem.
- **SC-003**: Todos os itens interativos do painel possuem área de toque mínima de 44×44px, verificado por teste automatizado.
- **SC-004**: A suíte de testes de acessibilidade automatizada (jest-axe) não reporta nenhuma violação para nenhum estado do componente (carregando, carregado, vazio, com erros, com aulas bloqueadas).
- **SC-005**: A navegação completa pelo painel (todos os módulos e aulas) é realizável sem usar mouse — apenas teclado.
- **SC-006**: O participante visualiza o estado atualizado de progresso dentro de 30 segundos após concluir uma aula, sem ação manual de recarregamento.
- **SC-007**: O componente passa na validação de conformidade de densidade visual: padding interno de 20–24px e radius de 12px em todos os cards de módulo/aula.

## Clarifications

### Session 2026-06-11

- Q: Qual estratégia de fetch deve ser usada para montar a playlist completa (nomes + progresso juntos)? → A: Parallel fetch (N+1 paralelo) sem endpoint agregador novo. A playlist monta via queries independentes no TanStack Query: (a) GET /trails/:trailId para metadados da trilha (staleTime 5min), (b) GET /progress/trails/:trailId para progresso (staleTime 30s), (c) GET /trails/:trailId/modules para lista de módulos (staleTime 5min) + GET /trails/:trailId/modules/:moduleId/lessons por módulo em paralelo via Promise.all (staleTime 5min). Story 8-9 é FE pura — sem mudança de backend. (dec-006, score 1)

- Q: Ao clicar numa aula no painel de playlist, qual é o comportamento de navegação? → A: Clicar numa aula navega para sub-rota `/app/consumo/trilhas/[trailId]/aulas/[lessonId]` (rota que será criada pela Story 8-10). No escopo da 8-9, o componente TrailPlaylist recebe um callback `onLessonSelect(lessonId: string)` que o page.tsx roteará com `router.push`. Aulas bloqueadas não disparam navegação — o callback não é chamado. (dec-007, score 1)

- Q: Na rota `/trilhas/[trailId]/`, o painel de playlist é o único conteúdo ou coexiste com área de conteúdo principal? → A: O painel TrailPlaylist é o conteúdo principal da rota nesta story. Não há área de viewer inline. A rota exibe a playlist para o participante escolher onde continuar. Layout: sidebar fixo à direita em desktop (md:w-80 lg:w-96), bottom-sheet em mobile (altura 60vh deslizante a partir da borda inferior). (dec-008, score 1)

- Q: O estado "bloqueada" de uma aula deve ser derivado no FE a partir de `lessonAccessMode` + ordem de conclusão, ou o backend já retorna um campo `locked` por aula? → A: Derivar no FE a partir de `lessonAccessMode` do módulo e da sequência de progresso. Lógica: se `módulo.lessonAccessMode === 'sequential'`, aula[i] está bloqueada se aula[i-1] não possui `status === 'completed'`. A primeira aula de cada módulo sequencial nunca está bloqueada por regra de sequência. Módulos com `lessonAccessMode === 'free'`: todas as aulas desbloqueadas independentemente de progresso. Integrar com componente de cadeado existente introduzido na Story 8-5. (dec-009, score 1)

- Q: Qual comportamento de retry/fallback ao falhar o carregamento da estrutura da trilha? → A: TanStack Query retry padrão (3 tentativas com backoff exponencial) + error boundary com mensagem pastoral em PT-BR e botão "Tentar novamente". Mensagem de erro: "Não foi possível carregar a trilha. Verifique sua conexão e tente novamente." Sem crash silencioso — alinhado com o edge case explícito da spec. (dec-010, score 3)
