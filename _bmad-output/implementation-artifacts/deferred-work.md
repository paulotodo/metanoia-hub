# Deferred Work

## Triage Summary (2026-05-11)

Após Sprint 7 fechado, todos os itens abertos receberam destino. Resumo:

- **Sprint 8 (P0/P1)** — 2 stories novas absorvem os itens críticos:
  - [`2-10-auth-hardening`](./2-10-auth-hardening.md) — audience JWT + secret rotation + Object.freeze guard
  - [`1-9-config-hardening`](./1-9-config-hardening.md) — LoggerModule.forRootAsync + tracesSampleRate env + redact expandido + X-Request-Id
- **Release 1b** — 6 itens (tactical em qualquer story / Sprint 17 Epic 12 / sprint estabilização)
- **Backlog** — 2 itens (defesa hipotética; sem dono claro)
- **Bloqueado por dependência externa** — 3 itens (Google OAuth real + WS/GraphQL guard)

Itens implicitamente resolvidos pelo `withTenantTx` (Story 7-5/7-7) marcados `~~strikethrough~~` abaixo.

---

## Deferred from: code review of story 1-4 (2026-04-09)

- Secret do client `metanoia-api` hardcoded no realm-export.json — configuração de dev apenas, substituir por secret gerado em produção → **Sprint 8 (Story [2-10 auth-hardening](./2-10-auth-hardening.md))**
- ~~`SET LOCAL` em transação pode ser explorado se tenantId não é UUID — fix de SQL injection já aplicado com template literal, validação de formato UUID seria defesa em profundidade~~ ✅ Resolvido em Story 7-5 (`apps/api/src/prisma/with-tenant-tx.ts:53` valida UUID via regex antes do `SET LOCAL`).
- Google OAuth placeholders requerem credenciais reais do Google Cloud Console para teste E2E completo → **Bloqueado por dependência externa**
- Guard HTTP-only: não suporta WebSocket ou GraphQL — fora do escopo do spike, implementar quando necessário → **Bloqueado (aguarda primeira feature WS/GraphQL)**
- `authorization.split(' ')` vulnerável a múltiplos espaços no header — edge case improvável em clients reais → **Backlog (defesa hipotética, sem dono)**
- Teste E2E do Google OAuth — requer credenciais reais, validar quando Google Cloud Console estiver configurado → **Bloqueado por dependência externa**
- APP_GUARD registration order (KeycloakAuthGuard antes de RolesGuard) — funciona na prática mas a ordem não é explícita no código → **Release 1b (tactical em qualquer story)**
- mockClear pattern inconsistente nos testes — apenas um teste faz mockClear, deveria estar no beforeEach para consistência → **Release 1b (tactical em qualquer story)**
- Audience (`aud`) validation no JWT — token `aud` contém `metanoia-web`, API precisa de audience mapper no Keycloak para validar corretamente. Decisão: defer (party mode 3-0 unânime). Resolver em story de auth hardening → **Sprint 8 (Story [2-10 auth-hardening](./2-10-auth-hardening.md)) — P0**

## Deferred from: code review of story-1-5 (2026-04-09)

- ~~Adicionar header X-Request-Id na response do middleware — melhoria de observabilidade para clientes~~ ✅ Resolvido em Story 1-9 (`apps/api/src/common/context/request-context.middleware.ts:24` seta `X-Request-Id` + `X-Correlation-Id` via `res.setHeader` antes do `requestContext.run`).
- Store mutable no guard — considerar Object.freeze() após população para segurança → **Sprint 8 (Story [2-10 auth-hardening](./2-10-auth-hardening.md))**
- ~~LoggerModule.forRoot avaliado em load time — migrar para forRootAsync com ConfigService~~ ✅ Resolvido em Story 1-9 (`app.module.ts:42` usa `LoggerModule.forRootAsync` injetando `ConfigService<EnvConfig, true>`; `pinoLoggerConfig` lê `NODE_ENV` via schema Zod validado).
- tenantId inicializado como '' ao invés de null — alinhar com regra de null explícito → **Release 1b (tactical em qualquer story)**
- ~~SET LOCAL sem transaction boundary no Prisma extension — verificar eficácia do RLS sem $transaction~~ ✅ Resolvido em Story 7-5 (helper `withTenantTx` envolve SET LOCAL e a query no mesmo `$transaction` → mesma conexão garantida) e Story 7-7 (extension legacy `withMultiTenant` deletado, 48 callsites migrados).
- ~~tracesSampleRate hardcoded — tornar configurável via env var SENTRY_TRACES_SAMPLE_RATE~~ ✅ Resolvido em Story 1-9 (helper `parseTracesSampleRate` em `apps/api/src/common/sentry/parse-traces-sample-rate.ts` + entrada `SENTRY_TRACES_SAMPLE_RATE` em `env.validation.ts` e `.env.example`).
- ~~redact config só cobre authorization header — expandir para cookies e outros headers sensíveis~~ ✅ Resolvido em Story 1-9 (`logger.config.ts` redact agora cobre `authorization`, `cookie`, `set-cookie` (req+res), `x-api-key`, `x-csrf-token` — integration test em `test/observability/logger-redact.integration-spec.ts`).

## Deferred from: code review of story 1-8 (2026-04-09)

- jest-axe TypeScript types sem augmentation para vitest — `toHaveNoViolations()` funciona em runtime mas não tem type declarations para vitest. Problema pré-existente em apps/web e packages/ui. → **Release 1b (Sprint 17, Epic 12 acessibilidade)**
- Sem error boundary no NavigationShell — se um ícone lucide falhar, o layout inteiro crasha sem fallback. Escopo geral de resiliência da app. → **Release 1b (Sprint 17, Epic 12 acessibilidade)**

## Deferred from: code review of story-7-4-e2e-happy-path-release-1a (2026-05-10)

- ~~**Bug irmão `KeycloakAdminService.createUserForTenant`** — typo `tenantId` (camelCase) no atributo enviado ao Keycloak, mapper espera `tenant_id` (snake_case). Invited users saem sem `tenant_id` claim.~~ ✅ Resolvido em Story 7-6 (`keycloak-admin.service.ts:158` + 3 regression specs + snapshot test `tenant-claim-mapper.spec.ts`).
- ~~**Concentração arquitetural — helper `withTenant`** — pattern `$transaction + SET LOCAL` duplicado em 4 repos (`groups`, `admin-invites`, `tenant-selection`, `plan-limits`).~~ ✅ Resolvido em Story 7-5 (`apps/api/src/prisma/with-tenant-tx.ts`). Os 7 repos legacy via `prisma.tenant.*` (Story 7-7) ainda usam o extension.
- ~~**`vitest.config.ts` exclude `e2e/**` não declarado** — funcionalmente OK pelo include guard.~~ ✅ Resolvido em Story 7-6 (exclude explícito `['e2e/**', 'node_modules/**', '.next/**']`).
- ~~**ESLint ignora `apps/web/e2e/**` totalmente** — dívida intencional; quando `@playwright/test` for tracked como devDep raiz, restaurar lint.~~ ✅ Resolvido em Story 7-6 (`@playwright/test` promovido para devDep raiz + ignores removidos).
- ~~**`apps/web/e2e/fixtures/auth.fixture.ts` código morto** — fixture `adminPage` exportada mas não consumida.~~ ✅ Resolvido em Story 7-6 (fixture removida; mantido apenas `loginAs`).
- ~~**`apiPost` E2E consome `${E2E_API_URL}` (3001) bypassando rewrites Next**.~~ ✅ Resolvido em Story 7-6 (`E2E_BASE_URL` em api-client + cleanup + spec guard; `E2E_API_URL` removido de env.ts e workflow CI).
- **Cleanup E2E faz DELETE → controller faz revoke (soft delete)** — invites do run ficam como rows revoked. Mitigação atual: reset diário do demo seed em CI. **Deferido para Release 1b** (Story 7-6 dev notes documenta a decisão). → **Release 1b (story tactical em sprint de estabilização futuro)**
- ~~**`getRequestContext()` optional chaining inconsistente em `tenant-selection.service`** — cosmético; remover `?.`.~~ ✅ Resolvido em Story 7-6 (`ctx?.userId/tenantId` → `ctx.userId/tenantId`).
- **`realignPgUserId` pode invalidar Redis cache de sessão em ambiente compartilhado** — improvável em CI (Redis volátil); só roda em seed (não em prod). **Deferido** com nota no Story 7-6 dev notes. → **Backlog (sem dono; só roda em seed/CI)**
- ~~**Seed Keycloak sem retry/backoff em chamadas REST**.~~ ✅ Resolvido em Story 7-6 (`retryWithBackoff` em `prisma/seeds/_retry.ts` + 6 callsites top-level envolvidos; `realignPgUserId` e `getAdminToken` deliberadamente fora).
- ~~**Playwright `retries: 2` em CI** — mascara flakes em vez de expô-las.~~ ✅ Resolvido em Story 7-6 (`retries: 1`).
- ~~**`ON UPDATE CASCADE` em todas as FKs `users.id` assumido sem teste**.~~ ✅ Resolvido em Story 7-5 (`apps/api/test/migrations/cascade-users-id.spec.ts`).

## Deferred from: implementation of story 7-5 (2026-05-10)

- ~~**Migrar 7 repos legacy do extension `withMultiTenant` para `withTenantTx`**~~ ✅ Resolvido em Story 7-7 (2026-05-11): 48 callsites migrados em 9 arquivos (admin-pastoral, meetings, reflections, meeting-event.worker, group-members, participant-groups, pastoral, admin-users, tenants); extension `prisma.extension.ts` **DELETADO** e getter `prisma.tenant` removido do `PrismaService`. Grep guard zero. Suite 369 tests verde. Encerra o bug de pool routing antes do tag Release 1a-beta.
