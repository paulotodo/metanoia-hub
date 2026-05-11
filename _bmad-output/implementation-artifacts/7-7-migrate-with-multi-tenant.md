# Story 7.7: Migrar `withMultiTenant` legacy → `withTenantTx`

Status: review

baseline_commit: d5a07b4 (dev após merge PR #98)

<!-- Story criada como follow-up da Story 7-5, que introduziu o helper `withTenantTx` e migrou 5 callsites manuais (groups, admin-invites, tenant-selection, plan-limits), mas deixou os 9 repos consumindo o extension `withMultiTenant` via `this.prisma.tenant.*`. Este artifact migra os 49 callsites remanescentes, deleta a extension e remove o getter `prisma.tenant` do `PrismaService`. Encerra o último blocker estrutural antes do tag Release 1a-beta — sob carga concorrente real, o pool routing do SET LOCAL deixaria queries cair sem tenant context, bloqueando INSERTs ou retornando 0 rows silenciosamente. -->

## Story

As a equipe Metanoia Hub,
I want migrar os 9 módulos legacy que ainda consomem `prisma.tenant.*` (via o extension `withMultiTenant` deprecated) para usar o helper central `withTenantTx`, depois deletar o extension e remover o getter `prisma.tenant` do `PrismaService`,
so that o codebase usa um único caminho transacional para SET LOCAL + query (garantia de mesma conexão pelo `$transaction` do Prisma), eliminando o bug latente de pool routing que se manifesta sob carga concorrente real e é o último blocker estrutural antes do tag Release 1a-beta.

## Acceptance Criteria

**Given** `apps/api/src/admin-pastoral/admin-pastoral.repository.ts` possui 14 callsites no formato `this.prisma.tenant.<model>.<method>(...)` (linhas 12, 27, 39, 49, 68, 92, 107, 117, 124, 139, 156, 169, 175, 182) cobrindo `group`, `meeting`, `pastoralAlert`, `pastoralAction`, `groupMember`, `pastoralNote` e `outreachIntent`
**When** esta story é entregue
**Then** todos os 14 callsites passam a usar `withTenantTx(this.prisma, (tx) => tx.<model>.<method>(...))` importado de `../prisma/with-tenant-tx`
**And** `createOutreachIntent` (já recebe `data.tenantId` explícito) usa o ALS fallback (não passa `opts.tenantId`) — o caller é HTTP, tem RequestContext populado, e o `data.tenantId` é só para fechar o tipo do Prisma create (o RLS lê do SET LOCAL)
**And** o module test `admin-pastoral.controller.spec.ts` (se existir) ou `admin-pastoral.service.spec.ts` continua verde sem mudanças além das que o mock de repository force

**Given** o domínio Meetings tem 3 callers do extension: `meetings.repository.ts` (6 callsites em meeting + group), `reflections.repository.ts` (2 callsites em reflection) e `meetings/events/meeting-event.worker.ts` (2 callsites em meetingEvent)
**When** esta story é entregue
**Then** os 3 arquivos passam a usar `withTenantTx(this.prisma, (tx) => tx.<model>.<method>(...))`
**And** especificamente o worker (`MeetingEventWorker.process`) — que já cria RequestContext via `requestContext.run({ tenantId, userId, ... }, async () => ...)` — usa o **fallback de ALS** (não passa `opts.tenantId`). O `withTenantTx` vai ler `requestContext.getStore()?.tenantId` que estará populado durante o callback. Decisão registrada: passar `opts.tenantId` explícito seria defesa em profundidade desnecessária — o worker já garante o ALS scope.
**And** specs unit existentes (`meetings.service.spec.ts`, `reflections.service.spec.ts`, worker integration spec se houver) continuam verdes

**Given** os 4 repos restantes consumem `prisma.tenant.*`: `group-members.repository.ts` (10 callsites cobrindo group, groupMember e userTenant), `participant-groups.repository.ts` (3 callsites em group e meeting), `pastoral.repository.ts` (6 callsites cobrindo pastoralAlert, pastoralAction, pastoralNote, group) e `admin-users.repository.ts` (5 callsites em userTenant)
**When** esta story é entregue
**Then** os 4 arquivos passam a usar `withTenantTx(this.prisma, (tx) => tx.<model>.<method>(...))`
**And** todos os métodos públicos preservam a assinatura atual (zero mudança no contrato dos services consumidores) — o wrap é estritamente interno
**And** os specs unit existentes continuam verdes (mocking de `PrismaService` continua funcionando porque o `client` getter está intacto)

**Given** `tenants.service.ts:12` é o único callsite restante do extension fora dos repositories (`this.prisma.tenant.tenant.findUnique`), e remover esse callsite encerra o consumo do extension
**When** esta story é entregue
**Then** `TenantsService.findMine` passa a usar `withTenantTx(this.prisma, (tx) => tx.tenant.findUnique({...}))`
**And** o extension `withMultiTenant` é **DELETADO** de `apps/api/src/prisma/prisma.extension.ts` (arquivo apagado, junto com seu spec se houver — não há)
**And** o getter `tenant` é removido de `apps/api/src/prisma/prisma.service.ts` (linhas 7-8 imports + 13 field + 23 inicialização + 30-36 getter); o getter `client` e `$queryRaw` permanecem
**And** `import` de `prisma.extension` é removido de qualquer arquivo (apenas `prisma.service.ts` o importa hoje)
**And** `pnpm exec rg "this\.prisma\.tenant\." apps/api/src/` retorna **zero matches** (grep guard final)
**And** `pnpm exec rg "withMultiTenant" apps/api/src/` retorna **zero matches**
**And** `pnpm --filter @metanoia/api typecheck` é verde — TypeScript prova que zero callers do getter ou do extension restam

**Given** a invariante "queries em cada repo migrado continuam isoladas por tenant via RLS" precisa de cobertura de regressão para detectar se algum callsite ficou para trás ou perdeu o wrap
**When** esta story é entregue
**Then** existe um spec novo `apps/api/test/rls/group-members.rls-spec.ts` seguindo o padrão de `groups.rls-spec.ts` (TENANT_A_ID/TENANT_B_ID via `rls-test.helper.ts`, seed → read cross-tenant → assert isolation), cobrindo `groupMember.findMany`, `findFirst` e `count` — a tabela `group_members` ainda não tem RLS spec dedicado e essa story é o lugar natural para introduzi-lo
**And** os tests existentes de RLS (`meetings.rls-spec.ts`, `reflections.rls-spec.ts`, `participant-groups.rls-spec.ts`, `outreach-intents.rls-spec.ts`, `users-isolation.integration-spec.ts`, `meeting-events-isolation.integration-spec.ts`) continuam verdes — provando que a migração NÃO mudou comportamento observável (mesmas tabelas, mesmas policies, mesmo SET LOCAL + query, só num caminho transacional explícito)
**And** `nullif-isolation.spec.ts` continua verde (a invariante NULLIF não foi tocada)
**And** suite completa `pnpm turbo test build lint` é verde em `apps/api` e `apps/web` (zero regressão)

## Tasks / Subtasks

### Task 1 — Migrar `admin-pastoral.repository.ts` (AC1) ✅
- [x] Importado `withTenantTx` + 14 callsites wrap

### Task 2 — Migrar Meetings family (AC2) ✅
- [x] `meetings.repository.ts`: 6 callsites wrap
- [x] `reflections.repository.ts`: 2 callsites wrap
- [x] `meetings/events/meeting-event.worker.ts`: 2 callsites wrap (ALS fallback via `requestContext.run`)

### Task 3 — Migrar repos restantes (AC3) ✅
- [x] `group-members.repository.ts`: 10 callsites wrap
- [x] `participant-groups.repository.ts`: 3 callsites wrap
- [x] `pastoral.repository.ts`: 6 callsites wrap
- [x] `admin-users.repository.ts`: 5 callsites wrap — **decisão runtime:** `updateRole` e `removeFromTenant` originais faziam 2 transações separadas (find + update/delete); funded para 1 só withTenantTx por chamada (atomicidade + 1 transação a menos). Comportamento idêntico do ponto de vista do caller.

### Task 4 — Migrar tenants.service + DELETAR extension + remover getter (AC4) ✅
- [x] `tenants.service.ts`: callsite wrap
- [x] `apps/api/src/prisma/prisma.service.ts`: removidos imports `withMultiTenant`, field `extendedClient`, getter `tenant`
- [x] `apps/api/src/prisma/prisma.extension.ts`: **APAGADO**
- [x] Grep guard `rg "this\.prisma\.tenant\." apps/api/src/` → zero matches
- [x] `pnpm build` (nest build) verde — TypeScript prova consumidores zerados
- [x] **Bug colateral fix:** `meeting-event.worker.ts` payload exige cast `as Prisma.InputJsonValue` (antes o extension extended-client mascarava o tipo)

### Task 5 — RLS isolation test para `group_members` (AC5) ✅
- [x] Criado `apps/api/test/rls/group-members.rls-spec.ts` (3 cenários: listByGroup cross-tenant, findMembership cross-tenant, countLeaders por tenant)
- [x] `pnpm exec vitest run test/rls/group-members.rls-spec.ts` → 3 verdes
- [x] Suite RLS completa: `12 files / 52 tests` verdes
- [x] Comentário do `meeting-events-isolation.integration-spec.ts` atualizado (não mais menciona extension)

### Task 6 — Suite completa + Change Log + PR ✅
- [x] `pnpm exec vitest run` (apps/api): `68 files / 369 tests passed` (era 366 — +3 novos do group-members RLS)
- [x] `pnpm turbo build lint` raiz → verde (6 tasks successful)
- [x] `sprint-status.yaml`: `7-7-migrate-with-multi-tenant: review`
- [x] `deferred-work.md`: item Story 7-5 marcado resolvido
- [x] Memória `sprint_story_7_7_done.md` (a salvar antes do commit)
- [ ] PR contra `dev` aberta

## Dev Notes

### Por que migrar todos de uma vez (não incremental)

O extension `withMultiTenant` é deprecated mas funcional. Em teoria poderia ficar coexistindo com `withTenantTx` indefinidamente. **Por que deletar é importante:**

1. **Footgun ativo:** qualquer dev novo que importe `prisma.tenant.foo()` reintroduz o bug de pool routing. Manter o getter aberto = manter a armadilha.
2. **Bloqueio de tag Release 1a-beta:** os 9 módulos migrados nesta story cobrem todo o domínio core de meetings/pastoral/admin. Sob carga real (vários líderes anotando reflections simultaneamente, super_admin listando tenants num picado de timing) o SET LOCAL vai descolar da query em alguma conexão.
3. **TypeScript guard depois de remover:** com o getter deletado, qualquer regressão para o pattern legacy quebra compile time — defesa em profundidade gratuita.

### Por que worker não passa `opts.tenantId` (apesar de ser fora do HTTP)

`MeetingEventWorker.process` já chama `requestContext.run({ tenantId, userId, ... }, async () => ...)` na linha 51 antes de qualquer query. Isso popula o `AsyncLocalStorage` do mesmo modo que o middleware HTTP. `withTenantTx` lê `requestContext.getStore()?.tenantId` no fallback e encontra o valor. Passar `opts.tenantId` seria duplicação de fonte de verdade — se um dia divergir, qual ganha?

Já o `tenant-selection.service.selectTenant` (migrado na Story 7-5) **passa** `opts.tenantId` porque o usuário está escolhendo o tenant — o ALS pode ter um tenantId diferente (do JWT atual) e o callsite precisa override explícito.

Regra prática: **passa `opts.tenantId` apenas se o caller precisa override do ALS**. Caso contrário, deixa o helper resolver via ALS.

### Por que só 1 RLS spec novo (group-members), não 5

Inventário de cobertura RLS atual (em `apps/api/test/rls/`):
- `groups.rls-spec.ts` ✓
- `meetings.rls-spec.ts` ✓
- `reflections.rls-spec.ts` ✓
- `participant-groups.rls-spec.ts` ✓
- `outreach-intents.rls-spec.ts` ✓
- `meeting-events-isolation.integration-spec.ts` ✓
- `users-isolation.integration-spec.ts` ✓ (cobre `user_tenants` da `admin-users` e indiretamente `group-members.findUserInTenant`)
- `nullif-isolation.spec.ts` ✓ (cobre `pastoral_actions`, `pastoral_alerts`, `pastoral_notes`, `tenants` na invariante "query sem SET LOCAL retorna 0 rows")
- **Faltando:** `group_members` — a tabela tem RLS policy ativa mas zero spec dedicado.

Inicialmente o handoff sugeria "5 RLS tests novos seguindo padrão `nullif-isolation.spec.ts`". A leitura de `apps/api/test/rls/` revela que a maioria das tabelas já tem cobertura — repetir specs (admin-pastoral lê 6 tabelas que JÁ têm spec) seria duplicação. O único gap real é `group_members`, e essa é a tabela mais crítica (membership join — vazamento aqui significa um líder de Tenant A vendo membership de Tenant B). Decisão: 1 spec novo focado no gap, deixar a invariante NULLIF + os specs existentes cobrirem o resto. A regressão arquitetural (extension volta a vazar) seria pega imediatamente pelos specs existentes que rodam queries de produção via os repos migrados.

### Por que typecheck é suficiente para guard final (além do grep)

Depois de remover `get tenant()` do `PrismaService`, qualquer `this.prisma.tenant.X` que sobreviver vira `Property 'tenant' does not exist on type 'PrismaService'`. TypeScript bloqueia o build. Grep é doublecheck rápido durante review; o typecheck é a barreira real.

### Fora de escopo (não nesta story)

- **Refatoração de `RequestContext` para não permitir `tenantId: undefined`:** o type atual `{ tenantId?: string }` ainda permite que callers públicos (login, signup) tenham `tenantId` ausente. O guard atual joga `Error` no `withTenantTx` se faltar. Considerar tornar `tenantId` obrigatório em contextos autenticados via type discriminated, mas isso requer reescrever o middleware — escopo Release 1b.
- **Helper `withPublicTx` para queries sem tenant:** alguns pontos (signup, marketing endpoints) usam `prisma.client.X` diretamente sem transação. Não há gap funcional, mas um helper simétrico ao `withTenantTx` traria consistência. Deferido.
- **Pool monitoring/observability:** adicionar telemetria em `withTenantTx` (tempo de transação, conexão escolhida) ajudaria a detectar regressão futura. Deferido — separado de uma story de hardening de observabilidade.

## File List

**Modified (11):**
- `apps/api/src/admin-pastoral/admin-pastoral.repository.ts`
- `apps/api/src/admin-users/admin-users.repository.ts`
- `apps/api/src/group-members/group-members.repository.ts`
- `apps/api/src/meetings/events/meeting-event.worker.ts` (+ cast `Prisma.InputJsonValue` em payload)
- `apps/api/src/meetings/meetings.repository.ts`
- `apps/api/src/meetings/reflections.repository.ts`
- `apps/api/src/participant-groups/participant-groups.repository.ts`
- `apps/api/src/pastoral/pastoral.repository.ts`
- `apps/api/src/prisma/prisma.service.ts` (remove getter `tenant` + field `extendedClient`)
- `apps/api/src/prisma/with-tenant-tx.ts` (JSDoc atualizado para refletir extension deletado)
- `apps/api/src/tenants/tenants.service.ts`
- `apps/api/test/rls/meeting-events-isolation.integration-spec.ts` (comentário Prerequisites atualizado)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/7-7-migrate-with-multi-tenant.md`

**Created:**
- `apps/api/test/rls/group-members.rls-spec.ts`
- `_bmad-output/implementation-artifacts/7-7-migrate-with-multi-tenant.md`

**Deleted:**
- `apps/api/src/prisma/prisma.extension.ts`

## Change Log

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-11 | Claude (inline) | Artifact criado como ready-for-dev, baseline d5a07b4 |
| 2026-05-11 | Claude (inline Task 1-3) | AC1+AC2+AC3 ✅ — 48 callsites migrados em 8 arquivos (admin-pastoral 14 + meetings 6 + reflections 2 + worker 2 + group-members 10 + participant-groups 3 + pastoral 6 + admin-users 5) |
| 2026-05-11 | Claude (inline Task 4) | AC4 ✅ — `tenants.service.ts` migrado (último callsite); `prisma.extension.ts` **DELETADO**; `prisma.service.ts` getter `tenant` removido + import limpo; bug colateral fix: `meeting-event.worker.ts` payload `as Prisma.InputJsonValue` (tipo estrito do `$transaction` agora aparece). Grep `this.prisma.tenant.` retorna zero matches. |
| 2026-05-11 | Claude (inline Task 5) | AC5 ✅ — `group-members.rls-spec.ts` criado (3 cenários cobrindo gap da tabela `group_members`); suite RLS 12 files / 52 tests verde |
| 2026-05-11 | Claude (inline Task 6) | Suite full apps/api: 68 files / 369 tests verde; turbo build+lint root: 6 tasks successful. Story marcada `review`. |
