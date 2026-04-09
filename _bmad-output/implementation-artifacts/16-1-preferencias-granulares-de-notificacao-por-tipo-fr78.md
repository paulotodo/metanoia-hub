# Story 16.1: Preferências Granulares de Notificação por Tipo (FR78)

Status: ready-for-dev

## Story

As a user (Participante or Líder),
I want to configure my notification preferences by type and channel,
So that I receive only the notifications that matter to me, on my preferred channels, across all my devices.

## Acceptance Criteria

**Given** a user accesses `GET /api/v1/users/me/notification-preferences`
**When** the endpoint returns their preferences
**Then** the response contains a preference object per notification type:
  - `pastoral_alert`: { inApp: boolean, email: boolean }
  - `meeting_reminder`: { inApp: boolean, email: boolean }
  - `content_new`: { inApp: boolean, email: boolean }
  - `export_ready`: { inApp: boolean, email: boolean }
  - `system_announcement`: { inApp: boolean, email: boolean }
**And** default values are: all `inApp: true`, all `email: true`
**And** `pastoral_alert` for role Líder has `inApp: true` as non-overridable (Líder MUST receive pastoral alerts in-app — email can be toggled off)

**Given** a user updates their preferences via `PATCH /api/v1/users/me/notification-preferences`
**When** the request body contains partial updates (e.g., `{ meeting_reminder: { email: false } }`)
**Then** only the specified fields are updated (patch semantics, not replace)
**And** the preferences are stored in `notification_preferences` table with `{ user_id, tenant_id, notification_type, channel, enabled, updated_at }`
**And** a Zod schema in `packages/types` validates the request (shared FE+BE contract)
**And** the response returns the full updated preferences object (201 status)

**Given** a user accesses the preferences UI at `/app/configuracoes/notificacoes`
**When** the page renders
**Then** each notification type is displayed with its PT-BR label and description:
  - "Alertas pastorais" — "Quando um participante muda de status no semáforo"
  - "Lembretes de reunião" — "24h antes de uma reunião agendada"
  - "Novo conteúdo" — "Quando uma nova trilha é publicada no seu grupo"
  - "Relatórios prontos" — "Quando um relatório exportado está disponível"
  - "Anúncios do sistema" — "Atualizações e comunicados da plataforma"
**And** each type has toggles for "No app" and "E-mail"
**And** toggles use optimistic UI (update immediately, revert on API error)
**And** the non-overridable `pastoral_alert.inApp` toggle for Líder is visually disabled with tooltip: "Alertas pastorais no app não podem ser desativados"

**Given** the notification pipeline (Epic 14) processes a new notification
**When** it checks the user's preferences
**Then** it queries `notification_preferences` for the user+type+channel combination
**And** if `enabled: false`, the notification is NOT sent via that channel (but IS still created in the `notifications` table with `delivered: false, reason: 'user_preference'`)
**And** preferences are cached in Redis (`cache:notif-prefs:{userId}`, TTL 10min) to avoid DB queries on every notification
**And** cache is invalidated on PATCH
**And** if Redis is unavailable, the pipeline falls back to direct DB query (no notification is silently dropped due to cache miss) — the fallback is logged as a warning for observability

**Given** the old "silenciar" toggle (Epic 14, localStorage) coexists with the new preferences
**When** "silenciar" is active
**Then** it acts as a master override — ALL in-app notifications are suppressed regardless of per-type preferences
**And** the preferences UI shows a banner: "Todas as notificações no app estão silenciadas. Desative o modo silencioso para usar preferências por tipo."
**And** when a user with "silenciar" active accesses the preferences UI for the first time, a migration modal is shown: "Você estava com notificações silenciadas. Deseja manter tudo desativado ou configurar por tipo?" with two actions:
  - "Manter silenciado" → copies state to all `inApp: false` preferences in DB, removes localStorage toggle
  - "Configurar por tipo" → removes localStorage toggle, opens the preferences UI with all defaults (all enabled)
**And** after migration, the localStorage toggle is permanently removed for that user

**Given** a user's role changes (e.g., Líder → Participante or Participante → Líder)
**When** the role change is processed in Keycloak and synced to the application
**Then** non-overridable preferences are recalculated: if the user is no longer Líder, `pastoral_alert.inApp` becomes a regular toggle (user can disable it)
**And** if the user becomes a Líder, `pastoral_alert.inApp` is forced to `true` regardless of previous preference
**And** other preferences are preserved unchanged across role transitions
**And** the user is NOT notified of the automatic preference change (it's a system enforcement, not a user action)

## Tasks / Subtasks

- [ ] Task 1: Create `notification_preferences` table via Prisma migration (AC: #2)
  - [ ] Define model: `id` (UUID v7), `user_id`, `tenant_id`, `notification_type`, `channel`, `enabled`, `updated_at`
  - [ ] Add RLS policy for tenant_id isolation
  - [ ] Add unique index on `(user_id, tenant_id, notification_type, channel)`
  - [ ] Map with `@@map("notification_preferences")`
- [ ] Task 2: Create Zod schemas in `packages/types` (AC: #2)
  - [ ] Define `NotificationPreferencesSchema` (full preferences object)
  - [ ] Define `UpdateNotificationPreferencesSchema` (partial patch)
  - [ ] Add snapshot tests
- [ ] Task 3: Implement preferences API endpoints (AC: #1, #2)
  - [ ] `GET /api/v1/users/me/notification-preferences` — return full preferences with defaults
  - [ ] `PATCH /api/v1/users/me/notification-preferences` — partial update, return full object (201)
  - [ ] Enforce non-overridable `pastoral_alert.inApp` for Líder role (return 422 if attempted)
  - [ ] Apply auth guard
- [ ] Task 4: Implement Redis caching for preferences (AC: #4)
  - [ ] Cache at `cache:notif-prefs:{userId}` with TTL 10min
  - [ ] Invalidate cache on PATCH
  - [ ] Fallback to direct DB query if Redis unavailable (log warning)
- [ ] Task 5: Integrate with notification pipeline (AC: #4)
  - [ ] Check preferences before sending via each channel
  - [ ] If disabled: still create notification record with `delivered: false, reason: 'user_preference'`
- [ ] Task 6: Build preferences UI at `/app/configuracoes/notificacoes` (AC: #3)
  - [ ] Display each type with PT-BR label and description
  - [ ] "No app" and "E-mail" toggles per type
  - [ ] Optimistic UI with revert on API error
  - [ ] Disabled toggle with tooltip for non-overridable pastoral_alert.inApp (Líder)
  - [ ] Use TanStack Query for data fetching, Zustand for toggle state
- [ ] Task 7: Implement "silenciar" migration flow (AC: #5)
  - [ ] Detect localStorage "silenciar" toggle on preferences page load
  - [ ] Show banner when silenciar is active
  - [ ] Show migration modal on first visit
  - [ ] "Manter silenciado": set all inApp=false in DB, remove localStorage
  - [ ] "Configurar por tipo": remove localStorage, show defaults
- [ ] Task 8: Implement role change preference recalculation (AC: #6)
  - [ ] On role sync from Keycloak: recalculate non-overridable preferences
  - [ ] Líder → Participante: pastoral_alert.inApp becomes toggleable
  - [ ] Participante → Líder: pastoral_alert.inApp forced true
  - [ ] Preserve other preferences unchanged
- [ ] Task 9: Write tests (AC: all)
  - [ ] Unit test: Zod schema validation — valid/invalid payloads
  - [ ] Integration test: PATCH → DB state → Redis invalidated → send notification → channel respected
  - [ ] Guard test: Líder tries to disable pastoral_alert.inApp → 422
  - [ ] E2E: toggle UI → optimistic update → API failure → revert
  - [ ] Cache test: Redis TTL and invalidation on update
  - [ ] Coexistence test: silenciar active + preferences → master override wins
  - [ ] Migration test: localStorage "silenciar" → open preferences → "Manter silenciado" → all inApp=false + localStorage removed
  - [ ] Role change test: Líder → Participante → pastoral_alert toggleable; Participante → Líder → forced true

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Epic 14 (notification infrastructure — pipeline integration, "silenciar" toggle migration)
- Epic 2 (auth — Keycloak role sync for preference recalculation)

### Project Structure Notes
- Backend: `apps/api/src/modules/notifications/preferences/`
  - `notification-preferences.service.ts`
  - `notification-preferences.controller.ts`
- Migration: `apps/api/prisma/migrations/YYYYMMDD_add_notification_preferences/`
- Frontend: `apps/web/app/(authenticated)/configuracoes/notificacoes/page.tsx`
- Shared types: `packages/types/src/notifications/preferences.ts`
- Redis: `cache:notif-prefs:{userId}` (TTL 10min)
- i18n: `apps/web/messages/pt-BR.json` — preference labels/descriptions

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-16.md` (Story 16.1)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
