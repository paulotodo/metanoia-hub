# Tarefas infra-notificacoes - Story 14.1 (FR77) — Infraestrutura de Notificações & Channel Router

Escopo: Infraestrutura centralizada de notificações para o projeto metanoia-hub. Migration Prisma (tabela `notifications`, 3 enums, índices, RLS tenant-scoped), contratos Zod em `packages/types`, bounded context `apps/api/src/notifications/` (service, controller, worker, channel router, InAppChannel, EmailChannel stub, DigestService), validação de env, spec RLS idempotente, unit e integration tests, e fechamento dos 6 gaps abertos no checklist (CHK007, CHK016, CHK024, CHK039, CHK041, CHK042).

**Legenda de status:**
- `[ ]` Pendente
- `[~]` Em andamento
- `[x]` Concluído
- `[!]` Bloqueado

**Legenda de criticidade:**
- `[C]` Crítico - Impacto financeiro direto ou bloqueante
- `[A]` Alto - Funcionalidade essencial
- `[M]` Médio - Necessário mas sem urgência imediata

---

## FASE 1 - Fundação: Contratos e Requisitos

### 1.1 Fechar gaps abertos do checklist `[A]`

Ref: checklists/requirements.md CHK007, CHK016, CHK039 (ambiguidades auto); CHK024, CHK041, CHK042 (humanos — decididos com defaults fiéis ao plano)

- [ ] 1.1.1 CHK007 — Definir comportamento para tenant deletado antes da entrega: job processado normalmente; falha de contexto (query retorna erro) → job vai para failed set com log explícito `tenant_not_found`; documentar no plano como decisão auditável (default: igual ao padrão de outros workers existentes)
- [ ] 1.1.2 CHK016 — Definir contrato de resposta do `dispatch()` ao chamador: retorna `Promise<void>`; erros de infra (Redis indisponível, tenant ausente) lançam exceção; sucesso não implica entrega (apenas enfileiramento). Anotar em `contracts/notification-channel.md`
- [ ] 1.1.3 CHK039 — Especificar formato exato do digest: `title = "Você tem {N} novas notificações ({type_label})"`, `body = "{N} eventos aguardam sua atenção"` (vocabulário pastoral; contagem explícita). Anotar no data-model.md
- [ ] 1.1.4 CHK024 — Decisão de risco: `body` sem max definido; decidir com default fiel: manter sem max no MVP (truncar no frontend ao exibir); documentar como risco aceito com RNF
- [ ] 1.1.5 CHK041 — Confirmar escopo MVP: infra + endpoints mínimos corretos; notification center completo = Story 14.2x. Default: confirmar o escopo como está
- [ ] 1.1.6 CHK042 — Confirmar profundidade de resiliência (3 retries, janela 5 min): alinhada ao SLA pastoral aceitável. Default: confirmar valores como estão

### 1.2 Contratos Zod em `packages/types` `[A]`

Ref: spec.md FR-013; contracts/notification-channel.md

- [ ] 1.2.1 Criar `packages/types/src/notification.ts` com os 3 enums (`NotificationTypeSchema`, `NotificationChannelSchema`, `NotificationStatusSchema`)
- [ ] 1.2.2 Adicionar `NotificationDispatchSchema` (userId, type, title max 200, body min 1, channels min 1, metadata opcional)
- [ ] 1.2.3 Adicionar `NotificationPayloadSchema` e `NotificationResultSchema` (payload de `send()`; result tipado sem exceção — Decision 6)
- [ ] 1.2.4 Adicionar `NotificationJobPayloadSchema` (notificationId, tenantId, userId, channel, correlationId — camelCase nível 1, Clarify Q4 score 3)
- [ ] 1.2.5 Adicionar `NotificationRealtimeEventSchema` (notificationId, type, title, body, createdAt ISO 8601 — Clarify Q2 score 3)
- [ ] 1.2.6 Exportar constantes `NOTIFICATIONS_QUEUE_NAME = 'notifications'` e `NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS = 300000`
- [ ] 1.2.7 Re-exportar todos os schemas e tipos em `packages/types/src/index.ts`
- [ ] 1.2.8 Criar `packages/types/src/__tests__/notification.snapshot.spec.ts` com snapshot de cada schema (padrão meeting.snapshot.spec.ts — inline snapshot via `toMatchInlineSnapshot`)
- [ ] 1.2.9 Executar `pnpm --filter @metanoia/types test` e confirmar snapshot verde e sem breaking changes

---

## FASE 2 - Banco de Dados: Migration, Schema Prisma e RLS

### 2.1 Prisma model e enums `[A]`

Ref: data-model.md §Entity Notification; spec.md FR-002

- [ ] 2.1.1 Adicionar enums `NotificationType`, `NotificationChannel`, `NotificationStatus` em `apps/api/prisma/schema.prisma` (com `@@map` para snake_case: `notification_type`, `notification_channel`, `notification_status`)
- [ ] 2.1.2 Adicionar model `Notification` com todos os campos (id via `@default(dbgenerated("gen_random_uuid()"))` como fallback — service passa `uuidv7()`; Decision 3)
- [ ] 2.1.3 Adicionar índice composto `notifications_user_status_created_idx` em `(userId, status, createdAt DESC)` e índice `notifications_tenant_idx` em `(tenantId)` (FR-012)
- [ ] 2.1.4 Confirmar que `metadata Json @default("{}")` usa JSONB no Postgres (Prisma v7 padrão — Decision 5)
- [ ] 2.1.5 Executar `pnpm --filter @metanoia/api prisma validate` e confirmar schema sem erros

### 2.2 Migration SQL `[C]`

Ref: plan.md §Project Structure; data-model.md §RLS; research.md Decision 4

- [ ] 2.2.1 Criar diretório `apps/api/prisma/migrations/20260629000000_14-1-notifications/`
- [ ] 2.2.2 Criar `migration.sql` com: CREATE TYPE para os 3 enums (`notification_type`, `notification_channel`, `notification_status`)
- [ ] 2.2.3 Adicionar CREATE TABLE `notifications` com todos os campos snake_case, constraints NOT NULL, DEFAULT `pending` para status, DEFAULT `'{}'::jsonb` para metadata
- [ ] 2.2.4 Adicionar CREATE INDEX `notifications_user_status_created_idx` ON `notifications(user_id, status, created_at DESC)` e `notifications_tenant_idx` ON `notifications(tenant_id)`
- [ ] 2.2.5 Adicionar RLS: `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation ON notifications USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)` — SEM ramo `IS NULL` (Decision 4)
- [ ] 2.2.6 Validar migration contra Postgres local: `docker-compose -f docker-compose.test.yml exec postgres psql -U postgres -p 5433 -c "\d notifications"` confirma tabela + enums + índices + policy RLS ativa

### 2.3 Spec RLS idempotente `[C]`

Ref: spec.md SC-001; research.md Decision 4; lições Epic 13 (MEMORY: rls idempotente roda 2x no CI)

- [ ] 2.3.1 Criar `apps/api/test/rls/notifications.rls-spec.ts` com setup de 2 tenants (TENANT_A_ID, TENANT_B_ID de `rls-test.helper`)
- [ ] 2.3.2 Implementar helper `insertNotification(prisma, tenantId, userId, type, channel)` com `SET LOCAL app.current_tenant_id` + INSERT direto via `$executeRawUnsafe`
- [ ] 2.3.3 Teste: Tenant A lê apenas suas notificações (SELECT com SET LOCAL tenantA retorna 0 rows de tenantB — RLS USING)
- [ ] 2.3.4 Teste: INSERT com tenant errado é bloqueado (WITH CHECK retorna erro quando `app.current_tenant_id` ≠ `tenant_id` do registro)
- [ ] 2.3.5 Teste: SELECT sem SET LOCAL (GUC vazio) retorna 0 rows (NULLIF garante que string vazia = NULL → policy false)
- [ ] 2.3.6 Garantir idempotência: todos os INSERTs usam `ON CONFLICT (id) DO NOTHING` para que o spec rode 2x sem falha no CI (lição Epic 13)
- [ ] 2.3.7 Executar contra Postgres local (porta 5433): `DATABASE_APP_URL=postgresql://app:app@localhost:5433/metanoia_test pnpm --filter @metanoia/api test apps/api/test/rls/notifications.rls-spec.ts`
- [ ] 2.3.8 Confirmar que o spec é listado em turbo test (pipeline CI roda 2x) e passa nas 2 execuções

---

## FASE 3 - Backend Core: Service, Controller e Env

### 3.1 Configuração de ambiente `[A]`

Ref: spec.md FR-008; plan.md §Project Structure

- [ ] 3.1.1 Adicionar `NOTIFICATION_DIGEST_WINDOW_MS: z.coerce.number().int().positive().default(300000)` em `apps/api/src/config/env.validation.ts` (envSchema)
- [ ] 3.1.2 Atualizar tipo `EnvConfig` (inferido automaticamente pelo Zod — verificar que `z.infer<typeof envSchema>` inclui o novo campo)
- [ ] 3.1.3 Escrever unit test para `env.validation` confirmando que `NOTIFICATION_DIGEST_WINDOW_MS` aceita override e usa default 300000

### 3.2 `NotificationsService.dispatch()` `[A]`

Ref: spec.md FR-001, FR-002, FR-004; plan.md §Architecture Overview; research.md Decision 2

- [ ] 3.2.1 Criar `apps/api/src/notifications/notifications.service.ts` com `@Injectable()` e injeção de `PrismaService`, `BullMqService`, `ConfigService`, `DigestService`
- [ ] 3.2.2 Implementar `dispatch(dto: NotificationDispatch): Promise<void>`: ler `tenantId` de `requestContext.get()` (NUNCA parâmetro — FR-001)
- [ ] 3.2.3 Para cada canal em `dto.channels`: persistir notificação via `withTenantTx` com `id: uuidv7()`, status `pending`; depois enfileirar job via `DigestService.enqueue()` (que decide: imediato vs delayed)
- [ ] 3.2.4 Se Redis indisponível no momento do enfileiramento: lançar exceção de infra; notificação NÃO persiste parcialmente (edge case — spec.md §Edge Cases item 3)
- [ ] 3.2.5 Adicionar `updateStatus(notificationId: string, status: NotificationStatus, readAt?: Date): Promise<void>` para PATCH /read e para o worker atualizar status
- [ ] 3.2.6 Adicionar `findByUser(userId: string, query: NotificationsQuery): Promise<PaginatedNotifications>` para o GET (ordena por status + created_at DESC via índice)
- [ ] 3.2.7 Escrever unit tests (`notifications.service.spec.ts`) mockando `PrismaService`, `BullMqService`, `requestContext`: dispatch cria notificação com tenantId do contexto, enfileira jobs, não aceita tenantId como parâmetro

### 3.3 `NotificationsController` `[A]`

Ref: contracts/notifications-api.md; spec.md FR-012

- [ ] 3.3.1 Criar `apps/api/src/notifications/notifications.controller.ts` com `@Controller('notifications')` e `@UseGuards(JwtAuthGuard)` (padrão do projeto)
- [ ] 3.3.2 Implementar `GET /api/v1/notifications` com `ZodValidationPipe` no query params (status?, page?, perPage? max 100); resposta `{ data: Notification[], meta: { page, perPage, total } }` — userId do requestContext (BOLA-safe)
- [ ] 3.3.3 Implementar `PATCH /api/v1/notifications/:id/read`; WHERE inclui `id AND userId` do contexto + withTenantTx; retorna 404 (não 403) se não encontrado (anti-IDOR)
- [ ] 3.3.4 Adicionar Swagger `@ApiTags('notifications')`, `@ApiBearerAuth()`, `@ApiOperation()` para ambos os endpoints
- [ ] 3.3.5 Escrever integration tests (`notifications.controller.spec.ts`) mockando o service: GET filtra por userId, PATCH retorna 404 cross-user, paginação respeita max 100

### 3.4 `NotificationsModule` `[A]`

Ref: plan.md §Project Structure; research.md Decision 1

- [ ] 3.4.1 Criar `apps/api/src/notifications/notifications.module.ts` com `@Module({ imports: [BullMqModule, PrismaModule], providers: [NotificationsService, NotificationsWorker, ChannelRouter, InAppChannel, EmailChannel, DigestService], controllers: [NotificationsController], exports: [NotificationsService] })`
- [ ] 3.4.2 Registrar `NotificationsModule` em `apps/api/src/app.module.ts` (importar no array `imports`)
- [ ] 3.4.3 Confirmar que `NotificationsService` é exportado para que outros módulos possam injetar e chamar `dispatch()`

---

## FASE 4 - Fila e Worker: BullMQ + Channel Router

### 4.1 `ChannelRouter` `[A]`

Ref: spec.md FR-004, FR-005; data-model.md §NotificationChannel

- [ ] 4.1.1 Criar `apps/api/src/notifications/channel-router.ts` com `@Injectable()` e Map de `channel → NotificationChannelInterface` no construtor
- [ ] 4.1.2 Injetar `InAppChannel` e `EmailChannel` via construtor; registrar no map por `channel.channel` (string `'in_app'`/`'email'`)
- [ ] 4.1.3 Implementar `route(channel: string): NotificationChannelInterface` — retorna a implementação ou lança `UnknownChannelError` para canal não registrado
- [ ] 4.1.4 Extensibilidade (FR-005): novo canal = nova classe implementando `NotificationChannelInterface` + registro no module; ChannelRouter não muda
- [ ] 4.1.5 Escrever unit test para `channel-router.ts`: `route('in_app')` retorna `InAppChannel`; `route('email')` retorna `EmailChannel`; canal desconhecido lança erro

### 4.2 `NotificationChannelInterface` e `InAppChannel` `[A]`

Ref: data-model.md §NotificationChannel; spec.md FR-014; research.md Decision 8

- [ ] 4.2.1 Criar `apps/api/src/notifications/channels/notification-channel.interface.ts` com `interface NotificationChannelInterface { readonly channel: 'in_app' | 'email'; send(payload: NotificationPayload): Promise<NotificationResult>; }`
- [ ] 4.2.2 Criar `apps/api/src/notifications/channels/in-app.channel.ts` com `@Injectable()`; injetar `PrismaService` e `RedisService`
- [ ] 4.2.3 `InAppChannel.send()`: atualizar `status → sent` via `withTenantTx` (tenantId do `requestContext.get()`)
- [ ] 4.2.4 Publicar payload mínimo em canal Redis `rt:notifications:{tenantId}:{userId}` via `RedisService.publish()` — Clarify Q2 score 3 (Decision 8)
- [ ] 4.2.5 Retornar `{ success: true }` em sucesso; `{ success: false, error: message }` em falha (Decision 6 — sem propagar exceção diretamente)
- [ ] 4.2.6 Escrever unit tests (`in-app.channel.spec.ts`): mock Prisma + Redis; confirmar status `sent` persistido; confirmar publish no canal correto; confirmar retorno `result.success`

### 4.3 `EmailChannel` stub `[M]`

Ref: spec.md US3; data-model.md §EmailChannel.send

- [ ] 4.3.1 Criar `apps/api/src/notifications/channels/email.channel.ts` com `@Injectable()` e `Logger`
- [ ] 4.3.2 Implementar `send()`: log `'email delivery delegated (stub OK)'` com `notificationId` e `userId`; retornar `{ success: true }`
- [ ] 4.3.3 Escrever unit test (`email.channel.spec.ts`): confirmar que `send()` retorna `{ success: true }` e emite log (não lança exceção)

### 4.4 `NotificationsWorker` `[A]`

Ref: plan.md §Architecture Overview; research.md Decision 1, Decision 2; spec.md FR-009, FR-010, FR-011

- [ ] 4.4.1 Criar `apps/api/src/notifications/notifications.worker.ts` com `@Injectable()` e `OnModuleInit`; injetar `BullMqService`, `ChannelRouter`, `NotificationsService`, `PrismaService`, `ConfigService`
- [ ] 4.4.2 Em `onModuleInit()`: criar worker via `bullMqService.createWorker('notifications', this.process.bind(this))`; registrar listener `worker.on('failed', ...)` para log estruturado
- [ ] 4.4.3 Em `process(job)`: extrair `{ tenantId, userId, notificationId, channel, correlationId }` do `job.data`; envolver em `requestContext.run({ tenantId, userId, requestId: generateId(), correlationId }, cb)` — padrão idêntico ao `meeting-event.worker.ts`
- [ ] 4.4.4 Dentro do contexto: buscar notificação por `notificationId` via Prisma; chamar `channelRouter.route(channel).send(payload)`; se `result.success === false`, lançar erro (BullMQ contabiliza tentativa e reagenda com backoff)
- [ ] 4.4.5 Configurar retry no job: `attempts: 3`, `backoff: { type: 'exponential', delay: 30000 }` → delays 30s/60s/120s (FR-009); `removeOnFail: false` (FR-010)
- [ ] 4.4.6 Quando tentativas esgotadas (`worker.on('failed')`): chamar `notificationsService.updateStatus(id, 'failed')` e logar `{ correlationId, channel, error_message }` (FR-011)
- [ ] 4.4.7 Escrever unit tests (`notifications.worker.spec.ts`): mock BullMqService + ChannelRouter; confirmar requestContext.run é chamado com tenantId do payload; confirmar que falha de canal lança erro (retry); confirmar log de falha contém correlationId

---

## FASE 5 - DigestService: Batching e Deduplicação

### 5.1 `DigestService` `[A]`

Ref: spec.md FR-006, FR-007, FR-008; data-model.md §Digest; research.md Decision 7

- [ ] 5.1.1 Criar `apps/api/src/notifications/digest.service.ts` com `@Injectable()`; injetar `BullMqService`, `ConfigService`
- [ ] 5.1.2 Em `onModuleInit()` (ou construtor): criar `Queue('notifications')` via `bullMqService.createQueue('notifications')` para enfileirar jobs
- [ ] 5.1.3 Implementar `enqueue(notificationId, userId, tenantId, type, channel, correlationId): Promise<void>`:
  - Se `type === 'pastoral_alert'`: enfileirar job imediato (sem delay, sem jobId especial) — FR-007
  - Caso contrário: calcular `jobKey = 'digest:{userId}:{type}:{Math.floor(Date.now() / NOTIFICATION_DIGEST_WINDOW_MS)}'` (Decision 7); enfileirar com `{ jobId: jobKey, delay: NOTIFICATION_DIGEST_WINDOW_MS }` — BullMQ deduplica por jobId (idempotente multi-pod)
- [ ] 5.1.4 Ler `NOTIFICATION_DIGEST_WINDOW_MS` do `ConfigService` (FR-008); default 300000 ms via env.validation
- [ ] 5.1.5 Payload do job imediato e delayed: `NotificationJobPayload` (camelCase conforme contrato Zod) — `{ notificationId, tenantId, userId, channel, correlationId }`
- [ ] 5.1.6 Escrever unit tests (`digest.service.spec.ts`): `pastoral_alert` enfileirado sem delay; tipo genérico enfileirado com delay e jobId determinístico; dois dispatches do mesmo bucket usam mesmo jobId (deduplicação BullMQ)
- [ ] 5.1.7 Teste com `NOTIFICATION_DIGEST_WINDOW_MS` alternativo (ex: 60000): confirmar jobId muda de bucket após a janela (SC-007)

---

## FASE 6 - Validação Local e CI

### 6.1 Validação Postgres local (pre-PR) `[A]`

Ref: lições Epic 13 (MEMORY: validação local do PAI — fórmula/lint/Postgres); plan.md §Phase 2 item 9

- [ ] 6.1.1 Subir ambiente de teste: `docker compose -f /var/lib/metanoia-hub/docker-compose.test.yml up -d`
- [ ] 6.1.2 Aplicar migration: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/metanoia_test pnpm --filter @metanoia/api prisma migrate deploy` (confirmar que migration 20260629000000 aplica sem erro)
- [ ] 6.1.3 Confirmar objetos criados: `\dt notifications`, `\dT notification_type`, `\di notifications_*`, `\d+ notifications` (RLS ativa com policy `tenant_isolation`)
- [ ] 6.1.4 Executar suite completa de testes da API: `DATABASE_APP_URL=postgresql://app:app@localhost:5433/metanoia_test pnpm --filter @metanoia/api test`
- [ ] 6.1.5 Executar spec RLS especificamente 2x seguidas e confirmar idempotência (ambas passam): `pnpm --filter @metanoia/api test apps/api/test/rls/notifications.rls-spec.ts`
- [ ] 6.1.6 Executar snapshot tests de types: `pnpm --filter @metanoia/types test` e confirmar que os snapshots estão estáveis (sem diff)
- [ ] 6.1.7 Executar lint e type-check: `pnpm --filter @metanoia/api lint && pnpm --filter @metanoia/api build`

### 6.2 Preparação do PR `[M]`

Ref: CLAUDE.md §Git Workflow; feature-00c regras críticas

- [ ] 6.2.1 Criar branch `feat/story-14-1-infra-notificacoes` a partir de `dev`
- [ ] 6.2.2 Commitar em granularidade lógica com conventional commits em PT-BR (ex: `feat(notifications): adiciona migration e modelo Prisma`, `feat(notifications): implementa NotificationsService.dispatch`, etc.)
- [ ] 6.2.3 Confirmar que nenhum arquivo de settings.json ou segredos foi incluído no staging
- [ ] 6.2.4 Abrir PR para `dev` via `gh pr create`; aguardar CI verde (lint + test + build via Turborepo remote cache)
- [ ] 6.2.5 Confirmar que a migration 20260629000000 aparece no CI sem conflito com outras migrations (timestamp > 20260628000000)

---

## Matriz de Dependências

```mermaid
flowchart TD
    F1[FASE 1 - Fundação: Contratos e Requisitos]
    F2[FASE 2 - Banco de Dados: Migration e RLS]
    F3[FASE 3 - Backend Core: Service e Controller]
    F4[FASE 4 - Fila e Worker: BullMQ e Channel Router]
    F5[FASE 5 - DigestService: Batching e Deduplicação]
    F6[FASE 6 - Validação Local e CI]

    F1 --> F2
    F1 --> F3
    F2 --> F3
    F3 --> F4
    F3 --> F5
    F4 --> F5
    F4 --> F6
    F5 --> F6
    F2 --> F6
```

## Resumo Quantitativo

| Fase | Tarefas | Subtarefas | Criticidade dominante |
|------|---------|------------|-----------------------|
| 1 - Fundação: Contratos e Requisitos | 2 | 15 | A |
| 2 - Banco de Dados: Migration e RLS | 3 | 21 | C/A |
| 3 - Backend Core: Service e Controller | 4 | 19 | A |
| 4 - Fila e Worker: BullMQ e Channel Router | 4 | 23 | A/M |
| 5 - DigestService: Batching e Deduplicação | 1 | 7 | A |
| 6 - Validação Local e CI | 2 | 12 | A/M |
| **Total** | **16** | **97** | - |

## Escopo Coberto

| Item | Descrição | Fase |
|------|-----------|------|
| Contratos Zod | Schemas em `packages/types` com snapshot gate | 1 |
| Fechamento de gaps | 6 gaps do checklist (CHK007/016/024/039/041/042) com defaults fiéis ao plano | 1 |
| Migration Prisma | Tabela `notifications` + 3 enums + 2 índices + RLS `tenant_isolation` | 2 |
| Spec RLS idempotente | `notifications.rls-spec.ts` com 2 tenants, roda 2x no CI | 2 |
| NotificationsService | `dispatch()`, `updateStatus()`, `findByUser()` | 3 |
| NotificationsController | GET + PATCH /read com BOLA/IDOR mitigation | 3 |
| NotificationsModule | Registro no app.module e export de NotificationsService | 3 |
| Configuração env | `NOTIFICATION_DIGEST_WINDOW_MS` em env.validation | 3 |
| ChannelRouter | Roteamento por interface comum; extensível sem modificação | 4 |
| InAppChannel | Persiste `sent` + publica Redis `rt:notifications:{tid}:{uid}` | 4 |
| EmailChannel | Stub funcional com log; mesma interface | 4 |
| NotificationsWorker | BullMQ worker + requestContext.run + retry 3x + failed set | 4 |
| DigestService | Batching por janela; `pastoral_alert` sem delay; jobId idempotente | 5 |
| Validação Postgres local | Migration + RLS + suite completa antes do PR | 6 |
| CI verde | Lint + type-check + test + build via Turborepo | 6 |

## Escopo Excluído

| Item | Descrição | Motivo |
|------|-----------|--------|
| Notification Center FE | Componentes de UI, SSE consumer, marca-como-lida no frontend | Story 14.2x |
| SSE consumer backend | Server-Sent Events endpoint consumindo `rt:notifications:*` | Story 14.2a |
| Integração real de e-mail | Resend / provedor SMTP real no EmailChannel | Story 14.3 |
| WhatsApp / push / outros canais | Novos canais além de in_app e email | Fases futuras |
| Painel admin de notificações | Dashboard de volume, failed set review, replay manual | Fora do MVP |
| Métricas/observabilidade | Contadores Prometheus de dispatch/entrega/falha | Não especificado no plano |
| Notificações em batch massal | Broadcast para múltiplos usuários num único dispatch | Não especificado no MVP |
