# Quickstart / Cenários de Teste: health-check-integracoes

> **CRÍTICO (NFR-TEST-001):** o host É produção. TODOS os probes em testes/CI são MOCKADOS
> (`vi.mock`/`nock` para HTTP, fake clients para Redis/PG, MSW no frontend). NENHUM cenário
> abaixo bate em `metanoia-prod-*` real durante a suíte automatizada.

---

## Cenário 1 — Happy path: dashboard com 5 integrações healthy

1. Super Admin autenticado abre `/app/admin/health`.
2. Frontend dispara `GET /api/v1/admin/health/integrations` (TanStack Query).
3. Backend roda 5 probes em paralelo (`Promise.all`); todas < 1000ms.
4. **Expected:** 200 com `summary { total:5, healthy:5, degraded:0, unhealthy:0 }`; cada card
   com badge verde + latência + "Verificado há X"; latência total < 6s.

## Cenário 2 — Classificação por boundary de latência

1. Mock de probes retornando latências 999ms, 1001ms, 5001ms.
2. **Expected:** 999 → `healthy`; 1001 → `degraded`; 5001 → `unhealthy`. (teste unit
   `health-check.service.spec.ts`).

## Cenário 3 — Probe com erro de rede → unhealthy

1. Mock da probe Resend lançando erro/timeout (`AbortSignal.timeout(5000)` aborta).
2. **Expected:** `status: 'unhealthy'`, `latencyMs` = tempo até o erro, `message`
   sanitizada (sem stack, sem `RESEND_API_KEY`, sem host interno).

## Cenário 4 — 403 para não-Super-Admin (NFR-SEC-002)

1. Usuário autenticado com role `admin_tenant` (não super_admin) chama
   `GET /api/v1/admin/health/integrations`.
2. **Expected:** 403 `{ statusCode: 403, error: "Forbidden", message: "Acesso negado" }`.
   Idem para `/integrations/history`. (teste `health-check.controller.spec.ts`).

## Cenário 5 — Single-execution multi-instância (Redis lock)

1. Simular 2 instâncias do worker disparando o job no mesmo tick.
2. Instância A adquire `SET rt:health-check:lock:integration NX EX 270` (true);
   instância B falha (false).
3. **Expected:** apenas A roda probes e escreve em `integration_health_log`; B faz ack
   silencioso sem escrita. Exatamente 5 linhas inseridas (não 10). (teste
   `health-check.processor.spec.ts` com fake Redis).

## Cenário 6 — Debounce anti-flapping

1. Sequência de 5 checks de uma integração alternando healthy/unhealthy/healthy/unhealthy/unhealthy.
2. **Expected:** notificação só dispara quando `unhealthy` persiste 2 checks consecutivos
   (máx 2-3 notificações na sequência, não 5). Mudança de 1 check não notifica.

## Cenário 7 — Notificação para Super Admins + audit

1. Debounce confirma `resend: healthy → unhealthy`.
2. **Expected:** `getUsersByRealmRole('super_admin')` chamado (mock Keycloak); para cada super
   admin, `NotificationsService.dispatch` chamado dentro de `requestContext.run(...)`; evento
   `system.integration.status-changed` publicado no canal Redis; `AuditService.create` com
   `action: 'INTEGRATION_STATUS_CHANGED'` e `correlation_id`.

## Cenário 8 — ResendHealthPort (circuit breaker)

1. `ResendHealthPort.isHealthy()`:
   - mock 200 → **Expected:** `true`.
   - mock 401 → **Expected:** `true` (conectividade OK, auth issue).
   - mock 500 → **Expected:** `false`.
   - mock timeout → **Expected:** `false` (sem throw — interface MUST NOT throw).
2. Provider `EMAIL_HEALTH_PORT` em `notifications.module.ts` resolve para `ResendHealthPort`
   (não mais `StubEmailHealthPort`). (teste `resend-health.port.spec.ts`).

## Cenário 9 — Sparkline 24h + auto-refresh + stale

1. Dashboard carrega histórico via `GET /history?integration=resend&hours=24` (MSW retorna 288 pts).
2. **Expected:** `<LatencySparkline>` renderiza um `<svg>` com polyline; hover mostra valor+timestamp;
   `motion-safe` (sem animação se `prefers-reduced-motion`); auto-refresh dispara a cada 60s; após
   120s sem refresh bem-sucedido, banner stale amarelo "Dados podem estar desatualizados". (E2E
   `admin-health.e2e-spec.ts`).

## Cenário 10 — Roundtrip End-to-End (obrigatório — anti-drift snake/camel)

1. Subir backend em ambiente de teste isolado (NÃO produção) com banco de teste; semear
   `integration_health_log` com 1 linha via worker (cliente privilegiado).
2. Fazer chamada REAL ao `GET /api/v1/admin/health/integrations/history?integration=resend`
   (não mock, não fixture) e capturar o payload.
3. **Expected:** o shape do payload bate EXATAMENTE com `IntegrationHealthHistoryPointSchema`
   (camelCase: `checkedAt`, `latencyMs` — NÃO `checked_at`/`latency_ms`). O Prisma auto-mapping
   (`@map`) e a query raw do worker referenciam a mesma tabela sem divergência de case.
   Razão: drift snake/camel histórico (40 ondas) só é exposto por roundtrip empírico, não por
   testes que parseiam mocks.

## Cenário 11 — RLS isolation (integration-health-log.rls-spec.ts)

1. **Expected:** cliente privilegiado (DATABASE_URL) escreve com sucesso; sessão de tenant
   normal LÊ (USING true permite); sessão de tenant normal NÃO escreve (sem policy INSERT →
   negado sob RLS).
