# Deferred Work

## Deferred from: code review of story 1-4 (2026-04-09)

- Secret do client `metanoia-api` hardcoded no realm-export.json — configuração de dev apenas, substituir por secret gerado em produção
- `SET LOCAL` em transação pode ser explorado se tenantId não é UUID — fix de SQL injection já aplicado com template literal, validação de formato UUID seria defesa em profundidade
- Google OAuth placeholders requerem credenciais reais do Google Cloud Console para teste E2E completo
- Guard HTTP-only: não suporta WebSocket ou GraphQL — fora do escopo do spike, implementar quando necessário
- `authorization.split(' ')` vulnerável a múltiplos espaços no header — edge case improvável em clients reais
- Teste E2E do Google OAuth — requer credenciais reais, validar quando Google Cloud Console estiver configurado
- APP_GUARD registration order (KeycloakAuthGuard antes de RolesGuard) — funciona na prática mas a ordem não é explícita no código
- mockClear pattern inconsistente nos testes — apenas um teste faz mockClear, deveria estar no beforeEach para consistência
- Audience (`aud`) validation no JWT — token `aud` contém `metanoia-web`, API precisa de audience mapper no Keycloak para validar corretamente. Decisão: defer (party mode 3-0 unânime). Resolver em story de auth hardening

## Deferred from: code review of story-1-5 (2026-04-09)

- Adicionar header X-Request-Id na response do middleware — melhoria de observabilidade para clientes
- Store mutable no guard — considerar Object.freeze() após população para segurança
- LoggerModule.forRoot avaliado em load time — migrar para forRootAsync com ConfigService
- tenantId inicializado como '' ao invés de null — alinhar com regra de null explícito
- SET LOCAL sem transaction boundary no Prisma extension — verificar eficácia do RLS sem $transaction
- tracesSampleRate hardcoded — tornar configurável via env var SENTRY_TRACES_SAMPLE_RATE
- redact config só cobre authorization header — expandir para cookies e outros headers sensíveis

## Deferred from: code review of story 1-8 (2026-04-09)

- jest-axe TypeScript types sem augmentation para vitest — `toHaveNoViolations()` funciona em runtime mas não tem type declarations para vitest. Problema pré-existente em apps/web e packages/ui.
- Sem error boundary no NavigationShell — se um ícone lucide falhar, o layout inteiro crasha sem fallback. Escopo geral de resiliência da app.

## Deferred from: code review of story-7-4-e2e-happy-path-release-1a (2026-05-10)

- **Bug irmão `KeycloakAdminService.createUserForTenant`** — rota invites (Story 4-3) tem typo idêntico ao corrigido em `createUser`, todos os usuários convidados saem sem `tenant_id` claim. P0 delegado para Story 7-6.
- **Concentração arquitetural — helper `withTenant`** — pattern `$transaction + SET LOCAL` duplicado em 4 repos (`groups`, `admin-invites`, `tenant-selection`, `plan-limits`). Story 7-5 deve consolidar em helper central com UUID guard uniforme.
- **`vitest.config.ts` exclude `e2e/**` não declarado** — funcionalmente OK pelo include guard, mas Task 1 da Story 7-4 pedia exclude explícito. Adicionar para defesa em profundidade.
- **ESLint ignora `apps/web/e2e/**` totalmente** — dívida intencional; quando `@playwright/test` for tracked como devDep raiz, restaurar lint sobre specs E2E.
- **`apps/web/e2e/fixtures/auth.fixture.ts` código morto** — fixture `adminPage` exportada mas não consumida pelo spec atual. Próximas suites E2E (Stories 7-5+) devem usar ou remover.
- **`apiPost` E2E consome `${E2E_API_URL}` (3001) bypassando rewrites Next** — não exercita CORS/rewrite real. Avaliar mudança para `${E2E_BASE_URL}/api/v1/...` quando rewrite estiver estável.
- **Cleanup E2E faz DELETE → controller faz revoke (soft delete)** — invites do run ficam como rows revoked. Mitigação: reset diário do demo seed em CI; long-term: hard-delete via Prisma client em fixture.
- **`getRequestContext()` optional chaining inconsistente em `tenant-selection.service`** — cosmético; remover `?.` quando refactor de RequestContext rodar.
- **`realignPgUserId` pode invalidar Redis cache de sessão em ambiente compartilhado** — improvável em CI; documentar guard ou flush sessões `session:*` no fim do seed.
- **Seed Keycloak sem retry/backoff em chamadas REST** — falha mid-loop deixa users sem role. Wrapper `retryWithBackoff` em chamadas `findUserByEmail/createUser/ensureRealmRole`.
- **Playwright `retries: 2` em CI** — mascara flakes em vez de expô-las. Reduzir para 0/1 após estabilização da suite.
- **`ON UPDATE CASCADE` em todas as FKs `users.id` assumido sem teste** — adicionar teste de migration que valida CASCADE em todas as referências; Story 7-5.

## Deferred from: implementation of story 7-5 (2026-05-10)

- **Migrar 7 repos legacy do extension `withMultiTenant` para `withTenantTx`** — Story 7-5 introduziu o helper e migrou 5 callsites com pattern manual (`groups`, `admin-invites`, `tenant-selection` ×2, `plan-limits` ×2). Os 7 repos restantes (`admin-pastoral` ~15 callsites, `meetings` ~5, `meetings/reflections` ~2, `meetings/events/meeting-event.worker` ~2, `group-members` ~8, `participant-groups` ~3, `tenants/tenants.service` ~1) ainda usam o extension via `this.prisma.tenant.*`. Têm o mesmo bug latente de pool routing (SET LOCAL em conexão diferente da query) — funciona em CI por baixa concorrência. Story 7-7 migra todos, deleta o extension e remove `get tenant` do `PrismaService`. Bloqueia tag Release 1a-beta se algum dos repos for executado sob carga concorrente real.
