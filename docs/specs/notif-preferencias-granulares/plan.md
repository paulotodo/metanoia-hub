# Implementation Plan — Preferências Granulares de Notificação por Tipo

**Feature**: `notif-preferencias-granulares` | **Branch base**: `dev`
**Spec**: `spec.md` | **Companions**: `research.md`, `data-model.md`, `contracts/`
**Escopo**: construir tudo + validar local. ZERO prod (migration aplicada por
gate humano pós-merge). Sem listener/webhook Keycloak. Sem tocar
`metanoia-prod-*`. Sem push direto a `dev`.

---

## Resumo Técnico (HOW)

Persistir preferências `(user, tenant, type, channel) → enabled` numa nova
tabela `notification_preferences` (RLS tenant-scoped), expor
`GET/PATCH /api/v1/users/me/notification-preferences` com defaults resolvidos
no service, cachear por usuário em Redis (`cache:notif-prefs:{userId}`,
TTL 10min, fallback DB), e integrar a checagem na pipeline de notificação no
`NotificationsWorker` ANTES do `ChannelRouter`. Enforcement do Líder é LAZY:
no HTTP via papel do token; no worker via lookup `user_tenants.role`. UI em
`/app/configuracoes/notificacoes` com toggles otimistas e fluxo de migração do
"silenciar" localStorage→DB. Contratos Zod compartilhados em `packages/types`
com snapshot tests.

Todos os fatos de integração estão verificados em `research.md` (símbolos,
arquivos, linhas reais). Esta seção é o desenho; os "porquês" estão lá.

---

## Constituição / Guardrails (gate de conformidade)

- **Multi-tenancy**: `tenant_id` na tabela + RLS obrigatória; tenant via
  `AsyncLocalStorage` (`getRequestContext()`), NUNCA parâmetro. Acesso via
  `withTenantTx`.
- **IDs**: `generateId()` (uuidv7) de `@metanoia/types`. Proibido
  `@default(uuid())`.
- **Validação**: Zod em `packages/types` + `ZodValidationPipe` custom. Sem
  libs de validação de terceiros (sem `nestjs-zod`).
- **API**: `/api/v1/`, sucesso `{ data, meta? }`, erro `{ statusCode, error,
  message, details? }`. PATCH retorna o objeto completo. Datas ISO 8601.
- **Idioma**: código/logs em inglês; mensagens de usuário PT-BR centralizadas
  em `apps/web/messages/pt-BR.json`; vocabulário pastoral.
- **Frontend**: Server Components por padrão; TanStack Query só em Client
  Components; Zustand 1 store por concern.

---

## Arquitetura por camada

### Camada 0 — Contratos compartilhados (`packages/types`)

Arquivo novo: `packages/types/src/notifications/preferences.ts` (re-exportado
em `packages/types/src/index.ts`). Deriva dos enums REAIS.

- `NotificationPreferenceChannelsSchema = z.object({ inApp: z.boolean(),
  email: z.boolean() })`.
- `NotificationPreferencesSchema` = objeto com chave por
  `NotificationType` (os 7), valor `NotificationPreferenceChannelsSchema`.
- `UpdateNotificationPreferencesSchema` = `.partial()` profundo: cada tipo
  opcional, cada canal opcional (patch semantics). Rejeita chaves fora do
  enum (`.strict()`), rejeita canais fora de `{inApp,email}`.
- Tipos `NotificationPreferences`, `UpdateNotificationPreferences` via
  `z.infer`.
- **Snapshot test** `preferences.snapshot.spec.ts` (gate contra breaking
  changes silenciosos — FR-011).

Detalhe do contrato em `contracts/notification-preferences.api.md` e
`contracts/notification-preferences.schema.md`.

### Camada 1 — Migration + RLS (data-model.md §1)

- `apps/api/prisma/schema.prisma`: model `NotificationPreference` (ver
  data-model.md §1.1).
- Migration `apps/api/prisma/migrations/<ts>_16-1-notification-preferences/`
  com CREATE TABLE + UNIQUE + INDEX + RLS ENABLE + POLICY `tenant_isolation`
  (EXATAMENTE o padrão de 14-1; ver data-model.md §1.2).
- Teste RLS `apps/api/test/rls/notification-preferences.rls.spec.ts`
  (idempotente, roda 2x no CI).

### Camada 2 — Backend service + controller

Diretório: `apps/api/src/notifications/preferences/`
- `notification-preferences.controller.ts`:
  `@Controller('api/v1/users/me/notification-preferences')`,
  `@UseGuards(KeycloakAuthGuard)`, `@ApiBearerAuth()`.
  - `GET ` → 200, `{ data: NotificationPreferences }` (defaults resolvidos +
    enforcement Líder do TOKEN).
  - `PATCH ` → 201, body via `ZodValidationPipe(UpdateNotificationPreferencesSchema)`,
    retorna objeto completo. Rejeita 422 se Líder tenta
    `pastoral_alert.inApp=false`.
  - userId SEMPRE de `getRequestContext().userId`; papel de `@CurrentUser()`
    / `request.user` (`AuthenticatedUser.roles` inclui `Role.LIDER='lider'`).
- `notification-preferences.service.ts`:
  - `getForCurrentUser(roles)`: cache→DB (via `withTenantTx`), resolve
    defaults (7×2), aplica enforcement Líder sobre `pastoral_alert.inApp`.
  - `patchForCurrentUser(roles, patch)`: valida enforcement (422 se Líder
    desabilita `pastoral_alert.inApp`), UPSERT idempotente
    (`ON CONFLICT ... DO UPDATE`), invalida cache, retorna objeto completo.
  - `resolveEnabled(userId, type, channel)`: usado pelo worker — cache→DB,
    default true; enforcement Líder via `isLeader(userId)` (lookup
    `user_tenants.role='lider'`).
  - `isLeaderInTenant(userId)`: `SELECT role FROM user_tenants WHERE
    user_id=$1 AND tenant_id=current_tenant` (via `withTenantTx`), retorna
    `role='lider'`.
- Cache: `getCache/setCache/delCache` envolvem `RedisService` com try/catch +
  `logger.warn` em falha → fallback DB (data-model.md §6).
- Registrar no módulo de notifications (`notifications.module.ts`): provider +
  controller.

### Camada 3 — Integração na pipeline (research.md D4)

`apps/api/src/notifications/notifications.worker.ts`, ENTRE l.114 e l.115
(dentro de `requestContext.run`, antes de `channelRouter.route`):

```ts
const enabled = await this.preferencesService.resolveEnabled(userId, type, channel);
if (!enabled) {
  await this.notificationsService.markSuppressedByPreference(notificationId);
  return; // não roteia o canal
}
```

- `markSuppressedByPreference`: `UPDATE notifications SET status='failed',
  metadata = metadata || '{"reason":"user_preference"}'::jsonb WHERE id=$1`
  (via `withTenantTx`).
- **`type` no worker**: o `NotificationJobPayloadSchema`
  (`packages/types/src/notification.ts:64`) NÃO carrega `type`. DECISÃO:
  adicionar campo `type: NotificationTypeSchema` ao payload (aditivo) +
  atualizar snapshot, e setá-lo no `DigestService.enqueue` (já tem `type` em
  mãos). Evita SELECT extra por job. Compat: jobs antigos sem `type` →
  fallback SELECT da linha (defensivo).

### Camada 4 — Frontend (`apps/web`)

- Rota: `apps/web/app/(authenticated)/configuracoes/notificacoes/page.tsx`
  (Client Component — toggles interativos + TanStack Query).
- Componentes: lista dos 7 tipos × 2 toggles; rótulos/descrições de
  `pt-BR.json` (data-model.md §3.1). Toggle otimista: muda já, reverte em erro
  da API + toast PT-BR.
- Toggle `pastoral_alert.inApp` para Líder: `disabled` + tooltip "Alertas
  pastorais no app não podem ser desativados".
- Data fetching: TanStack Query (`useQuery` GET, `useMutation` PATCH com
  optimistic update + rollback `onError`).
- Migração "silenciar" (research.md D8): ao montar a página, se
  `localStorage['metanoia:notificationSilence']` existe → banner + modal
  (1ª visita). "Manter silenciado" → PATCH all `inApp:false` + remove key;
  "Configurar por tipo" → remove key + defaults. Master override respeitado
  enquanto a key existir.
- i18n: adicionar rótulos/descrições/textos do banner+modal em
  `apps/web/messages/pt-BR.json`.

### Camada 5 — Mudança de papel (US4)

Sem listener Keycloak. Enforcement lazy já cobre: GET reflete papel do token,
PATCH rejeita, worker lê DB. "Recálculo" = consequência natural de ler o papel
corrente a cada request/job. Promoção→Líder: `pastoral_alert.inApp` aparece
forçado `true` no próximo GET. Rebaixamento: vira toggle editável. Outras
preferências preservadas (nunca tocadas pelo enforcement).

---

## Segurança (OWASP — gate owasp-security obrigatório, 0 high/critical)

1. **IDOR/BOLA**: rota `/users/me/...` sem `:userId`; userId SEMPRE de
   `getRequestContext()`. Impossível operar prefs de outro usuário por path.
2. **Tenant isolation**: RLS na tabela + todo acesso via `withTenantTx`
   (`SET LOCAL app.current_tenant_id`). Teste RLS obrigatório.
3. **Validação de input**: `notification_type`/`channel` validados contra
   enum via `ZodValidationPipe` + `.strict()` → **400 Bad Request** antes de
   tocar DB (FR-004). NOTA: o `ZodValidationPipe` do projeto lança
   `BadRequestException` (400), não 422 — o 422 é só para a regra do Líder.
   Sem texto livre em `metadata` (só constante server-side
   `reason='user_preference'` — sem superfície stored-XSS, research.md D9).
4. **Enforcement Líder**: 422 inviolável via API (SC-005). Worker fail-safe
   (entrega a mais, nunca a menos para `pastoral_alert.inApp`).
5. **Cache poisoning**: chave derivada só de `userId` autenticado; valor é
   JSON server-controlled; TTL curto; fallback DB.
6. **SQL injection (A05)**: todo acesso ao DB usa `$N::uuid`/`$N` bind params
   (espelha `notifications.service.ts:64`), NUNCA interpolação de input do
   usuário. A única interpolação no caminho é o `tenant_id` no `SET LOCAL` de
   `withTenantTx`, já validado contra `UUID_RE` antes de interpolar
   (`with-tenant-tx.ts:56`) — defense-in-depth confirmada no recon.

---

## Cenários de Teste (mapeados a AC/FR/SC)

### Unit (Zod) — Task 2/9
- T-U1: payload PATCH válido parcial → parse OK (FR-004).
- T-U2: `notification_type` desconhecido → ZodError → 400 via ZodValidationPipe (FR-004, edge case). [422 é só p/ Líder]
- T-U3: canal fora de `{inApp,email}` → ZodError (FR-004).
- T-U4: snapshot do schema estável (FR-011).

### Integração backend — Task 9
- T-I1: PATCH `{meeting_reminder:{email:false}}` → linha UPSERT no DB →
  cache invalidado → GET reflete; outros tipos intactos (US1, FR-001/002).
- T-I2: GET sem linhas → todos defaults true (FR-003, US1 AC3).
- T-I3: pipeline: pref `email=false` p/ tipo → worker NÃO chama email channel;
  notificação criada `status='failed', metadata.reason='user_preference'`
  (US2, FR-007, SC-002).
- T-I4: Redis down → `resolveEnabled` cai p/ DB + log warn; nenhuma
  notificação dropada (FR-006, SC-006).
- T-I5: cache hit em rajada → 1 ida ao DB, demais do cache (FR-005, SC-003).

### Guard/enforcement — Task 9
- T-G1: Líder PATCH `pastoral_alert.inApp=false` → 422 (US4 AC1, SC-005).
- T-G2: Líder GET → `pastoral_alert.inApp=true` forçado (US4, story AC).
- T-G3: worker, usuário Líder (`user_tenants.role='lider'`), pref
  `pastoral_alert.in_app=false` → in_app ENTREGUE assim mesmo (D3.b).
- T-G4: Participante PATCH `pastoral_alert.inApp=false` → 200, persiste.

### RLS — Task 1
- T-R1: tenant B não enxerga/edita preferência de tenant A (roda 2x).

### E2E frontend — Task 6/9
- T-E1: toggle muda otimista; erro de API → reverte + toast PT-BR (US1 AC2).
- T-E2: toggle Líder `pastoral_alert.inApp` desabilitado + tooltip (US1 AC4).

### Migração "silenciar" — Task 7/9
- T-M1: localStorage silenciar ativo → banner + modal na 1ª visita (US3 AC1/2).
- T-M2: "Manter silenciado" → PATCH all inApp=false + key removida; recarregar
  → sem modal (US3 AC3/5, SC-004).
- T-M3: "Configurar por tipo" → key removida + defaults (US3 AC4).

---

## Sequência de implementação (ordem de tasks sugerida p/ create-tasks)

1. Contratos Zod + snapshot (`packages/types`).
2. Migration + RLS + teste RLS.
3. Service (cache+DB+defaults+enforcement) + controller GET/PATCH + unit/integ.
4. Adicionar `type` ao job payload + integração no worker + teste pipeline.
5. UI página + toggles otimistas + i18n.
6. Fluxo de migração "silenciar".
7. Testes E2E + guard + cobertura final.

> Cada camada é validável local: `pnpm --filter @metanoia/types test`,
> `turbo build` (api+web — lição Epic 14-3: boot da API + Record exaustivo no
> FE), testes RLS Postgres local, suíte web (specs keyboard/touch se a UI
> reusar componentes a11y). Migration NÃO aplicada em prod (gate Paulo).

---

## Fora de escopo (explícito)

- Aplicar migration em produção (gate humano).
- Listener/webhook de troca de papel no Keycloak.
- Novo valor de enum `NotificationStatus` (`suppressed`).
- Push/web-push como canal (apenas `in_app`, `email`).
