# Sprint 7 — Bug Log

Sprint 7 (Estabilização Release 1a) usa este log para rastrear bugs descobertos
pela suite E2E (Story 7-4) e por sessões de hardening (Story 7-5). Cada entrada
é triada em uma das três severidades:

- **P0 — bloqueia Release 1a.** Fix obrigatório dentro da Story que descobriu o
  bug, antes do tag `v1a`.
- **P1 — importante mas não bloqueia.** Vai para Story 7-6 (follow-up de bugs
  do E2E) e precisa fechar antes do tag `v1a`.
- **P2 — cosmético / edge case.** Backlog Release 1b. Não bloqueia o tag.

## Convenções

- Data no formato ISO `YYYY-MM-DD`.
- Coluna **Trace** aponta para `playwright-report/` (local) ou para o artifact
  do CI run que reproduziu o bug.
- **Story de fix** vazio = ainda não tem story; preenche quando o bug for
  triado para uma sprint específica.

## Bugs

| Data | Descrição | Severidade | Trace | Story de fix | Status |
|------|-----------|------------|-------|--------------|--------|
| 2026-05-10 | Login form (`apps/web/app/(public)/login/_components/`) redireciona para `/dashboard`, rota que não existe na app router (admin home está em `/app/admin/igreja/vista`). Idem `/tenant/select` (deveria ser `/selecionar-igreja`) e `/consent` (não há página). Spec da Story 7-4 contorna fazendo `goto('/selecionar-igreja')` direto após login para destravar o fluxo. | P1 | descoberta durante criação do spec (não rodou) | 7-6 (a criar) | aberto |
| 2026-05-10 | `apps/web/app/(authenticated)/app/admin/grupos/novo/_components/create-group-form.tsx` redireciona para `/app/admin?acabou-de-criar=1` em vez de `/app/admin/igreja/grupos/<id>` como descrito na story 4-1. Spec captura o id via `waitForResponse` em `/api/v1/admin/groups`. Não bloqueia, mas sugere ajuste UX para abrir o grupo recém-criado. | P2 | descoberta durante criação do spec | backlog 1b | aberto |
| 2026-05-10 | Keycloak container OOM (exit 137) na primeira run do CI: limit `768M` em `docker-compose.test.yml` insuficiente para `start-dev --import-realm`. Bumped para `1536M` + `JAVA_OPTS_KC_HEAP=-Xms256m -Xmx768m` + `start_period: 60s`/`retries: 30`. | P0 | run 25622713277 job 75212227331 | esta PR | resolvido |
| 2026-05-10 | Backend `/api/v1/auth/register` falha 500 ("An unexpected error occurred") porque o realm export `infra/keycloak/realm-export.json` NÃO atribui ao service account de `metanoia-api` os client roles `realm-management.manage-users`/`view-users`/`query-users`. Sem isso o `KeycloakAdminService.createUser` retorna 403 e o filter Nest devolve 500 genérico. Unit tests do `register.service.spec.ts` mockam o KeycloakAdminService — esta lacuna só foi exposta agora pelo E2E real. **Fix nesta PR:** `demo-seed-keycloak.ts` ganha pre-step `provisionApiServiceAccount()` que injeta as 3 roles via admin-cli antes de provisionar os 12 demo users. Idempotente. **Observação:** local dev pode ter as roles configuradas manualmente; a fonte de verdade agora é o seed. Refactor de longo prazo: incluir as mappings direto no realm export (Story 7-6 ou 7-5). | P0 | run 25622868639 job 75212636539 (screenshot mostra "An unexpected error occurred") | esta PR | resolvido |
| 2026-05-10 | `KeycloakAdminService.createUser` (rota `/api/v1/auth/register`) NÃO inclui `username` no body do POST `/admin/realms/{realm}/users`. Realm não tem `registrationEmailAsUsername=true`, então Keycloak rejeita com `400 {"errorMessage":"User name is missing"}` → AllExceptionsFilter devolve 500 genérico. Sintoma: register continua falhando mesmo após service account ter `manage-users`. Bug pré-existente desde Story 2-1, exposto só agora pelo E2E real (unit tests mockam fetch e nunca validavam o body). `createUserForTenant` (rota de invite) não tem o problema porque já passa `username: email`. **Fix nesta PR:** add `username: email` em `keycloak-admin.service.ts:81` + regression guard em `keycloak-admin.service.spec.ts` que valida o body shape. | P0 | run 25623133938 job 75213335935 (api.log mostra `body:"{\"errorMessage\":\"User name is missing\"}"`) | esta PR | resolvido |
| 2026-05-10 | Web em CI loga warning `"next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead`. Funcionalmente OK (rewrites do `next.config.ts` continuam ativos), mas modo degradado. Refactor: trocar `pnpm start` por `node .next/standalone/server.js` no workflow ou remover `output: 'standalone'` do `next.config.ts` se não estiver usado em produção. | P2 | run 25623133938 job 75213335935 (web.log) | Story 7-5 | aberto |
| 2026-05-10 | Login E2E falha 401 "invalid credentials" porque o env block do CI define `KEYCLOAK_CLIENT_ID: metanoia-app` — typo, cliente inexistente no realm. Realm tem `metanoia-web` (`directAccessGrantsEnabled: true`, único habilitado para password grant) e `metanoia-api` (service account, sem direct grants). KC rejeita o request com 401 antes mesmo de validar o user/senha. Bug pré-existente no `.github/workflows/ci.yml`. **Fix nesta PR:** `metanoia-app` → `metanoia-web`. | P0 | run 25623268673 job 75213703754 (api.log mostra `LoginService action=auth.login.failed msg="invalid credentials"` para admin@demo.metanoia.app) | esta PR | resolvido |
| 2026-05-10 | Login para `admin@demo.metanoia.app` falha 401 "user authenticated in keycloak but not found in database". KC autentica OK, mas `prisma.client.user.findUnique({ email })` retorna null porque RLS na tabela `users` (`FORCE ROW LEVEL SECURITY`) bloqueia o lookup pré-auth. Demo seed criava `User.tenantId=DEMO_TENANT_ID`. Política `tenant_isolation` (migration `20260414120000_add_invites_and_tenant_rls`) exige `tenant_id = current_setting('app.current_tenant_id')` — sem tenant context, registro fica oculto. Política mais antiga `users_tenant_isolation` (`tenant_id IS NULL OR ...`) permitia null mas não cobre rows com tenantId set. **Fix nesta PR:** demo-seed.ts agora cria User com `tenantId: null` (mesma convenção do register flow). Membership continua via UserTenant (admin/lider) e GroupMember (participantes). Refactor de longo prazo: alinhar as duas políticas RLS conflitantes (Story 7-5). | P0 | run 25623387403 job 75214027227 (api.log: `LoginService msg="user authenticated in keycloak but not found in database"`) | esta PR | resolvido |
