# Story 7.5: Hardening Release 1a — Tenant Isolation & SSR Wire-up

Status: in-progress

baseline_commit: a88db3c (dev após merge PR #96)

<!-- Story criada como follow-up técnico ao Sprint 7 (Estabilização Release 1a). Story 7-4 expôs 4 fronteiras arquiteturais frágeis nos repos com SET LOCAL + uma página SSR que nunca foi wired ao backend (Cenário 06). 7-5 consolida o pattern central e fecha o gap do convite participant. Não inclui o typo `createUserForTenant` (Story 4-3) — esse vai para 7-6, junto com o cleanup tactical da E2E. -->

## Story

As a equipe Metanoia Hub,
I want consolidar o pattern `SET LOCAL` em um helper único, fazer o wire-up do convite participant ao endpoint real e blindar a integridade das FKs `users.id`,
so that elimino divergência entre repos (que já produziu 4 bugs idênticos em Story 7-4), encerro o débito SSR pendente do Cenário 06 e garanto que mudanças futuras em `users.id` não corrompam o demo nem a produção.

## Acceptance Criteria

**Given** o pattern `$transaction → tx.$executeRawUnsafe('SET LOCAL app.current_tenant_id = ...')` está duplicado em 5 lugares: `groups.repository.ts`, `admin-invites.repository.ts` (incluindo `withTenantTx` ad-hoc), `tenant-selection.service.ts` (2 ocorrências: `listMyTenants` + `selectTenant`), `common/plan-limits/plan-limits.service.ts` (2 ocorrências) e a Prisma extension `withMultiTenant` (que sabidamente quebra em pool routing — Story 7-4 bug log #18/#19)
**When** esta story é entregue
**Then** existe `apps/api/src/prisma/with-tenant-tx.ts` exportando `withTenantTx<T>(prisma: PrismaService, fn: (tx) => Promise<T>, opts?: { tenantId?: string }): Promise<T>` que:
- resolve `tenantId` a partir do parâmetro OU do `RequestContext` (AsyncLocalStorage) — preferindo o parâmetro quando ambos existem (caso de `tenant-selection.selectTenant`, que opera pré-tenant-context)
- valida UUID format antes do interpolation (regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) e lança `Error('Refusing SET LOCAL with non-UUID tenant_id "<value>"')` em caso de falha
- abre `prisma.client.$transaction(async (tx) => { await tx.$executeRawUnsafe(\`SET LOCAL app.current_tenant_id = '${tenantId}'\`); return fn(tx); })`
- expõe o `tx` tipado (`Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]`) para a callback
**And** os 5 callsites listados acima são reescritos para usar `withTenantTx`, removendo helpers privados `withTenant` duplicados de `groups.repository.ts` e `admin-invites.repository.ts`
**And** a Prisma extension `withMultiTenant` em `apps/api/src/prisma/prisma.extension.ts` é marcada `@deprecated` com JSDoc explicando o bug de pool routing (SET LOCAL roda em conexão diferente da query) e apontando para a Story 7-7 que migrará os 7 repos restantes (`admin-pastoral`, `meetings`, `meetings/reflections`, `meetings/events/meeting-event.worker`, `group-members`, `participant-groups`, `tenants/tenants.service`) — a extension NÃO é deletada nesta story porque esses 7 repos ainda dependem dela; deletação é parte da Story 7-7
**And** uma suíte `apps/api/src/prisma/__tests__/with-tenant-tx.spec.ts` cobre: (a) UUID guard rejeita strings inválidas, (b) prefere `opts.tenantId` sobre `RequestContext`, (c) lança quando ambos faltam, (d) propaga o `tx` para a callback, (e) rollback em erro dentro da callback
**And** `pnpm turbo test` permanece verde

> **Scope split (decisão 2026-05-10):** o artifact original propunha deletar `withMultiTenant` nesta story, mas grep revelou ~40 callsites do `prisma.tenant.*` em 7 outros repos. Deletar o extension exigiria refactor de ≈12 callsites adicionais e dobraria o escopo. Decisão Paulo: introduzir helper + migrar 5 callsites manuais nesta story; criar Story 7-7 para migrar os 7 repos restantes.

**Given** `/convite/[token]/page.tsx` ainda consome `resolveInviteFixture` (in-memory mock) — wire-up real nunca aconteceu desde Cenário 06 Session 2 (PR #78) — e `GET /api/v1/invites/:token` existe há ~3 semanas em `apps/api/src/invites/invites.controller.ts`
**When** esta story é entregue
**Then** `apps/web/app/(onboarding)/convite/[token]/page.tsx` passa a chamar `GET ${process.env.API_URL}/api/v1/invites/:token` direto via Server Component fetch (Server Components NÃO usam TanStack Query — regra `docs/project-context.md`)
**And** o fetch usa `cache: 'no-store'` (token é one-shot, sem caching legítimo)
**And** a resposta é validada com o schema Zod `inviteResolveResponseSchema` já exportado em `packages/types/src/invites/...` (ou criado se não existir); o type narrowing produz `kind: 'admin-tenant' | 'participant' | 'leader'`
**And** `404` da API renderiza `<InviteErrorView variant="invalid" />`; `410` (token usado/expirado) detecta o `details.reason` ('expired' | 'used') e renderiza variantes correspondentes
**And** outras falhas (500, network) renderizam `<InviteErrorView variant="invalid" />` com log via `console.error` (será capturado pelo error boundary já existente no layout)
**And** `resolveInviteFixture` em `apps/web/__mocks__/onboarding/resolve-invite.ts` permanece no projeto mas é referenciado APENAS pelos testes (`page.spec.tsx`) via re-import explícito — não pelo runtime de produção
**And** os specs existentes em `apps/web/app/(onboarding)/convite/[token]/__tests__/page.spec.tsx` são atualizados para mockar o fetch (via MSW handler já existente em `apps/web/__mocks__/handlers/invites.ts` ou novo) em vez do fixture direto
**And** smoke test E2E manual: rodando `pnpm dev` + `db:seed:demo` + curl `GET /api/v1/invites/<token-do-seed>` retornando dados reais, abrir `/convite/<token>` no browser deve renderizar `<ParticipantWelcomeView>` com o nome do grupo vindo do banco (NÃO mais do fixture)

**Given** Story 7-4 descobriu que `users.id` em PostgreSQL precisou ser atualizado para casar com `JWT.user_id` do Keycloak (bug #13 — `realignPgUserId`) e que o sucesso disso depende silenciosamente de `ON UPDATE CASCADE` em todas as FKs que referenciam `users.id` (caso contrário, o UPDATE falha com FK constraint violation OU corrompe relações)
**When** esta story é entregue
**Then** existe `apps/api/test/migrations/cascade-users-id.spec.ts` (integration test contra Postgres real) que:
- lista todas as constraints `FOREIGN KEY ... REFERENCES users(id)` no schema atual via query `information_schema.referential_constraints` (filtrando por `unique_constraint_schema` e `referenced_table = 'users'`)
- afirma que `update_rule = 'CASCADE'` para cada uma — falha o teste listando NOMES das constraints que não estão CASCADE
- como teste positivo: cria user, cria rows dependentes em 2 tabelas distintas (ex: `user_tenants`, `consents`), faz `UPDATE users SET id = <novo_uuid>` e afirma que as linhas dependentes têm o novo id
**And** se o teste falhar, a migration corretiva é incluída nesta story (`apps/api/prisma/migrations/<timestamp>_cascade_users_id_fks/migration.sql`) com `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... ON UPDATE CASCADE` para cada FK não conforme
**And** rodando localmente: `pnpm --filter @metanoia/api test:integration cascade-users-id` passa

**Given** as duas migrations que estabelecem RLS — `20260413131927_add_pastoral_rls` e `20260414120000_add_invites_and_tenant_rls` — usam variantes diferentes do guard de tenant em policies: a 0413 lê `current_setting('app.current_tenant_id')::uuid` direto (falha quando setting é `''`), a 0414 introduziu `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` (correto, tolera setting ausente). Story 7-4 bug log #20 documenta a divergência
**When** esta story é entregue
**Then** existe nova migration `apps/api/prisma/migrations/<timestamp>_consolidate_rls_nullif/migration.sql` que `DROP POLICY ... ON ...; CREATE POLICY ... USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)` para TODAS as policies criadas na 0413 (admin-pastoral context: `groups`, `group_members`, `member_engagement_snapshots`, etc.)
**And** um RLS isolation test em `apps/api/test/rls/` cobre: (a) query sem `SET LOCAL` retorna 0 rows (`NULLIF` produz null → policy bloqueia), (b) query com `SET LOCAL '<tenant-a>'` retorna apenas rows do tenant-a, (c) query com `SET LOCAL '<tenant-b>'` retorna apenas rows do tenant-b
**And** o teste é parametrizado em todas as tabelas tenant-scoped tocadas pela consolidação (não só uma — a lista vem da query de discovery do AC3)
**And** após a consolidação, NÃO existem mais ocorrências de `current_setting('app.current_tenant_id')::uuid` (sem NULLIF) em arquivos `migration.sql` ativos — `rg "current_setting.app.current_tenant_id..::uuid" apps/api/prisma/migrations` retorna apenas a forma NULLIF

## Tasks / Subtasks

### Task 1 — `withTenantTx` helper central (AC1)
- [ ] Criar `apps/api/src/prisma/with-tenant-tx.ts` com a função, UUID guard e tipos
- [ ] Criar `apps/api/src/prisma/__tests__/with-tenant-tx.spec.ts` com 5 cenários (UUID guard, prefer opts, throw quando ambos faltam, propaga tx, rollback)
- [ ] Refactor `groups.repository.ts` — remover método privado `withTenant`, usar helper
- [ ] Refactor `admin-invites.repository.ts` — remover método privado `withTenantTx`, usar helper
- [ ] Refactor `tenant-selection.service.ts` — `listMyTenants` + `selectTenant` (este último passa `tenantId` explícito via `opts`)
- [ ] Refactor `common/plan-limits/plan-limits.service.ts` — 2 callsites
- [ ] NÃO refactor `invites/invites.service.ts.createAccount` — o `$transaction` ali NÃO usa SET LOCAL (cria o tenant na mesma tx, pré-RLS context); usa o `prisma.client` cru, está correto
- [ ] Marcar `withMultiTenant` em `prisma.extension.ts` como `@deprecated` com JSDoc explicando o bug de pool routing e apontando para Story 7-7
- [ ] Manter `prisma.service.ts` inalterado: `get tenant` continua disponível para os 7 repos legacy; `get client` é o entry point para callers via `withTenantTx`
- [ ] Rodar `pnpm turbo test build lint` — todos verdes

### Task 2 — Wire-up SSR `/convite/[token]` (AC2)
- [ ] Verificar/criar `inviteResolveResponseSchema` em `packages/types/src/invites/`
- [ ] Reescrever `apps/web/app/(onboarding)/convite/[token]/page.tsx` para chamar `GET ${API_URL}/api/v1/invites/:token` com `cache: 'no-store'`
- [ ] Tratar 404 / 410 / 5xx mapeando para `<InviteErrorView variant="...">` apropriado
- [ ] Atualizar `apps/web/app/(onboarding)/convite/[token]/__tests__/page.spec.tsx` para mockar fetch (MSW) em vez de fixture direto
- [ ] Confirmar que `resolveInviteFixture` continua existindo só para testes (não para runtime)
- [ ] Smoke manual: `pnpm dev` + curl invite token do seed → abrir `/convite/<token>` → verifica nome do grupo real

### Task 3 — Teste CASCADE em FKs `users.id` (AC3)
- [ ] Criar `apps/api/test/migrations/cascade-users-id.spec.ts` (integration, usa banco real do `docker-compose.test.yml`)
- [ ] Implementar discovery via `information_schema.referential_constraints`
- [ ] Assertion: todas FKs → users.id têm `update_rule = 'CASCADE'`
- [ ] Implementar smoke positivo (insert deps → UPDATE users.id → check propagação)
- [ ] Se teste falhar: criar migration `cascade_users_id_fks/migration.sql` com ALTER TABLE para cada FK não conforme
- [ ] Rodar e validar verde

### Task 4 — Consolidação RLS NULLIF (AC4)
- [ ] Discovery: `grep "current_setting" apps/api/prisma/migrations/20260413131927_add_pastoral_rls/migration.sql` → listar policies sem NULLIF
- [ ] Criar `apps/api/prisma/migrations/<timestamp>_consolidate_rls_nullif/migration.sql` com DROP + CREATE para cada policy
- [ ] Criar/atualizar test em `apps/api/test/rls/` cobrindo as tabelas afetadas
- [ ] Rodar `pnpm prisma migrate dev` localmente para verificar idempotência
- [ ] Confirmar pós-migração: `rg "current_setting.app.current_tenant_id..::uuid" apps/api/prisma/migrations` retorna apenas a forma NULLIF
- [ ] CI verde

### Task 5 — Change log + memória + PR
- [ ] Atualizar `Change Log` desta story
- [ ] Atualizar `sprint-7-bug-log.md` marcando itens 14/15/17/18/19/20 como resolvidos por Story 7-5
- [ ] Atualizar `deferred-work.md` riscando os itens absorvidos
- [ ] Salvar memória `sprint_story_7_5_done.md`
- [ ] Abrir PR contra `dev`

## Dev Notes

### Por que dropar `withMultiTenant` em vez de consertar

Tentar consertar a extension (forçar `$transaction` interno) só recria `withTenantTx` com pior interface. A extension hook é por-query, mas SET LOCAL precisa ser por-transação. Não há composição correta. Manter os dois confunde reviewers e atrasa adoption do helper. Dropar é cirurgia, não cleanup.

### `selectTenant` é o caso especial

Em `tenant-selection.service.ts:selectTenant`, o `RequestContext` ainda NÃO tem `tenantId` (esse endpoint é justamente o que define o tenant). Por isso o `tenantId` precisa vir como parâmetro do método — daí o `opts.tenantId` no helper. Mantém o helper genérico sem branches especiais por callsite.

### Por que NULLIF é defeito-fechado, não defeito-aberto

Sem NULLIF: `current_setting('app.current_tenant_id')` em conexão fresh dá `''`. Cast `''::uuid` lança SQLSTATE 22P02 (invalid input syntax). RLS interpreta isso como ERROR, query falha em vez de retornar 0 rows. Comportamento: "tudo quebra ruidosamente". Com NULLIF: cast vira `NULL::uuid`. Comparação `tenant_id = NULL` é sempre `NULL` (não TRUE), policy bloqueia, query retorna 0 rows silenciosamente. Comportamento: "fechado por padrão, queries pré-tenant retornam vazio". O segundo é o correto para multi-tenant.

### Convite SSR — porque Server Component fetch direto, não Server Action / route handler

Server Components que precisam de dados HTTP usam `fetch` nativo (regra explícita em `docs/project-context.md`: "Server Components use native fetch — no TanStack Query"). Page-level data fetch para resolver token é exatamente isso. Criar route handler intermediário seria redirecionamento desnecessário.

### CASCADE — porque não confiar no schema atual

`prisma.schema` define relations com `onUpdate: Cascade` por padrão, MAS migrations manuais podem ter sido escritas sem essa cláusula. O teste vai além do schema: lê o estado real do banco. Garante que migrations futuras manuais não silenciem CASCADE.

### Fora de escopo

- Bug irmão `createUserForTenant` no Story 4-3 invites (typo idêntico ao corrigido em `createUser` — usuários convidados saem sem `tenant_id` claim) — vai para **Story 7-6**
- Cleanup dos workarounds tactical aplicados na Story 7-4 (`Playwright retries: 2`, `vitest.config exclude e2e`, `ESLint ignora e2e`, etc.) — vai para **Story 7-6**
- Retry/backoff no `demo-seed-keycloak.ts` — vai para **Story 7-6**
- Cleanup E2E DELETE → revoke soft-delete mismatch — vai para **Story 7-6**
- **Migração dos 7 repos legacy que ainda usam `prisma.tenant.*` via extension `withMultiTenant`** (`admin-pastoral`, `meetings`, `meetings/reflections`, `meetings/events/meeting-event.worker`, `group-members`, `participant-groups`, `tenants/tenants.service`) — vai para **Story 7-7** (criada como follow-up nesta story). Esses repos têm o mesmo bug de pool routing dos 5 callsites que migramos aqui, mas o blast radius é maior (≈40 callsites) e o escopo seria demais para uma única PR. Story 7-7 deleta a extension após migração completa.

## File List

A ser populado durante implementação. Arquivos previstos:

**Created:**
- `apps/api/src/prisma/with-tenant-tx.ts`
- `apps/api/src/prisma/__tests__/with-tenant-tx.spec.ts`
- `apps/api/test/migrations/cascade-users-id.spec.ts`
- `apps/api/prisma/migrations/<ts>_consolidate_rls_nullif/migration.sql`
- (talvez) `apps/api/prisma/migrations/<ts>_cascade_users_id_fks/migration.sql`

**Modified:**
- `apps/api/src/prisma/prisma.extension.ts` (marcar `withMultiTenant` como `@deprecated`, NÃO deletar)
- `apps/api/src/groups/groups.repository.ts`
- `apps/api/src/admin-invites/admin-invites.repository.ts`
- `apps/api/src/auth/tenant-selection.service.ts`
- `apps/api/src/common/plan-limits/plan-limits.service.ts`
- `apps/api/src/invites/invites.service.ts`
- `apps/web/app/(onboarding)/convite/[token]/page.tsx`
- `apps/web/app/(onboarding)/convite/[token]/__tests__/page.spec.tsx`
- (talvez) `packages/types/src/invites/...`
- `_bmad-output/implementation-artifacts/sprint-7-bug-log.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-10 | Claude (bmad-create-story shorthand) | Artifact criado como ready-for-dev, baseline a88db3c |
| 2026-05-10 | Claude (bmad-dev-story start) | Scope split AC1: grep revelou 7 repos legacy via `prisma.tenant.*` (~40 callsites) que dependem do extension. Decisão Paulo: marcar `withMultiTenant` como `@deprecated` nesta story; criar Story 7-7 para migrar os 7 repos e deletar extension. Status: in-progress. |

## Suggested Review Order

1. `apps/api/src/prisma/with-tenant-tx.ts` + spec — entender o contrato do helper antes de revisar os 5 callsites
2. Diff dos 5 repositórios/services — confirmar redução de duplicação 1:1
3. JSDoc `@deprecated` em `withMultiTenant` (`prisma.extension.ts`) — confirmar que aponta para Story 7-7 e que extension NÃO foi deletada
4. Migration `_consolidate_rls_nullif` + RLS test — validar que policies não passaram a aceitar tenant null silenciosamente
5. CASCADE test — confirmar discovery via `information_schema` e smoke de UPDATE
6. `/convite/[token]/page.tsx` — confirmar que zero código de runtime importa `resolveInviteFixture`
