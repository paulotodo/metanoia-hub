# Feature Specification: Log de Auditoria Imutável

**Short Name**: `auditoria-log`
**Epic**: Epic 9 — LGPD & Compliance
**Story**: 9-3
**Status**: Draft
**Actors**: Todos os usuários autenticados (originam eventos), Super Admin (consome o viewer)

> Decisões de infraestrutura:
> - `FR-INFRA-01`: Retenção PERMANENTE — audit events NUNCA são auto-deletados (requisito legal LGPD).
> - `FR-INFRA-02`: Append-only via RLS — policies apenas INSERT + SELECT; sem UPDATE/DELETE na camada de aplicação.
> - `FR-INFRA-03`: Export assíncrono via job queue com polling (padrão Story 8-7); sem scheduling periódico automático — export é sob demanda.
> - N/A para key rotation, mutex multi-pod, idempotência de request (audit events são fire-and-forget via interceptor; duplicatas são aceitáveis, não destrutivas).

---

## User Scenarios & Testing

### User Story 1 — Captura automática de ações mutativas (Priority: P1)

Como **qualquer usuário autenticado** que realiza uma ação mutativa na plataforma (criar, atualizar, deletar recursos),
Quero que cada ação seja registrada automaticamente no log de auditoria,
Para que exista rastreabilidade completa de quem fez o quê, quando e de onde.

**Why this priority**: Fundação de toda a funcionalidade. Sem captura automática e transparente, o log é inútil. Deve funcionar antes de qualquer viewer.

**Independent Test**: Executar um POST de criação de grupo → verificar que um audit event com `action=create`, `resource=group`, `userId` e `tenantId` corretos foi persistido, sem que o fluxo do request tenha sido alterado.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com tenantId no contexto, **When** ele faz uma requisição POST/PUT/PATCH/DELETE em qualquer endpoint da API, **Then** um audit event é criado automaticamente com: `id` (UUID v7), `tenantId`, `userId`, `action` (enum: create/update/delete/login/export/config_change), `resource` (tipo da entidade), `resourceId`, `ipAddress`, `userAgent`, `previousState` (JSON para updates), `newState` (JSON após a mudança), `timestamp` (ISO 8601), `severity` (enum: info/warning/critical).

2. **Given** um usuário autenticado, **When** ele faz uma requisição GET, HEAD ou OPTIONS, **Then** NENHUM audit event é criado (reads não são auditados).

3. **Given** que a captura de auditoria falha internamente (ex: banco indisponível), **When** o interceptor tenta persistir o evento, **Then** o request original NÃO é bloqueado — falhas no audit log são não-bloqueantes e logadas.

4. **Given** uma ação mutativa bem-sucedida, **When** o audit event é criado, **Then** o campo `severity` reflete a criticidade da ação: `critical` para deleções e config_change; `warning` para updates de papéis e permissões; `info` para creates e exports padrão.

---

### User Story 2 — Persistência imutável via RLS append-only (Priority: P1)

Como **plataforma de compliance LGPD**,
Quero que os registros de auditoria sejam fisicamente imutáveis na camada de banco de dados,
Para garantir que nenhum agente (nem a própria aplicação) possa alterar ou apagar evidências de auditoria.

**Why this priority**: Imutabilidade é o diferencial legal do audit log. Sem isso, a evidência não tem valor probatório.

**Independent Test**: Conectar diretamente ao banco como `metanoia_app` e tentar executar `UPDATE audit_events SET action = 'fake'` e `DELETE FROM audit_events` → ambos devem falhar com erro de policy RLS. Adicionalmente, verificar que o serviço de aplicação não expõe métodos de update ou delete para audit events.

**Acceptance Scenarios**:

1. **Given** a tabela `audit_events` com RLS habilitado, **When** qualquer operação UPDATE é tentada (diretamente ou via ORM) pelo role da aplicação, **Then** a operação é bloqueada pela política RLS — nenhuma linha é modificada.

2. **Given** a tabela `audit_events` com RLS habilitado, **When** qualquer operação DELETE é tentada pelo role da aplicação, **Then** a operação é bloqueada pela política RLS — nenhuma linha é removida.

3. **Given** um tenant específico, **When** um usuário desse tenant faz SELECT em audit_events via aplicação, **Then** apenas os eventos do próprio tenant são retornados (isolamento RLS por tenantId).

4. **Given** que o sistema nunca auto-deleta audit events, **When** eventos envelhecem além de qualquer período, **Then** eles permanecem permanentemente acessíveis (retenção indefinida — requisito legal LGPD).

---

### User Story 3 — Viewer de auditoria para Super Admin (Priority: P2)

Como **Super Admin**,
Quero uma interface de visualização do log de auditoria completo (cross-tenant),
Para investigar incidentes de segurança, auditar conformidade e responder a requisições LGPD.

**Why this priority**: O viewer é o produto visível do audit log — sem ele, o log existe mas não é consumível por humanos. Vem após P1 porque depende da camada de persistência.

**Independent Test**: Navegar para `/app/admin/super/audit`, verificar que a tabela carrega com paginação de 50 itens/página, expandir uma linha e ver os campos `previousState`/`newState` formatados como JSON, aplicar filtro por `severity=critical` e confirmar que apenas eventos críticos são exibidos.

**Acceptance Scenarios**:

1. **Given** que estou autenticado como Super Admin, **When** acesso o viewer de auditoria, **Then** vejo uma tabela paginada (50 itens/página, server-side) com colunas: timestamp, usuário, ação, recurso, tenant e badge de severidade (visual: info/aviso/crítico).

2. **Given** a tabela de auditoria, **When** clico para expandir uma linha, **Then** vejo os detalhes completos: `previousState` e `newState` formatados como JSON legível, endereço IP, user agent e metadados da sessão.

3. **Given** o viewer com filtros, **When** aplico filtros por tipo de ação, usuário (userId), intervalo de datas, severidade ou texto livre (busca em resource/description), **Then** os resultados são filtrados server-side e os filtros persistem enquanto navego entre páginas (sticky filters).

4. **Given** que novos eventos chegam continuamente, **When** o viewer está aberto, **Then** a lista é automaticamente atualizada a cada 30 segundos sem perder a posição de paginação/filtro atual.

5. **Given** o viewer renderizado, **When** avalio a experiência, **Then** a interface é otimizada para desktop (audit é operação administrativa — não há requisito de responsividade mobile nesta tela).

---

### User Story 4 — Export assíncrono do log de auditoria (Priority: P3)

Como **Super Admin**,
Quero exportar o log de auditoria filtrado em CSV ou JSON,
Para análise offline, relatórios de compliance e envio a auditores externos.

**Why this priority**: Funcionalidade complementar ao viewer. Valor alto para compliance, mas não bloqueia o audit operacional.

**Independent Test**: Clicar em "Exportar" com filtro de data aplicado → receber resposta 202 com jobId → fazer polling até status `completed` → acessar URL de download → confirmar que o arquivo contém todos os campos (não apenas os visíveis na tabela).

**Acceptance Scenarios**:

1. **Given** que apliquei filtros no viewer, **When** clico em "Exportar" e escolho CSV ou JSON, **Then** o sistema inicia um job assíncrono e retorna imediatamente com um `jobId` (HTTP 202), sem bloquear a interface.

2. **Given** um jobId de export, **When** faço polling no endpoint de status, **Then** recebo o status atual (`processing` / `completed` / `failed`) e, quando `completed`, uma URL de download temporária (signed URL com validade de 24h).

3. **Given** o arquivo exportado, **When** abro o CSV ou JSON, **Then** todos os campos do audit event estão incluídos (id, tenantId, userId, action, resource, resourceId, previousState, newState, ipAddress, userAgent, timestamp, severity) — não apenas os campos visíveis na tabela.

---

### Edge Cases

- **Interceptor sem contexto de usuário**: Requests que passam por endpoints públicos (ex: marketing) ou falham na autenticação antes de chegar ao interceptor — NÃO devem gerar audit event (sem userId = sem auditoria válida).
- **previousState em creates**: Para operações CREATE, `previousState` é `null` (não há estado anterior). Para DELETE, `newState` é `null`.
- **Bulk operations**: Uma requisição que afeta N recursos deve gerar N audit events (um por recurso afetado), não um evento agregado.
- **Super Admin cross-tenant**: O SELECT cross-tenant do viewer deve funcionar sem depender de bypass implícito de RLS — usar mecanismo explícito validado (consultar padrão do módulo super-admin existente).
- **Conflito com 9-2 (anonimização)**: A Story 9-2 precisará anonimizar `userId` em audit events quando um usuário solicitar exclusão de dados. Este conflito com a imutabilidade deve ser resolvido explicitamente na Story 9-2 (fora do escopo desta spec) — possíveis caminhos: função `SECURITY DEFINER` restrita à coluna `user_id`, ou flag lógica `is_anonymized`.
- **Tamanho de payload**: `previousState` e `newState` podem ser grandes (ex: configurações de tenant com muitos campos). Truncar a 64KB por campo se necessário, logando o truncamento.

---

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE capturar automaticamente todo request HTTP mutativo (POST, PUT, PATCH, DELETE) realizado por usuário autenticado, sem exigir anotações explícitas nos controllers.

- **FR-002**: O sistema DEVE persistir cada audit event com os campos: `id` (UUID v7), `tenantId`, `userId`, `action` (enum: create/update/delete/login/export/config_change), `resource` (string, tipo da entidade), `resourceId` (string, nullable), `ipAddress`, `userAgent`, `previousState` (JSONB, nullable), `newState` (JSONB, nullable), `timestamp` (ISO 8601 com timezone), `severity` (enum: info/warning/critical).

- **FR-003**: O sistema DEVE garantir que audit events são imutáveis após criação — a camada de persistência NÃO deve expor operações de update ou delete em audit events, e o banco de dados deve rejeitar tentativas diretas via política de controle de acesso.

- **FR-004**: O sistema DEVE isolar audit events por tenant — cada tenant acessa apenas seus próprios eventos via política de controle de acesso baseada em row-level.

- **FR-005**: O Super Admin DEVE conseguir visualizar audit events de TODOS os tenants via interface dedicada, com paginação server-side de 50 itens/página.

- **FR-006**: O sistema DEVE suportar filtragem de audit events pelos campos: tipo de ação, userId, intervalo de datas (from/to), severidade e texto livre (busca em resource e descrição) — todos os filtros aplicados server-side.

- **FR-007**: O sistema DEVE suportar export assíncrono do log filtrado em formato CSV e JSON, seguindo o padrão: resposta imediata com jobId, polling de status e URL de download temporária quando completo.

- **FR-008**: O viewer de auditoria DEVE exibir linhas expansíveis com `previousState` e `newState` formatados como JSON legível, além de IP e user agent.

- **FR-009**: O viewer de auditoria DEVE se auto-atualizar a cada 30 segundos para refletir eventos recentes.

- **FR-010**: Falhas na persistência do audit event NÃO devem bloquear o request original — o interceptor deve ser tolerante a falhas de auditoria.

- **FR-011**: Requests GET, HEAD e OPTIONS NUNCA devem gerar audit events.

- **FR-012**: O índice de busca na tabela de audit events DEVE cobrir ao mínimo a combinação `(tenantId, timestamp DESC)` para garantir performance na paginação.

- **FR-INFRA-01**: Audit events são retidos permanentemente — nenhum mecanismo de expiração ou auto-delete deve ser implementado.

- **FR-INFRA-02**: A tabela de audit events deve ter apenas políticas de controle de acesso para INSERT e SELECT — nenhuma política para UPDATE ou DELETE deve existir.

- **FR-INFRA-03**: O export é sob demanda, via job queue assíncrono com até 3 tentativas em caso de falha.

---

### Key Entities

**AuditEvent**
- `id`: UUID v7 — identificador imutável do evento
- `tenantId`: UUID — tenant ao qual o evento pertence (scoping RLS)
- `userId`: string — identificador do usuário que executou a ação
- `action`: enum(create | update | delete | login | export | config_change)
- `resource`: string — tipo da entidade afetada (ex: "group", "user", "trail")
- `resourceId`: string | null — ID do recurso afetado (null em bulk sem ID único)
- `ipAddress`: string — IP do cliente no momento da ação
- `userAgent`: string — user agent do cliente
- `previousState`: JSON | null — snapshot do estado antes da mudança (null para creates)
- `newState`: JSON | null — snapshot do estado após a mudança (null para deletes)
- `timestamp`: ISO 8601 com timezone — momento exato da ação
- `severity`: enum(info | warning | critical)

**AuditExportJob** (derivado do padrão de reports)
- `jobId`: UUID v7
- `status`: enum(processing | completed | failed)
- `format`: enum(csv | json)
- `filters`: objeto com os filtros aplicados no momento do export
- `signedUrl`: string | null — URL de download quando completed
- `expiresAt`: ISO 8601 | null
- `failureReason`: string | null

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% das requisições mutativas de usuários autenticados geram um audit event — verificável por teste de integração que compara contagem de requests POST/PUT/PATCH/DELETE com contagem de audit events criados.

- **SC-002**: 0 audit events são modificados ou deletados após criação — verificável por teste direto de tentativa de UPDATE e DELETE na camada de banco de dados.

- **SC-003**: O viewer de auditoria com 10.000 eventos carrega a primeira página em menos de 2 segundos com paginação server-side e índice ativo.

- **SC-004**: Falhas no interceptor de auditoria não impactam a taxa de sucesso dos requests de negócio — o P99 de latência dos endpoints auditados aumenta em no máximo 50ms em relação à baseline sem auditoria.

- **SC-005**: Super Admin consegue encontrar qualquer evento de auditoria usando combinação de filtros em no máximo 3 interações com a interface.

- **SC-006**: Export de até 100.000 eventos completa em menos de 5 minutos e gera arquivo baixável por URL temporária com validade mínima de 24h.

- **SC-007**: Audit events de tenants diferentes não são visíveis entre si — verificável por teste de isolamento RLS com dois tenants distintos tentando acessar eventos um do outro.

---

## Clarifications

> Nenhuma ambiguidade bloqueante — todos os pontos foram resolvidos pela RECONCILIAÇÃO-EPIC9 antes desta spec.

### Decisões incorporadas (da RECONCILIAÇÃO-EPIC9)

- **Ordem na pipeline NestJS**: Interceptor roda APÓS guards de autenticação — tenantId e userId já estão no contexto quando o evento é capturado. Confirmar empiricamente na implementação.
- **Cross-tenant Super Admin**: Usar mecanismo explícito (validar padrão do módulo super-admin existente), não assumir bypass implícito de RLS.
- **Conflito 9-2/9-3 (anonimização vs imutabilidade)**: Fora do escopo desta spec; será resolvido explicitamente na Story 9-2. Esta spec define a imutabilidade como absoluta no contexto da aplicação.
- **Severidade padrão**: `info` para creates/reads; `warning` para updates de papéis; `critical` para deletes e config_change. Lógica de mapeamento na implementação.
- **Truncamento de payload**: `previousState`/`newState` truncados a 64KB por campo com log de aviso — default razoável da indústria, sem necessidade de configurabilidade no MVP.
