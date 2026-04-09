# Story 16.4: Métricas por Integração & Dashboard de Observabilidade (NFR-O4)

Status: ready-for-dev

## Story

As a Super Admin,
I want to see detailed metrics per external integration (success rate, latency, retry rate),
So that I can proactively identify degradation patterns before they impact users.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Task 1: Set up `prom-client` metrics collection (AC: #1)
  - [ ] Install `prom-client` package
  - [ ] Define counter `integration_requests_total` with labels `{ integration, operation, status }`
  - [ ] Define histogram `integration_request_duration_ms` with labels and buckets
  - [ ] Define counter `integration_retries_total` with labels
  - [ ] Restrict `operation` labels to fixed enum set, bucket unlisted as `other`
- [ ] Task 2: Instrument integration calls (AC: #1)
  - [ ] Wrap Resend SDK calls with metrics recording
  - [ ] Wrap Keycloak API calls with metrics recording
  - [ ] Wrap MinIO client calls with metrics recording
  - [ ] Record latency, status, and retry count per call
- [ ] Task 3: Expose `/metrics` endpoint on separate port (AC: #4)
  - [ ] Create separate Express/Fastify server on port 9090
  - [ ] Serve Prometheus exposition format
  - [ ] Protect with IP allowlist or HTTP Basic Auth (`METRICS_AUTH_TOKEN` env var)
- [ ] Task 4: Implement `GET /api/v1/admin/observability/integrations` (AC: #2)
  - [ ] Query Prometheus or materialized summary table
  - [ ] Calculate success rate (1h, 24h, 7d)
  - [ ] Calculate p50/p95/p99 latency
  - [ ] Calculate retry rate
  - [ ] Error breakdown by type
  - [ ] Apply `@Roles('super_admin')` guard
- [ ] Task 5: Implement degradation alerts (AC: #3)
  - [ ] Monitor success rate threshold (default < 95% in 15min)
  - [ ] Create notification for Super Admins via Epic 14 infrastructure
  - [ ] Emit `system.integration.degraded` domain event
  - [ ] De-duplicate: max 1 alert per integration per 30min window
- [ ] Task 6: Build observability dashboard at `/app/admin/observabilidade` (AC: #2)
  - [ ] Per-integration panels: Resend, Keycloak, MinIO
  - [ ] Success rate, latency percentiles, retry rate, error breakdown
  - [ ] Sparkline trend (24h, 5min resolution)
  - [ ] Use TanStack Query for data fetching
- [ ] Task 7: Create Grafana dashboards (AC: #4)
  - [ ] Integration overview dashboard JSON
  - [ ] Per-integration detail dashboard JSON
  - [ ] Latency heatmap dashboard JSON
  - [ ] Store in `infra/grafana/dashboards/`
- [ ] Task 8: Write tests (AC: all)
  - [ ] Unit test: verify metric recording for each integration call
  - [ ] Integration test: 100 Resend calls (50 success, 30 retry, 20 fail) → verify metrics accuracy
  - [ ] Endpoint test: `/metrics` returns valid Prometheus format
  - [ ] Dashboard API test: verify aggregation logic
  - [ ] Alert test: simulate < 95% success → verify notification, verify de-duplication
  - [ ] Security test: `/metrics` port 9090 not accessible from public internet

## Dev Notes

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Cardinality Control
- Operation labels restricted to fixed enum to prevent cardinality explosion
- Unlisted operations bucketed as `other`

### Dependencies
- Epic 14 (notification infrastructure — for Super Admin alerts)
- Story 14.4 (health check — complementary, this story adds detailed metrics)

### Project Structure Notes
- Backend metrics: `apps/api/src/modules/observability/`
  - `metrics.service.ts` — prom-client setup and metric definitions
  - `metrics.server.ts` — separate server on port 9090
  - `integration-metrics.interceptor.ts` — NestJS interceptor for auto-instrumentation
- Admin API: `apps/api/src/modules/admin/observability/`
- Frontend: `apps/web/app/(authenticated)/admin/observabilidade/page.tsx`
- Grafana: `infra/grafana/dashboards/`
- Config: `METRICS_AUTH_TOKEN` env var, port 9090

### References
- Epic source: `_bmad-output/planning-artifacts/epics/epic-16.md` (Story 16.4)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project rules: `docs/project-context.md`
