# RECONCILIAÇÃO EPIC 11 — Planos, Limites & Feature Gating

> Pré-flight executado em 2026-06-14 sobre `dev @ 8031f7b` (Epic 10 fechado + follow-ups 10-4; working tree limpa).
> Stories: **11-1 → 11-2 → 11-3 → 11-4** (ver §7). Implementar via cstk `/feature-00c` por story.
> Fonte autoritativa: `_bmad-output/planning-artifacts/epics/epic-11.md`. Sondagens feitas no schema/código reais, não nos artifacts.
> Núcleo: evoluir os limites **hardcoded** da Story 3-3 (`PLAN_LIMITS` em `apps/api/src/common/plan-limits/`) para configuração em banco, + branding, + feature toggles, + prompt de upgrade.

## 0. Veredito por story

| Story | Short-name sugerido | Classificação | Resumo |
|-------|--------------------|--------------|--------|
| **11-1** Planos de assinatura & limites dinâmicos | `planos-limites-dinamicos` | **NOVA (tabela+migração) + EVOLUI plan-limits 3-3** | Cria `SubscriptionPlan` (seed 3 tiers) + `tenants.plan_limits_override` (JSONB, **NÃO existe ainda** — §1.1). `PlanLimitsService` passa a ler limites do banco com cache Redis write-through + fallback hardcoded. Endpoints super-admin para listar/editar planos. |
| **11-2** Branding customizado do tenant | `branding-tenant` | **NOVA (FE+upload) + ESTENDE tenants/storage** | Logo (MinIO + `sharp` resize) + cores (CSS custom props) + display name. `logoUrl` já existe; faltam cores/displayName. Gate por tier (Pro+). Cache Redis `cache:branding:{tenantId}`. |
| **11-3** Políticas & feature toggles por tenant | `feature-toggles-tenant` | **NOVA (tabela) + CONFLITA com `focusIndicatorEnabled`** | `TenantPolicies` (JSONB) + write-through Redis com `policyVersion`. **Conflito de fonte de verdade**: `tenant.focusIndicatorEnabled` já existe e está fiado em Epic 5/6 (§3). Reusa transparency banner (5-5) + consent withdrawal (9-4). |
| **11-4** Prompt de upgrade & gestão de limites | `upgrade-prompt-limites` | **NOVA (tabela+FE) + EVOLUI Guard 3-3** | `UpgradeRequest` (workflow pending→approved) + 403 acionável no `PlanLimitsGuard` + banner ≥80% + tabela comparativa. Depende de 11-1. Endpoint super-admin upgrade-requests. |

**Nenhuma é redundante.** Todas tocam infra nova; 11-1 é a fundação (11-4 depende dela).

---

## 1. ⚠️ DRIFTS / fatos do código real — corrigir nos artifacts

1. **`tenants.plan_limits_override` NÃO EXISTE.** A AC 11-1 afirma "the `plan_limits_override` JSONB field on `tenants` table (already created in Epic 3)". **Falso** — o `model Tenant` (schema.prisma:264-291) tem `plan`, `logoUrl`, `metadata`, `onboardingProgress`, `focusIndicatorEnabled`, mas **não** tem `plan_limits_override`. → **Criar a coluna em 11-1** (migration), não assumir.

2. **NÃO existe "Redis atomic counting (INCR + 5-min TTL) do Epic 3".** A AC 11-1 diz que o counting Redis "continues to work — só muda a fonte do max". **Falso** — `PlanLimitsService.hasCapacity` (plan-limits.service.ts:22) faz **contagem direta via Prisma** (`tx.group.count`, `tx.userTenant.count`) dentro de `withTenantTx`, sem Redis nem INCR. **Decisão §10.4**: manter a contagem direta (RLS-safe, correta); 11-1 muda só a **fonte do limite** (constante→banco) e adiciona cache Redis write-through **para os valores de limite do plano** (`cache:plan-limits:{tenantId}`), NÃO para contagem. Não fabricar um contador INCR que nunca existiu.

3. **`PLAN_LIMITS` real cobre só 3 recursos**, não o conjunto rico do épico. plan-limits.config.ts:13 → `{ groups, membersPerGroup, leadersPerTenant }` (free 3/30/5, pro 25/100/50, enterprise ∞). O épico descreve `maxParticipantsPerGroup, maxSimultaneousUsers, maxStorageGB, maxRecordingDaysRetention, maxRecordingGB`. **Decisão §10.6**: `SubscriptionPlan.limits` JSONB pode ser superset, mas o **Guard só enforça os 3 recursos hoje contáveis** (groups, membersPerGroup, leadersPerTenant). Storage/recording/simultaneous-users ficam **armazenados mas NÃO enforçados** (não há contadores) — documentar como não-enforçado/futuro, não alegar enforcement inexistente. Nota: free `membersPerGroup` real = **30** (não 15 do épico) e pro groups = **25** (não 20). Manter os valores reais de 3-3 no seed (evita regressão de contrato — há contract test em 11-1 AC).

4. **`membersPerGroup` curto-circuita** (`hasCapacity` retorna `{allowed:true,current:0}` em plan-limits.service.ts:36). Foi a armadilha da 10-4 (que fez enforce manual). 11-1/11-4 devem decidir: implementar contagem real de membros por grupo OU manter o enforce manual onde necessário (a 10-4 já fez `enforcePlanLimits` por grupo). Não regredir o que a 10-4 construiu.

5. **Convenção de endpoint é `/me`, não `/current`.** As ACs 11-2/11-3 dizem `PATCH /api/v1/tenants/current/branding` e `.../current/policies`. O repo usa **`/me`** (tenants.controller.ts:28/41 já tem `GET me` + `PATCH me` de 10-1). **Decisão §10.1**: usar `PATCH /api/v1/tenants/me/branding` e `PATCH /api/v1/tenants/me/policies` (mesmo drift do Epic 10 §1.2). Reusar o `tenants.controller`/`tenants.service` existentes.

6. **Endpoints super-admin vivem sob `/api/v1/admin/super/...`.** As ACs 11-1/11-4 citam `/api/v1/admin/plans`, `/api/v1/admin/tenants/:id`, `/api/v1/admin/upgrade-requests`. O real (Epic 9) é `super-admin-tenants.controller.ts:30` → `@Controller('api/v1/admin/super/tenants')`. **Decisão §10.2**: novos endpoints super-admin como `/api/v1/admin/super/plans` e `/api/v1/admin/super/upgrade-requests`; override por-tenant via o controller super-admin existente (PATCH no tenant). Guard de role SUPER_ADMIN (não ADMIN_TENANT).

7. **Não há `prisma/seed.ts`.** AC 11-1/11-4 dizem "seed plans in `prisma/seed.ts`". Real: seeds em `apps/api/prisma/seeds/` (demo-seed.ts etc.) + `prisma/seed-*.ts`, e `turbo.json`/`package.json` têm pipelines `db:seed*`. **Decisão §10.7-impl**: criar `prisma/seeds/subscription-plans-seed.ts` idempotente (upsert por tier) + script `db:seed:plans` + **guard CLI** `if (process.argv[1]?.includes('subscription-plans-seed')) void main()` (gotcha boot — §8.2). O seed de planos deve rodar no provisioning/bootstrap (não só dev), pois o Guard depende dele (com fallback se vazio).

8. **`sharp` JÁ instalado** (package.json root). 11-2 (resize logo síncrono ≤2MB) OK — sem nova dep.

9. **`TenantPlan` (enum free/pro/enterprise) já existe** em `packages/types/src/super-admin-tenant.ts:33` (`TenantPlanSchema`). Reusar — não recriar.

---

## 2. Base JÁ ENTREGUE — NÃO recriar

- **`apps/api/src/common/plan-limits/`** (Story 3-3): `plan-limits.config.ts` (`PLAN_LIMITS`, `getLimit`), `plan-limits.service.ts` (`hasCapacity`, `getPlan`), `plan-limits.guard.ts`, `plan-limit.decorator.ts` (`@PlanLimit('groups')`), `plan-limits.module.ts` + testes. 11-1 **evolui** (getLimits dinâmico + override + cache + fallback); 11-4 **evolui** o 403 do Guard. Uso atual: só `groups.controller.ts:31/49`.
- **`tenant.focusIndicatorEnabled`** (Boolean column) — já fiado em `meetings.service.ts:172/177` (gating do focus heartbeat), `focus-heartbeat.controller.ts`, `tenants.service.ts:49`, transparency banner (5-5). **NÃO duplicar** em 11-3 (ver §3).
- **`tenants.controller.ts`** (`GET me`, `PATCH me` + `ScrubPiiInterceptor` + `UpdateTenantProfileSchema`) — 11-2/11-3 **estendem** (branding/policies), não recriam.
- **`super-admin-tenants.{controller,service,repository,module}.ts`** (Epic 9) — 11-1 (planos) e 11-4 (upgrade-requests) **adicionam** controllers/rotas sob o mesmo prefixo `admin/super/`; override por-tenant reusa o PATCH existente.
- **`storage.service.ts`** (MinIO, `upload`/`getSignedUrl`, policy `permanent`) — 11-2 logo. `sharp` para resize.
- **`transparency-banner.tsx`** (5-5, FE) + **consent withdrawal** (9-4: `@Patch(':consentType/withdraw')`, `consent.repository.hasActiveWithdrawal(userId, consentType)`) — 11-3 reusa para notificar/exemptar `focusMonitoring`.
- **`audit.service.createEvent`** (9-3, action enum em `packages/types/src/audit`) — 11-1 (override), 11-3 (policy change), 11-4 (upgrade) gravam audit. Adicionar actions novas ao enum + snapshot (gotcha 10-4: `AUDIT_ACTIONS` precisa do verbo).
- **`vocabulary.ts`** + `apps/web/messages/pt-BR.json` — labels de toggles (11-3) e prompts de upgrade (11-4) pastorais.
- **EventEmitter2** (global) — 11-4 emite `tenant.upgrade.requested`.

---

## 3. 🔀 CONFLITO 11-3 × `focusIndicatorEnabled` — duas fontes de verdade (resolver antes de codar)

11-3 quer `TenantPolicies.policies` JSONB com toggles incluindo `focusMonitoring`. Mas `tenant.focusIndicatorEnabled` **já existe** e já é a fonte de verdade lida por Epic 5 (focus heartbeat gating) e pela transparency banner.

| | `focusIndicatorEnabled` (existe) | `TenantPolicies.focusMonitoring` (11-3 quer) |
|---|---|---|
| Forma | Coluna Boolean em `tenants` | Chave em JSONB `tenant_policies.policies` |
| Leitores | meetings.service, focus-heartbeat.controller, tenants.service | (novo) |

**Decisão §10.5 (recomendada, IMPL-TIME confirmar):** **NÃO duplicar.** Manter `focusIndicatorEnabled` como coluna canônica para ESSE flag (já fiado) e fazer a API de policies (11-3) **mapear** `policies.focusMonitoring ↔ tenant.focusIndicatorEnabled` (ler/escrever a coluna), enquanto `TenantPolicies` JSONB guarda os **demais** toggles novos (`mandatoryCamera`, `sequentialTrailAccess`, `autoPresenceTracking`, `expressMode`). Alternativa (mais arriscada): migrar a coluna→JSONB com backfill + atualizar os 3 leitores. Decidir no arranque de 11-3; recomendo o mapeamento (menor blast radius).

Demais riscos 11-3:
- **Defaults em código** (convention-over-config): `focusMonitoring` OFF (NFR-L4), `mandatoryCamera` OFF, `sequentialTrailAccess` OFF, `autoPresenceTracking` ON, `expressMode` ON. Aplicar quando não há linha `TenantPolicies`.
- **Exempção por consent (9-4)**: usuário que retirou consent de `focusMonitoring` fica exempto mesmo com toggle ON — reusar `consent.repository.hasActiveWithdrawal(userId, <consentType>)`. Confirmar/criar o `consentType` correspondente em `consent.versions.ts`.
- **Tier gating**: toggles que exigem Pro retornam 403 "[Ver upgrade]" no Free (padrão 11-4).

---

## 4. Migrations necessárias (RLS spec obrigatória por tabela tenant-scoped nova)

- **11-1**: `+ SubscriptionPlan` (id uuid v7, name, tier enum free/pro/enterprise, limits JSONB, features JSONB, metadata JSONB[preços], isActive, createdAt, updatedAt) — tabela **global** (não tenant-scoped; sem RLS por tenant, mas só super-admin escreve). `+ tenants.plan_limits_override Json? @map("plan_limits_override")`. Seed dos 3 tiers (idempotente). Zod `SubscriptionPlanSchema` + `PlanLimitsOverrideSchema` (numéricos > 0 ou null; inválido → 422) em `packages/types` + snapshot.
- **11-2**: branding em `tenants` (recomendo colunas: `+ brand_primary_color VarChar(9)?`, `+ brand_secondary_color VarChar(9)?`, `+ display_name?`) — `logoUrl` já existe. (Ou tabela `TenantBranding` 1:1; colunas são mais simples e o tenant já carrega `logoUrl`.) Zod `BrandingSchema` + snapshot.
- **11-3**: `+ TenantPolicies` (tenantId unique FK, policies JSONB, policyVersion Int @default(1), timestamps) **tenant-scoped → RLS + RLS spec**. Decisão §10.5 sobre `focusMonitoring`.
- **11-4**: `+ UpgradeRequest` (id uuid v7, tenantId FK, currentPlan, targetPlan, requestedBy, status enum pending/approved/rejected, createdAt, updatedAt) **tenant-scoped → RLS + RLS spec**. `AUDIT_ACTIONS += 'plan_change'/'upgrade_request'` (confirmar nomes) + snapshot.

**RLS spec**: usar nomes REAIS de coluna (Docker não roda local WSL2 — só CI pega; armadilhas recorrentes title/order_index/created_by/FK→users; users globais; cleanup só mutável; `PrismaPg({connectionString: DATABASE_APP_URL})`; UUID hex fixos). Reusar padrão `group-members.rls-spec.ts`.

---

## 5. Endpoints — inventário (novo vs reuso)

| Endpoint | Story | Status | Nota |
|----------|-------|--------|------|
| `GET /api/v1/admin/super/plans` | 11-1 | **NOVO** | lista planos + contagem de tenants/plano (super-admin) |
| `PATCH /api/v1/admin/super/plans/:planId` | 11-1 | **NOVO** | edita limites; write-through Redis `cache:plan-limits` |
| `PATCH /api/v1/admin/super/tenants/:tenantId` (override) | 11-1/11-4 | **REUSO/ESTENDE** | `planLimitsOverride` + `plan` change; audit |
| `PATCH /api/v1/tenants/me/branding` | 11-2 | **NOVO** | (artifact diz `/current/branding` — usar `/me`, §1.5) |
| `PATCH /api/v1/tenants/me/policies` | 11-3 | **NOVO** | write-through `cache:policies` + `X-Policy-Version` |
| `POST /api/v1/tenants/me/upgrade` (ou `/current/upgrade`→`/me`) | 11-4 | **NOVO** | 202 pending + evento `tenant.upgrade.requested` |
| `GET /api/v1/admin/super/upgrade-requests?status=` | 11-4 | **NOVO** | paginado, filtro status (super-admin) |
| `PlanLimitsGuard` 403 acionável | 11-4 | **EVOLUI** (3-3) | `PlanLimitExceeded` + details + suggestedPlan |
| `PlanLimitsService.getLimits(tenantId)` dinâmico | 11-1 | **EVOLUI** (3-3) | banco + override + cache + fallback |

---

## 6. Caching write-through (regra crítica 11-1/11-3)

ACs exigem **write-through** (não só invalidação): ao mudar plano/override/policy, **ESCREVER** o novo valor no Redis (`SET cache:plan-limits:{tenantId}` / `cache:policies:{tenantId}`), não só `DEL` — elimina a janela de corrida invalidação→próximo cold read. 11-3 incrementa `policyVersion` e devolve em header `X-Policy-Version`; o FE (TanStack) compara e invalida no mismatch. Namespaces Redis do projeto: `cache:*` (alinhado). Fallback: cache miss → lê banco → escreve cache. Banco vazio/erro (SubscriptionPlan) → `PLAN_LIMITS_FALLBACK` (= os `PLAN_LIMITS` atuais) + warning Pino, nunca 500.

---

## 7. Ordem & estratégia de execução

**11-1 → 11-2 → 11-3 → 11-4** (sequencial), via cstk `/feature-00c` por story.
- **11-1 primeiro (fundação obrigatória)**: SubscriptionPlan + override + getLimits dinâmico + cache + fallback + seed + contract test (Guard idêntico antes/depois) + endpoints super-admin de plano. 11-4 depende disto.
- **11-2 segundo**: branding (independente; quick win FE+upload; `sharp` já existe; reusa storage/tenants).
- **11-3 terceiro**: policies/toggles (resolver §3 antes; integra Epic 5/6/9).
- **11-4 por último**: amarra tudo — 403 acionável, banner ≥80%, tabela comparativa, upgrade-requests workflow, aprovação super-admin.

Short-names: `planos-limites-dinamicos`, `branding-tenant`, `feature-toggles-tenant`, `upgrade-prompt-limites`. State em `.claude/feature-00c-state/<short>/`. Crash → `/feature-00c-resume <short>` (lock órfão: `rmdir`; `state-lock.sh check` exit 0 = livre; `current_stage` top-level).

---

## 8. ⚠️ GUARDRAILS CI (repassar a TODO orquestrador feature-00c)

1. **NUNCA push direto em `dev`** — `ci.yml` só dispara em `pull_request`. Toda story: feature-branch → PR → CI verde → squash-merge. Auditar `git log` a cada onda (entrou via PR squash `(#NNN)`?). **PAI cria a feature-branch ANTES da FASE 0** e re-dirige se o orquestrador declarar "concluída" cedo (na 10-4 o orquestrador pulou FASEs 5/7/8 + review-task e marcou 0/167 tasks — **auditar tasks.md checked/total + arquivos reais + CI, nunca confiar no sumário**).
2. **Bugs que SÓ a CI pega** (unit mockado não cobre): **DI wiring** — service novo que injeta repo/serviço de outro módulo exige que o módulo dono **exporte** o provider (ver 10-4: `GroupMembersModule` não exportava `GroupMembersRepository` → boot crash só no E2E). Verificar DI graph contra exports reais antes do push. **RLS spec** — FK→users (criar user global antes de bind; `beforeEach` não pode deletar users globais), nomes reais de coluna.
3. **Seed com `void main()`** → guard `if (process.argv[1]?.includes('<nome>')) void main()` senão crasha boot da API (só E2E). Seed de planos idempotente (upsert por tier).
4. **Validar local antes de done** (gate de evidência — citar output literal): `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint -- --max-warnings 0` + unit tests. Após migration/dep: `pnpm install` + commit `pnpm-lock.yaml`. **jest-axe é gate real** no FE (settings branding 11-2, toggles 11-3, tabela de planos/upgrade 11-4).
5. **RLS spec local**: re-aplicar grants `metanoia_app` após `docker-compose.test.yml`; `PrismaPg({connectionString: DATABASE_APP_URL})`, UUIDs hex fixos, users globais, cleanup só mutável. Tabelas novas tenant-scoped (TenantPolicies, UpgradeRequest) precisam policy + spec; SubscriptionPlan é global (sem RLS por tenant — só super-admin escreve; testar autorização).
6. **useMutation FE** (salvar branding/policies/override, pedir upgrade): `useMutation<T, Error, V>`, mutationFn async com `await` + retorno explícito. TanStack: branding `staleTime` 30min; policies invalida no mismatch de `X-Policy-Version`.
7. **Flakes conhecidos**: `demo-data-isolation`/`demo-data-cleanup`/`reflections` rls-spec (não-determinísticos) → `gh run rerun --failed`; `gh pr merge` 401 → retry 3-4x; cache-miss turbo/prisma → rerun. Distinguir flake de falha real (na 10-4 o flake demo-data coexistiu com bug real no csv-import.rls).
8. **Contratos**: `tenant_id` em toda tabela tenant-scoped (RLS; nunca parâmetro — AsyncLocalStorage/`withTenantTx`); UUID v7 `generateId()`/`uuidv7()`; ISO 8601; nulls explícitos; `{data,meta?}`/`{statusCode,error,message,details?}`; **Async 202** (upgrade pending); override inválido **422**; tier-gate **403** acionável; `ZodValidationPipe` custom; Zod em `packages/types` + snapshot; código+log inglês, user-facing PT-BR + vocabulário pastoral; conventional commits PT-BR; audit em mudanças de plano/override/policy/upgrade; evento `tenant.upgrade.requested`.

---

## 9. Fechamento

Ao mergear as 4: marcar `11-1..11-4: done` + `epic-11: done` em `sprint-status.yaml` (PR de status — push direto em dev é bloqueado pelo auto-mode classifier nesta sessão). Rodar `epic-11-retrospective` (optional). Atualizar memória. **Epic 11 fecha 11/16 épicos** (resta 12 para completar o núcleo MVP; 13-16 são Release 2).

---

## 10. Decisões (resolvidas 2026-06-14)

1. **✅ §1.5** — endpoints do tenant em `/me` (não `/current`): `PATCH /api/v1/tenants/me/branding` (11-2), `.../me/policies` (11-3), `POST .../me/upgrade` (11-4). Reusar `tenants.controller`.
2. **✅ §1.6** — endpoints super-admin sob `/api/v1/admin/super/...`: `plans` (11-1) e `upgrade-requests` (11-4); role SUPER_ADMIN; override reusa o PATCH super-admin de tenant.
3. **✅ §1.1** — `tenants.plan_limits_override` é **NOVO** (migration em 11-1), não pré-existente.
4. **✅ §1.2/§6** — **sem** contador Redis INCR herdado (3-3 conta direto no DB). 11-1 mantém contagem direta + adiciona cache Redis write-through **dos valores de limite** (`cache:plan-limits:{tenantId}`) + fallback `PLAN_LIMITS_FALLBACK` (= PLAN_LIMITS atuais). Nunca 500.
5. **✅ §1.3/§6** — `SubscriptionPlan.limits` JSONB pode ser superset, mas o Guard **enforça só** `groups`/`membersPerGroup`/`leadersPerTenant` (recursos contáveis hoje). Storage/recording/simultaneous-users: armazenados, **não enforçados** (sem contador) — documentar. Seed usa os valores REAIS de 3-3 (free 3/30/5, pro 25/100/50) para passar o contract test de paridade.
6. **⏳ IMPL-TIME §3/§10.5** — 11-3 NÃO duplica `focusMonitoring`: mapear `policies.focusMonitoring ↔ tenant.focusIndicatorEnabled` (coluna canônica já fiada em Epic 5/6); `TenantPolicies` JSONB guarda os demais toggles. Confirmar no arranque de 11-3 (alternativa: migrar coluna→JSONB com backfill + atualizar 3 leitores).
7. **✅ §7** — ordem **11-1 → 11-2 → 11-3 → 11-4**; 11-1 é dependência dura de 11-4.
8. **✅ §1.4** — não regredir o enforce manual por-grupo da 10-4 (`membersPerGroup` curto-circuita no `hasCapacity`); 11-1/11-4 decidem se implementam contagem real de membros-por-grupo no Guard ou mantêm o enforce manual onde já existe.
