# Story 16.2: PWA & Service Worker — Leitura Offline de Conteúdo (FR82)

Status: ready-for-dev

## Story

As a participant,
I want to access previously viewed trail content when I'm offline,
So that I can continue my discipleship journey even without internet connectivity.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Create Web App Manifest (AC: #1)
  - [ ] Create dynamic `manifest.json` with tenant branding
  - [ ] Configure icons: 192px and 512px PNG
  - [ ] Set `start_url`, `scope`, `display: standalone`
- [ ] Task 2: Set up Workbox service worker (AC: #1)
  - [ ] Configure Workbox directly in `next.config.js` (NOT next-pwa)
  - [ ] Register service worker on app load
  - [ ] Configure Cache-First for static assets, Network-First for API calls
- [ ] Task 3: Implement content caching with tenant isolation (AC: #2)
  - [ ] Cache HTML, CSS, JS, and inline images for visited modules
  - [ ] Cache keys with tenantId prefix: `cache:offline:{tenantId}:{moduleId}`
  - [ ] 50MB cap with LRU eviction
  - [ ] NO pre-caching of unvisited content
- [ ] Task 4: Implement offline fallback UI (AC: #3)
  - [ ] Offline banner: "Modo offline — conteúdo pode estar desatualizado" (accessible)
  - [ ] Non-cached page fallback: "Este conteúdo não está disponível offline."
  - [ ] Navigation within cached pages (back/forward)
- [ ] Task 5: Implement offline action queue and sync (AC: #4)
  - [ ] Queue progress actions (mark as read) in IndexedDB when offline
  - [ ] Sync via Background Sync API (Chrome/Edge) or on page load (Safari/Firefox)
  - [ ] Last-write-wins conflict resolution
  - [ ] User notifications for sync success/failure
- [ ] Task 6: Implement A2HS install prompt (AC: #5)
  - [ ] Show non-intrusive install banner once per session
  - [ ] 30-day cooldown after dismissal (localStorage)
  - [ ] Install option in user settings menu
- [ ] Task 7: Handle video content offline (AC: #6)
  - [ ] Exclude video files from caching
  - [ ] Show fallback message for video modules offline
  - [ ] Cache module metadata (title, description) only
- [ ] Task 8: Implement service worker update flow (AC: #7)
  - [ ] Detect new version via `updatefound`
  - [ ] Show toast: "Nova versão disponível. [Atualizar agora]"
  - [ ] `skipWaiting()` + `clients.claim()` on update
  - [ ] Purge stale cache on activation (CACHE_VERSION constant)
- [ ] Task 9: Write tests (AC: all)
  - [ ] Integration: visit 3 modules online → simulate offline → verify cached content renders
  - [ ] Cache size test: fill to 50MB → visit new module → verify LRU eviction
  - [ ] Sync test: unit test sync queue (IndexedDB queue + drain on "online" event); E2E for fallback "on page load" path
  - [ ] A2HS test: install prompt appears once, respects 30-day cooldown
  - [ ] Tenant isolation test: cache keys include tenantId
  - [ ] Video offline test: verify friendly fallback, not broken player
  - [ ] SW update test: deploy new version → toast → click update → reload → stale cache purged
  - [ ] E2E: Playwright with `context.setOffline(true)`

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Technology Decisions
- Workbox directly (custom webpack config) — NOT `next-pwa` (abandoned, Next.js 16 incompatibility)
- Background Sync API for Chrome/Edge, page load fallback for Safari/Firefox
- IndexedDB for offline action queue
- Cache-First for static, Network-First for API

### Dependencies
- Epic 6 (tenant branding — theme colors for manifest)
- Epic 8 (trails — content modules to cache)
- Epic 15 (accessibility — offline indicators must be accessible)

### Project Structure Notes
- Service Worker: `apps/web/public/sw.js` (Workbox generated)
- Workbox config: `apps/web/next.config.js`
- Manifest: `apps/web/app/manifest.ts` (dynamic)
- Offline components: `apps/web/components/offline/`
- Sync queue: `apps/web/lib/offline-sync.ts`

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-16.md` (Story 16.2)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
