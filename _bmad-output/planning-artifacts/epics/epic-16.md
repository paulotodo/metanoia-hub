## Epic 16: Resiliência, Offline & Expansões Futuras

Épico Post-MVP que agrupa funcionalidades de resiliência operacional, experiência offline, segurança avançada, observabilidade profunda e acessibilidade de conteúdo multimídia. Cada story é independente e pode ser priorizada individualmente — não há dependência sequencial obrigatória entre elas.

**FRs cobertos:** FR78, FR82
**NFRs cobertos:** NFR-S5, NFR-O4, NFR-O5, NFR-A6, NFR-C3, NFR-C5–C7
**Pré-requisito:** Epics 1-14 (infraestrutura core), Epic 15 (acessibilidade avançada — para NFR-A6 legendas)

**Definition of Done (transversal):** Cada story deve incluir documentação operacional (runbook ou seção em docs existentes) descrevendo: como monitorar, como diagnosticar falhas, como reverter em caso de problema.

### Story 16.1: Preferências Granulares de Notificação por Tipo (FR78)

As a user (Participante or Líder),
I want to configure my notification preferences by type and channel,
So that I receive only the notifications that matter to me, on my preferred channels, across all my devices.

**Acceptance Criteria:**

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

**Teste:** Unit test: Zod schema validation — valid/invalid payloads. Integration test: PATCH preferences → verify DB state → verify Redis cache invalidated → send notification → verify channel respected. Guard test: Líder tries to disable pastoral_alert.inApp → 422 with descriptive error. E2E: toggle UI → verify optimistic update → simulate API failure → verify revert. Cache test: verify Redis TTL and invalidation on update. Coexistence test: silenciar active + preferences → verify master override wins. Migration test: user with localStorage "silenciar" → open preferences → select "Manter silenciado" → verify all inApp=false in DB + localStorage removed. Role change test: Líder → Participante → verify pastoral_alert.inApp becomes toggleable; Participante → Líder → verify pastoral_alert.inApp forced true.

### Story 16.2: PWA & Service Worker — Leitura Offline de Conteúdo (FR82)

As a participant,
I want to access previously viewed trail content when I'm offline,
So that I can continue my discipleship journey even without internet connectivity.

**Acceptance Criteria:**

**Given** the application is configured as a PWA
**When** it is loaded for the first time
**Then** a Web App Manifest (`manifest.json`) is served with:
  - `name`: "{tenantName} — Metanoia" (or platform name if no tenant)
  - `short_name`: "Metanoia"
  - `theme_color` and `background_color` from tenant branding (Epic 6), fallback to platform defaults
  - `display`: "standalone"
  - `icons`: 192px and 512px PNG (platform default, tenant-customizable in future)
  - `start_url`: "/app/trilhas"
  - `scope`: "/app/"
**And** the service worker is registered via Workbox directly (custom webpack config in `next.config.js`) — NOT via `next-pwa` wrapper (abandoned library, incompatibility risk with Next.js 16 App Router)

**Given** a participant views a text/document content module while online
**When** the content is rendered
**Then** the service worker caches the page HTML, CSS, JS bundles, and inline images using a Cache-First strategy (network-first for API calls)
**And** only content modules the user has actually visited are cached (NO pre-caching of unvisited content)
**And** cached content respects tenant isolation — cache keys include `tenantId` prefix: `cache:offline:{tenantId}:{moduleId}`
**And** total offline cache is capped at 50MB per user with LRU eviction (oldest accessed content removed first)

**Given** a participant goes offline after having viewed content
**When** they navigate to a previously viewed trail/module
**Then** the cached content is served instantly with a visible offline indicator: banner at top "Modo offline — conteúdo pode estar desatualizado" (icon + text, accessible per Epic 15)
**And** navigation within cached pages works (back/forward, module list)
**And** non-cached pages show a friendly fallback: "Este conteúdo não está disponível offline. Conecte-se para acessá-lo."

**Given** a participant completes progress actions while offline (e.g., marks module as read)
**When** they regain connectivity
**Then** queued actions are synced via Background Sync API (if supported by the browser — Chrome/Edge yes, Safari/Firefox NO) or on next page load as fallback
**And** the Safari/iOS limitation is documented in the PWA section of the user-facing help: "No Safari, o progresso offline será sincronizado na próxima vez que você abrir o app."
**And** conflicts are resolved with last-write-wins (server timestamp)
**And** the user is notified: "Progresso sincronizado. {n} ações atualizadas."
**And** if sync fails after 3 retries, the user is notified: "Não foi possível sincronizar {n} ações. Tente novamente."

**Given** the PWA install prompt (A2HS — Add to Home Screen)
**When** the browser supports it and the user is authenticated
**Then** a non-intrusive install banner appears once per session (dismissible): "Instale o Metanoia para acesso rápido e offline"
**And** after dismissal, the banner does NOT appear again for 30 days (stored in localStorage)
**And** the install option is always available in the user settings menu

**Given** video content modules
**When** cached for offline use
**Then** videos are NOT cached offline (too large) — only text/document/image content
**And** a video module accessed offline shows: "Vídeos não estão disponíveis offline. Conecte-se para assistir."
**And** the module metadata (title, description) IS cached so the user knows what they're missing

**Given** a new version of the application is deployed
**When** the service worker detects a new version (via `updatefound` event)
**Then** the new SW is installed in the background (does NOT activate immediately — avoids breaking the user's current session)
**And** a non-intrusive toast appears: "Nova versão disponível. [Atualizar agora]"
**And** clicking "Atualizar agora" calls `skipWaiting()` + `clients.claim()` and reloads the page
**And** if the user ignores the toast, the new version activates on the next full page load (browser close/reopen)
**And** stale cache entries from the previous SW version are purged on activation (cache versioning via `CACHE_VERSION` constant)

**Teste:** Integration test: visit 3 content modules online → simulate offline (service worker mock) → navigate to cached modules → verify content renders. Cache size test: fill cache to 50MB → visit new module → verify LRU eviction removes oldest. Sync test (split strategy): (a) unit test the sync queue independently — verify actions are queued to IndexedDB when offline, verify queue is drained and API calls made on "online" event; (b) E2E focuses on fallback "on next page load" path (testable in all browsers) — Background Sync API itself is NOT E2E tested (browser engine dependency, not automatable). A2HS test: verify install prompt appears once, respects 30-day cooldown. Tenant isolation test: cache keys include tenantId — switching tenant context does NOT serve wrong content. Video offline test: verify friendly fallback, not broken player. SW update test: deploy new version → verify toast appears → click "Atualizar agora" → verify page reloads with new version → verify stale cache purged. E2E: Playwright with `context.setOffline(true)` for offline simulation.

### Story 16.3: MFA para Papel Líder via Keycloak (NFR-S5)

As a Super Admin,
I want to enforce MFA (TOTP) for all users with the Líder role,
So that pastoral care data is protected by an additional authentication factor.

**Acceptance Criteria:**

**Given** a user is assigned the role Líder in Keycloak
**When** they log in for the first time after MFA enforcement
**Then** Keycloak redirects them to the TOTP setup flow (required action: `CONFIGURE_TOTP`)
**And** the setup page shows: QR code for authenticator app (Google Authenticator, Authy, etc.), manual entry code as fallback, and step-by-step instructions in PT-BR
**And** the user must successfully enter a valid TOTP code to complete setup
**And** after setup, 10 one-time recovery codes are generated and displayed ONCE with a "Copiar todos" button and a warning: "Guarde estes códigos em local seguro. Eles não serão exibidos novamente."

**Given** a Líder with MFA configured logs in
**When** they enter valid credentials
**Then** Keycloak prompts for the TOTP code as a second factor
**And** the TOTP input accepts 6-digit codes with a 30-second window (±1 step tolerance per RFC 6238)
**And** if the code is invalid, the error message says "Código inválido. Tente novamente." (no timing leaks)
**And** after 5 consecutive failed attempts, the account is locked for 15 minutes with message: "Conta temporariamente bloqueada. Tente novamente em 15 minutos."

**Given** a Líder has lost their authenticator device
**When** they click "Usar código de recuperação" on the TOTP screen
**Then** they can enter one of their 10 recovery codes
**And** each recovery code can only be used once (marked as consumed in Keycloak)
**And** after using a recovery code, the user is prompted to set up a new TOTP device
**And** if all 10 recovery codes are consumed, the Líder must contact a Super Admin to reset MFA

**Given** a "break glass" scenario where both the Líder AND Super Admin are locked out
**When** recovery is needed
**Then** a documented procedure exists in `docs/operations/mfa-break-glass.md` describing: direct access to Keycloak Admin Console (separate from the application), steps to reset TOTP credentials for any user, and required infrastructure credentials
**And** the break-glass procedure requires 2-person authorization (infrastructure team, not application-level) to prevent single-point-of-failure
**And** every break-glass access is logged in the audit log as `auth.mfa.break-glass-reset` with the identity of who performed it

**Given** a Super Admin accesses the user management at `/app/admin/usuarios`
**When** they view a Líder's profile
**Then** MFA status is visible: "MFA ativo" / "MFA pendente de configuração"
**And** the Super Admin can reset MFA for the Líder (generates new required action) with a confirmation dialog: "Isso removerá o MFA atual. O líder precisará configurar novamente no próximo login."
**And** a domain event `auth.user.mfa-reset` is emitted and logged in the audit log

**Given** MFA enforcement is configured in Keycloak
**When** the configuration is applied
**Then** MFA is enforced ONLY for the Líder role (not Participante, not Super Admin — Super Admin MFA is a separate future decision)
**And** the Keycloak realm configuration uses conditional authentication flow: `role:lider` → require TOTP
**And** the NestJS auth guard does NOT implement MFA logic — Keycloak handles it entirely (no custom MFA code in the application)

**Teste:** Integration tests use Keycloak Testcontainers (`@testcontainers/keycloak`) with a pre-configured realm export (`test/fixtures/keycloak-realm.json`) — avoids slow Keycloak startup per test suite. Integration test: create user with Líder role → first login → verify TOTP setup redirect. TOTP validation test: valid code → success, expired code → fail, reused recovery code → fail. Lockout test: 5 invalid codes → verify 15min lock → verify unlock after timeout. Super Admin test: reset MFA → verify Líder is prompted again on next login. Role isolation test: Participante login → verify NO MFA prompt. Keycloak config test: verify conditional auth flow targets correct role. Audit test: verify `auth.user.mfa-reset` event logged. Break-glass test: verify procedure documented and audit event emitted. Unit tests for NestJS guards: mock JWT token (MFA is Keycloak's responsibility — NestJS only validates the resulting token).

### Story 16.4: Métricas por Integração & Dashboard de Observabilidade (NFR-O4)

As a Super Admin,
I want to see detailed metrics per external integration (success rate, latency, retry rate),
So that I can proactively identify degradation patterns before they impact users.

**Acceptance Criteria:**

**Given** the application makes calls to external integrations (Resend, Keycloak, MinIO)
**When** each call completes (success or failure)
**Then** a metric is recorded with dimensions: `{ integration_name, operation, status, latency_ms, timestamp }`
**And** metrics are collected via `prom-client` (Prometheus client for Node.js) as histograms and counters:
  - `integration_requests_total` (counter): labels `{ integration, operation, status }`
  - `integration_request_duration_ms` (histogram): labels `{ integration, operation }`, buckets `[50, 100, 250, 500, 1000, 2500, 5000, 10000]`
  - `integration_retries_total` (counter): labels `{ integration, operation }`
**And** `operation` labels are restricted to a fixed enum set to prevent cardinality explosion (memory leak): `['send_email', 'verify_token', 'refresh_token', 'upload_object', 'get_object', 'delete_object', 'get_user', 'create_user']` — any unlisted operation is bucketed as `other`
**And** a `/metrics` endpoint (Prometheus format) is exposed on a separate port (9090) — NOT on the public API port

**Given** a Super Admin accesses the observability dashboard at `/app/admin/observabilidade`
**When** the page loads
**Then** it displays per-integration panels for: Resend (email), Keycloak (auth), MinIO (storage)
**And** each panel shows:
  - Success rate (%) — last 1h, 24h, 7d (calculated from `integration_requests_total`)
  - p50 / p95 / p99 latency — last 1h (from histogram)
  - Retry rate (%) — retries / total requests
  - Error breakdown by type (timeout, 4xx, 5xx, network)
  - Sparkline trend (last 24h, 5min resolution)
**And** data is fetched from a backend endpoint `GET /api/v1/admin/observability/integrations` that queries Prometheus (or reads from a materialized summary table if Prometheus is not available in deployment)

**Given** an integration's success rate drops below a configurable threshold
**When** the threshold is crossed (default: < 95% success in 15min window)
**Then** an alert is created for Super Admins via the notification system (Epic 14)
**And** the alert includes: integration name, current success rate, error sample, and link to the dashboard
**And** a domain event `system.integration.degraded` is emitted
**And** the alert is de-duplicated: only one alert per integration per 30min window

**Given** the metrics endpoint is scraped
**When** a Prometheus instance (or compatible scraper) connects
**Then** all metrics are exported in standard Prometheus exposition format
**And** the `/metrics` endpoint is protected by IP allowlist (only Prometheus scraper IPs) or HTTP Basic Auth (credentials via environment variable `METRICS_AUTH_TOKEN`) — defense in depth beyond port separation
**And** default Grafana dashboards are provided as JSON files in `infra/grafana/dashboards/` for import
**And** dashboards include: integration overview, per-integration detail, latency heatmap

**Teste:** Unit test: verify metric recording for each integration call (mock integration → verify counter/histogram incremented). Integration test: trigger 100 Resend calls (50 success, 30 retry, 20 fail) → verify metrics accuracy. Endpoint test: `/metrics` returns valid Prometheus format (parse with prom-client parser). Dashboard API test: verify aggregation logic (success rate, percentiles). Alert test: simulate < 95% success rate → verify notification created, verify de-duplication (second breach within 30min → no second alert). Security test: `/metrics` port 9090 is NOT accessible from public internet (infrastructure config).

### Story 16.5: Tracing Distribuído entre Serviços (NFR-O5)

As a developer or Super Admin,
I want distributed tracing across all service boundaries,
So that I can trace a request end-to-end and quickly identify bottlenecks or failures.

**Acceptance Criteria:**

**Given** the NestJS application is instrumented with OpenTelemetry
**When** the application starts
**Then** the OpenTelemetry SDK is initialized with:
  - `@opentelemetry/sdk-node` with auto-instrumentation for: HTTP, Express/Fastify, Prisma, BullMQ, Redis (ioredis)
  - `service.name`: "metanoia-api"
  - `service.version`: from `package.json`
  - `deployment.environment`: from `NODE_ENV`
**And** the SDK is configured via environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`) — no hardcoded endpoints

**Given** an HTTP request arrives at the API
**When** it is processed through guards, pipes, controllers, services, and repositories
**Then** a root span is created with: `http.method`, `http.url`, `http.status_code`, `user.id` (if authenticated), `tenant.id`
**And** child spans are created for: database queries (Prisma), Redis operations, BullMQ job dispatch, external HTTP calls (Resend, Keycloak)
**And** each span includes: `span.kind`, duration, status, and relevant attributes (e.g., `db.statement` for Prisma — sanitized with parameter values replaced by `?` placeholders to prevent PII leakage, `messaging.destination` for BullMQ)
**And** span filtering is configured to reduce noise: health check endpoints (`/health`, `/ready`) are excluded from tracing, and Prisma spans for simple `SELECT 1` keep-alive queries are dropped
**And** OTLP export batch size is limited to 512 spans per batch with 5s flush interval to prevent network saturation under high load
**And** `tenant_id` is propagated as a span attribute on ALL spans (for filtering by tenant in the tracing UI)

**Given** a Next.js SSR request makes API calls to NestJS
**When** the Server Component or `fetch` call is executed during SSR
**Then** the Next.js instrumentation (`instrumentation.ts` file, Next.js 16 native support) initializes OpenTelemetry with `service.name: "metanoia-web"`
**And** the `traceparent` header is propagated from the SSR request to the NestJS API call via `fetch` headers (W3C Trace Context propagation)
**And** this creates a true end-to-end trace: Browser → Next.js SSR → NestJS API → Prisma/Redis/BullMQ
**And** the SSR span includes: `http.url`, `http.method`, `next.route`, `next.rsc` (boolean), `tenant.id`

**Given** a BullMQ job is dispatched from an HTTP request
**When** the worker processes the job
**Then** the trace context (W3C `traceparent` header) is propagated via the job's `data` field: `{ ..., _traceContext: { traceparent, tracestate } }`
**And** the worker creates a linked span that continues the original trace
**And** the worker span includes: `job.name`, `job.id`, `job.attemptsMade`, `queue.name`

**Given** traces are exported
**When** the OTLP exporter sends data
**Then** traces are exported to the configured OTLP endpoint (Jaeger, Tempo, or any OTLP-compatible backend)
**And** in development, traces can also be viewed via `@opentelemetry/exporter-console` (enabled via `OTEL_TRACES_EXPORTER=console`)
**And** sampling is configured: 100% in dev, 10% in production (configurable via `OTEL_TRACES_SAMPLER_ARG`)

**Given** an error occurs during request processing
**When** the span records the error
**Then** the span status is set to `ERROR`
**And** `exception.type`, `exception.message`, and `exception.stacktrace` are recorded as span events
**And** the `correlation_id` from the request (already in logs from Epic 7) is added as a span attribute for log-trace correlation

**Teste:** Integration test: send HTTP request → verify root span created with correct attributes. Trace propagation test: HTTP request → dispatches BullMQ job → verify worker span is linked to original trace via `traceparent`. Prisma span test: execute a query → verify child span with `db.statement`. Error test: trigger a 500 error → verify span status ERROR with exception details. Sampling test: configure 50% sampling → send 100 requests → verify ~50 traces exported (±10%). Console exporter test: set `OTEL_TRACES_EXPORTER=console` → verify traces printed to stdout. Tenant isolation: verify `tenant_id` attribute present on all spans.

### Story 16.6: Legendas & Transcrição de Vídeo (NFR-A6)

As a content creator (Líder or Admin),
I want to upload subtitles for video content and have them displayed to participants,
So that video content is accessible to users who are deaf, hard of hearing, or in sound-sensitive environments.

**Acceptance Criteria:**

**Given** a content creator edits a video module in the trail editor
**When** they access the subtitle section
**Then** an upload area accepts subtitle files in VTT format (WebVTT — the web standard, NOT SRT)
**And** the upload validates: file extension `.vtt`, file size <= 1MB, valid WebVTT syntax (parser validates `WEBVTT` header and at least one cue)
**And** if validation fails, a descriptive error is shown: "Arquivo inválido. Use formato WebVTT (.vtt) com tamanho máximo de 1MB."
**And** cue text content is sanitized on upload: all HTML tags are stripped (WebVTT allows `<b>`, `<i>`, `<u>`, `<c>` tags but they can be abused for XSS via `<c.class>` or malformed tags) — only plain text is stored
**And** multiple language tracks can be uploaded per video, each with a `lang` label (e.g., "Português", "English", "Libras")

**Given** a subtitle file is uploaded successfully
**When** it is stored
**Then** the file is uploaded to MinIO/S3 under `{tenantId}/subtitles/{moduleId}/{lang}.vtt`
**And** a record is created in `module_subtitles` table: `{ module_id, tenant_id, language, file_key, uploaded_by, created_at }`
**And** the subtitle file URL is a signed URL (1h expiry) served via `GET /api/v1/modules/{moduleId}/subtitles/{lang}`
**And** tenant isolation is enforced via RLS — a tenant cannot access another tenant's subtitle files

**Given** a participant views a video module that has subtitles
**When** the Plyr player (defined in Epic 15 Story 15.4) loads
**Then** subtitle tracks are loaded as `<track kind="subtitles" src="{vttUrl}" srclang="{lang}" label="{langLabel}">`
**And** the first available track matching the user's browser language is enabled by default (if no match, subtitles are off by default)
**And** the user can toggle subtitles on/off and switch between language tracks via the player's CC button
**And** subtitle styling uses platform defaults (white text, semi-transparent dark background) — no custom CSS overrides that could break readability

**Given** a participant wants to read the full transcript
**When** they click "Ver transcrição" below the video player
**Then** the WebVTT file is parsed and displayed as a scrollable text block with timestamps
**And** each cue is a clickable element: clicking a timestamp seeks the video to that position
**And** the transcript is searchable via a text input: "Buscar na transcrição" with highlight of matching terms
**And** the transcript section is accessible: `role="region"` with `aria-label="Transcrição do vídeo"`

**Given** a video module has NO subtitles uploaded
**When** the module is displayed
**Then** no CC button appears in the player (clean UI — don't show a button that does nothing)
**And** an admin-facing indicator (not visible to participants) flags: "Este módulo não possui legendas" in the content management list, similar to the `has_missing_alt_text` flag from Epic 15

**Given** a video module with subtitles is deleted (soft-delete)
**When** the module enters soft-delete state
**Then** the subtitle records in `module_subtitles` are soft-deleted alongside the module (cascade)
**And** after the soft-delete retention period (30 days), a cleanup job hard-deletes the `module_subtitles` records AND the VTT files from MinIO/S3 (`{tenantId}/subtitles/{moduleId}/`)
**And** no orphan VTT files remain in storage after cleanup

**Teste:** Upload test: valid VTT → success, invalid format → descriptive error, oversized file → size error. XSS test: upload VTT with `<script>` in cue text → verify tags are stripped on storage. Plyr integration test: load video with 2 subtitle tracks → verify `<track>` elements rendered → toggle CC → verify display. Transcript test: parse VTT → verify all cues displayed → click timestamp → verify video seeks. Search test: search term in transcript → verify highlights. RLS test: tenant A uploads subtitle → tenant B cannot access via API. Cascade delete test: soft-delete module → verify subtitle records soft-deleted → advance 30 days (mock) → verify VTT files removed from MinIO. E2E: upload subtitle → view as participant → enable CC → view transcript → search → click timestamp.

### Story 16.7: Resiliência Operacional — Backup, Restore & Disaster Recovery (NFR-C3, NFR-C5–C7)

As a Super Admin or operations engineer,
I want documented and tested backup, restore, and disaster recovery procedures,
So that the platform can recover from data loss or infrastructure failures within acceptable RPO/RTO targets.

**Acceptance Criteria:**

**Given** a post-mortem process is needed (NFR-C3)
**When** an incident causes downtime > 30 minutes
**Then** a post-mortem template exists at `docs/operations/post-mortem-template.md` with sections:
  - Incident summary (what happened, duration, impact scope)
  - Timeline (detection → response → mitigation → resolution)
  - Root cause analysis (5 Whys or Fishbone)
  - Action items with owners and deadlines
  - Lessons learned
**And** the template is pre-filled with metadata fields: `incident_id`, `date`, `duration`, `severity` (P1-P4), `affected_tenants`
**And** completed post-mortems are stored in `docs/operations/post-mortems/` with naming convention `YYYY-MM-DD-incident-slug.md`

**Given** MinIO/S3 storage is configured (NFR-C5)
**When** objects are stored
**Then** bucket versioning is enabled for buckets containing: user uploads, content media, subtitle files, exported reports
**And** a lifecycle policy retains versions for 90 days, then deletes non-current versions
**And** versioning is NOT enabled for temporary/cache buckets (e.g., `tmp-exports`) to avoid unnecessary storage costs
**And** the versioning configuration is defined in IaC (Terraform/Pulumi or Docker Compose for dev) — not manual bucket settings

**Given** a database restore needs to be performed (NFR-C6)
**When** the restore procedure is executed
**Then** a restore script exists at `scripts/db-restore.sh` that:
  - Takes parameters: `backup_file`, `target_db`, `--dry-run` (validates without executing)
  - Validates backup integrity (checksum verification)
  - Restores to a temporary database first (not directly to production)
  - Runs a verification query set (`scripts/db-verify-restore.sql`): row counts for critical tables, latest timestamp sanity check, RLS policies present
  - Only swaps to production after verification passes
**And** a restore test is executed and documented at least once before Release 1b gate, using a seed database of at least 1GB (representative volume: ~5 tenants, ~1000 users, ~50 groups, ~200 trails with content) to validate performance under realistic data volume
**And** the restore script checks available disk space before starting (requires 2x backup size free) and fails with a clear error if insufficient: "Espaço em disco insuficiente. Necessário: {required}GB, disponível: {available}GB"
**And** the test results are stored in `docs/operations/restore-test-results/YYYY-MM-DD-restore-test.md` including: backup size, restore duration, verification results, disk usage

**Given** a disaster recovery scenario occurs (NFR-C7)
**When** the operations team needs to recover the platform
**Then** a DR runbook exists at `docs/operations/disaster-recovery-runbook.md` covering:
  - **Scenario 1: Database corruption/loss** — restore from backup (RPO ≤ 1h R1, ≤ 15min R2, RTO ≤ 4h)
  - **Scenario 2: Object storage loss** — restore from versioned objects + backups (RPO ≤ 24h, RTO ≤ 8h)
  - **Scenario 3: Full infrastructure failure** — rebuild from IaC + restore data (RTO ≤ 8h)
  - **Scenario 4: Keycloak corruption** — realm export/import procedure
  - **Scenario 5: Redis data loss** — cache rebuild strategy (ephemeral data, no backup needed, but document warm-up procedure)
**And** each scenario includes: step-by-step commands, expected duration, verification steps, rollback procedure
**And** the runbook is tested at least once before Release 1b gate (tabletop exercise or actual DR drill)
**And** test results are documented in `docs/operations/dr-test-results/YYYY-MM-DD-dr-drill.md`

**Given** a BullMQ scheduled job monitors backup health
**When** it runs daily at 03:00 UTC
**Then** it first checks if a backup is currently in progress (via a `backup_status` key in Redis: `{ status: 'running' | 'completed' | 'failed', started_at, completed_at }`)
**And** if a backup is in progress, it reports "backup em andamento" (NOT failure) and skips the age check
**And** if no backup is in progress, it verifies: latest PostgreSQL backup exists and is < 25h old, latest MinIO backup exists, backup file size is within expected range (not empty/truncated)
**And** if any check fails, a `system.backup.health-failed` domain event is emitted and Super Admins are notified: "⚠️ Verificação de backup falhou: {details}"
**And** the job runs as a BullMQ repeatable job (consistent with Epic 14 health check pattern)

**Given** the restore script needs ongoing validation (not just a one-time gate)
**When** CI runs monthly (or on any migration that alters schema)
**Then** a CI job executes `scripts/db-restore.sh --dry-run` against a fresh backup to validate the script still works with the current schema
**And** if the dry-run fails, the CI pipeline reports a warning (not blocking, but visible) and creates a notification for the operations team
**And** full restore tests (non-dry-run) are executed quarterly and documented

**Teste:** Post-mortem template test: verify template renders correctly with all sections, metadata fields are fillable. Versioning test: upload object → upload new version → verify both versions exist → verify lifecycle deletes after 90 days (mock time). Restore script test: create backup (seed ≥ 1GB) → corrupt test DB → run restore with --dry-run → run actual restore → verify data integrity → verify disk space check. DR runbook test: tabletop walkthrough of each scenario — verify commands are current and work against staging environment. Backup health job test: mock backup present → verify success, mock backup missing → verify alert, mock backup in progress → verify "em andamento" status (not false alarm). Dry-run CI test: verify monthly dry-run executes against current schema. Security test: restore script requires Super Admin credentials, not accessible from application runtime.
