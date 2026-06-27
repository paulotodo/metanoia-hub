# Tasks — Preferências Granulares de Notificação por Tipo

**Feature**: `notif-preferencias-granulares` | **Branch base**: `dev`
**Stories**: US1 (P1) configurar preferências, US2 (P2) pipeline respeita, US3 (P3) migração silenciar, US4 (P4) enforcement Líder
**Escopo**: ZERO prod. Todas as validações locais. Gate humano para aplicar migration em prod.

**Legenda de status:**
- `[ ]` Pendente
- `[~]` Em andamento
- `[x]` Concluido
- `[!]` Bloqueado

**Legenda de criticidade:**
- `[C]` Critico — bloqueante para outras tarefas ou para a feature inteira
- `[A]` Alto — funcionalidade essencial, sem alternativa
- `[M]` Medio — necessário mas sem dependentes diretos

---

## Matriz de Dependências

```text
FASE 1 (Contratos) → FASE 2 (Migration) → FASE 3 (Backend Service) → FASE 4 (Worker) → FASE 5 (Frontend) → FASE 6 (Migração silenciar) → FASE 7 (Testes e validação)
```

| Task | Depende de | Bloqueia |
|------|-----------|----------|
| 1.1 Zod schemas + snapshot | — | 2.1, 3.1, 4.1, 5.1 |
| 2.1 Prisma model | 1.1 | 2.2, 2.3, 3.1 |
| 2.2 Migration SQL + RLS | 2.1 | 2.3, 3.1 |
| 2.3 Teste RLS | 2.2 | — |
| 3.1 Service preferences | 1.1, 2.2 | 3.2, 4.1 |
| 3.2 Controller GET+PATCH | 3.1 | 3.3, 5.1 |
| 3.3 Registrar no módulo | 3.2 | 5.1 |
| 3.4 Testes unit/integ service | 3.1 | — |
| 4.1 Campo type no job payload | 1.1 | 4.2 |
| 4.2 Integração worker + markSuppressed | 3.1, 4.1 | 4.3 |
| 4.3 Testes integração worker | 4.2, 3.4 | — |
| 5.1 Página + toggles otimistas | 1.1, 3.2 | 5.2, 5.3 |
| 5.2 Toggle Líder desabilitado + tooltip | 5.1 | — |
| 5.3 i18n PT-BR completo | 5.1 | 5.4 |
| 5.4 Estado de erro GET (retry) | 5.1 | — |
| 6.1 Detecção localStorage + banner | 5.1 | 6.2, 6.3 |
| 6.2 Modal migração "Manter silenciado" | 6.1 | — |
| 6.3 Modal migração "Configurar por tipo" | 6.1 | — |
| 7.1 Testes E2E toggle + rollback + Líder | 5.1, 5.2 | — |
| 7.2 Testes E2E migração silenciar | 6.1, 6.2, 6.3 | — |
| 7.3 Validação turbo build + lint | TODAS | — |

---

## FASE 1 — Contratos compartilhados (packages/types)

### 1.1 Zod schemas de preferências + snapshot test `[C]`

- [x] Criar `packages/types/src/notifications/preferences.ts`
  - [x] `NotificationPreferenceChannelsSchema = z.object({ inApp: z.boolean(), email: z.boolean() })`
  - [x] `NotificationPreferencesSchema` — objeto com chave por cada um dos 7 tipos (`pastoral_alert`, `group_message`, `content_update`, `meeting_reminder`, `system`, `export_ready`, `content_new`), valor `NotificationPreferenceChannelsSchema`
  - [x] `UpdateNotificationPreferencesSchema` — `.partial()` profundo (cada tipo opcional, cada canal opcional), `.strict()` no nível raiz e por tipo (rejeita chaves desconhecidas)
  - [x] Tipos `NotificationPreferences`, `UpdateNotificationPreferences` via `z.infer<>`
  - [x] Re-exportar em `packages/types/src/index.ts`
- [x] Criar `packages/types/src/notifications/preferences.snapshot.spec.ts`
  - [x] Snapshot de `NotificationPreferencesSchema` via `expect(schema).toMatchSnapshot()`
  - [x] Snapshot de `UpdateNotificationPreferencesSchema`
  - [x] Testar que tipo desconhecido é rejeitado com `.strict()`
  - [x] Testar que canal fora de `{inApp,email}` é rejeitado
- [x] Rodar `pnpm --filter @metanoia/types test` — deve passar (incluindo snapshot)
- [x] Commit de validação: `pnpm --filter @metanoia/types build`

> **Critério de aceite**: `pnpm --filter @metanoia/types test` verde; snapshot gravado em `.spec.ts.snap`; `z.infer<typeof NotificationPreferencesSchema>` compilável em TS strict.

---

## FASE 2 — Migration + RLS + Teste RLS

### 2.1 Prisma model NotificationPreference `[C]`

- [x] Adicionar model em `apps/api/prisma/schema.prisma`:
  ```prisma
  model NotificationPreference {
    id               String              @id @db.Uuid
    tenantId         String              @map("tenant_id") @db.Uuid
    userId           String              @map("user_id") @db.Uuid
    notificationType NotificationType    @map("notification_type")
    channel          NotificationChannel
    enabled          Boolean
    updatedAt        DateTime            @updatedAt @map("updated_at") @db.Timestamptz

    @@unique([userId, tenantId, notificationType, channel], name: "notif_prefs_user_tenant_type_channel_uq")
    @@index([tenantId], name: "notification_preferences_tenant_idx")
    @@map("notification_preferences")
  }
  ```
- [x] **NÃO** usar `@default(uuid())` — id gerado pela aplicação via `generateId()` (uuidv7)
- [x] **NÃO** criar novos enums — reusar `NotificationType` e `NotificationChannel` existentes (migration 14-1)
- [x] Rodar `pnpm --filter @metanoia/api prisma validate` — deve passar sem erros

> **Critério de aceite**: `prisma validate` sem erro; model aparece no Prisma Client gerado.

### 2.2 Migration SQL com RLS `[C]`

- [x] Criar diretório: `apps/api/prisma/migrations/<TIMESTAMP>_16-1-notification-preferences/migration.sql`
- [x] SQL da migration:
  ```sql
  -- CreateTable
  CREATE TABLE "notification_preferences" (
      "id" UUID NOT NULL,
      "tenant_id" UUID NOT NULL,
      "user_id" UUID NOT NULL,
      "notification_type" "NotificationType" NOT NULL,
      "channel" "NotificationChannel" NOT NULL,
      "enabled" BOOLEAN NOT NULL,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
  );
  -- Unique index para UPSERT ON CONFLICT
  CREATE UNIQUE INDEX "notif_prefs_user_tenant_type_channel_uq"
      ON "notification_preferences" ("user_id", "tenant_id", "notification_type", "channel");
  -- Índice de tenant para RLS e queries filtradas
  CREATE INDEX "notification_preferences_tenant_idx"
      ON "notification_preferences" ("tenant_id");
  -- Enable RLS
  ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
  -- Policy de isolamento (espelha padrão 14-1)
  CREATE POLICY "tenant_isolation" ON "notification_preferences"
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  ```
- [x] Aplicar localmente: `pnpm --filter @metanoia/api prisma migrate dev --name 16-1-notification-preferences`
- [x] Verificar que migration aplica sem erros em banco dev local
- [x] **NÃO** aplicar em produção (gate Paulo)

> **Critério de aceite**: tabela `notification_preferences` existe no DB local com RLS e policy `tenant_isolation` criados.

### 2.3 Teste de isolamento RLS `[A]`

- [x] Criar `apps/api/test/rls/notification-preferences.rls.spec.ts`
  - [x] Tenant A insere preferência (`pastoral_alert`, `in_app`, `enabled=true`)
  - [x] Tenant B (`SET LOCAL app.current_tenant_id = <tenant_b_id>`) faz SELECT → retorna 0 linhas
  - [x] Tenant B tenta UPDATE da linha de A → falha por WITH CHECK
  - [x] Teste roda 2× de forma idempotente (padrão CI)
- [x] Rodar localmente — deve passar 2×

> **Critério de aceite**: isolamento verificado nas duas direções; idempotente.

---

## FASE 3 — Backend Service + Controller

### 3.1 NotificationPreferencesService `[C]`

- [x] Criar `apps/api/src/notifications/preferences/notification-preferences.service.ts`
  - [x] Injetar `PrismaService`, `RedisService`, `Logger`
  - [x] **`getForCurrentUser(roles: string[])`**:
    - [x] Cache hit `cache:notif-prefs:{userId}` → parse JSON + enforcement Líder pós-cache → retornar
    - [x] Cache miss / Redis down → DB via `withTenantTx()`, resolver defaults (7×2 = 14, ausência de linha → `true`), SET cache EX 600 (fallback: logger.warn)
    - [x] Enforcement Líder: `roles.includes('lider')` → forçar `pastoral_alert.inApp = true` no retorno (NÃO cachear pós-enforcement)
  - [x] **`patchForCurrentUser(roles, patch)`**:
    - [x] Guard enforcement: `roles.includes('lider') && patch.pastoral_alert?.inApp === false` → `UnprocessableEntityException(422)`
    - [x] UPSERT idempotente via `INSERT ... ON CONFLICT (...) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`
    - [x] `id` gerado via `generateId()` (uuidv7) para cada nova linha
    - [x] Mapeamento: `inApp` → `channel='in_app'`, `email` → `channel='email'`
    - [x] Invalidar cache: `del(cache:notif-prefs:{userId})` (fallback: logger.warn)
    - [x] Retornar `getForCurrentUser(roles)` pós-patch
  - [x] **`resolveEnabled(userId, type, channel)`**:
    - [x] Cache hit → retornar campo `[type][inApp|email]`
    - [x] Cache miss / Redis down → DB direct via `withTenantTx()`
    - [x] Default: ausente → `true`
    - [x] Enforcement Líder via `isLeaderInTenant()` para `type='pastoral_alert'` e `channel='in_app'`
  - [x] **`markSuppressedByPreference(notificationId)`**:
    - [x] `UPDATE notifications SET status='failed', metadata = metadata || '{"reason":"user_preference"}'::jsonb WHERE id=$1`
  - [x] **`isLeaderInTenant(userId)`**:
    - [x] Query `user_tenants` WHERE `user_id=$1 AND tenant_id=current_tenant` via `withTenantTx()`; retorna `role === 'lider'`
- [x] Criar `apps/api/src/notifications/preferences/notification-preferences.service.spec.ts` com 6 casos:
  - [x] PATCH parcial → UPSERT correto
  - [x] GET sem linhas → todos defaults true (14 campos)
  - [x] RedisService.get lança → fallback DB sem exceção propagada
  - [x] Líder PATCH `pastoral_alert.inApp=false` → 422
  - [x] Líder GET → `pastoral_alert.inApp=true` forçado
  - [x] Participante PATCH `pastoral_alert.inApp=false` → persiste
- [x] Rodar `pnpm --filter @metanoia/api test notifications/preferences` — verde

> **Critério de aceite**: 6 testes passam; sem libs de validação de terceiros.

### 3.2 NotificationPreferencesController `[C]`

- [x] Criar `apps/api/src/notifications/preferences/notification-preferences.controller.ts`
  - [x] `@Controller('api/v1/users/me/notification-preferences')`, `@UseGuards(KeycloakAuthGuard)`, `@ApiBearerAuth()`
  - [x] `GET /` → `@HttpCode(200)` → extrair `roles` de `@CurrentUser()` → `service.getForCurrentUser(roles)` → `{ data: result }`
  - [x] `PATCH /` → `@HttpCode(201)` → `@Body(new ZodValidationPipe(UpdateNotificationPreferencesSchema))` → `service.patchForCurrentUser(roles, dto)` → `{ data: result }`
  - [x] 400 para tipo/canal desconhecidos (ZodValidationPipe); 422 do service para Líder (propagação natural)
  - [x] Swagger: `@ApiTags('notifications')`, `@ApiOperation`, `@ApiResponse(200/201/400/401/422)`
  - [x] userId NUNCA no path/query/body — SEMPRE de `getRequestContext()` via service
- [x] Rodar `pnpm --filter @metanoia/api build` — deve compilar

> **Critério de aceite**: endpoint registrado no Swagger; IDOR impossível via path.

### 3.3 Registrar no módulo de notifications `[C]`

- [x] Atualizar `apps/api/src/notifications/notifications.module.ts`:
  - [x] `providers`: adicionar `NotificationPreferencesService`
  - [x] `controllers`: adicionar `NotificationPreferencesController`
  - [x] `exports`: adicionar `NotificationPreferencesService` (para injeção no worker)
- [x] Rodar `pnpm --filter @metanoia/api build` — deve compilar sem erro

> **Critério de aceite**: build verde; serviço injetável em `NotificationsWorker`.

### 3.4 Testes de integração backend `[A]`

- [ ] Criar `apps/api/src/notifications/preferences/notification-preferences.integration.spec.ts`:
  - [ ] T-I1: PATCH `{meeting_reminder:{email:false}}` → UPSERT no DB → cache invalidado → GET reflete; outros tipos intactos
  - [ ] T-I3: Redis down + PATCH → fallback DB + log warn; GET retorna correto
  - [ ] T-I5: segunda chamada GET usa cache (mock Redis.get retorna hit)
  - [ ] T-G3: Líder via `isLeaderInTenant` → `pastoral_alert.inApp` sempre true mesmo pref DB = false
- [ ] Rodar `pnpm --filter @metanoia/api test` — deve passar; zero regressão

> **Critério de aceite**: 4 testes de integração verdes; zero regressão em notifications.

---

## FASE 4 — Integração na pipeline de notificação (worker)

### 4.1 Adicionar campo `type` ao NotificationJobPayload `[C]`

- [x] Editar `packages/types/src/notification.ts`: adicionar `type: NotificationTypeSchema.optional()` em `NotificationJobPayloadSchema` (opcional para compatibilidade retroativa com jobs antigos)
- [x] Atualizar snapshot: `pnpm --filter @metanoia/types test` — snapshot auto-atualiza
- [x] Editar `apps/api/src/notifications/digest.service.ts`: incluir `type` no objeto `NotificationJobPayload` no método `enqueue()` (já tem `type` como parâmetro; incluir no literal de objeto)
- [x] Verificar que `NotificationsWorker` compila com campo novo (TS strict)

> **Critério de aceite**: `type` presente no payload; `DigestService.enqueue` propaga o tipo; snapshot atualizado.

### 4.2 Integração no worker: verificar preferência antes de rotear `[C]`

- [x] Editar `apps/api/src/notifications/notifications.worker.ts`:
  - [x] Injetar `NotificationPreferencesService` no construtor
  - [x] Em `process()`, ANTES de `channelRouter.route(channel)`:
    ```ts
    const notifType = job.data.type ?? await this.notificationsService.getTypeById(notificationId);
    if (notifType) {
      const enabled = await this.preferencesService.resolveEnabled(userId, notifType, channel as NotificationChannel);
      if (!enabled) {
        await this.preferencesService.markSuppressedByPreference(notificationId);
        this.logger.log({ notificationId, channel, type: notifType }, 'notification suppressed by user preference');
        return;
      }
    }
    ```
  - [x] Fallback para `job.data.type === undefined` (jobs antigos): buscar `getTypeById`; se null → log warn + entregar (nunca descarta silenciosamente)
- [x] Adicionar `getTypeById(id: string): Promise<NotificationType | null>` em `NotificationsService` (SELECT type FROM notifications WHERE id=$1 via `withTenantTx`)
- [x] Rodar `pnpm --filter @metanoia/api build` — verde

> **Critério de aceite**: pipeline verifica preferência; supressão registra `status='failed'` + `metadata.reason='user_preference'`; log estruturado emitido.

### 4.3 Testes de integração do worker `[A]`

- [ ] Criar/estender `apps/api/src/notifications/notifications.worker.spec.ts`:
  - [ ] T-I3: pref `email=false` para `meeting_reminder` → worker NÃO chama EmailChannel; `markSuppressedByPreference` chamado
  - [ ] T-G3: Líder com pref DB `pastoral_alert.in_app=false` → worker ENTREGA in_app (`resolveEnabled` retorna true por enforcement)
  - [ ] Fallback defensivo: job sem `type` → `getTypeById` chamado; se null → entrega
- [ ] Rodar `pnpm --filter @metanoia/api test` — deve passar

> **Critério de aceite**: 3 casos de teste verdes; zero regressão nos testes existentes do worker.

---

## FASE 5 — Frontend: página de preferências

### 5.1 Página de preferências + toggles otimistas `[C]`

- [ ] Criar `apps/web/app/(authenticated)/configuracoes/notificacoes/page.tsx` (Client Component `'use client'`)
  - [x] `useQuery` → `GET /api/v1/users/me/notification-preferences`; estado de loading: skeleton
  - [x] Renderizar 7 tipos na ordem pastoral: pastoral_alert, meeting_reminder, content_new, content_update, export_ready, group_message, system
  - [x] Para cada tipo: rótulo PT-BR + descrição PT-BR + 2 toggles ("No app" + "E-mail")
  - [x] `useMutation` → `PATCH /api/v1/users/me/notification-preferences`
    - [x] Optimistic update: atualizar cache local no `onMutate`; rollback em `onError` + toast PT-BR
    - [x] Invalidar query em `onSuccess`
  - [ ] Toggle bloqueado durante PATCH em voo (CHK048: desabilitar + spinner para prevenir duplo-clique)
- [ ] Criar `apps/web/app/(authenticated)/configuracoes/notificacoes/_components/NotificationTypeRow.tsx`
  - [x] Props: `type`, `labels`, `channels`, `isLeader`, `onToggle(type, channel, value)`, `isMutating`
  - [x] `data-testid="notif-row-{type}"` para E2E
- [x] Rodar `pnpm --filter @metanoia/web build` — deve compilar sem erro TS

> **Critério de aceite**: página em `/app/configuracoes/notificacoes`; toggle otimista; erro API reverte + toast PT-BR.

### 5.2 Toggle Líder pastoral_alert desabilitado + tooltip `[A]`

- [x] Em `NotificationTypeRow.tsx`: quando `type === 'pastoral_alert'` e `isLeader === true`
  - [x] Toggle `inApp` com `disabled={true}` e `aria-disabled="true"`
  - [x] Tooltip: "Alertas pastorais no app não podem ser desativados" (de `pt-BR.json`)
  - [x] Toggle `email` permanece editável (apenas `inApp` é bloqueado para Líder)
- [x] `isLeader`: extraído do token de autenticação via hook de auth do projeto

> **Critério de aceite**: toggle visualmente desabilitado; tooltip acessível; toggle `email` funciona normalmente.

### 5.3 i18n PT-BR completo `[A]`

- [x] Adicionar em `apps/web/messages/pt-BR.json` (nova seção `notificationPreferences`):
  - [x] `pageTitle`: "Preferências de notificações"
  - [x] `channels.inApp`: "No app" | `channels.email`: "E-mail"
  - [x] `types.pastoral_alert`: `{ label: "Alertas pastorais", description: "Quando um participante muda de status no semáforo" }`
  - [x] `types.meeting_reminder`: `{ label: "Lembretes de reunião", description: "24h antes de uma reunião agendada" }`
  - [x] `types.content_new`: `{ label: "Novo conteúdo", description: "Quando uma nova trilha é publicada no seu grupo" }`
  - [x] `types.content_update`: `{ label: "Atualização de conteúdo", description: "Quando uma trilha que você acompanha é atualizada" }`
  - [x] `types.group_message`: `{ label: "Mensagens do grupo", description: "Novas mensagens no seu grupo" }`
  - [x] `types.export_ready`: `{ label: "Relatórios prontos", description: "Quando um relatório exportado está disponível" }`
  - [x] `types.system`: `{ label: "Anúncios do sistema", description: "Atualizações e comunicados da plataforma" }`
  - [x] `tooltip.leaderPastoralLock`: "Alertas pastorais no app não podem ser desativados"
  - [x] `errors.fetchFailed`: "Não foi possível carregar suas preferências. Tente novamente."
  - [x] `errors.updateFailed`: "Não foi possível salvar sua preferência. Tente novamente."
- [x] Usar `useTranslations('notificationPreferences')` na página e componentes

> **Critério de aceite**: zero string PT-BR literal no TSX; todas centralizadas em `pt-BR.json`.

### 5.4 Estado de erro GET + botão "Tentar novamente" `[A]`

- [x] Em `page.tsx`: quando `isError` (useQuery) → mensagem de erro PT-BR + botão "Tentar novamente"
  - [x] Botão chama `refetch()` da query
  - [x] NÃO exibir tela branca (CHK062)
  - [x] `data-testid="pref-error-retry"` para E2E

> **Critério de aceite**: erro no GET exibe mensagem + botão retry funcional.

---

## FASE 6 — Migração do toggle "silenciar" global

### 6.1 Detecção localStorage + banner de aviso `[C]`

- [x] Em `page.tsx`, ao montar:
  - [x] Checar `localStorage.getItem('metanoia:notificationSilence')`
  - [x] Se presente: exibir banner: "Todas as notificações no app estão silenciadas. Desative o modo silencioso para usar preferências por tipo."
  - [ ] Se é primeira visita na sessão (`sessionStorage.getItem('pref:migrationSeen')` ausente) + chave presente → abrir `SilenceMigrationModal`
  - [x] Enquanto localStorage ativo: todos os toggles `inApp` desabilitados visualmente (master override)
- [x] `data-testid="silence-banner"` para E2E

> **Critério de aceite**: banner aparece com chave; modal abre na primeira visita; não reabre no mesmo tab.

### 6.2 Modal migração "Manter silenciado" `[A]`

- [x] Criar `_components/SilenceMigrationModal.tsx`
  - [x] Texto modal: "Você estava com notificações silenciadas. Deseja manter tudo desativado ou configurar por tipo?"
  - [x] Ação "Manter silenciado": PATCH único com todos 7 tipos `inApp: false` (1 requisição atômica) + spinner no botão
    - [ ] On success: `localStorage.removeItem('metanoia:notificationSilence')` + `sessionStorage.setItem('pref:migrationSeen', 'true')` + fechar modal + invalidar query
    - [x] On error: toast PT-BR; localStorage NÃO removido
  - [x] `data-testid="migration-modal"`, `data-testid="btn-manter-silenciado"`, `data-testid="btn-configurar-por-tipo"`

> **Critério de aceite**: "Manter silenciado" envia 1 PATCH com todos inApp=false; localStorage removido; reload sem modal.

### 6.3 Modal migração "Configurar por tipo" `[A]`

- [x] Ação "Configurar por tipo" no `SilenceMigrationModal`:
  - [x] `localStorage.removeItem('metanoia:notificationSilence')`
  - [x] `sessionStorage.setItem('pref:migrationSeen', 'true')`
  - [x] Fechar modal sem PATCH
  - [x] Página exibe defaults habilitados (sem gravação no servidor)

> **Critério de aceite**: "Configurar por tipo" remove localStorage, fecha modal sem PATCH; reload sem modal.

---

## FASE 7 — Testes E2E, validação e cobertura final

### 7.1 Testes E2E — toggle otimista + rollback + Líder `[A]`

- [ ] Criar `apps/web/e2e/notification-preferences.e2e-spec.ts`:
  - [ ] T-E1: toggle desativa → otimista; MSW retorna 500 → toggle reverte + toast exibido
  - [ ] T-E2: mock Líder → toggle `pastoral_alert.inApp` com `[disabled]` + tooltip no hover; toggle `email` clicável
  - [ ] T-E3: GET falha → mensagem erro + botão retry; clicar retry re-tenta
  - [ ] T-E4: durante PATCH em voo → toggles desabilitados (sem duplo-clique)
- [ ] Rodar localmente: `pnpm --filter @metanoia/web playwright test notification-preferences`

> **Critério de aceite**: 4 testes E2E passam; MSW mock sem estado externo.

### 7.2 Testes E2E — fluxo de migração silenciar `[A]`

- [ ] Adicionar em `notification-preferences.e2e-spec.ts`:
  - [ ] T-M1: setar `localStorage['metanoia:notificationSilence']` → banner + modal exibidos
  - [ ] T-M2: clicar "Manter silenciado" → verificar payload PATCH (7 tipos inApp=false) → localStorage removido → reload → sem modal
  - [ ] T-M3: clicar "Configurar por tipo" → sem PATCH; localStorage removido; reload → sem modal

> **Critério de aceite**: 3 testes de migração passam; fluxo completo verificado E2E.

### 7.3 Validação completa turbo build + boot da API `[C]`

- [ ] `pnpm --filter @metanoia/types build` — verde
- [ ] `pnpm --filter @metanoia/types test` — verde (snapshots)
- [ ] `pnpm --filter @metanoia/api build` — verde (TS strict, sem Record exaustivo quebrado)
- [ ] `pnpm --filter @metanoia/web build` — verde (sem i18n faltando, sem tipo desconhecido)
- [ ] Boot da API: `NODE_ENV=test node apps/api/dist/main.js &` → `/api/health` retorna 200 (verifica `onModuleInit` do worker sem throw)
- [ ] `pnpm --filter @metanoia/api test` — verde; zero regressão
- [ ] Lint: `pnpm --filter @metanoia/api lint && pnpm --filter @metanoia/web lint`
- [ ] `pnpm --filter @metanoia/api test apps/api/test/rls/notification-preferences.rls.spec.ts` — verde 2× idempotente
- [ ] **NÃO** commitar `apps/web/next-env.d.ts`
- [ ] **NÃO** push direto a `dev` — PR: `feat/16-1-notif-preferencias-granulares`

> **Critério de aceite**: toda a suite local verde; zero regressão; PR aberto contra `dev`.

---

## Resumo Quantitativo

| Fase | Tarefas | Criticidade |
|------|---------|-------------|
| 1 — Contratos compartilhados | 1 | C |
| 2 — Migration + RLS | 3 | C, C, A |
| 3 — Backend Service + Controller | 4 | C, C, C, A |
| 4 — Integração worker | 3 | C, C, A |
| 5 — Frontend página | 4 | C, A, A, A |
| 6 — Migração silenciar | 3 | C, A, A |
| 7 — Testes E2E + validação | 3 | A, A, C |
| **Total** | **21** | 8 críticas, 13 altas |

## Escopo Coberto

| ID | Descrição | Fase |
|----|-----------|------|
| US1 | Página `/app/configuracoes/notificacoes`, 7 tipos × 2 canais, optimistic update, defaults | 5 |
| US2 | Pipeline respeita preferências, `markSuppressedByPreference`, cache Redis + fallback DB | 3, 4 |
| US3 | Detecção localStorage, banner, modal migração ("Manter silenciado" / "Configurar por tipo") | 6 |
| US4 | Enforcement Líder — `pastoral_alert.inApp` inviolável via API (422) e UI (disabled + tooltip) | 3, 5 |
| FR-001 | Persistência `(user, tenant, type, channel, enabled)` com timestamp | 2, 3 |
| FR-002 | GET + PATCH `/api/v1/users/me/notification-preferences` | 3 |
| FR-003 | Defaults resolvidos no service sem pré-popular banco | 3 |
| FR-004 | Validação tipo/canal via ZodValidationPipe + `.strict()` | 1, 3 |
| FR-005 | Cache Redis TTL 10min + invalidação imediata no PATCH | 3 |
| FR-006 | Fallback DB quando Redis indisponível | 3, 4 |
| FR-007 | Worker verifica preferências; supressão registra `status='failed'` + `metadata.reason` | 4 |
| FR-008 | Recusa 422 para Líder desabilitando `pastoral_alert.inApp` | 3 |
| FR-009 | Enforcement lazy por request/token | 3 |
| FR-010 | Fluxo de migração localStorage → DB | 6 |
| FR-011 | Snapshot tests como gate contra breaking changes nos contratos | 1 |
| Segurança | IDOR-safe (`/me`), RLS isolamento multi-tenant, SQL bind params, sem superfície stored-XSS | 2, 3 |

## Escopo Excluído

| ID | Descrição | Motivo |
|----|-----------|--------|
| Prod migration | Aplicar migration em produção | Gate Paulo — gate humano obrigatório pós-merge |
| Keycloak event | Listener/webhook para troca de papel | Enforcement lazy por design (FR-009) |
| Enum suppressed | Novo `NotificationStatus.suppressed` | Usa `failed` + `metadata.reason` sem alterar schema |
| Canais extras | Push/web-push como canal adicional | Fora do escopo desta feature |
| Retry por preferência | Notificações `status='failed'` por preferência NÃO disparam retry | Falha por preferência é intencional, não falha de entrega |
