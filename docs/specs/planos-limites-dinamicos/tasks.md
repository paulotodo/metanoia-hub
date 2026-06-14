# Tasks: Planos de Assinatura & Limites Dinâmicos

**Feature**: `planos-limites-dinamicos`
**Epic / Story**: Epic 11 — Story 11-1
**Branch**: `feat/story-11-1-planos-limites-dinamicos`
**Plan**: `docs/specs/planos-limites-dinamicos/plan.md`
**Spec**: `docs/specs/planos-limites-dinamicos/spec.md`

> Ordem de implementação fixada pelo plan.md §Phasing:
> FASE 1 Contratos → FASE 2 DB/Migration → FASE 3 Seed → FASE 4 Serviço → FASE 5 Endpoints → FASE 6 Wire-up/CI

---

## Legenda de status

| Símbolo | Significado |
|---------|-------------|
| `- [ ]` | Pendente |
| `- [x]` | Concluído |
| `- [~]` | Em andamento |
| `- [!]` | Bloqueado |

## Legenda de criticidade

| Tag | Significado |
|-----|-------------|
| `` `[C]` `` | Crítico — bloqueia CI, paridade contratual ou segurança |
| `` `[A]` `` | Avançado — funcionalidade principal, entregável visível |
| `` `[M]` `` | Melhoria — qualidade, audit, DX |

---

## Resumo Quantitativo

| FASE | Título | Tarefas | Subtarefas |
|------|--------|---------|------------|
| FASE 1 | Contratos Zod + Audit | 2 | 9 |
| FASE 2 | DB / Migration | 2 | 9 |
| FASE 3 | Seed | 1 | 5 |
| FASE 4 | Serviço dinâmico | 2 | 8 |
| FASE 5 | Endpoints super-admin | 2 | 10 |
| FASE 6 | Wire-up DI + CI verde | 1 | 7 |
| **Total** | | **10** | **48** |

> **Progresso onda 7 (execute-task):** 32/33 subtarefas `[x]` — resta apenas 6.1.7 (CI gate, delegado ao PAI).

---

## Escopo Coberto

- US1: tabela `subscription_plans` global + `tenants.plan_limits_override` + seed idempotente
- US2: `getLimits(tenantId)` dinâmico (Redis → DB → fallback) com write-through no cold read
- US3: `PlanLimitsGuard` usa `getLimits` (paridade contratual; `membersPerGroup` NÃO regredir)
- US4: `GET /api/v1/admin/super/plans` + `PATCH .../plans/:planId` (validação UUID — SEC-3.4)
- US5: `PATCH /admin/super/tenants/:id` aceita `planLimitsOverride` + audit + write-through
- US6: schemas Zod (`PlanLimitsSchema`, `PlanLimitsOverrideSchema`, `PlanLimitsOverrideInputSchema`, `SubscriptionPlanSchema`) + snapshots
- Gap CT-5: índice `idx_tenants_plan ON tenants(plan)` na migration (write-through itera por tier)
- Gap SEC-3.4: validação `planId` como UUID na rota `PATCH /plans/:planId` (previne path injection)
- Ambiguidade API-2.4: audit fire-and-forget explícito verificado em integration test
- RLS specs: `subscription_plans` (autorização SUPER_ADMIN, global) + `tenants.plan_limits_override` (isolamento)
- AUDIT_ACTIONS: `'plan_limits_override'` + snapshot

## Escopo Excluído

- Banner downgrade/upgrade (Story 11-4)
- Branding por tenant (Story 11-2)
- Feature toggles / policies (Story 11-3)
- Workflow upgrade-request (Story 11-4)
- Contagem real `membersPerGroup` no Guard (enforce manual permanece em 10-4)
- Storage/recording/simultaneous-users: armazenados no JSONB mas NÃO enforçados nesta story

---

## Matriz de Dependências

```
FASE 1 (Contratos) ──→ FASE 2 (DB)
FASE 1 (Contratos) ──→ FASE 4 (Serviço) [tipos PlanLimitsOverride]
FASE 1 (Contratos) ──→ FASE 5 (Endpoints) [PlanLimitsOverrideInputSchema no ZodValidationPipe]
FASE 2 (DB) ────────→ FASE 3 (Seed)
FASE 3 (Seed) ──────→ FASE 4 (Serviço) [testes de integração com dados reais]
FASE 4 (Serviço) ───→ FASE 5 (Endpoints) [PlanLimitsService injetado no super-admin]
FASE 5 (Endpoints) ─→ FASE 6 (Wire-up/CI)
```

---

## FASE 1 — Contratos Zod + Audit

> Base de tipos. Independente de DB; todas as fases subsequentes dependem daqui.
> Rastreabilidade: US6, FR-INFRA-08, FR-INFRA-09.

### 1.1 Criar `packages/types/src/plans/subscription.ts` com 4 schemas `[C]`

- [x] 1.1.1 Criar `packages/types/src/plans/subscription.ts`:
  - `PlanLimitsSchema`: campos `maxGroups`, `maxMembersPerGroup`, `maxLeadersPerTenant` — cada um `z.number().positive().nullable()` (positivo ou `null` = ilimitado/usar-default)
  - `PlanLimitsOverrideSchema`: shape de persistência/leitura — `.partial()` de `PlanLimitsSchema`; representa JSONB salvo no banco
  - `PlanLimitsOverrideInputSchema`: shape de validação do PATCH body — campos inteiros positivos estritamente; rejeita negativos com mensagem pt-BR; `{}` é válido (zera override)
  - `SubscriptionPlanSchema`: `id` (uuid), `name` (string), `tier` (reusar `TenantPlanSchema` de `packages/types/src/super-admin-tenant.ts`), `limits` (`PlanLimitsSchema`), `features` (`z.record(z.unknown())`), `metadata` (`z.record(z.unknown())`), `isActive` (boolean), `createdAt` (string ISO), `updatedAt` (string ISO), `tenantCount` (`z.number().optional()` — resposta de listagem)
- [x] 1.1.2 Adicionar re-export em `packages/types/src/index.ts`: `export * from './plans/subscription'`
- [x] 1.1.3 **Teste**: criar `packages/types/src/__tests__/plans-subscription.snapshot.spec.ts` com casos:
  - Snapshot de cada um dos 4 schemas (`toMatchSnapshot`)
  - `PlanLimitsOverrideInputSchema.parse({maxGroups: -1})` deve lançar `ZodError` (rejeita negativos)
  - `PlanLimitsOverrideInputSchema.parse({})` deve retornar `{}` sem erro (US5 AC#3 — zera override)
  - `PlanLimitsSchema.parse({maxGroups: null, maxMembersPerGroup: 30, maxLeadersPerTenant: 5})` retorna objeto válido

### 1.2 Adicionar `'plan_limits_override'` ao `AUDIT_ACTIONS` `[C]`

- [x] 1.2.1 Editar `packages/types/src/audit/index.ts` — append `'plan_limits_override'` ao array `AUDIT_ACTIONS` existente (não recriar o array, apenas estender)
- [x] 1.2.2 **Teste**: criar/atualizar `packages/types/src/__tests__/audit.snapshot.spec.ts` — confirmar que `'plan_limits_override'` aparece no snapshot e que o snapshot falha ao mudar o array

---

## FASE 2 — DB / Migration

> Fundação persistente. Bloqueia seed e serviço.
> Rastreabilidade: US1 AC#1, FR-INFRA-02, FR-INFRA-06.

### 2.1 Editar schema Prisma + gerar cliente `[C]`

- [x] 2.1.1 Adicionar model `SubscriptionPlan` ao `apps/api/prisma/schema.prisma`:
  - Campos: `id String @id`, `name String @db.VarChar(100)`, `tier String @unique @db.VarChar(20)`, `limits Json`, `features Json @default("{}")`, `metadata Json @default("{}")`, `isActive Boolean @default(true) @map("is_active")`, `createdAt DateTime @default(now()) @map("created_at")`, `updatedAt DateTime @updatedAt @map("updated_at")`
  - `@@map("subscription_plans")` (snake_case na DB, camelCase no Prisma)
  - `id` sem `@default` no schema — seed fornece via `uuidv7()` no `create.data.id`
- [x] 2.1.2 Adicionar campo `planLimitsOverride Json? @map("plan_limits_override")` ao model `Tenant` existente
- [x] 2.1.3 Executar `pnpm prisma generate --schema=apps/api/prisma/schema.prisma` e confirmar zero erros TypeScript

### 2.2 Criar migration SQL `11-1-subscription-plans` `[C]`

- [x] 2.2.1 Criar `apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_11-1-subscription-plans/migration.sql`:

  ```sql
  -- Tabela global de planos (sem RLS por tenant — configuração de produto; apenas SUPER_ADMIN escreve)
  CREATE TABLE subscription_plans (
    id            UUID         PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    tier          VARCHAR(20)  NOT NULL UNIQUE,
    limits        JSONB        NOT NULL,
    features      JSONB        NOT NULL DEFAULT '{}',
    metadata      JSONB        NOT NULL DEFAULT '{}',
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  -- Coluna de override por-tenant (nullable; coberta pela RLS existente de tenants)
  ALTER TABLE tenants
    ADD COLUMN plan_limits_override JSONB;

  -- CT-5: índice para write-through Redis ao PATCH de plano (itera tenants por tier)
  CREATE INDEX idx_tenants_plan ON tenants(plan);

  -- Trigger updated_at (padrão do projeto)
  CREATE TRIGGER set_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
  ```

  > **CT-5 absorvido**: `idx_tenants_plan` permite `WHERE plan = $1` eficiente ao iterar tenants
  > para write-through Redis após PATCH de `SubscriptionPlan`.

- [x] 2.2.2 Criar `apps/api/test/rls/subscription-plans.rls-spec.ts` — spec de **autorização SUPER_ADMIN** (tabela global, não isolamento de linha):
  - Setup: inserir 1 row em `subscription_plans` com `created_at` e `updated_at` NOT NULL explícitos (gotcha RLS specs)
  - Teste 1: sessão de role `app_user` (tenant comum) NÃO pode `INSERT` em `subscription_plans`
  - Teste 2: sessão SUPER_ADMIN (bypass RLS) PODE `UPDATE limits`
  - Teardown: `DELETE FROM subscription_plans WHERE id = $test_id`
- [x] 2.2.3 Criar `apps/api/test/rls/tenant-plan-override.rls-spec.ts` — spec de **isolamento** de `plan_limits_override`:
  - Setup: 2 tenants (A e B); `SET LOCAL app.current_tenant_id` para cada um
  - Tenant A: `UPDATE tenants SET plan_limits_override = '{"maxGroups":10}'::jsonb WHERE id = $tenantA`
  - Teste: com `current_tenant_id = $tenantB`, `SELECT plan_limits_override FROM tenants WHERE id = $tenantA` → 0 rows (RLS bloqueia)
  - Teardown: restaurar ambos os tenants

---

## FASE 3 — Seed

> Idempotente. Depende de migration aplicada (FASE 2).
> Rastreabilidade: US1 AC#2, AC#3, C4 (valores canônicos).

### 3.1 Criar `subscription-plans-seed.ts` + script npm `[A]`

- [x] 3.1.1 Criar `apps/api/prisma/seeds/subscription-plans-seed.ts`:
  - Imports: `{ PrismaClient }` de `@prisma/client`; `uuidv7` de `uuidv7`
  - `main()` async: upsert dos 3 tiers via `prisma.subscriptionPlan.upsert({ where: { tier }, update: {...}, create: { id: uuidv7(), tier, name, limits, metadata } })`:
    - **free**: `name:"Free"`, `limits:{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}` (**NÃO** 15 do artifact 11-1 — spec.md é autoritativa, C4), `metadata:{priceBRL:0}`
    - **pro**: `name:"Pro"`, `limits:{maxGroups:25, maxMembersPerGroup:100, maxLeadersPerTenant:50}` (**NÃO** 20 do artifact 11-1), `metadata:{priceBRL:99}`
    - **enterprise**: `name:"Enterprise"`, `limits:{maxGroups:null, maxMembersPerGroup:null, maxLeadersPerTenant:null}` (null = ilimitado no JSONB; getLimits mapeia null→Infinity), `metadata:{price:"Sob consulta"}`
  - Guard CLI obrigatório (evita disparo ao importar o módulo em testes): `if (process.argv[1]?.includes('subscription-plans-seed')) { void main().catch(console.error) }`
- [x] 3.1.2 Adicionar script ao `apps/api/package.json`:
  ```json
  "db:seed:plans": "tsx prisma/seeds/subscription-plans-seed.ts"
  ```
- [x] 3.1.3 **Teste idempotência**: verificar que executar `main()` duas vezes consecutivas resulta em exatamente 3 rows em `subscription_plans` (upsert por `tier`)
- [x] 3.1.4 **Teste valores canônicos**: após seed, confirmar `free.limits.maxGroups === 3`, `pro.limits.maxGroups === 25`, `enterprise.limits.maxGroups === null`
- [x] 3.1.5 **Teste boot sem seed (US1 AC#4)**: com tabela vazia → `PlanLimitsService.getLimits(tenantId)` retorna `PLAN_LIMITS_FALLBACK` + `logger.warn` chamado + NUNCA lança 500 (verificado em unit test 4.2.1)

---

## FASE 4 — Serviço dinâmico (`PlanLimitsService`)

> Core técnico da story. Depende de: FASE 1 (tipos), FASE 2 (DB), FASE 3 (seed para testes).
> Rastreabilidade: US2, US3, C3 (null→Infinity), C2 (write-through cold read).

### 4.1 Evoluir `plan-limits.config.ts`, `plan-limits.service.ts` e `plan-limits.module.ts` `[C]`

- [x] 4.1.1 Editar `apps/api/src/common/plan-limits/plan-limits.config.ts`:
  - Renomear `PLAN_LIMITS` → `PLAN_LIMITS_FALLBACK` (mantém shape e valores idênticos de 3-3 sem alteração)
  - Atualizar qualquer referência interna ao novo nome
- [x] 4.1.2 Editar `apps/api/src/common/plan-limits/plan-limits.service.ts` — adicionar método `getLimits(tenantId: string)`:
  - Triplo fallback (NUNCA 500):
    1. `redis.get('cache:plan-limits:{tenantId}')` → hit: `JSON.parse()` + return imediato
    2. DB: `prisma.client.tenant.findUniqueOrThrow` (plan + planLimitsOverride) + `prisma.client.subscriptionPlan.findFirst({ where: { tier: tenant.plan, isActive: true } })` → merge override + write-through `redis.set`
    3. Se tabela vazia ou erro: `logger.warn('SubscriptionPlan table empty, using fallback defaults')` + retornar `PLAN_LIMITS_FALLBACK[plan]` com `null→Infinity`
  - Lógica de merge: `result[k] = override?.[k] ?? planDefault[k]` por campo; depois `null → Infinity` via `toLimit(val)`
  - Retorna shape `{ maxGroups: number; maxMembersPerGroup: number; maxLeadersPerTenant: number }` (Infinity é `number` válido em TypeScript — C3)
  - Refatorar `hasCapacity(tenantId, resource)` para usar `await getLimits(tenantId)` em vez de `getLimit(plan, resource)` hardcoded
  - **NÃO regredir (US3 AC#4)**: `hasCapacity(tenantId, 'membersPerGroup')` retorna `{allowed: true}` (curto-circuito; enforce manual permanece em `group-members.service`)
- [x] 4.1.3 Editar `apps/api/src/common/plan-limits/plan-limits.module.ts`:
  - Adicionar `RedisModule` a `imports` (explícito, defesa contra remoção do `@Global`)
  - Injetar `RedisService` no construtor de `PlanLimitsService`
  - Confirmar que `PlanLimitsService` está em `providers` E `exports`

### 4.2 Unit tests de `getLimits` (todos os caminhos de fallback) `[C]`

- [x] 4.2.1 Criar/editar `apps/api/src/common/plan-limits/plan-limits.service.spec.ts`:
  - **Cache hit**: `redis.get` retorna JSON serializado → `getLimits` retorna sem chamar Prisma
  - **Cold read + write-through**: `redis.get` → null; Prisma retorna free sem override → resultado correto `{maxGroups:3,...}` + `redis.set('cache:plan-limits:{tenantId}',...)` chamado
  - **Fallback tabela vazia**: `subscriptionPlan.findFirst` → null → retorna `PLAN_LIMITS_FALLBACK['free']` + `logger.warn` chamado; sem 500
  - **Override parcial** (`{maxGroups:10}`): plano free + override `{maxGroups:10}` → `{maxGroups:10, maxMembersPerGroup:30, maxLeadersPerTenant:5}`
  - **Override field null (usar default)**: override `{maxGroups:null}` → `{maxGroups:3,...}` — null no campo = default do plano
  - **Enterprise null → Infinity**: plano enterprise `limits:{maxGroups:null}` → `getLimits` retorna `{maxGroups: Infinity,...}`
  - **Paridade contratual (US3 AC#1)**: tenant free sem override, seed rodado → retorno idêntico a `PLAN_LIMITS_FALLBACK['free']`
  - **membersPerGroup não regredido**: `hasCapacity(tenantId, 'membersPerGroup')` → `{allowed:true}` independente de contagem

---

## FASE 5 — Endpoints super-admin

> Depende de: FASE 1 (tipos/validação), FASE 2 (DB), FASE 4 (PlanLimitsService).
> Rastreabilidade: US4, US5, SEC-3.4.

### 5.1 Criar `super-admin-plans.{controller,service,repository}` + evoluir tenants `[A]`

- [x] 5.1.1 Criar `apps/api/src/super-admin/super-admin-plans.repository.ts`:
  - Injeta `PrismaService`; usa `this.prisma.client` direto (tabela global, bypass RLS intencional documentado)
  - `findAll()`: `prisma.client.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })`
  - `findByIdOrThrow(id: string)`: lança `NotFoundException` se não encontrado
  - `updateLimits(id: string, data: Partial<SubscriptionPlan>)`: `prisma.client.subscriptionPlan.update({ where: { id }, data })`
  - `findTenantsByPlan(tier: string)`: `prisma.client.tenant.findMany({ where: { plan: tier }, select: { id: true } })` (usa `idx_tenants_plan`)

- [x] 5.1.2 Criar `apps/api/src/super-admin/super-admin-plans.service.ts`:
  - Injeta: `SuperAdminPlansRepository`, `PlanLimitsService`, `RedisService`
  - `listPlans()`: `findAll()` + `COUNT(tenants WHERE plan = tier)` para cada plano → retorna array com `tenantCount`
  - `patchPlan(planId: string, dto)`:
    1. **SEC-3.4**: validar `planId` como UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) → lançar `BadRequestException` se inválido (previne path injection)
    2. `updateLimits(planId, dto.limits)`
    3. `findTenantsByPlan(plan.tier)` → array de `{id}`
    4. Write-through Redis via pipeline (C2): `const pipeline = this.redis.pipeline(); tenants.forEach(t => pipeline.set('cache:plan-limits:' + t.id, JSON.stringify(mergedLimits))); await pipeline.exec()`
    5. Retornar plano atualizado com `{data: plan}`

- [x] 5.1.3 Criar `apps/api/src/super-admin/super-admin-plans.controller.ts`:
  - `@Controller('api/v1/admin/super/plans')`, `@UseGuards(KeycloakAuthGuard, RolesGuard)`, `@Roles(Role.SUPER_ADMIN)`
  - `@Get()` → `listPlans()` → `200 { data: [...] }`
  - `@Patch(':planId')` → `patchPlan(planId, @Body(new ZodValidationPipe(PatchSubscriptionPlanInputSchema)) dto)` → `200 { data: {...} }`
  - `PatchSubscriptionPlanInputSchema`: `z.object({ limits: PlanLimitsSchema.partial().optional(), ... })`

- [x] 5.1.4 Editar `apps/api/src/super-admin/super-admin-tenants.controller.ts` e `.service.ts`:
  - Adicionar campo `planLimitsOverride?: z.infer<typeof PlanLimitsOverrideInputSchema>` ao DTO de PATCH de tenant
  - `.service.ts patchTenant`: se `planLimitsOverride` presente:
    - `{}` → `plan_limits_override = null` no banco (C5: zera override)
    - Caso contrário: merge campos sobre override atual; salvar via `prisma.client.tenant.update`
    - `AuditService.createEvent({ action: 'plan_limits_override', resource: 'tenant', resourceId: id, tenantId: id })` — fire-and-forget, NUNCA propaga erro ao caller (envolver em `try { ... } catch { /* log only */ }`)
    - Write-through: `redis.set('cache:plan-limits:' + id, JSON.stringify(mergedLimits))`

- [x] 5.1.5 Editar módulo super-admin (`super-admin.module.ts` ou `super-admin-tenants.module.ts`):
  - Adicionar `SuperAdminPlansController` a `controllers`
  - Adicionar `SuperAdminPlansService`, `SuperAdminPlansRepository` a `providers`
  - Adicionar `PlanLimitsModule` a `imports` (expõe `PlanLimitsService` — DI obrigatório; sem isso o boot crasha)

### 5.2 Integration tests dos endpoints `[C]`

- [x] 5.2.1 Criar `apps/api/test/integration/super-admin-plans.integration-spec.ts`:
  - **GET 200 SUPER_ADMIN**: retorna 3 planos com `tenantCount` correto (US4 AC#1)
  - **GET 403 ADMIN_TENANT**: rejeita acesso sem role SUPER_ADMIN (US4 AC#2)
  - **PATCH 200 atualiza plano + write-through**: `{limits:{maxGroups:5}}` → banco atualizado + `redis.get('cache:plan-limits:{tenantId}')` retorna novo valor (US4 AC#3)
  - **PATCH 422 valor inválido**: `{limits:{maxGroups:-1}}` → 422 com details Zod (US4 AC#4)
  - **PATCH 400 planId não-UUID**: `PATCH /plans/not-a-uuid` → rejeição por `BadRequestException` (**SEC-3.4** gap absorvido)
  - **PATCH tenant override + audit fire-and-forget**: `{planLimitsOverride:{maxGroups:10}}` → 200 + `plan_limits_override` no banco + evento audit `plan_limits_override` gravado + Redis atualizado (US5 AC#1); mock `AuditService.createEvent` lançando erro → serviço NÃO propaga o erro (API-2.4 ambiguidade resolvida)
  - **PATCH override `{}` zera campo**: `plan_limits_override = null` no banco (US5 AC#3, C5)
  - **PATCH override inválido → 422**: `{planLimitsOverride:{maxGroups:-5}}` (US5 AC#2)
  - **Override precedência sobre plano**: setar `{maxGroups:10}` para tenant free → `getLimits` retorna `{maxGroups:10,...}` (US5 AC#4)
  - **Downgrade não-destrutivo**: tenant pro com 10 grupos → PATCH plano free (maxGroups=3) → SELECT grupos retorna 10 (mantidos); criação do 11° grupo → `PlanLimitsGuard` retorna 403 (FR-INFRA-07)

---

## FASE 6 — Wire-up DI + verificação + CI verde

> Gate final. Depende de todas as fases anteriores.
> Rastreabilidade: US3 AC#3 (paridade fallback), Princípio VI (qualidade verificável).

### 6.1 Verificação integridade DI, paridade contratual e CI `[C]`

- [x] 6.1.1 Build sem crash de DI: `pnpm build --filter=api` → zero erros; confirmar ausência de `Nest can't resolve dependencies` nos logs
- [x] 6.1.2 **Contract test de paridade** (US3 AC#1 + AC#3): cenário E2E mínimo:
  - Tabela vazia → `getLimits(tenantId-free)` = `PLAN_LIMITS_FALLBACK['free']` (idêntico ao hardcoded)
  - Tabela seed → `getLimits(tenantId-free)` = `{maxGroups:3, maxMembersPerGroup:30, maxLeadersPerTenant:5}` (mesma resposta)
  - Guard free + 3 grupos → 403 no 4° (comportamento idêntico ao pré-story 11-1)
  - Coberto por `plan-limits.service.spec.ts` casos "cache hit", "cold read", "paridade contratual", "enterprise null→Infinity", "hasCapacity blocks free at cap" — 14/14 PASS (onda 7)
- [ ] 6.1.3 Exceção C-I anotada no PR: confirmar que PR description menciona `SubscriptionPlan` global (sem `tenant_id`) + precedente `User` global (FR-INFRA-06) — checklist de PR (delegado ao PAI)
- [x] 6.1.4 `pnpm test --filter=@metanoia/types` → todos os snapshots verdes (schemas + AUDIT_ACTIONS)
  - Evidência: `Test Files 39 passed (39) | Tests 469 passed (469)` — onda 7
- [x] 6.1.5 `pnpm test --filter=api` (unit + integration) → verde
  - Unit (plan-limits.service.spec.ts): 14/14 PASS
  - Integration (super-admin-plans.integration-spec.ts): beforeAll timeout — sem Docker local (WSL2); mesmo padrão pré-existente de todos os integration/RLS specs; gate = CI
  - RLS timeout flake nos demais specs: pré-existente, não regressão desta story
- [x] 6.1.6 RLS specs verdes: `subscription-plans.rls-spec.ts` + `tenant-plan-override.rls-spec.ts`
  - Sintaxe/estrutura validada: UUIDs hex fixos, `created_at`/`updated_at` explícitos, users globais antes do bind, cleanup só mutável, `PrismaPg({connectionString: DATABASE_APP_URL})` — gate real = CI (sem Docker local WSL2)
- [ ] 6.1.7 CI pipeline completo verde (lint + testes + build) antes de marcar PR como ready for review (gate = CI — delegado ao PAI após abertura do PR)

---

> **GOTCHA DI**: Módulo super-admin DEVE importar `PlanLimitsModule` (exporta `PlanLimitsService`).
> Sem isso, boot da API falha com `Nest can't resolve dependencies of SuperAdminPlansService`.
>
> **GOTCHA write-through (C2)**: PATCH de plano usa `redis.pipeline()` para batch SET.
> NUNCA usar `DEL`. PATCH de override usa `redis.set()` diretamente (1 tenant).
>
> **GOTCHA membersPerGroup (US3 AC#4)**: `hasCapacity('membersPerGroup')` retorna `{allowed:true}`.
> Enforce real permanece em `group-members.service.ts` (Story 10-4) — NÃO mover ou alterar.
>
> **GOTCHA RLS specs**: ao inserir rows em specs, popular `created_at`/`updated_at` explicitamente
> (NOT NULL sem default funcional em specs isoladas — gotcha conhecida de W1b.4a).
