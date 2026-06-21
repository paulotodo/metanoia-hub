# Feature Specification: SSE Reconnection & Gap Fill

**Feature**: `sse-reconnection`
**Created**: 2026-06-21
**Status**: Draft
**Story Source**: Story 14-2c (FR77) — Epic 14: Notificações
**Depends On**: Story 14-2a (SSE backend endpoint), Story 14-2b (Notification Center UI)

## Summary

Pastores e líderes dependem do Notification Center para acompanhar alertas pastorais em tempo real. Hoje, quando a conexão SSE cai (rede instável, reinício do servidor), a reconexão é silenciosa e não automática — notificações emitidas durante a interrupção são perdidas sem aviso ao usuário. Esta feature resolve isso com reconexão automática com backoff exponencial, gap fill das notificações perdidas, e indicadores de status de conexão ao usuário.

## User Scenarios & Testing

### User Story 1 — Reconexão automática transparente (Priority: P1)

Uma pastora está com o Notification Center aberto no celular quando a rede cai por alguns segundos. Sem nenhuma ação dela, o sistema detecta a desconexão, mostra um indicador sutil "Reconectando...", restabelece a conexão SSE automaticamente e busca as notificações perdidas durante a interrupção — tudo em segundo plano. Ao reconectar, o indicador desaparece e as notificações perdidas aparecem no centro sem duplicatas.

**Why this priority**: É o fluxo feliz mais crítico. Reconexão automática e gap fill são a proposta de valor central da feature. Sem P1, o usuário perde notificações pastorais urgentes sem saber.

**Independent Test**: Simular queda de rede (desabilitar SSE endpoint via mock de rota) → aguardar reconexão automática → verificar que notificações emitidas durante a queda aparecem no Notification Center.

**Acceptance Scenarios**:

1. **Given** a conexão SSE está ativa e o usuário tem o Notification Center montado, **When** a conexão SSE é perdida, **Then** o sistema detecta a perda e inicia tentativas de reconexão com backoff exponencial começando em 1 segundo.
2. **Given** a reconexão está em andamento, **When** o sistema tenta reconectar, **Then** um indicador "Reconectando..." aparece de forma sutil na interface, sem interromper a navegação.
3. **Given** a reconexão é bem-sucedida, **When** a conexão SSE é restabelecida, **Then** o sistema busca automaticamente as notificações perdidas desde a última recebida e as mescla no Notification Center sem duplicatas.
4. **Given** notificações foram emitidas durante a interrupção, **When** o gap fill é executado, **Then** apenas notificações com IDs ainda não presentes no centro são adicionadas (deduplicação por ID).
5. **Given** a reconexão foi bem-sucedida e o gap fill concluído, **When** o usuário olha para o Notification Center, **Then** o indicador "Reconectando..." não está mais visível.

---

### User Story 2 — Visibilidade de outage estendido (Priority: P2)

Um líder de célula está com a plataforma aberta durante uma manutenção prolongada do servidor. Após 5 tentativas fracassadas no intervalo máximo de backoff, a interface exibe uma mensagem clara: "Sem conexão. Notificações podem estar atrasadas." com um botão "Tentar agora" para que o usuário possa forçar uma nova tentativa imediatamente. A reconexão em segundo plano continua acontecendo.

**Why this priority**: Sem feedback de outage, o usuário acredita que está recebendo notificações normalmente — risco de perder alertas pastorais urgentes sem saber. O aviso é essencial para gestão de expectativa.

**Independent Test**: Simular 5 falhas consecutivas no intervalo máximo de backoff via mock → verificar exibição do aviso e do botão "Tentar agora" → clicar no botão → verificar que nova tentativa de reconexão é iniciada.

**Acceptance Scenarios**:

1. **Given** a reconexão falhou repetidamente, **When** 5 tentativas consecutivas no intervalo máximo de backoff falham, **Then** a interface exibe "Sem conexão. Notificações podem estar atrasadas." com o botão "Tentar agora".
2. **Given** o aviso de outage está visível, **When** o usuário clica "Tentar agora", **Then** uma nova tentativa de reconexão é iniciada imediatamente, independente do timer de backoff.
3. **Given** o aviso de outage está visível, **When** a reconexão bem-sucedida ocorre (via tentativa automática ou manual), **Then** o aviso desaparece, o gap fill é executado e notificações perdidas aparecem.
4. **Given** o aviso de outage está visível, **When** o usuário não interage, **Then** tentativas de reconexão continuam automaticamente em segundo plano.

---

### User Story 3 — Filtro `since` nas notificações (Priority: P3)

O sistema de gap fill precisa buscar apenas as notificações criadas após um determinado momento. O endpoint `GET /api/v1/notifications` aceita o parâmetro `since` com timestamp ISO 8601, retornando somente as notificações criadas após aquele instante para o usuário autenticado, respeitando isolamento de inquilino.

**Why this priority**: Sem P3, o gap fill teria que buscar todas as notificações não lidas e depender apenas de deduplicação no cliente — ineficiente e propenso a divergências. P3 é pré-requisito técnico para o gap fill eficiente de P1.

**Independent Test**: Chamar `GET /api/v1/notifications?since=<timestamp>&status=unread` com timestamp no passado → verificar que apenas notificações criadas após o timestamp são retornadas. Testar com timestamp futuro → lista vazia. Testar sem `since` → comportamento idêntico ao original.

**Acceptance Scenarios**:

1. **Given** o usuário está autenticado e tem notificações no sistema, **When** `GET /api/v1/notifications?since=<ISO 8601>` é chamado, **Then** apenas notificações criadas após o timestamp fornecido são retornadas.
2. **Given** o parâmetro `since` é fornecido com formato inválido, **When** a requisição é processada, **Then** o sistema retorna erro de validação 400 com mensagem clara.
3. **Given** `since` não é fornecido, **When** `GET /api/v1/notifications` é chamado, **Then** o comportamento é idêntico ao atual (sem filtro de timestamp).
4. **Given** notificações de outro inquilino existem no sistema, **When** o filtro `since` é aplicado, **Then** apenas notificações do inquilino do usuário autenticado são retornadas (isolamento RLS preservado).

---

### Edge Cases

- O que acontece quando `lastReceivedAt` é nulo (primeira conexão ou após refresh da página)? → O gap fill não é executado; o estado inicial é carregado pela query TanStack Query existente (busca todos os não lidos).
- O que acontece se a mesma notificação aparecer tanto no stream SSE quanto no gap fill? → Deduplicação por ID no cliente garante que cada notificação aparece uma única vez.
- O que acontece quando o usuário navega para outra página durante a reconexão? → O hook é desmontado, a conexão SSE é fechada, os timers de backoff são cancelados. Ao voltar, uma nova conexão é estabelecida do zero.
- O que acontece se o servidor de SSE retornar erro HTTP 401 (token expirado)? → A reconexão não deve logar a URL (contém token). O fluxo de reconexão deve respeitar erros de autenticação sem expor o token em logs.
- O que acontece se o `since` timestamp fornecido for muito antigo (> 30 dias)? → O sistema retorna as notificações normalmente sem restrição de janela temporal — o frontend rastreia `lastReceivedAt` apenas em memória (sessão), então na prática o `since` sempre reflete interrupções recentes.
- O que acontece se o gap fill falhar (erro de rede durante o fetch)? → A falha é silenciosa para o usuário; as notificações perdidas não são recuperadas nessa tentativa. Na próxima reconexão SSE, um novo gap fill é tentado com o mesmo `lastReceivedAt`.

## Requirements

### Functional Requirements

**Frontend — Reconexão e backoff:**

- **FR-001**: O sistema DEVE detectar automaticamente a perda de conexão SSE e iniciar tentativas de reconexão com backoff exponencial: 1s, 2s, 4s, 8s, com teto máximo de 30s por tentativa.
- **FR-002**: O sistema DEVE exibir um indicador sutil "Reconectando..." durante tentativas de reconexão ativas.
- **FR-003**: O indicador "Reconectando..." DEVE desaparecer automaticamente quando a conexão SSE for restabelecida com sucesso.
- **FR-004**: Após 5 falhas consecutivas no intervalo máximo de backoff (30s), o sistema DEVE exibir a mensagem "Sem conexão. Notificações podem estar atrasadas." com o botão "Tentar agora".
- **FR-005**: O botão "Tentar agora" DEVE iniciar uma nova tentativa de reconexão imediatamente, reiniciando o contador de falhas.
- **FR-006**: As tentativas de reconexão DEVEM continuar em segundo plano mesmo quando o aviso de outage estendido está visível.
- **FR-007**: Ao reconectar com sucesso após outage estendido, o aviso DEVE desaparecer e o gap fill DEVE ser executado.

**Frontend — Gap fill:**

- **FR-008**: O hook de stream DEVE rastrear em memória o timestamp `lastReceivedAt` da notificação mais recente recebida via SSE.
- **FR-009**: O `lastReceivedAt` NÃO deve ser persistido (localStorage, sessionStorage, cookie) — um refresh da página descarta o valor e o estado inicial é obtido pela query existente de todas as notificações não lidas.
- **FR-010**: Ao restabelecer conexão SSE, se `lastReceivedAt` estiver definido, o sistema DEVE buscar notificações via `GET /api/v1/notifications?since={lastReceivedAt}&status=unread`.
- **FR-011**: As notificações retornadas pelo gap fill DEVEM ser mescladas no Notification Center deduplicando por `id` — notificações já presentes não são adicionadas novamente.
- **FR-012**: Toda comunicação de estado de conexão entre o hook de stream e os componentes DEVE usar mecanismos de state de cliente (não server state), sem misturar com TanStack Query.

**Frontend — Componente de status:**

- **FR-013**: Um novo componente de status de conexão DEVE encapsular os três estados: reconectando, falha estendida e conectado (não renderiza nada quando conectado).
- **FR-014**: Todos os textos de reconexão exibidos ao usuário DEVEM estar em PT-BR com vocabulário acessível e pastoral, centralizados no arquivo de mensagens do projeto.

**Backend — Filtro `since`:**

- **FR-015**: O endpoint `GET /api/v1/notifications` DEVE aceitar o parâmetro de query `since` com valor em formato ISO 8601.
- **FR-016**: Quando `since` for fornecido, apenas notificações cuja data de criação seja estritamente posterior ao timestamp fornecido DEVEM ser retornadas.
- **FR-017**: O schema Zod compartilhado entre frontend e backend DEVE ser atualizado para incluir `since` como campo opcional com validação de formato datetime.
- **FR-018**: A implementação do filtro `since` DEVE respeitar o isolamento de inquilino (RLS) — o filtro se aplica apenas às notificações do inquilino do usuário autenticado.
- **FR-019**: O parâmetro `since` inválido (formato não-ISO 8601) DEVE resultar em resposta 400 com mensagem de erro clara.

**Testes:**

- **FR-020**: Testes E2E DEVEM cobrir os cenários: (a) desconexão → reconexão automática → gap fill recupera notificações perdidas; (b) 5 falhas consecutivas → aviso exibido; (c) reconexão após outage → indicador some e gap fill executado.
- **FR-021**: Testes unitários DEVEM cobrir a lógica de backoff exponencial, rastreamento de `lastReceivedAt`, deduplicação no gap fill e os estados do componente de status.

> **Decisões de infraestrutura:** N/A para esta feature — não há scheduling periódico novo, nem rotação de chaves, nem mutex multi-pod. O RLS existente cobre o filtro `since` sem configuração adicional. A conexão SSE reutiliza o endpoint de 14-2a com o mesmo mecanismo de token por query string.

## Clarifications

Não há itens `[NEEDS CLARIFICATION]`. Todos os parâmetros de comportamento (backoff 1s/2s/4s/8s/30s, threshold de 5 falhas, deduplicação por ID, memória não-persistida) estão definidos nos ACs da Story 14-2c.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Após queda momentânea de conexão (<30s), o usuário não perde nenhuma notificação — todas as notificações emitidas durante a interrupção aparecem no Notification Center ao reconectar, sem ação manual.
- **SC-002**: O indicador "Reconectando..." aparece em menos de 2 segundos após a perda de conexão e desaparece em menos de 2 segundos após a reconexão bem-sucedida.
- **SC-003**: Após 5 falhas consecutivas no intervalo máximo, 100% dos usuários recebem o aviso de outage e o botão de retry manual — nenhum usuário fica sem feedback de conexão perdida.
- **SC-004**: O gap fill não introduz duplicatas: o mesmo ID de notificação nunca aparece duas vezes no Notification Center, independente de quantas reconexões ocorram na mesma sessão.
- **SC-005**: O filtro `since` retorna apenas notificações criadas após o timestamp fornecido, com erro 400 para formato inválido — validação verificável em testes de integração.
- **SC-006**: Nenhuma informação de sessão (token, `lastReceivedAt`) é persistida além da sessão do navegador — verificável auditando localStorage/sessionStorage/cookies após refresh de página.
