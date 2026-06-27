# Feature Specification: Preferências Granulares de Notificação por Tipo

**Feature**: `notif-preferencias-granulares`
**Created**: 2026-06-26
**Status**: Draft
**Source Story**: `_bmad-output/implementation-artifacts/16-1-preferencias-granulares-de-notificacao-por-tipo-fr78.md` (FR78)

---

## User Scenarios & Testing

### User Story 1 — Configurar preferências por tipo e canal (Priority: P1)

Como Participante ou Líder, quero acessar uma página de configurações de
notificações onde posso ativar/desativar cada tipo de notificação
independentemente para o canal "No app" e para o canal "E-mail", para que
eu receba apenas os avisos que importam para mim, nos canais certos.

**Why this priority**: É o núcleo da feature. Sem a capacidade de ler e
gravar preferências, nenhuma das outras stories tem sentido. Entrega valor
imediato ao usuário que quer parar de receber e-mails de lembretes de
reunião sem silenciar todos os alertas.

**Independent Test**: Abrir `/app/configuracoes/notificacoes`, desativar
"E-mail" para "Lembretes de reunião", salvar e verificar que outros tipos
não foram alterados. Recarregar a página e confirmar que a preferência persiste.

**Acceptance Scenarios**:

1. **Given** o usuário está autenticado, **When** acessa `/app/configuracoes/notificacoes`, **Then** vê uma lista com os tipos de notificação disponíveis (alertas pastorais, lembretes de reunião, novo conteúdo, relatórios prontos, anúncios do sistema), cada um com dois toggles ("No app" e "E-mail") e seus rótulos e descrições em PT-BR.
2. **Given** o usuário ativa/desativa um toggle, **When** o toggle muda, **Then** a UI reflete a mudança imediatamente (optimistic update) e o sistema persiste a preferência via PATCH sem exigir confirmação explícita; em caso de erro da API, o toggle reverte ao estado anterior e exibe mensagem de erro em PT-BR.
3. **Given** o usuário não tem preferências salvas (primeiro acesso), **When** a página carrega, **Then** todos os toggles aparecem ativados (defaults: inApp=true, email=true para todos os tipos).
4. **Given** o usuário é Líder, **When** vê o toggle "No app" de "Alertas pastorais", **Then** ele aparece visualmente desabilitado com tooltip explicativo — não pode ser desativado.

---

### User Story 2 — Pipeline de notificação respeita preferências (Priority: P2)

Como Líder ou Participante, quero que o sistema não me envie notificações
por canais que desativei, para que minha caixa de entrada de e-mail e a
central de notificações no app reflitam apenas o que me interessa.

**Why this priority**: Sem essa story, as preferências existem mas não têm
efeito real — são apenas cosmética. É a story que fecha o ciclo de valor.

**Independent Test**: Desativar "E-mail" para "Lembretes de reunião".
Acionar o envio de uma notificação desse tipo. Verificar que o e-mail não
foi enviado, mas a notificação aparece na central in-app (se inApp habilitado).
Verificar que o registro na tabela `notifications` foi criado com status de
não-entregue via e-mail por preferência.

**Acceptance Scenarios**:

1. **Given** o usuário desativou um canal para um tipo de notificação, **When** o sistema processa uma notificação daquele tipo, **Then** o canal desativado é ignorado — a notificação não é enviada por esse canal.
2. **Given** o usuário desativou um canal, **When** uma notificação é suprimida por preferência, **Then** o sistema registra a notificação de forma que auditores/admins possam verificar que ela existiu e foi suprimida intencionalmente (razão: preferência do usuário).
3. **Given** o serviço de cache está indisponível, **When** o sistema precisa verificar preferências, **Then** consulta diretamente a base de dados e emite um aviso nos logs — nenhuma notificação é silenciosamente descartada por falha de cache.
4. **Given** preferências salvas, **When** múltiplas notificações chegam em sequência rápida, **Then** as preferências são consultadas de cache (TTL ~10 minutos) sem múltiplas viagens ao banco por evento.

---

### User Story 3 — Migração do "silenciar" global para preferências por tipo (Priority: P3)

Como Participante ou Líder que usava o toggle "Silenciar todas as notificações"
da versão anterior, quero uma transição suave para o novo sistema de
preferências, sem perder meu estado atual e sem decisões automáticas tomadas
em meu nome.

**Why this priority**: Necessário para que a nova feature não quebre usuários
existentes que dependiam do toggle de silêncio global. É uma story de
continuidade.

**Independent Test**: Simular um usuário com toggle "silenciar" ativo em
localStorage. Abrir a página de preferências. Verificar que o banner de aviso
aparece. Escolher "Manter silenciado" → confirmar que todos os canais in-app
aparecem como desabilitados e o localStorage é removido. Em nova aba, confirmar
que o localStorage não existe mais.

**Acceptance Scenarios**:

1. **Given** o usuário tem o toggle "silenciar" ativo (localStorage), **When** acessa a página de preferências, **Then** vê um banner informando que todas as notificações no app estão silenciadas e que deve desativar o modo silencioso para usar as preferências por tipo.
2. **Given** o usuário tem o toggle "silenciar" ativo e é o primeiro acesso à página de preferências, **When** a página carrega, **Then** aparece um modal de migração: "Você estava com notificações silenciadas. Deseja manter tudo desativado ou configurar por tipo?" com duas ações: "Manter silenciado" e "Configurar por tipo".
3. **Given** o modal de migração está aberto e o usuário escolhe "Manter silenciado", **When** confirma, **Then** todas as preferências in-app são gravadas como `false` no servidor, o localStorage é removido, e a página exibe o estado correto.
4. **Given** o modal de migração está aberto e o usuário escolhe "Configurar por tipo", **When** confirma, **Then** o localStorage é removido, o modal fecha e o usuário vê a página de preferências com todos os padrões ativados para configurar à vontade.
5. **Given** após a migração (qualquer caminho), **When** o usuário recarrega a página, **Then** o modal não é exibido novamente e o banner de silêncio não aparece (o estado de silêncio global não existe mais para esse usuário).

---

### User Story 4 — Enforcement de papel: preferências não-sobrescreváveis do Líder (Priority: P4)

Como Líder, devo sempre receber alertas pastorais in-app,
independentemente das minhas preferências, porque esses alertas são minha
responsabilidade primária no sistema.

**Why this priority**: Regra de negócio de segurança pastoral. Um Líder
que desativa alertas pastorais e deixa de atender um participante em
situação crítica seria uma falha do produto. O enforcement é necessário
mas pode ser implementado após P1–P3 estarem funcionando.

**Independent Test**: Autenticar como Líder. Tentar via API enviar
`PATCH /api/v1/users/me/notification-preferences` com `pastoral_alert.inApp = false`.
Verificar resposta de erro (422). Verificar que o toggle está desabilitado na UI.
Remover o papel de Líder do usuário → verificar que o toggle se torna editável.

**Acceptance Scenarios**:

1. **Given** o usuário tem papel de Líder, **When** tenta desabilitar "Alertas pastorais" in-app (via UI ou API), **Then** a operação é recusada com mensagem clara em PT-BR (UI: tooltip; API: erro 422).
2. **Given** o usuário é promovido a Líder (mudança de papel), **When** o sistema detecta o novo papel no próximo acesso, **Then** a preferência `pastoral_alert.inApp` é forçada para `true`, independentemente do valor anterior, sem notificação ao usuário.
3. **Given** o usuário era Líder e é rebaixado a Participante (mudança de papel), **When** o sistema detecta o novo papel, **Then** a preferência `pastoral_alert.inApp` passa a ser um toggle regular — o usuário pode desativá-la.
4. **Given** mudança de papel ocorre, **When** as preferências são atualizadas, **Then** todos os outros tipos de preferência (inApp e email) são preservados sem alteração.

---

### Edge Cases

- O que acontece se o usuário pertence a múltiplos tenants? → Preferências são por `(user_id, tenant_id)` — cada tenant tem suas próprias preferências. O contexto de tenant é determinado pelo request corrente.
- O que acontece se um novo tipo de notificação é adicionado ao sistema sem ter registro de preferência para um usuário? → O sistema usa o default `enabled: true` para tipos sem registro explícito.
- O que acontece se o Redis fica indisponível durante uma rafaga de notificações? → Cada consulta de preferência cai para o banco de dados diretamente; há degradação de performance mas nenhuma notificação é descartada por erro de cache.
- O que acontece se um usuário tenta atualizar preferências de outro usuário? → O endpoint `/users/me` só permite operações no próprio usuário autenticado; tentativas de IDOR são bloqueadas na camada de autorização.
- O que acontece se o payload de PATCH contém um `notification_type` desconhecido? → A requisição é rejeitada com erro de validação (422) antes de chegar à camada de negócio.

---

## Requirements

### Functional Requirements

- **FR-001**: O sistema MUST persistir preferências de notificação por `(usuário, tenant, tipo de notificação, canal)` com valores booleanos de habilitação e timestamp de atualização.
- **FR-002**: O sistema MUST expor dois endpoints autenticados: leitura de preferências do usuário corrente e atualização parcial (patch semantics, não replace).
- **FR-003**: O sistema MUST retornar preferências com defaults `inApp: true, email: true` para tipos sem registro explícito, sem necessidade de popular todos os registros no banco de criação de conta.
- **FR-004**: O sistema MUST validar `notification_type` e `channel` contra os valores aceitos pelo sistema — requisições com valores fora do conjunto são rejeitadas com erro de validação antes de tocar o banco.
- **FR-005**: O sistema MUST cache de preferências por usuário com TTL de aproximadamente 10 minutos, invalidando o cache imediatamente após qualquer atualização bem-sucedida.
- **FR-006**: O sistema MUST continuar operando (consultando preferências diretamente da base de dados) quando o serviço de cache estiver indisponível — a indisponibilidade do cache é registrada como aviso nos logs mas não interrompe o fluxo de notificação.
- **FR-007**: O sistema MUST verificar preferências antes de rotear cada notificação por canal; quando um canal está desabilitado, o registro de notificação é criado com indicação de não-entrega por preferência do usuário.
- **FR-008**: O sistema MUST recusar a desabilitação do canal in-app para `pastoral_alert` quando o usuário tem papel de Líder — a recusa ocorre na API (erro de negócio) e a UI reflete a restrição visualmente.
- **FR-009**: O sistema MUST recalcular o enforcement de `pastoral_alert.inApp` de forma lazy no momento do acesso (GET, PATCH) e do roteamento de notificação, baseado no papel corrente do token de autenticação — sem necessidade de evento proativo de sincronização de papel.
- **FR-010**: O sistema MUST detectar a presença do toggle de silêncio global (localStorage) e apresentar o fluxo de migração ao usuário na primeira visita à página de preferências quando o toggle estiver ativo.
- **FR-011**: O sistema MUST compartilhar os contratos de tipo das preferências entre frontend e backend via schemas centralizados com snapshot tests que atuam como gate contra breaking changes silenciosos.

### Key Entities

- **PreferênciaDeNotificação**: Representa a escolha de um usuário sobre se quer receber um tipo específico de notificação por um canal específico. Atributos: identificador único, usuário, tenant, tipo de notificação, canal, habilitado (booleano), data da última atualização. A combinação (usuário, tenant, tipo, canal) é única.
- **TipoDeNotificação**: Conjunto fechado de categorias de aviso que o sistema pode gerar: alertas pastorais, lembretes de reunião, novo conteúdo, relatórios prontos, anúncios do sistema.
- **Canal**: Conjunto fechado de meios de entrega: in-app e e-mail.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuário consegue visualizar e alterar suas preferências de notificação em menos de 2 minutos, do acesso à página até a persistência confirmada.
- **SC-002**: Após desativar um canal para um tipo de notificação, o usuário não recebe notificações por aquele canal para aquele tipo — verificável em 100% dos casos via testes de integração.
- **SC-003**: A consulta de preferências durante o roteamento de notificação é atendida por cache na grande maioria dos casos, sem impacto perceptível na latência do pipeline de notificação.
- **SC-004**: Usuários com toggle de silêncio global ativo concluem a migração para o novo sistema em uma única sessão — sem necessidade de suporte técnico.
- **SC-005**: A restrição de `pastoral_alert.inApp` para Líderes é inviolável via API — 100% das tentativas de bypass são rejeitadas com erro de negócio.
- **SC-006**: A indisponibilidade do cache não causa nenhuma perda silenciosa de notificação — 0 notificações descartadas por falha de cache (fallback a DB garante).

> **Decisões de infraestrutura**:
> - Cache: preferências cacheadas por usuário com TTL de ~10 minutos; invalidação imediata no PATCH; fallback obrigatório a banco de dados em caso de indisponibilidade.
> - Enforcement de papel: lazy (por request, sem evento Keycloak); baseado no papel corrente extraído do token de autenticação.
> - Migração localStorage→DB: one-time, disparada por presença de chave específica no localStorage na primeira visita à página de preferências.
> - Idempotência do PATCH: operações de atualização de preferências são idempotentes — múltiplas requisições com o mesmo payload produzem o mesmo estado final.

---

## Clarifications

*Nenhuma clarificação pendente. Todos os comportamentos foram derivados da story (FR78) e dos achados do recon contra o código real.*

### Decisões de Alinhamento (desvios story → spec)

1. **`system_announcement` → `system`**: o enum real `NotificationType` (packages/types) tem o tipo `system`, não `system_announcement`. A spec usa `system` conforme o código existente — a UI exibirá "Anúncios do sistema" como rótulo PT-BR para o tipo `system`.
2. **`delivered: false` → `metadata.reason`**: a tabela `notifications` não possui coluna `delivered` nem `reason`. O registro de não-entrega por preferência reutiliza a coluna `metadata` (JSONB) com `{ reason: 'user_preference' }` — sem alteração no schema da tabela existente.
3. **Enforcement lazy sem listener Keycloak**: a story mencionava "role change is synced to the application". Conforme achados do recon (Keycloak = pull-from-token, sem evento de troca de papel), o enforcement é recalculado no momento de cada request (GET/PATCH/roteamento) com base no papel presente no token — sem listener, sem webhook.
