# Feature Specification: Infraestrutura de Notificações & Channel Router

**Feature**: `infra-notificacoes`
**Created**: 2026-06-20
**Status**: Draft
**Epic**: 14 — Notificações
**Story**: 14.1 — Infraestrutura de Notificações & Channel Router (FR77)

## User Scenarios & Testing

### User Story 1 — Qualquer módulo dispara uma notificação (Priority: P1)

Como desenvolvedor de qualquer módulo do sistema,
quero chamar um serviço de notificações centralizado passando apenas `userId`, `type`, `title`, `body` e a lista de canais,
para que eu não precise conhecer como a entrega acontece nem me acoplar a canal específico.

**Why this priority**: É o contrato fundamental de toda a infraestrutura — sem ele, nenhum outro módulo consegue emitir notificações.

**Independent Test**: Dado que o módulo de reuniões chama `dispatch()` com `{ userId, type: 'meeting_reminder', channels: ['in_app'] }`, verificar que uma notificação é persistida com `status: pending` e um job é enfileirado — sem que o módulo de reuniões acesse diretamente a fila ou o banco de notificações.

**Acceptance Scenarios**:

1. **Given** o tenant está ativo e o usuário existe, **When** `dispatch({ userId, type: 'content_new', title, body, channels: ['in_app', 'email'] })` é chamado, **Then** um job por canal é criado na fila de notificações e o isolamento de tenant é mantido (notificação vinculada ao tenant do contexto corrente).
2. **Given** o dispatch é chamado fora de um request HTTP (por exemplo, dentro de um job agendado), **When** o processador executa, **Then** o tenant correto é resolvido a partir do payload do job (nunca de parâmetro externo).
3. **Given** dois tenants distintos têm usuários com o mesmo `userId` em seus escopos, **When** cada módulo chama `dispatch()`, **Then** as notificações de cada tenant são completamente isoladas e invisíveis ao outro tenant.

---

### User Story 2 — Notificação entregue in-app (Priority: P1)

Como participante ou líder autenticado,
quero receber notificações dentro da aplicação (notification center),
para que eu seja informado de eventos relevantes sem precisar sair da plataforma.

**Why this priority**: Canal in-app é o canal primário de MVP; é bloqueador para qualquer feature downstream que dependa de notificações visíveis.

**Independent Test**: Dado um job processado pelo canal in-app, verificar que a notificação está persistida no banco com `status: sent`, vinculada ao tenant e ao usuário correto, disponível via consulta ordenada por `(user_id, status, created_at DESC)`.

**Acceptance Scenarios**:

1. **Given** um job in-app é enfileirado, **When** o processador executa com sucesso, **Then** a notificação é salva no banco com `status: sent` e publicada no canal Redis preparado para SSE (Story 14.2a).
2. **Given** uma notificação in-app é entregue, **When** o usuário a lê, **Then** o `status` é atualizado para `read` e o campo `read_at` registra o timestamp da leitura.

---

### User Story 3 — Canal de e-mail preparado (stub) (Priority: P2)

Como desenvolvedor,
quero que o canal de e-mail esteja implementado como stub funcional seguindo a mesma interface do canal in-app,
para que futuras stories (14.3) possam integrar o provedor real sem alterar o roteador.

**Why this priority**: A interface comum é parte do contrato de extensibilidade; o stub valida o design do Channel Router antes da integração real de e-mail.

**Independent Test**: Dado um job com `channel: 'email'`, verificar que o Channel Router encaminha para o `EmailChannel`, que executa sem erro e registra no log que a entrega foi delegada (stub OK).

**Acceptance Scenarios**:

1. **Given** `dispatch({ ..., channels: ['email'] })` é chamado, **When** o job é processado, **Then** o Channel Router roteia para `EmailChannel` sem alterar `InAppChannel`.
2. **Given** um novo canal é adicionado no futuro (WhatsApp), **When** o desenvolvedor registra o novo `NotificationChannel` no router, **Then** nenhuma alteração é necessária no `dispatch()` ou no contrato da interface.

---

### User Story 4 — Batching de notificações do mesmo tipo (Priority: P2)

Como participante,
quero receber um resumo agrupado quando vários eventos do mesmo tipo acontecem em sequência,
para que minha caixa de notificações não seja inundada por eventos repetidos num curto espaço de tempo.

**Why this priority**: Evita spam de notificações; é requisito explícito do AC da Story 14.1.

**Independent Test**: Dado 10 notificações do tipo `content_new` para o mesmo usuário disparadas dentro de uma janela de 5 minutos, verificar que somente 1 notificação digest é entregue com texto agregado; verificar que `NOTIFICATION_DIGEST_WINDOW_MS` é lida do ambiente e que alterar o valor muda o comportamento.

**Acceptance Scenarios**:

1. **Given** múltiplas notificações do mesmo `type` para o mesmo usuário chegam dentro da janela configurada, **When** o job delayed dispara, **Then** as notificações são agrupadas em 1 digest com contagem e contexto ("3 participantes precisam de cuidado").
2. **Given** `NOTIFICATION_DIGEST_WINDOW_MS` está definida em 60000 (1 min), **When** duas notificações chegam com 30s de intervalo, **Then** são agrupadas em digest; se chegam com 90s de intervalo, **Then** cada uma é entregue individualmente.
3. **Given** uma notificação do tipo `pastoral_alert` é disparada, **When** o batching está ativo para outros tipos, **Then** `pastoral_alert` NUNCA é agrupado — é entregue imediatamente ao canal destinatário.

---

### User Story 5 — Resiliência com retry e retorno de falha (Priority: P1)

Como operador do sistema,
quero que falhas de entrega sejam automaticamente retentadas com backoff e retidas para análise,
para que problemas transitórios não resultem em perda silenciosa de notificações críticas.

**Why this priority**: Notificações de cuidado pastoral têm importância crítica; falhas silenciosas são inaceitáveis.

**Independent Test**: Dado um processador configurado para falhar nas 3 primeiras tentativas, verificar que a notificação é retentada com delays crescentes (30s/60s/120s) e, após esgotar, o status muda para `failed`, o job é retido no failed set, e o log contém `correlation_id`, `channel` e `error_message`.

**Acceptance Scenarios**:

1. **Given** um canal falha ao entregar, **When** o sistema retenta, **Then** a sequência de delays é crescente (backoff exponencial) com no máximo 3 tentativas.
2. **Given** todas as tentativas são esgotadas, **When** o job falha definitivamente, **Then** o status da notificação no banco é atualizado para `failed`, o job é mantido no failed set (não descartado) e o evento é logado com `correlation_id`, `channel` e `error_message`.
3. **Given** um job está no failed set, **When** o operador inspeciona, **Then** os dados do job estão intactos para replay manual ou análise futura.

---

### Edge Cases

- O que acontece se `dispatch()` é chamado sem contexto de tenant (fora de um request e sem payload de tenant no job)? → sistema deve rejeitar com erro claro antes de persistir.
- O que acontece se o mesmo usuário recebe `pastoral_alert` e `content_new` simultâneos? → `pastoral_alert` entregue imediatamente; `content_new` entra no batching independentemente.
- O que acontece se o Redis (fila BullMQ) estiver indisponível no momento do dispatch? → dispatch falha com erro de infra; notificação não é parcialmente persistida; o chamador recebe erro de serviço.
- O que acontece se dois jobs delayed do mesmo tipo/usuário chegam ao mesmo tempo (race condition no digest)? → o digest deve ser idempotente — uma única notificação agregada entregue.
- O que acontece com notificações cujo tenant é deletado antes da entrega? → job é processado normalmente; se a query de contexto falhar por tenant ausente, o job vai para failed com erro explícito.

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE manter isolamento de tenant em 100% das notificações — `tenant_id` é sempre derivado do contexto de execução (AsyncLocalStorage/RequestContext), nunca aceito como parâmetro externo de chamada.
- **FR-002**: O sistema DEVE persistir cada notificação no banco com `id` único, `tenant_id`, `user_id`, `type`, `title`, `body`, `channel`, `status`, `read_at`, `metadata` e `created_at`. O campo `metadata` é estrutura flexível que inclui `actionUrl` e dados adicionais por tipo.
- **FR-003**: O sistema DEVE garantir que a coluna `tenant_id` em notificações esteja protegida por política RLS (Row Level Security), bloqueando leituras e escritas cross-tenant.
- **FR-004**: O sistema DEVE rotear cada notificação para o canal correto (`in_app` ou `email`) por meio de um Channel Router que desconhece os detalhes de cada canal — o roteamento é feito via interface comum `NotificationChannel`.
- **FR-005**: O sistema DEVE suportar adição de novos canais (ex: WhatsApp) sem modificar o roteador ou o serviço de dispatch — extensibilidade por registro de implementação.
- **FR-006**: O sistema DEVE agrupar (digest) notificações do mesmo `type` para o mesmo usuário dentro de uma janela de tempo configurável, resultando em no máximo 1 notificação entregue por janela.
- **FR-007**: O sistema DEVE garantir que notificações do tipo `pastoral_alert` NUNCA sejam agrupadas — sempre entregues imediatamente, por sua criticidade pastoral.
- **FR-008**: O sistema DEVE configurar a janela de digest via variável de ambiente `NOTIFICATION_DIGEST_WINDOW_MS` (padrão: 300000 ms / 5 min), sem necessitar de redeploy para ajuste.
- **FR-009**: O sistema DEVE retentar automaticamente entregas falhas com backoff exponencial (tentativas 1/2/3 com delays de 30s/60s/120s respectivamente).
- **FR-010**: O sistema DEVE manter jobs falhos no failed set após esgotar as tentativas, garantindo que dados para análise e replay não sejam perdidos.
- **FR-011**: O sistema DEVE atualizar o status da notificação para `failed` no banco após esgotar todas as tentativas de entrega, e logar `correlation_id`, `channel` e `error_message`.
- **FR-012**: O sistema DEVE oferecer consulta de notificações de um usuário ordenadas por `(user_id, status, created_at DESC)`, garantindo performance para o notification center.
- **FR-013**: Contratos de entrada e saída do serviço de dispatch DEVEM ser validados por schemas compartilhados entre frontend e backend, com snapshots como gate contra breaking changes silenciosos.
- **FR-014**: O canal in-app DEVE publicar a entrega em canal Redis para que o SSE (Story 14.2a) possa distribuir em tempo real — a publicação é preparatória, não requer consumidor ativo no MVP.

### Decisões de Infraestrutura Auditáveis

| Tipo de decisão | Decisão | Justificativa |
|-----------------|---------|---------------|
| Política de scheduling | Job delayed via BullMQ com delay configurável em ms | Aproveita infraestrutura BullMQ existente; sem scheduler externo |
| Mutex multi-pod | BullMQ garante at-least-once; idempotência do digest via job key único por `(user_id, type, window)` | Evita duplicate digest em ambiente multi-réplica |
| Retry policy | 3 tentativas, backoff exponencial 30s/60s/120s; failed set retido (NFR-I4) | Requisito explícito do AC; alinhado com SLA pastoral |
| Context rebuild fora de request | `RequestContext.run({ tenantId, userId }, cb)` com tenant_id do payload do job | Garante multi-tenancy mesmo em jobs assíncronos |

### Key Entities

- **Notificação**: Registro de um evento de comunicação, com id único (UUID v7), contexto de tenant e usuário, tipo do evento, conteúdo (title/body), canal de entrega, ciclo de vida de status (pending → sent/failed → read), metadados flexíveis e timestamp imutável de criação.
- **Canal de Notificação (NotificationChannel)**: Abstração de entrega — implementações concretas são `InAppChannel` (persiste + publica Redis) e `EmailChannel` (stub → Resend em Story 14.3). Interface: `send(payload) → result`.
- **Job de Notificação**: Unidade de trabalho na fila `queue:notifications` com payload do canal, tenant_id, correlation_id e configuração de retry. Jobs delayed são usados para digest.
- **Digest**: Agrupamento de múltiplas notificações do mesmo tipo/usuário numa janela de tempo — entregue como única notificação com contagem e contexto pastoral.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% das notificações persistidas no banco têm `tenant_id` correspondente ao tenant do contexto — nenhuma notificação cross-tenant possível (verificado por teste RLS com 2 tenants distintos).
- **SC-002**: Uma chamada `dispatch()` com 2 canais resulta em exatamente 2 jobs enfileirados em `queue:notifications` — roteamento verificado por teste de integração.
- **SC-003**: 10 notificações do mesmo tipo/usuário dentro da janela de 5 min resultam em no máximo 1 notificação digest entregue ao destinatário.
- **SC-004**: `pastoral_alert` é entregue em menos de 2 segundos após o dispatch, independentemente do volume de outras notificações sendo processadas.
- **SC-005**: Após 3 falhas de entrega, o status da notificação no banco é `failed` e o job está disponível no failed set com todos os dados intactos para análise.
- **SC-006**: Adição de um novo canal (ex: WhatsApp stub) não requer modificação do serviço de dispatch nem do Channel Router — apenas registro de nova implementação de `NotificationChannel`.
- **SC-007**: A janela de digest é alterada via `NOTIFICATION_DIGEST_WINDOW_MS` sem necessidade de redeploy — verificado por teste com valores distintos.
