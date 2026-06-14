# Plano de Implementação — Políticas & Feature Toggles por Tenant (Story 11-3)

**short_name:** `feature-toggles-tenant`
**epic:** 11 — Planos, Limites & Feature Gating
**branch:** `feat/story-11-3-feature-toggles-tenant`
**status:** planned
**data:** 2026-06-14

---

## Summary

Permitir que o Admin Tenant configure políticas comportamentais da igreja
(indicador de foco, câmera obrigatória, acesso sequencial a trilhas, registro
de presença, modo express) via endpoints `GET`/`PATCH /api/v1/tenants/me/policies`.

Abordagem técnica (da pesquisa):
- Nova tabela `tenant_policies` (JSONB `policies` + `policyVersion`), tenant-scoped
  com RLS obrigatória.
- `focusMonitoring` MAPEIA a coluna existente `tenant.focusIndicatorEnabled`
  (fonte de verdade Epic 5) — JSONB guarda só os 4 toggles novos.
- Estender `tenants.controller`/`tenants.module` + novo `policies.service.ts`
  (padrão branding, Story 11-2 — sem módulo separado).
- Cache Redis write-through `cache:policies:{tenantId}` + header `X-Policy-Version`.
- Tier gating (Pro: focusMonitoring, mandatoryCamera) → 403 acionável no Free
  exclusivamente no PATCH.
- Reuso: `consent.repository.hasActiveWithdrawal` (9-4), `audit.service.createEvent`
  (nova action `policy_change`), `transparency-banner.tsx` (5-5) via EventEmitter2.

---

## Constitution Check

*GATE: passou antes do Phase 0. Re-checado após Phase 1 (idem).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS | `tenant_policies` tem `tenant_id` + RLS habilitada na migration; RLS isolation spec obrigatória (`tenant-policies.rls-spec.ts`); `tenantId` via RequestContext/`withTenantTx` (nunca parâmetro); 3 camadas auth (Keycloak `@ADMIN_TENANT` → RolesGuard → RLS). |
| II. Type-Safety & UUID v7 (NON-NEGOTIABLE) | PASS | `strict` herdado; `id` via `uuidv7()` no service (proibido `@default(uuid())`); datas ISO 8601 timestamptz; `null` explícito; sem `undefined` em JSON (defaults convention-over-config). |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs/Swagger em inglês; mensagens user-facing PT-BR em `apps/web/messages/pt-BR.json` (bloco `policies`); vocabulário pastoral nos labels (§3 spec). |
| IV. Contratos de API Padronizados | PASS | `TenantPoliciesSchema`/`UpdatePoliciesSchema`/`PoliciesResponseSchema` Zod em `packages/types` + snapshot; envelope `{ data }`; PATCH→200 (mutação parcial idempotente, sem create); prefixo `/api/v1/`; `ZodValidationPipe(UpdatePoliciesSchema)`. |
| V. Separação de Estado no FE | PASS | Página `policies/page.tsx` é Client Component; TanStack Query SÓ para policies (server state); sem Zustand misturado; sem TanStack em Server Component. |
| VI. Qualidade Verificável | PASS | Unit specs (`policies.service.spec.ts`), RLS isolation spec, snapshot tests (Zod + AUDIT_ACTIONS); WCAG AA na UI (dialog de confirmação acessível); CI verde antes de done. |
| VII. Processo de Entrega Auditável | PASS | Branch `feat/story-11-3-feature-toggles-tenant`; conventional commits PT-BR; 1 story=1 branch=1 PR; reconciliação EPIC11 já consumida na spec. |

**Resultado:** PASS em todos os 7 princípios MUST. Sem violações. Complexity
Tracking não aplicável.

---

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript `strict` (monorepo Turborepo + pnpm) |
| Backend | NestJS 11.1.17 (REST `/api/v1/`, bounded context `tenants`) |
| Frontend | Next.js 16.2 (App Router, área autenticada CSR) |
| ORM/DB | Prisma v7 + PostgreSQL + RLS multi-tenant; PrismaPg adapter |
| Cache | Redis (RedisService, namespace `cache:*`) via `RedisModule` (@Global) |
| Eventos internos | EventEmitter2 (`@nestjs/event-emitter`) |
| Contratos | Zod em `packages/types` (compartilhado FE+BE) + snapshot tests |
| Validação | `ZodValidationPipe` custom (sem libs terceiras) |
| Testes | Vitest (unit/integration/RLS spec); service-level (não supertest) |
| Auth | Keycloak → `KeycloakAuthGuard` + `RolesGuard(@ADMIN_TENANT)` → RLS |
| i18n | `apps/web/messages/pt-BR.json` |
| NEEDS CLARIFICATION restantes | 0 (dec-008..012 fecharam tudo) |

---

## Convenções de Borda

Feature atravessa DB ↔ Backend ↔ Frontend → tabela obrigatória.

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case (`tenant_id`, `policy_version`, `focus_indicator_enabled`) | migration + RLS policy | `apps/api/prisma/migrations/*_tenant_policies/migration.sql` |
| Prisma model | camelCase (`tenantId`, `policyVersion`) com `@map` para snake_case | Prisma schema | `apps/api/prisma/schema.prisma` (model `TenantPolicies`) |
| JSONB `policies` keys | camelCase (`mandatoryCamera`, `sequentialTrailAccess`, `autoPresenceTracking`, `expressMode`) | Zod `TenantPoliciesSchema` | `packages/types/src/policies/tenant-policies.ts` |
| Backend DTO/response | camelCase | Zod parse | `packages/types` (re-export) |
| API payload (req/resp) | camelCase | `ZodValidationPipe(UpdatePoliciesSchema)` no PATCH; Zod no FE | `docs/specs/feature-toggles-tenant/contracts/policies-api.md` |
| Response header | `X-Policy-Version` (Train-Case) | controller `res.set` | `tenants.controller.ts` |
| URL path | kebab/`/me/policies` | router NestJS | `tenants.controller.ts` |

**Mapper layer (DB ↔ DTO):** Prisma auto-mapping via `@map`/`@@map` (snake_case
no banco ↔ camelCase no model). JSONB `policies` é gravado/lido como objeto
camelCase puro (sem mapper — Zod é o contrato). ORM auto-mapping: SIM (Prisma).

**Validação Zod:**
- Borda: PATCH request (`UpdatePoliciesSchema` via `ZodValidationPipe`) +
  FE response parse (`PoliciesResponseSchema`).
- Schema compartilhado: SIM — `packages/types/src/policies/tenant-policies.ts`,
  re-exportado em `packages/types/src/index.ts`.

**Roundtrip E2E:** o cenário de quickstart §"Roundtrip" faz PATCH real → lê
`X-Policy-Version` do header da resposta + valida shape `{ data: { policies, policyVersion } }`
contra `PoliciesResponseSchema` (não mock) — protege contra drift snake_case/camelCase.

---

## Project Structure

### Documentação (feature dir)
```
docs/specs/feature-toggles-tenant/
├── spec.md                       # existente (com §Clarifications)
├── plan.md                       # este arquivo
├── research.md                   # 8 decisões empíricas ancoradas
├── data-model.md                 # entidade TenantPolicies + mapeamento focusMonitoring
├── quickstart.md                 # cenários (happy + 403 + roundtrip)
└── contracts/
    └── policies-api.md           # GET/PATCH /me/policies
```

### Source (árvore real do projeto)
```
apps/api/src/tenants/
├── policies.service.ts           # NOVO — getPolicies / updatePolicies
├── policies.service.spec.ts      # NOVO — unit tests service-level
├── tenants.controller.ts         # ESTENDER — 2 rotas /me/policies + X-Policy-Version
└── tenants.module.ts             # ESTENDER — providers PoliciesService; imports AuditModule+ConsentModule

apps/api/prisma/
├── schema.prisma                 # ESTENDER — model TenantPolicies + relação Tenant.policies
└── migrations/<ts>_tenant_policies/migration.sql   # NOVO — tabela + RLS

apps/api/test/rls/
└── tenant-policies.rls-spec.ts   # NOVO — padrão group-members.rls-spec.ts

packages/types/src/
├── policies/tenant-policies.ts   # NOVO — 3 schemas Zod
├── policies/tenant-policies.spec.ts  # NOVO — snapshot test
├── audit/index.ts                # ESTENDER — 'policy_change' em AUDIT_ACTIONS + snapshot
└── index.ts                      # ESTENDER — re-export policies

apps/web/src/
├── app/(authenticated)/app/admin/settings/policies/
│   ├── page.tsx                          # NOVO — PoliciesSettingsPage (Client)
│   └── _components/
│       ├── policy-toggle-list.tsx        # NOVO
│       ├── policy-toggle-item.tsx        # NOVO
│       └── privacy-confirm-dialog.tsx    # NOVO
├── hooks/use-policies.ts                 # NOVO — usePolicies + useUpdatePolicies
apps/web/messages/pt-BR.json              # ESTENDER — bloco "policies"
```

---

## Arquitetura

### Backend — fluxo de dados

**GET `/api/v1/tenants/me/policies`** (admin-only, sempre 200 — dec-012):
1. `KeycloakAuthGuard` + `RolesGuard(@ADMIN_TENANT)`.
2. `PoliciesService.getPolicies(tenantId via RequestContext)`:
   - Redis `GET cache:policies:{tenantId}` → hit: parse e usa.
   - Miss: lê `TenantPolicies` (`withTenantTx`) + `tenant.focusIndicatorEnabled`.
   - Merge: `{ ...POLICY_DEFAULTS, ...(row?.policies ?? {}), focusMonitoring: tenant.focusIndicatorEnabled }`.
   - Write-through: `SET cache:policies:{tenantId}` `{policies, policyVersion}` `EX 3600`.
   - Retorna `{ policies, policyVersion, tierInfo }`.
3. Controller seta `X-Policy-Version` via `@Res({ passthrough: true })`.
4. Retorna `{ data: { policies, tierInfo } }`.

**PATCH `/api/v1/tenants/me/policies`** (admin-only, 200):
1. Guards + `ZodValidationPipe(UpdatePoliciesSchema)`.
2. `PoliciesService.updatePolicies(dto)`:
   - `getPolicies()` → `previousState`.
   - Tier gating: para cada toggle Pro em `dto` (`focusMonitoring`, `mandatoryCamera`)
     → `PlanLimitsService.getPlan(tenantId)`; se `'free'` → `ForbiddenException`
     com mensagem acionável (i18n key `upgradePrompt`).
   - `focusMonitoring` (se presente) → `UPDATE tenants SET focus_indicator_enabled`.
   - Restantes → UPSERT `TenantPolicies`: `newPolicies = { ...currentJSONB, ...omit(dto,'focusMonitoring') }`;
     `id` via `uuidv7()` no create; `policyVersion = currentVersion + 1` (dec-010: SEMPRE).
   - Write-through Redis `SET` com `policyVersion` novo.
   - `audit.service.createEvent({ userId, action:'policy_change', resource:'tenant_policies', resourceId, payload:{ previousState, newState } })`
     (tenantId resolvido internamente pelo AuditService).
   - Se `focusMonitoring` transita OFF→ON: `eventEmitter.emit('focus-monitoring.enabled', {...})`.
3. Controller seta `X-Policy-Version` (novo).
4. Retorna `{ data: { policies: merged, policyVersion } }`.

### DI / módulo (Decision 6)
- `PoliciesService` injeta: `PrismaService`, `RedisService`, `PlanLimitsService`,
  `AuditService`, `ConsentRepository`, `EventEmitter2`.
- `TenantsModule`: adicionar `AuditModule` + `ConsentModule` aos imports
  (`PlanLimitsModule`/`RedisModule` já presentes). Adicionar `PoliciesService`
  aos `providers` (+ `exports` se consumido fora). EventEmitter2 vem do
  `EventEmitterModule.forRoot()` global do app.

### Frontend
- `usePolicies()` (TanStack Query) — GET; `useUpdatePolicies()` mutation com
  tipagem explícita `useMutation<PoliciesResponse, Error, UpdatePoliciesDto>`.
- `onSuccess`: lê `X-Policy-Version` da resposta; se difere do cache →
  `invalidateQueries(['policies'])` (dec-010).
- `PrivacyConfirmDialog` antes de ativar `focusMonitoring`/`mandatoryCamera`
  (toggles de privacidade) — WCAG AA.
- Tier badge + upgrade prompt renderizados de `tierInfo` (GET sempre traz).

---

## Sequência de implementação

Ordem por dependência (types → DB → backend → tests → FE). Cada passo é
gate-able por `tasks` no `/create-tasks`.

1. **Contratos Zod** (`packages/types`): `policies/tenant-policies.ts` (3 schemas)
   + re-export `index.ts` + `'policy_change'` em `AUDIT_ACTIONS` + snapshots.
   *Sem isso, BE e FE não tipam.*
2. **Schema + migration**: model `TenantPolicies` + relação `Tenant.policies`;
   `migration.sql` com tabela + RLS policy (FK→tenants `ON DELETE/UPDATE CASCADE`,
   sem `trigger_set_timestamp`). `prisma generate`.
3. **PoliciesService** + DI: novo service; estender `tenants.module.ts`
   (imports AuditModule+ConsentModule, providers PoliciesService).
   Confirmar `'focus_monitoring'` em `ConsentDocumentType` (adicionar se ausente).
4. **Controller**: 2 rotas `/me/policies` com guards + `ZodValidationPipe` +
   `@Res({ passthrough: true })` p/ `X-Policy-Version`.
5. **Unit tests** (`policies.service.spec.ts`): defaults, merge, focusMonitoring
   GET/PATCH, tier gating 403, write-through, audit, consent exemption, policyVersion.
6. **RLS spec** (`tenant-policies.rls-spec.ts`): 4 cenários (padrão group-members).
7. **Frontend**: `use-policies.ts` hook; `page.tsx` + 3 componentes; bloco i18n
   `policies` em `pt-BR.json`.
8. **Verificação**: lint + test + build verde; roundtrip empírico (quickstart).

---

## Mapeamento spec → plano

| Item spec | Coberto em plano |
|-----------|------------------|
| §2 D1 (focusMonitoring↔coluna) | Arquitetura/GET-PATCH; data-model §mapeamento; research D8 |
| §2 D2 (`/me/policies`) | Convenções de Borda (URL); Arquitetura |
| §2 D3 (sem módulo separado) | Sequência passo 3-4; research D6 |
| §2 D4 (defaults código) | Arquitetura GET (POLICY_DEFAULTS merge) |
| §2 D5 (write-through) | Arquitetura; research D4 |
| §2 D6 (tier gating 403) | Arquitetura PATCH; research D1 (`'free'`/`'pro'`) |
| §2 D7 (consent exemption) | research D8; Arquitetura PATCH 3.h |
| §2 D8 (audit policy_change) | research D2/D3; passo 1 |
| §4 modelo de dados | data-model.md |
| §5 contratos Zod | contracts/policies-api.md; passo 1 |
| §6 backend API | Arquitetura backend; passos 3-4 |
| §7 RLS spec | passo 6; data-model |
| §8 frontend | Arquitetura FE; passo 7 |
| §9 testes | passos 5-6; quickstart |
| §10 guardrails CI | Convenções de Borda + Constitution Check VI |
| §12 AC | quickstart (cenários) + mapeamento §9 |
| dec-008..012 | research D8 (008/012), D7→EventEmitter2 (009), policyVersion (010), DI (011) |

---

## Riscos / Atenções

- **Tier values lowercase** (research D1): comparar `getPlan() === 'free'`, não `'Free'`.
- **AuditModule/ConsentModule não importados** (research D6): erro de DI se esquecer.
- **`X-Policy-Version` via passthrough** (research D5): não usar `@Header()` estático.
- **RLS spec** deve seguir EXATAMENTE `group-members.rls-spec.ts` (UUIDs hex fixos,
  users globais antes do bind, `DATABASE_APP_URL`, nomes de coluna reais).
- **`'focus_monitoring'`** pode não existir em `ConsentDocumentType` — verificar/adicionar (spec D7).
- **Snapshot AUDIT_ACTIONS** quebra ao adicionar `policy_change` — atualizar inline (esperado).

---

## Artefatos

| Arquivo | Status |
|---------|--------|
| docs/specs/feature-toggles-tenant/plan.md | Criado |
| docs/specs/feature-toggles-tenant/research.md | Criado |
| docs/specs/feature-toggles-tenant/data-model.md | Criado |
| docs/specs/feature-toggles-tenant/contracts/policies-api.md | Criado |
| docs/specs/feature-toggles-tenant/quickstart.md | Criado |

### Próximos passos
1. `/checklist` — quality gate antes de implementar.
2. `/create-tasks` — decompor em backlog executável.
3. `/analyze` — validar consistência cross-artifact.
