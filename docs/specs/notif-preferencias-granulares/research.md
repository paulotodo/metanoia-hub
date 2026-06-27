# Research — Preferências Granulares de Notificação por Tipo

**Feature**: `notif-preferencias-granulares`
**Plan companion**: `plan.md`, `data-model.md`

Achados de reconhecimento contra o código REAL de `/var/lib/metanoia-hub`.
Cada decisão cita o símbolo/arquivo/linha verificado. Nada inventado.

---

## D1 — Enums reais (NÃO usar nomes da story literalmente)

**Arquivo**: `packages/types/src/notification.ts`
- `NotificationTypeSchema = z.enum([...])` (l.5), 7 valores: `pastoral_alert`,
  `group_message`, `content_update`, `meeting_reminder`, `system`,
  `export_ready`, `content_new`.
- `NotificationChannelSchema = z.enum(['in_app','email'])` (l.24).
- `NotificationStatusSchema = z.enum(['pending','sent','failed','read'])` (l.27).

**Decisão**: a story citava `system_announcement` (não existe) e 5 tipos.
A spec/plan usam o enum REAL (`system`) e a UI cobre os 7 tipos. Os schemas
Zod novos das preferências DERIVAM de `NotificationTypeSchema`/
`NotificationChannelSchema` (reuso, não redefinição) — gate snapshot
(`packages/types`) protege contra drift.

---

## D2 — Tabela `notifications` NÃO ganha colunas

**Arquivo**: `apps/api/prisma/schema.prisma`, model `Notification`. Colunas:
`id, tenantId, userId, type, channel, status, title, body, metadata(JSONB),
readAt, createdAt, updatedAt`. **Não existem** `delivered` nem `reason`.

**Decisão (dec-010)**: supressão por preferência = `status='failed'` +
merge `metadata` `{ "reason": "user_preference" }`. Justificativa: enum
`NotificationStatus` não tem `suppressed`; criar valor exigiria migration de
enum e quebraria o `Record` exaustivo no FE (lição Epic 14-3). Reuso de
`status` + `metadata` honra "NÃO alterar notifications".

> Read-back loop (K=4) confirmou: `metadata` é JSONB no Prisma
> (infra-notificacoes/onda-002) — o merge de `reason` é seguro.

---

## D3 — Enforcement lazy do Líder: ONDE o papel é lido (dois caminhos)

O papel NÃO está em `RequestContext` (só `tenantId, userId, requestId,
correlationId` — `apps/api/src/common/context/request-context.ts:3`). Há
DOIS contextos distintos:

### D3.a — Caminho HTTP (GET/PATCH): papel vem do TOKEN
`AuthenticatedUser` (`apps/api/src/auth/interfaces/authenticated-user.interface.ts`)
tem `roles: (Role|string)[]`. `Role.LIDER = 'lider'`
(`apps/api/src/auth/enums/role.enum.ts:23`). O controller lê via
`@CurrentUser()`/`request.user`. Logo GET reflete o enforcement e PATCH
rejeita (422) com base no papel do TOKEN corrente — "pull-from-token", sem
listener Keycloak (alinha com Decisão de spec #3).

### D3.b — Caminho WORKER (roteamento BullMQ): papel vem do DB
O `NotificationsWorker` (`apps/api/src/notifications/notifications.worker.ts`)
processa job BullMQ — NÃO há `request.user`. `NotificationJobPayload`
(`packages/types/src/notification.ts:64`) carrega só
`notificationId, tenantId, userId, channel, correlationId` — sem papel.

**Decisão (dec-009, score 3 — empírica)**: o worker resolve o papel via
LOOKUP no DB `user_tenants.role` para `(user_id, tenant_id)`. Evidência:
`schema.prisma:197` model `UserTenant { ... role String @default("participante") }`.
Opções rejeitadas: (a) carregar roles no payload — infla payload e fica
stale entre enqueue e processamento; (c) Keycloak admin API — não há método
inverso (roles-by-user; só `getUsersByRealmRole`), +200-500ms/job.

> O lookup é tenant-scoped (RLS via `withTenantTx`). `user_tenants.role`
> reflete o papel no tenant — fonte de verdade do DB. Se um dia divergir do
> token, o caminho HTTP (token) e o worker (DB) podem discordar; aceitável:
> ambos são "best-effort lazy" e o pior caso para `pastoral_alert.inApp` é
> entregar a mais (fail-safe pastoral), nunca a menos.

---

## D4 — Ponto de integração na pipeline (antes do ChannelRouter)

`notifications.worker.ts`: `requestContext.run({tenantId,userId,...}, async () => {`
(l.112-114) e logo após `const channelImpl = this.channelRouter.route(channel)`
(l.115) → `channelImpl.send({...})` (l.119).

**Decisão**: inserir a checagem de preferência ENTRE l.114 e l.115 (já dentro
do `requestContext.run`, antes do `route`). Fluxo:
1. resolver preferência `(userId, type, channel)` (cache→DB).
2. aplicar enforcement Líder (D3.b) sobre `pastoral_alert + in_app`.
3. se `enabled === false`: atualizar a notificação para
   `status='failed'`, `metadata += {reason:'user_preference'}` e RETORNAR
   (não chamar `channelRouter.route`).
4. senão: seguir o fluxo existente (route + send).

> O `type` da notificação não está no `NotificationJobPayload` atual — o
> worker já carrega `notificationId`; o type é lido da linha `notifications`
> (o worker provavelmente já a carrega para `send`). plan.md detalha: se o
> type não estiver disponível no worker sem custo, adicionar `type` ao
> payload (campo aditivo no `NotificationJobPayloadSchema`, com snapshot
> test atualizado) é a via preferida vs. SELECT extra.

---

## D5 — Cache Redis (RedisService = ioredis cru)

`apps/api/src/redis/redis.service.ts`: `RedisService extends Redis` (ioredis).
Sem wrapper — chamar `.get/.set/.del` direto. Padrão de TTL observado:
`set(key, val, 'EX', seconds[, 'NX'])` (`last-seen.interceptor.ts`,
ex. `rt:lastseen:{tenantId}:{userId}` TTL 900s).

**Decisão**: chave `cache:notif-prefs:{userId}` (namespace `cache:`), valor =
JSON do objeto resolvido (pós-defaults, PRÉ-enforcement de papel), TTL 600s
(`'EX', 600`). Invalida via `del` no PATCH. Try/catch em torno de toda op
Redis → on error: `logger.warn` + fallback DB (SC-006: nunca dropar).

> NÃO cachear o resultado pós-enforcement (depende do papel corrente);
> aplicar enforcement após ler do cache.

---

## D6 — Padrões de service/controller a espelhar

- Controller: `notifications.controller.ts` — `@Controller('api/v1/notifications')`,
  `@UseGuards(KeycloakAuthGuard)`, `@ApiBearerAuth()`. BOLA-safe: userId SEMPRE
  de `getRequestContext().userId`, NUNCA de path/query/body.
- O novo controller usa rota `/api/v1/users/me/notification-preferences`
  (escopo `/users/me` → IDOR-safe por construção; sem `:userId` no path).
- Service + RLS: `withTenantTx(this.prisma, (tx) => tx.$queryRawUnsafe(...))`
  (`apps/api/src/prisma/with-tenant-tx.ts`; faz `SET LOCAL
  app.current_tenant_id`). Espelhar `NotificationsService.findByUser`.
- Validação: `ZodValidationPipe` custom (`apps/api/src/common/pipes/zod-validation.pipe.ts`)
  — sem libs de validação de terceiros.

---

## D7 — ID = generateId() (uuidv7)

`packages/types/src/id.ts`: `generateId()` → `uuidv7()`. Exportado de
`@metanoia/types`. A nova tabela usa `id @db.Uuid` sem `@default` e o service
faz `INSERT ... $1::uuid` com `generateId()` (regra do projeto; proíbe
`@default(uuid())` do Prisma).

---

## D8 — "Silenciar" (frontend) → migração para DB

`apps/web/src/hooks/use-notification-silence.ts`: key localStorage
`'metanoia:notificationSilence'`; estado boolean (`silenced`/`setSilenced`),
SSR-safe, sync cross-tab via evento `storage`. Master override: quando
`silenced`, suprime TODAS as in-app (Epic 14).

**Decisão**: migração one-time disparada na 1ª visita a
`/app/configuracoes/notificacoes` quando a key existe → banner + modal
("Manter silenciado" → PATCH all `in_app=false`; "Configurar por tipo" →
remove key, defaults). Após qualquer caminho, remover a key (migração
permanente). O master override permanece respeitado enquanto a key existir.

---

## D9 — Read-back loop (memória cross-feature)

K=4 achados injetados (dec-008). Relevantes:
- `metadata` é JSONB (Prisma Json → JSONB) — confirma D2.
- Finding owasp MEDIUM prévio: `metadata` via `z.record(z.string(),
  z.unknown())` + `actionUrl` = vetor stored-XSS/open-redirect. **Aplicação
  aqui**: o merge `metadata.reason='user_preference'` é valor controlado pelo
  servidor (constante), NÃO input do usuário — sem superfície XSS adicional.
  O gate owasp deve confirmar que nenhum campo de preferência alimenta
  `metadata` com texto livre do usuário.

---

## Riscos & mitigações

| Risco | Mitigação |
|-------|-----------|
| Worker sem `type` no payload | Adicionar `type` ao `NotificationJobPayloadSchema` (aditivo + snapshot) OU SELECT da linha; plan.md decide pelo aditivo. |
| Drift token (HTTP) vs DB (worker) p/ papel | Aceito; fail-safe pastoral (entregar a mais). Documentado em D3. |
| Cache stale após mudança de papel | Enforcement é pós-cache (papel resolvido por request/job), não cacheado. |
| Quebra de contrato FE/BE | Schemas Zod compartilhados + snapshot tests (gate). |
| Migration em prod | FORA de escopo — gate humano (Paulo) pós-merge. |
