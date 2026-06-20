# Research: Infraestrutura de Notificações & Channel Router

**Feature**: `infra-notificacoes` | **Phase**: 0 (Research) | **Date**: 2026-06-20

Todos os NEEDS CLARIFICATION foram resolvidos na seção `## Clarifications` da
spec (Session 2026-06-20, 5 decisões). Este documento consolida as decisões
técnicas com rationale e alternativas, ancoradas nos padrões REAIS já em uso no
projeto (`apps/api/src`).

## Decision 1 — Reuso da infraestrutura BullMQ/Redis existente

**Decision**: Usar `BullMqService` (`apps/api/src/bullmq/bullmq.service.ts`) e
`RedisService` (`apps/api/src/redis/redis.service.ts`) já existentes. Nova fila
`notifications` criada via `bullMq.createQueue('notifications')` (prefixo
`queue` aplicado automaticamente pelo serviço → chave Redis efetiva
`queue:notifications`). Worker via `bullMq.createWorker('notifications', proc)`.

**Rationale**: `BullMqService` já encapsula connection options
(`REDIS_HOST`/`REDIS_PORT`), `maxRetriesPerRequest: null`, lifecycle
(`onModuleDestroy` fecha queues/workers). Módulo é `@Global`, exportado. Padrão
idêntico ao `AuditExportProcessor` e `meeting-event.worker.ts`.

**Alternatives considered**:
- `@nestjs/bullmq` decorators (`@Processor`): rejeitado — o projeto não usa
  decorators de fila; usa o wrapper imperativo `BullMqService`. Manter
  consistência evita dois estilos de worker.
- Scheduler externo (cron) para digest: rejeitado — BullMQ delayed jobs cobrem
  o caso sem dependência adicional (Decisão de Infra da spec).

## Decision 2 — Rebuild de RequestContext fora do ciclo HTTP

**Decision**: O processor envolve o handling de cada job em
`requestContext.run({ tenantId, userId, requestId, correlationId }, cb)`,
lendo `tenantId`/`userId`/`correlationId` do payload do job (camelCase, nível 1).
Acesso a banco sempre via `withTenantTx(prisma, (tx) => ...)`
(`apps/api/src/prisma/with-tenant-tx.ts`).

**Rationale**: Padrão exato do `meeting-event.worker.ts` (linha 53):
`await requestContext.run({ tenantId, userId: userId ?? 'system', requestId:
generateId(), correlationId: eventId }, async () => { ... })`. Garante RLS
(`app.current_tenant_id`) mesmo fora de request HTTP. Cumpre FR-001 (tenant_id
nunca como parâmetro) e Princípio I da constitution.

**Alternatives considered**:
- Passar `tenantId` como parâmetro às funções de repositório: PROIBIDO pela
  constitution (Princípio I) e CLAUDE.md.
- `requestContext.enterWith`: rejeitado — `run` é o idioma usado pelos workers
  existentes (escopo limpo por callback, sem vazamento entre jobs).

## Decision 3 — Geração de ID com uuidv7()

**Decision**: O service passa `id: uuidv7()` explicitamente no `create` do
Prisma. A coluna no schema mantém `@default(dbgenerated("gen_random_uuid()"))`
apenas como fallback DB-side (consistência com os modelos existentes), mas o
caminho de aplicação SEMPRE fornece UUID v7.

**Rationale**: Padrão observado em `reflections.service.ts`,
`meetings.service.ts`, `presence.service.ts` (`id: uuidv7()`). Constitution
Princípio II: UUID v7 via `uuidv7()`, proibido `@default(uuid())` do Prisma. O
`dbgenerated("gen_random_uuid()")` NÃO é `uuid()` do Prisma — é um default SQL
de fallback alinhado ao restante do schema; o app override com `uuidv7()`
satisfaz o MUST.

**Alternatives considered**:
- `@default(uuid())` Prisma: PROIBIDO (Princípio II).
- Sem default DB: rejeitado — quebraria consistência com schema existente e
  inserts diretos em migrations/seed.

## Decision 4 — RLS tenant-scoped sem linhas globais

**Decision**: Policy `tenant_isolation` na tabela `notifications` com
`USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true),
'')::uuid)` e `WITH CHECK` idêntico — SEM o ramo `tenant_id IS NULL OR`, pois
notificações são SEMPRE tenant-scoped (não há linhas globais).

**Rationale**: O padrão canônico do projeto (`evasion_job_log`) usa
`tenant_id IS NULL OR tenant_id = NULLIF(...)` porque aquele log tem linhas
globais (`tenant_id NULL`). Notificações nunca são globais → o ramo `IS NULL`
seria uma brecha (permitiria linha sem tenant visível por todos). Lições do
Epic 13 (MEMORY): "WITH CHECK separado p/ linhas globais" — aqui NÃO há globais,
logo USING e WITH CHECK são idênticos e restritivos.

**Alternatives considered**:
- Reusar a policy com ramo `IS NULL`: rejeitado — abre vazamento cross-tenant
  para qualquer linha com `tenant_id` nulo (BOLA — ver owasp gate).
- RLS apenas em leitura (USING sem WITH CHECK): rejeitado — permitiria INSERT
  cross-tenant. WITH CHECK obrigatório.

## Decision 5 — metadata como Json (JSONB)

**Decision**: Coluna `metadata Json` no Prisma (mapeia para `jsonb` no
PostgreSQL no Prisma v5+/v7). Default `{}`. Inclui `actionUrl` e dados por tipo.

**Rationale**: Clarify Q5 (score 3). Padrão idêntico ao `meeting_events.payload`
(`payload Json @default("{}")`) e ao `templates-conteudo.structure` (JSONB) no
mesmo projeto. Permite índices GIN futuros; alinha com FR-002 ("estrutura
flexível") e type-safety (validado por Zod na borda de entrada).

**Alternatives considered**:
- Colunas tipadas para actionUrl etc.: rejeitado — engessa extensão por tipo de
  notificação (FR-002 exige flexibilidade).
- `String` com JSON serializado: rejeitado — perde queryability e índices GIN.

## Decision 6 — Falha de canal via result tipado (não exceção)

**Decision**: `NotificationChannel.send(payload)` retorna
`{ success: boolean; error?: string }` em vez de lançar exceção em falha de
entrega. O processor inspeciona `result.success`: se `false`, lança erro
controlado para acionar o retry do BullMQ (que decrementa attempts e reagenda
com backoff).

**Rationale**: Clarify Q1 (score 2). Permite ao retry handler distinguir
sucesso/falha de entrega sem `try/catch` em torno de toda a lógica de canal, e
separar falhas de entrega (retentáveis) de erros de infra (ex: tenant deletado
→ contexto falha). O processor converte `result.success === false` em throw
para o BullMQ contabilizar a tentativa.

**Alternatives considered**:
- Propagar exceção do canal: rejeitado — mistura erros de infra com falhas de
  entrega; dificulta logging estruturado de `error_message`.

## Decision 7 — Idempotência do digest via job key determinística

**Decision**: Job key do digest =
`digest:{userId}:{type}:{Math.floor(Date.now() / NOTIFICATION_DIGEST_WINDOW_MS)}`.
Enfileirado como delayed job com `delay = NOTIFICATION_DIGEST_WINDOW_MS` e
`jobId` = a chave acima. BullMQ deduplica por `jobId` → multi-pod produz 1
digest por janela.

**Rationale**: Clarify Q3 (score 2). Epoch dividido pela janela gera o mesmo
bucket para eventos dentro da janela. UUID v7 é globalmente único → `userId` já
isola cross-tenant (sem necessidade de tenantId na chave). `pastoral_alert`
NUNCA usa esse caminho — entregue imediatamente (FR-007).

**Alternatives considered**:
- Lock distribuído (Redlock) para o digest: rejeitado — `jobId` determinístico
  do BullMQ já garante unicidade sem lock manual.
- tenantId na chave: desnecessário (userId UUID v7 já isola); manteria a chave
  mais longa sem ganho.

## Decision 8 — Canal Redis para SSE (preparatório)

**Decision**: `InAppChannel` publica em `rt:notifications:{tenantId}:{userId}`
após persistir, payload `{ notificationId, type, title, body, createdAt }`.
Publicação preparatória — não requer consumidor ativo no MVP (Story 14.2a fará
o SSE consumer).

**Rationale**: Clarify Q2 (score 3). Namespace `rt:*` alinhado ao CLAUDE.md
(real-time). `tenantId` no canal garante isolamento de subscriber — exatamente
o padrão de `meeting-sse.service.ts` (`rt:meeting:{tenantId}:{meetingId}:events`).
Cliente busca detalhes completos via API após o evento (payload mínimo no canal).

**Alternatives considered**:
- Payload completo no canal: rejeitado — vaza body/metadata no pub/sub; cliente
  já busca via API autenticada (BOLA-safe).
