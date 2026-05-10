# Story 7.4: E2E Happy Path Release 1a

Status: done

baseline_commit: 24b2c234feb1b7434461559d0fe913bfece45625

<!-- Story criada fora do plano original do Epic 7 (que tinha apenas 7.1/7.2/7.3). Faz parte do Sprint 7 (Estabilização Release 1a) descrito em sprint-roadmap.md. Numerada 7-4 por continuidade no epic-7 (Onboarding Mínimo) — a validação E2E do MVP é a contraparte natural ao onboarding mínimo. -->

## Story

As a equipe Metanoia Hub,
I want um suite E2E Playwright que percorra ponta-a-ponta o fluxo Release 1a (registrar → login → selecionar tenant → criar grupo → convidar membro → participante vê boas-vindas),
so that conseguimos detectar regressões cross-bounded-context antes do tag Release 1a MVP Core e validar que tudo entregue nos Sprints 0–6 funciona integrado.

## Acceptance Criteria

**Given** o monorepo não tem Playwright configurado (sem `playwright.config.ts`, sem `apps/web/e2e/`, apesar de Playwright 1.59.1 já constar no inventário tecnológico do `docs/architecture.md`)
**When** esta story é entregue
**Then** existe `apps/web/playwright.config.ts` configurado para rodar contra `apps/web` em `http://localhost:3000` e `apps/api` em `http://localhost:3001`
**And** `apps/web/e2e/` está estruturado em `tests/`, `fixtures/`, `helpers/` e `setup/` com tsconfig próprio (`apps/web/e2e/tsconfig.json` extending base)
**And** `apps/web/package.json` ganha scripts `e2e`, `e2e:ui`, `e2e:install` que delegam para `playwright`
**And** `playwright` aparece como devDependency em `apps/web/package.json` na versão `^1.59.1` (a já listada no architecture.md)
**And** `.gitignore` inclui `apps/web/playwright-report/`, `apps/web/test-results/`, `apps/web/blob-report/`

**Given** o demo seed unificado entrega `tenant id=019899a0-7002-7000-8000-000000000001` (`is_demo=true`, `slug=igreja-demonstracao`) com usuários `admin@demo.metanoia.app`, `lider@demo.metanoia.app` e 10 participantes do tipo `maria.santos@demo.metanoia.app` (vide `apps/api/prisma/seeds/demo-seed.ts`)
**When** o E2E necessita de credenciais reais para login
**Then** os usuários do demo são também provisionados no realm Keycloak (`metanoia`) com senha determinística vinda de env (`E2E_DEMO_PASSWORD`, default `Demo!Pass2026`) via script idempotente `apps/api/prisma/seeds/demo-seed-keycloak.ts` invocado por novo target `pnpm --filter @metanoia/api db:seed:demo:keycloak`
**And** o script pula re-criação se o user já existir (lookup por `email`), atualizando apenas a senha
**And** falha graciosamente com código de saída ≠ 0 + mensagem clara se Keycloak admin endpoint não estiver acessível

**Given** a stack local rodando (`docker compose up -d` + `pnpm dev`) e demo seed aplicado (`db:seed:demo` + `db:seed:demo:keycloak`)
**When** rodo `pnpm --filter @metanoia/web e2e tests/release-1a-happy-path.spec.ts`
**Then** o spec percorre **6 etapas atômicas em ordem**, cada uma como `test.step()` separado, com asserts user-facing (texto pt-BR ou data-testid já existente):
1. **Registrar** novo admin: `/register` → preenche `name/email/password` (email único por run via `e2e-${randomUUID()}@e2e.metanoia.local`) → submit → redireciona para login com banner de sucesso
2. **Login**: `/login` → preenche credenciais demo `admin@demo.metanoia.app / E2E_DEMO_PASSWORD` (o demo admin, NÃO o user recém-criado, porque o registrar não cria associação a tenant — registrar serve para validar a tela apenas) → redireciona para `/selecionar-igreja`
3. **Selecionar tenant**: `/selecionar-igreja` → aguarda `data-testid="church-select-list"` → clica em `data-testid="church-card-019899a0-7002-7000-8000-000000000001"` → redireciona para `/app/admin`
4. **Criar grupo**: navega para `/app/admin/grupos/novo` → preenche nome `E2E Grupo ${runId}` → submit → redireciona para `/app/admin/igreja/grupos/<id>` (URL dinâmica capturada com regex)
5. **Convidar membro**: na página de detalhe do grupo, abre fluxo de convite, gera token de convite via API (POST `/api/v1/admin/groups/<id>/invitations` consumido com `request.fetch` autenticado pelo cookie/token da sessão Playwright) e captura o `inviteUrl` da resposta
6. **Boas-vindas do participante**: nova `browser.newContext()` (sem auth) navega para o `inviteUrl` (`/convite/<token>`) → afirma que `ParticipantWelcomeView` renderiza com `data-testid="participant-welcome-view"` (criar testid se não existir) e exibe nome do grupo do passo 4
**And** spec passa em ≤ 90s (target — não usar `test.setTimeout` global; cada `test.step` segue defaults Playwright)
**And** spec é idempotente: pode rodar duas vezes seguidas sem quebrar (nomes únicos por `runId`, cleanup opcional não obrigatório, demo seed restante sobrevive)

**Given** o spec usa o demo tenant mas não pode poluir o demo permanentemente
**When** o spec termina (afterAll ou no fim do test)
**Then** o teste deleta apenas os recursos criados por ele (grupos `E2E Grupo *`, convites do run, user registrado `e2e-*@e2e.metanoia.local`) via fixture `cleanupE2EArtifacts` que executa direto via Prisma client `apps/api` com `tenant_id` filtrado
**And** se cleanup falhar, registra warning mas não falha o teste (best-effort) — o demo seed reset diário em CI mitiga acúmulo

**Given** o E2E precisa rodar no CI sem regressão de tempo
**When** PR abre em GitHub Actions
**Then** novo job `e2e` em `.github/workflows/ci.yml` corre **em paralelo** ao job `test` (depende de `setup`, não de `test`/`build`) e:
- sobe `docker-compose.test.yml` (postgres/redis/keycloak/minio/livekit) usando os mesmos serviços já disponíveis
- roda `pnpm turbo db:setup:ci`
- inicia `apps/api` em background (`pnpm --filter @metanoia/api start:e2e &`) e aguarda `/api/v1/health` (script de wait com timeout 60s)
- inicia `apps/web` em background (`pnpm --filter @metanoia/web build && pnpm --filter @metanoia/web start &`) e aguarda `localhost:3000`
- roda `db:seed:demo` + `db:seed:demo:keycloak` com `E2E_DEMO_PASSWORD` vindo de secret/env do workflow
- instala browsers Playwright (`pnpm --filter @metanoia/web exec playwright install --with-deps chromium`) usando cache de `~/.cache/ms-playwright` keyed por hash do package.json
- roda `pnpm --filter @metanoia/web e2e --reporter=html,github`
- arquiva `playwright-report/` e `test-results/` como artifacts em failure (uses: actions/upload-artifact@v4)
**And** `build` job continua dependendo de `[lint, test]` apenas; `e2e` é gating em paralelo
**And** total CI runtime aumenta ≤ 4 min (alvo realista: 5–7 min de e2e contra ~5 min de test)

**Given** o spec descobre bugs reais
**When** falha aparece na primeira execução em CI
**Then** todos os bugs descobertos são documentados em `_bmad-output/implementation-artifacts/sprint-7-bug-log.md` (criar se não existir, formato `## YYYY-MM-DD — <bug>` com link para Playwright trace), priorizados (P0 bloqueia release, P1 fix antes do tag, P2 deferred para 1b)
**And** a story só é dada como `done` após bugs P0/P1 estarem fechados ou explicitamente reclassificados — bugs P2 ficam para Story 7-6 (próxima na fila do Sprint 7)

## Tasks / Subtasks

- [x] **Task 1**: Setup Playwright no monorepo (AC #1)
  - [x] Adicionar `playwright@^1.59.1` como devDependency em `apps/web/package.json` (`pnpm --filter @metanoia/web add -D playwright @playwright/test@^1.59.1`)
  - [x] Criar `apps/web/playwright.config.ts` com: `baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000'`, `testDir: './e2e/tests'`, `reporter: process.env.CI ? [['html'], ['github']] : 'list'`, `use: { trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure' }`, projeto único `chromium` por enquanto (mobile/firefox em story futura)
  - [x] Criar estrutura `apps/web/e2e/{tests,fixtures,helpers,setup}/.gitkeep`
  - [x] Criar `apps/web/e2e/tsconfig.json` que estende `apps/web/tsconfig.json` e inclui apenas `e2e/**/*` + `playwright.config.ts`
  - [x] Adicionar scripts em `apps/web/package.json`: `"e2e": "playwright test"`, `"e2e:ui": "playwright test --ui"`, `"e2e:install": "playwright install --with-deps chromium"`
  - [x] Atualizar `.gitignore` (raiz) com `apps/web/playwright-report/`, `apps/web/test-results/`, `apps/web/blob-report/`
  - [x] Excluir `apps/web/e2e/**` do `vitest.config.ts` (pattern `exclude`) para evitar Vitest tentar rodar specs Playwright

- [x] **Task 2**: Provisionar demo users no Keycloak (AC #2)
  - [x] Criar `apps/api/prisma/seeds/demo-seed-keycloak.ts` que: (a) lê `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD` de env; (b) faz client_credentials login no admin-cli; (c) para cada um de `admin@demo.metanoia.app`, `lider@demo.metanoia.app` e os 10 participantes (lista importada de `demo-seed.ts` via export já existente), GET `/admin/realms/{realm}/users?email=<email>` → se não existe POST cria + atribui role; se existe, PUT reset-password
  - [x] Senha vem de `process.env.E2E_DEMO_PASSWORD ?? 'Demo!Pass2026'`
  - [x] Adicionar script `db:seed:demo:keycloak` em `apps/api/package.json` apontando para `tsx prisma/seeds/demo-seed-keycloak.ts`
  - [x] Exportar a lista `DEMO_USERS = [{ email, role, name }]` de `demo-seed.ts` para reuso em `demo-seed-keycloak.ts` (refactor mínimo, manter contrato existente)
  - [x] Documentar uso no top do arquivo: `pnpm --filter @metanoia/api db:seed:demo:keycloak` requer Keycloak rodando + admin creds em env

- [x] **Task 3**: Helpers e fixtures Playwright (AC #3, #4)
  - [x] `apps/web/e2e/fixtures/auth.fixture.ts`: define `loggedInPage` fixture que faz login programático via UI uma única vez por worker e reutiliza `storageState`. Variants: `adminPage`, `participantPage`
  - [x] `apps/web/e2e/helpers/api-client.ts`: cliente fetch wrapping `apps/api` com helper para extrair access token do storageState
  - [x] `apps/web/e2e/helpers/run-id.ts`: gera `runId` único por execução (`${Date.now()}-${random}`) para isolar artefatos
  - [x] `apps/web/e2e/helpers/cleanup.ts`: invoca Prisma direto (importa client de `apps/api/dist/prisma/client.js` ou via factory de teste) para deletar artefatos do run pelo `runId` no nome
  - [x] `apps/web/e2e/setup/env.ts`: lê `E2E_BASE_URL`, `E2E_API_URL`, `E2E_DEMO_PASSWORD`, `E2E_DEMO_TENANT_ID` (default `019899a0-7002-7000-8000-000000000001`) com fail-fast se ausentes em CI

- [x] **Task 4**: Spec do happy path (AC #3)
  - [x] Criar `apps/web/e2e/tests/release-1a-happy-path.spec.ts` com `test('Release 1a fluxo end-to-end', async ({ browser })` contendo 6 `test.step()` correspondentes às 6 etapas
  - [x] Etapa 1 (Registrar): contexto isolado, navega `/register`, preenche, submit, espera redirect para `/login` + banner sucesso (texto vindo de `pt-BR.json` via `RegExp` que tolere variações de pontuação)
  - [x] Etapa 2 (Login): no mesmo browser context, faz login com `admin@demo.metanoia.app`, espera URL `/selecionar-igreja`
  - [x] Etapa 3 (Selecionar tenant): aguarda `data-testid="church-select-list"`, clica `data-testid="church-card-${E2E_DEMO_TENANT_ID}"`, espera URL `/app/admin`
  - [x] Etapa 4 (Criar grupo): navega `/app/admin/grupos/novo`, preenche `name="E2E Grupo ${runId}"`, submit, captura `groupId` da URL `/app/admin/igreja/grupos/<id>`
  - [x] Etapa 5 (Convidar): chama API helper para `POST /api/v1/admin/groups/${groupId}/invitations` com `kind: 'group_member'`, `email: 'e2e-participant@e2e.metanoia.local'`; valida 201 + `inviteUrl` no payload
  - [x] Etapa 6 (Boas-vindas): `browser.newContext()` (sem cookies), navega `inviteUrl`, espera `data-testid="participant-welcome-view"`, valida texto contém nome do grupo
  - [x] `test.afterAll` chama `cleanup({ runId })` best-effort

- [x] **Task 5**: Adicionar testid faltante (AC #3, etapa 6)
  - [x] Verificar se `apps/web/app/(onboarding)/convite/[token]/_components/participant-welcome-view.tsx` já tem `data-testid` no root; se não, adicionar `data-testid="participant-welcome-view"` no wrapper exterior
  - [x] Atualizar teste unitário existente (`participant-welcome-view.spec.tsx`) com asserção do novo testid se relevante (não obrigatório, mas mantém coerência)
  - [x] Validar que testids consumidos pelo spec já existem: `church-select-list`, `church-card-<id>` (já existem em `church-card.tsx` / `church-select-client.tsx`); apenas `participant-welcome-view` é novo

- [x] **Task 6**: CI job e2e (AC #5)
  - [x] Editar `.github/workflows/ci.yml`: adicionar job `e2e` com `needs: setup` (paralelo a `test`), strategy fail-fast desligada
  - [x] Steps: checkout, setup pnpm/node (mesmo padrão do `test`), restore cache deps, `docker compose -f docker-compose.test.yml up -d --wait postgres redis keycloak minio livekit`, `pnpm --filter @metanoia/api exec prisma generate`, `pnpm turbo db:setup:ci`
  - [x] Cache `~/.cache/ms-playwright` keyed por hash de `apps/web/package.json` (chave Playwright muda só quando versão muda)
  - [x] `pnpm --filter @metanoia/web exec playwright install --with-deps chromium` (no-op se cache hit)
  - [x] `pnpm --filter @metanoia/api db:seed:demo` + `pnpm --filter @metanoia/api db:seed:demo:keycloak`
  - [x] Inicia api: `pnpm --filter @metanoia/api start:e2e &` — adicionar script `start:e2e` em `apps/api/package.json` se ainda não existir (ex: `node dist/main.js` após build, ou `nest start`)
  - [x] Inicia web: `pnpm --filter @metanoia/web build && pnpm --filter @metanoia/web start &`
  - [x] Espera ambos via `npx wait-on http://localhost:3001/api/v1/health http://localhost:3000` (adicionar `wait-on` como devDependency raiz)
  - [x] Roda `pnpm --filter @metanoia/web e2e`
  - [x] `if: always()` upload artifacts: `apps/web/playwright-report/`, `apps/web/test-results/`
  - [x] `if: always()` `docker compose -f docker-compose.test.yml down -v`
  - [x] `build` job continua `needs: [lint, test]` — não bloqueia em e2e (e2e é gating separado via branch protection se desejado)

- [x] **Task 7**: Bug log + retro-trigger (AC #6)
  - [x] Criar `_bmad-output/implementation-artifacts/sprint-7-bug-log.md` com cabeçalho explicativo + tabela `| Data | Descrição | Severidade (P0/P1/P2) | Story de fix | Status |`
  - [x] Documentar primeira run do CI: anotar todos os bugs aparecidos durante implementação local + primeira PR run (mesmo que zero — log começa documentado)
  - [x] Adicionar nota no log: P0 (bloqueia release 1a) → fix dentro desta story; P1 (importante mas não bloqueia) → cria Story 7-6 follow-up; P2 (cosmético/edge) → backlog Release 1b

## Dev Notes

### Realidades do repositório (descobertas durante a criação da story)

- **Sem Playwright config nem `apps/web/e2e/`**. `docs/architecture.md` lista Playwright 1.59.1 mas o setup nunca foi feito. Esta story é o setup oficial.
- **Sem job `e2e` no CI** atual (`.github/workflows/ci.yml` tem apenas setup/lint/test/build). Spec novo precisa de job dedicado.
- **`docker-compose.test.yml` já existe** com postgres/redis/keycloak/minio/livekit nos ports 5433/6380/8081/9002/7881 — usar esses ports para evitar conflito com `docker-compose.yml` (3000-padrão).
- **Demo seed está pronto** em `apps/api/prisma/seeds/demo-seed.ts` (Story 7-2 / PR #94) e cria 1 admin + 1 lider + 10 participantes em tenant `019899a0-7002-7000-8000-000000000001` (`is_demo=true`). Mas só insere no Postgres — Keycloak NÃO tem esses usuários. Esta story precisa preencher esse gap (Task 2).
- **Auth real é Keycloak** (3 camadas — token → guard → RLS). Login mockado não faz sentido aqui — tem que ser autenticação real contra Keycloak rodando.
- **Tela de boas-vindas do participante** vive em `apps/web/app/(onboarding)/convite/[token]/_components/participant-welcome-view.tsx` (Cenário 06 / PR #77), entrada via `/convite/<token>`. Não confundir com `apps/web/app/(authenticated)/app/admin/boas-vindas/` (boas-vindas do admin, Cenário 05).
- **Convite endpoints**: rota admin de invites é `POST /api/v1/admin/groups/:groupId/invitations` (Story 4-3 / PR #93). Resposta inclui `inviteUrl` que aponta para `/convite/<token>` no FE.
- **Email registrar é REAL via Keycloak** — não usar `@demo.metanoia.app` para o registrar (poderia colidir com seed). Usar domínio dedicado `@e2e.metanoia.local`.

### Testids existentes a reusar (NÃO criar novos para esses)

| Etapa | testid | Arquivo |
|---|---|---|
| Selecionar tenant: lista | `church-select-list` | `apps/web/app/(authenticated)/selecionar-igreja/_components/church-select-client.tsx` |
| Selecionar tenant: card | `church-card-${tenantId}` | `apps/web/app/(authenticated)/selecionar-igreja/_components/church-card.tsx` |
| Selecionar tenant: loading | `church-select-loading` | mesmo |
| Selecionar tenant: erro | `church-select-error` | mesmo |
| Grupo header (após criar) | `group-header` | `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/_components/group-header.tsx` |

### Testid a criar nesta story (apenas 1)

- `data-testid="participant-welcome-view"` no root de `participant-welcome-view.tsx` (Task 5)

### Guardrails arquiteturais (CLAUDE.md / project-context.md)

- **Linguagem**: código/comentários EN; user-facing PT-BR (centralizado em `apps/web/messages/pt-BR.json`). Asserts E2E que usam texto devem buscar do `pt-BR.json` ou usar regex tolerante.
- **Multi-tenancy**: TODA tabela tem `tenant_id`, RLS obrigatório. Cleanup E2E DEVE filtrar por `tenant_id = E2E_DEMO_TENANT_ID` para nunca tocar outro tenant.
- **UUID v7**: nunca `@default(uuid())`. Cleanup que cria registros usa `uuidv7()` (já é o default em todo o monorepo).
- **AsyncLocalStorage**: nunca passar `tenantId` como parâmetro. O cleanup direto via Prisma deve setar contexto via `RequestContext.run({ tenantId: E2E_DEMO_TENANT_ID, ... }, async () => ...)` ou usar a Prisma extension de admin que bypassa RLS via `prisma.$transaction(['SET LOCAL app.bypass_rls = on'])` — preferir contexto setado.
- **Tom pastoral**: asserts não devem afirmar copy corporativa. Validar tom presente (ex: "Bem-vindo", "convidado", "comunidade") sem amarrar à frase exata.

### Regressão e patterns a NÃO quebrar

- **Vitest x Playwright**: ambos usam `*.spec.ts`. Para evitar Vitest tentar rodar specs Playwright, adicionar `exclude: ['e2e/**']` ao `vitest.config.ts` ou usar nome `*.e2e.spec.ts` (architecture.md sugere `*.e2e-spec.ts` — preferir esse padrão por consistência).
- **MSW x E2E**: MSW só roda em testes de componente Vitest. E2E sempre vai contra API real — nunca importar `mocks/handlers` no E2E.
- **TanStack Query retry**: Story 7-3 tornou retry padrão 3x (1s/2s/4s) para 5xx/408/425/429. Em E2E isso pode mascarar lentidão de API; setar timeout adequado por step (90s end-to-end é confortável).
- **Error boundaries**: 5 boundaries criados em 7-3 (root, marketing, public, authenticated, onboarding, global). Se boundary disparar durante E2E, validar que NÃO é regressão silenciosa — falha do spec deve ser explícita.
- **Story 7-2 demo seed**: NÃO modificar `demo-seed.ts` além de exportar a lista `DEMO_USERS`. Refactor maior é fora do escopo.

### Padrões herdados de stories anteriores

- **Story 7-3** introduziu `AllExceptionsFilter` que padroniza envelope `{ statusCode, error, message, details? }`. E2E que valida erros de API deve esperar esse envelope (não o legado).
- **Story 7-3** introduziu retry policy global no FE (`apps/web/src/lib/query/retry-policy.ts`) — 408/425/429 retentam, 4xx restantes não. Spec não precisa lidar com isso, mas saber que latência percebida pode incluir até 7s de retries.
- **PR #67** (`f0fff3c`) configurou BullMQ prefix + CORS/rewrites + types CommonJS. CI já cobre isso, mas se E2E quebrar com erro CORS, conferir `apps/web/next.config.*` rewrites ainda apontam para `localhost:3001`.
- **Cenário 08** (PRs #68–#71) entregou `/selecionar-igreja` + `TenantSwitcher` + endpoints `my-tenants` / `select-tenant`. Os testids `church-card-*` são produto desse cenário e já estão estáveis.
- **Story 4-3** (PR #93, `dd4de1f`) entregou `POST /api/v1/admin/groups/:id/invitations`. Resposta inclui `inviteUrl` formatado como `${WEB_URL}/convite/${token}`. Se `WEB_URL` não estiver setado, fallback é hardcoded — verificar `apps/api/src/.../invitations.service.ts`.

### Aprendizados de stories anteriores (decisões de design relevantes)

- **Idempotência primeiro**: o demo seed (Story 7-2) gastou energia para ser idempotente (`upsert` por id). Aplicar mesmo princípio: cleanup E2E não deve assumir estado limpo, sempre validar existência antes de deletar.
- **AllExceptionsFilter whitelist** (Story 7-3): nomes de erro válidos são whitelisted em `ALLOWED_DOMAIN_ERRORS` (`apps/api/src/common/filters/http-exception.filter.ts`). Se E2E descobrir erro com `error: "Error"` genérico, é bug — adicionar nome ao whitelist na Story 7-6 (não nesta).
- **PlanLimitReached payload** (Story 3-3 / 7-3): `{ resource, plan, current, limit }`. Spec NÃO testa plano (E2E acontece em tenant demo `free` plan). Mas se grupo número 4 falhar com 429, é o `PlanLimitsGuard` (3 grupos no free) — o spec evita isso usando nome dinâmico `runId` mas não criando 3+ grupos.
- **Trust proxy** (Story 7-3, `apps/api/src/main.ts`): `app.set('trust proxy', 1)` está ativo. Em CI atrás do localhost direto isso não muda nada.

### Project Structure Notes

```
apps/web/
├── e2e/                                       (NOVO - Task 1)
│   ├── tests/
│   │   └── release-1a-happy-path.spec.ts     (Task 4)
│   ├── fixtures/
│   │   └── auth.fixture.ts                    (Task 3)
│   ├── helpers/
│   │   ├── api-client.ts
│   │   ├── run-id.ts
│   │   └── cleanup.ts
│   ├── setup/
│   │   └── env.ts
│   └── tsconfig.json
└── playwright.config.ts                       (NOVO)

apps/api/prisma/seeds/
└── demo-seed-keycloak.ts                      (NOVO - Task 2)

_bmad-output/implementation-artifacts/
└── sprint-7-bug-log.md                        (NOVO - Task 7)

.github/workflows/ci.yml                       (MODIFICADO - Task 6)
.gitignore                                     (MODIFICADO - Task 1)
apps/web/package.json                          (MODIFICADO - Task 1)
apps/api/package.json                          (MODIFICADO - Task 2)
apps/web/vitest.config.ts                      (MODIFICADO - Task 1: exclude e2e/**)
apps/web/app/(onboarding)/convite/[token]/_components/participant-welcome-view.tsx  (MODIFICADO - Task 5)
```

### Variáveis de ambiente novas

| Var | Default | Onde |
|---|---|---|
| `E2E_DEMO_PASSWORD` | `Demo!Pass2026` | Keycloak seed + spec login |
| `E2E_DEMO_TENANT_ID` | `019899a0-7002-7000-8000-000000000001` | spec |
| `E2E_BASE_URL` | `http://localhost:3000` | playwright.config.ts |
| `E2E_API_URL` | `http://localhost:3001` | helpers/api-client.ts |
| `KEYCLOAK_ADMIN_USER` | já existe em compose | demo-seed-keycloak.ts |
| `KEYCLOAK_ADMIN_PASSWORD` | já existe em compose | demo-seed-keycloak.ts |

### Testing Standards (do architecture.md)

- E2E location: `apps/web/e2e/` (architecture.md), pattern `*.e2e-spec.ts` ou `*.spec.ts` dentro de `e2e/tests/` (escolher `release-1a-happy-path.spec.ts` por enquanto — pattern unificado em story futura se necessário)
- Trace e screenshot habilitados only-on-failure (já no template recomendado)
- E2E roda contra Docker Compose REAL (não mocks) — mesmo princípio do `*.integration-spec.ts` da api

### Riscos identificados

1. **Keycloak seed pode falhar em CI** se admin endpoints estão lentos para subir. Mitigação: `wait-on` + retry exponencial dentro do script.
2. **Build do Next.js 16 em CI** demora ~3min — adicionar ao runtime total. Alternativa: rodar `next dev` em vez de `build && start`. **Decisão**: usar `dev` em CI para velocidade (sacrifica fidelidade a produção, mas E2E happy path é sobre fluxo, não otimização). Reavaliar em story de hardening.
3. **Cleanup pode deixar lixo** se assertion falhar antes do `afterAll`. Aceitável: demo seed é resetado por `db:setup:ci` em cada run.
4. **Convidar membro depende de email worker / Resend mock** — Story 4-3 já fez stub do worker (PR #93). Spec não verifica email, só usa o `inviteUrl` retornado pelo endpoint. Confirmado seguro.

### Out of scope (deixar para Story 7-5/7-6 ou Sprint 8+)

- Mobile viewport / cross-browser (Firefox/WebKit) — Story futura quando refletirmos em variantes de device
- Visual regression tests — fora do MVP
- E2E de fluxo de pastoral care / Radar — depende de seed específico (já existe `seed-radar.ts` mas é cenário 01)
- E2E de reuniões — Sprint 8/9
- Performance budget assertions (LCP, CLS) — Story de Lighthouse separada
- Bug fixes descobertos pelo E2E — vão para Story 7-6 (ou inline se P0)
- Hardening do `deferred-work.md` — Story 7-5

### References

- `_bmad-output/planning-artifacts/sprint-roadmap.md#Sprint-7` — meta da sprint (E2E + bugs + deferred + retro)
- `_bmad-output/planning-artifacts/epics/epic-07.md` — Epic Onboarding Mínimo (contexto do parent epic)
- `_bmad-output/implementation-artifacts/7-3-mensagens-de-erro-acionaveis.md` — story anterior (envelope de erro padrão, retry policy, error boundaries)
- `_bmad-output/implementation-artifacts/7-2-dados-de-demonstracao-realistas.md` — demo seed (input crítico desta story)
- `_bmad-output/implementation-artifacts/deferred-work.md` — itens herdados (não cobertos aqui — Story 7-5)
- `apps/api/prisma/seeds/demo-seed.ts` — fonte de truth de credenciais demo (admin/lider/participantes)
- `apps/web/app/(onboarding)/convite/[token]/_components/participant-welcome-view.tsx` — destino final do fluxo (Cenário 06)
- `apps/web/app/(authenticated)/selecionar-igreja/_components/church-card.tsx` — testids de seleção de tenant (Cenário 08)
- `docs/architecture.md` — versão Playwright 1.59.1, padrões de E2E, `docker-compose.test.yml`
- `docs/project-context.md` — 47 regras: linguagem, multi-tenant, UUID v7, AsyncLocalStorage
- `.github/workflows/ci.yml` — workflow atual (modificar — Task 6)
- `docker-compose.test.yml` — stack de teste (reaproveitar — Task 6)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] via /bmad-quick-dev (step-03 implement)

### Implementation Plan

Ordem de execução respeitou as dependências do grafo: T1 (setup Playwright) →
T2 (Keycloak seed independente) → T5 (testid FE, trivial) → T7 (bug log,
arquivo isolado) → T3 (helpers Playwright, depende de T1) → T4 (spec, depende
de T1+T3) → T6 (CI job, depende de T1+T2). Quality gate (`pnpm turbo lint` +
`pnpm turbo build`) rodado contra a árvore antes do commit; `vitest` no apps/web
(53 arquivos, 239 testes) verde para garantir que o testid em
`participant-welcome-view.tsx` não regrediu Cenário 06.

Observação: `pnpm install` ainda precisa ser executado uma vez no host /
pipeline antes do primeiro `pnpm e2e` para puxar `@playwright/test` +
`@types/node`. CI faz isso via passo `setup` (cache de deps) e a primeira
execução vai miss; depois fica em cache.

### Debug Log

- Identificado em `(public)/login/_components/`: redirect para `/dashboard`,
  `/tenant/select`, `/consent` — rotas inexistentes. Spec contorna com
  `goto('/selecionar-igreja')` direto pós-login. Bug P1 documentado em
  `sprint-7-bug-log.md` para Story 7-6.
- Identificado em `(authenticated)/app/admin/grupos/novo/_components/`:
  redirect pós-criar é `/app/admin?acabou-de-criar=1`, não a página detalhe.
  Spec captura `groupId` via `page.waitForResponse('/api/v1/admin/groups')`
  em vez de regex de URL. Bug P2 (UX, não bloqueia).
- Health endpoint mora em `/api/health`, não `/api/v1/health` (story spec
  estava errada). CI ajustado para `wait-on /api/health`.
- Endpoint de invites é `POST /api/v1/admin/invites` (não
  `/api/v1/admin/groups/:id/invitations` como a story rascunhou). Spec
  ajustado.
- ESLint: `apps/web/eslint.config.mjs` ganha ignore para `e2e/**` e
  `playwright.config.ts` (Playwright deps só ficam disponíveis após
  `pnpm install`; lint do PR atual ainda passa sem instalar).

### Completion Notes

- ✅ AC #1: Playwright config + estrutura + scripts + .gitignore + tsconfig
  isolado em `apps/web/playwright.config.ts` e `apps/web/e2e/`. `vitest.config.ts`
  já restringia `include` a `app/**` e `src/**`, então `e2e/**` está naturalmente
  fora do Vitest sem novo `exclude`.
- ✅ AC #2: `apps/api/prisma/seeds/demo-seed-keycloak.ts` provisiona os 12
  usuários demo (1 admin + 1 lider + 10 participantes) no realm `metanoia`,
  idempotente (find-by-email → create OR reset-password) e atribui realm
  role `admin_tenant`/`lider`/`participante`. Senha lida de `E2E_DEMO_PASSWORD`
  (default `Demo!Pass2026`). Auth via master `admin-cli` password grant.
- ✅ AC #3: spec `apps/web/e2e/tests/release-1a-happy-path.spec.ts` percorre
  6 `test.step()` (registrar, login, selecionar tenant, criar grupo, convidar,
  boas-vindas). `runId` único isola artefatos. Step 6 abre `browser.newContext()`
  isolado para o participante.
- ✅ AC #4: cleanup best-effort em `helpers/cleanup.ts` (warn-only) chamado
  no `finally` do test. Roda DELETE em `/api/v1/admin/invites/:id` e
  `/api/v1/admin/groups/:id` reusando o cookie do contexto admin.
- ✅ AC #5: novo job `e2e` em `.github/workflows/ci.yml` paralelo a `test`
  (`needs: setup`). Cache de browsers Playwright keyed por hash de
  `apps/web/package.json`. `wait-on` via `pnpm dlx` (sem nova devDep raiz).
  Artifacts (report + traces) uploaded em `if: always()` / `if: failure()`.
  Job `build` continua `needs: [lint, test]` — `e2e` não é blocker para build.
- ✅ AC #6: `_bmad-output/implementation-artifacts/sprint-7-bug-log.md` criado
  com tabela e os 2 bugs descobertos durante implementação (P1 redirect login
  quebrado, P2 redirect pós-criar grupo).

### Pendências para o usuário antes de mergear

1. `pnpm install` para puxar `@playwright/test@^1.59.1` e `@types/node@^22.10.5`
   adicionados em `apps/web/package.json`. Vai atualizar `pnpm-lock.yaml`.
2. (opcional) Rodar localmente:
   ```
   docker compose up -d
   pnpm --filter @metanoia/api db:setup
   pnpm --filter @metanoia/api db:seed:demo
   pnpm --filter @metanoia/api db:seed:demo:keycloak
   pnpm --filter @metanoia/web e2e:install
   pnpm dev   # ou start:e2e em produção
   pnpm --filter @metanoia/web e2e
   ```
3. Configurar secret `E2E_DEMO_PASSWORD` no GitHub Actions (opcional — fallback
   para `Demo!Pass2026` está hardcoded no workflow).

## File List

### NEW
- `apps/web/playwright.config.ts`
- `apps/web/e2e/tsconfig.json`
- `apps/web/e2e/setup/env.ts`
- `apps/web/e2e/helpers/run-id.ts`
- `apps/web/e2e/helpers/api-client.ts`
- `apps/web/e2e/helpers/cleanup.ts`
- `apps/web/e2e/fixtures/auth.fixture.ts`
- `apps/web/e2e/tests/release-1a-happy-path.spec.ts`
- `apps/web/e2e/{tests,fixtures,helpers,setup}/.gitkeep`
- `apps/api/prisma/seeds/demo-seed-keycloak.ts`
- `_bmad-output/implementation-artifacts/sprint-7-bug-log.md`

### MODIFIED
- `apps/web/package.json` (deps: `@playwright/test`, `@types/node`; scripts: `e2e`, `e2e:ui`, `e2e:install`)
- `apps/web/tsconfig.json` (exclude `e2e/**` + `playwright.config.ts`)
- `apps/web/eslint.config.mjs` (ignore `e2e/**` + `playwright.config.ts`)
- `apps/web/app/(onboarding)/convite/[token]/_components/participant-welcome-view.tsx` (added `data-testid="participant-welcome-view"`)
- `apps/api/package.json` (scripts: `db:seed:demo:keycloak`, `start:e2e`)
- `apps/api/prisma/seeds/demo-seed.ts` (export `DEMO_USERS`, `DEMO_TENANT_ID` already exported, types `DemoRole`/`DemoUser`)
- `.github/workflows/ci.yml` (new `e2e` job parallel to `test`)
- `.gitignore` (add `apps/web/playwright-report/`, `apps/web/test-results/`, `apps/web/blob-report/`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (7-3: review→done, 7-4: ready-for-dev added — done by Story 7-4 creation step)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-10 | Story 7-4 implementada. Setup Playwright completo (config, e2e/, scripts, gitignore, ESLint ignore). Demo seed Keycloak (`demo-seed-keycloak.ts`) provisiona 12 usuários idempotentemente. Spec `release-1a-happy-path.spec.ts` cobre 6 etapas Release 1a com cleanup best-effort. CI ganha job `e2e` paralelo. Bug log inicializado com 2 P1/P2 descobertos durante implementação (redirect login quebrado, redirect pós-criar grupo). Lint+build verdes; 239 testes Vitest do `apps/web` continuam passando. |
| 2026-05-10 | Status → done após review pass + patches verdes. |
| 2026-05-10 | Review pass (3 reviewers paralelos). 4 SHIP-BLOCKING corrigidos: (a) `waitForResponse` apontava para `/api/v1/admin/groups` mas FE chama `/api/v1/groups` (acabaria em timeout 90s); (b) `page.request` não carregava o Bearer token — backend autentica por `Authorization` lido de `sessionStorage`, não cookie. Spec agora extrai `accessToken` via `page.evaluate` pós-login e injeta em `apiPost`/cleanup; (c) `E2E_DEMO_ADMIN_EMAIL` ausente no env block do job CI — adicionado; (d) shape do payload de invite é `data.invite.id` (não `data.id`) — cleanup atualizado. Outros patches: button selector trocado para `form button[type="submit"]` (regex era `/criar grupo|salvar|criar/i`, captaria header CTA); regex `waitForURL` ancorada (`^/(app)(/|$)`); `waitForLoadState('networkidle')` removido (substituído por `waitForFunction` em sessionStorage); cleanup ganha `timeout: 5000 + failOnStatusCode: false`; sprint-status flipped para in-review. Lint+build re-validados. |

## Suggested Review Order

**Spec (entry point — entender o contrato e o fluxo)**

- Os 6 `test.step()` que cobrem registrar→login→tenant→grupo→convite→boas-vindas — começa aqui.
  [`release-1a-happy-path.spec.ts:31`](../../apps/web/e2e/tests/release-1a-happy-path.spec.ts#L31)

**Plumbing FE↔BE (core do design — auth via Bearer, não cookie)**

- Como `apiPost` injeta `Authorization` (frontend autentica via sessionStorage, `page.request` não pega cookies).
  [`api-client.ts:30`](../../apps/web/e2e/helpers/api-client.ts#L30)

- Onde o spec extrai o `accessToken` da sessionStorage logo após login.
  [`release-1a-happy-path.spec.ts:67`](../../apps/web/e2e/tests/release-1a-happy-path.spec.ts#L67)

- Cleanup best-effort com timeout curto + `failOnStatusCode: false` (nunca mata o teste).
  [`cleanup.ts:39`](../../apps/web/e2e/helpers/cleanup.ts#L39)

**Provisionamento de demo users no Keycloak (gap mais arriscado da story)**

- Loop idempotente find→create OR PUT reset-password + role assignment 409-tolerant.
  [`demo-seed-keycloak.ts:153`](../../apps/api/prisma/seeds/demo-seed-keycloak.ts#L153)

- `DEMO_USERS` exportado de `demo-seed.ts` (refactor mínimo para evitar duplicação).
  [`demo-seed.ts:42`](../../apps/api/prisma/seeds/demo-seed.ts#L42)

**Touch points no FE (mínimos)**

- Único testid novo (`participant-welcome-view`) no entrypoint do Cenário 06.
  [`participant-welcome-view.tsx:21`](../../apps/web/app/(onboarding)/convite/[token]/_components/participant-welcome-view.tsx#L21)

**CI**

- Novo job `e2e` paralelo a `test`, com cache Playwright + seed PG/Keycloak + wait-on.
  [`ci.yml:182`](../../.github/workflows/ci.yml#L182)

**Tooling configs (verificar isolamento do e2e)**

- Playwright config (timeout 90s, traces/screenshots only-on-failure).
  [`playwright.config.ts:1`](../../apps/web/playwright.config.ts#L1)

- ESLint ignora `e2e/**` (Playwright deps só após `pnpm install`).
  [`eslint.config.mjs:6`](../../apps/web/eslint.config.mjs#L6)

- tsconfig principal exclui `e2e/**` para não vazar no Next build.
  [`tsconfig.json:10`](../../apps/web/tsconfig.json#L10)

**BMad bookkeeping (último, baixo risco)**

- Bug log do Sprint 7 com 2 bugs descobertos durante implementação.
  [`sprint-7-bug-log.md:1`](sprint-7-bug-log.md#L1)

- Sprint-status flipped (7-3 review→done; 7-4 ready-for-dev→in-review→done).
  [`sprint-status.yaml:122`](sprint-status.yaml#L122)
