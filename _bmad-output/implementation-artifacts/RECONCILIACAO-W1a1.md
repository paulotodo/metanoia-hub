# Reconciliação WDS↔BMad — Wave W1a.1

> Pré-flight executado 2026-06-09. Auditoria do código real (apps/api + apps/web)
> contra o escopo das stories. Fonte: 3 agentes de auditoria independentes.

## Resultado

| Story | Classificação | Ação recomendada |
|---|---|---|
| 2-6 RLS | **JÁ-COBERTA** | Marcar `done` com evidência (sem implementação) |
| 2-4 Authz Guards | **PARCIAL** | `/feature-00c` com escopo reduzido (só residual) |
| 2-5 Tenant Select | **PARCIAL** | `/feature-00c` com escopo reduzido (só residual) |

## 2-6 — JÁ-COBERTA (100%)

Implementada de forma transversal pelas Stories **7-5** (NULLIF consolidation) e
**7-7** (withTenantTx enforcement), ambas merged antes de 2026-05-13.

Evidência:
- RLS policies NULLIF em 20 tabelas — `migrations/20260510210000_consolidate_rls_nullif/migration.sql`
- `withTenantTx` (SET LOCAL app.current_tenant_id) — `apps/api/src/prisma/with-tenant-tx.ts`, 118 callsites em 24 repos
- `RequestContext` AsyncLocalStorage — `apps/api/src/common/context/request-context.ts`
- 16 specs de isolamento (2 tenants, SELECT/UPDATE/DELETE/INSERT, JOINs, aggregations) — `apps/api/test/rls/`
- CI gate — `.github/workflows/ci.yml` "Run RLS isolation tests"

**Residual: nenhum.**

## 2-4 — PARCIAL (residual a implementar)

Já existe (não refazer):
- `apps/api/src/auth/keycloak.guard.ts` — Layer 1 (JWT signature/exp/issuer/audience, extrai realm_roles/tenant_id) + spec
- `apps/api/src/auth/roles.guard.ts` + `decorators/roles.decorator.ts` — Layer 2 (roles) + spec

Escopo residual:
1. **`TenantGuard`** (`apps/api/src/auth/guards/tenant.guard.ts`) — valida `user.tenantId == resource.tenant_id`; bypass `super_admin`; 403 em mismatch. **Crítico**: hoje a defesa de tenant é só RLS (opt-in).
2. **Enum `Role`** formal (`super_admin`, `admin_tenant`, `lider`, `participante`) — hoje strings inline.
3. **Logging Pino** de rejeição: `action: "auth.access.denied"`, user_id, endpoint, required_role.
4. **Testes de integração 3-camadas** — super_admin acessa qualquer tenant; admin_tenant bloqueado fora do tenant.

## 2-5 — PARCIAL (~70%, residual a implementar)

Já existe (não refazer — Cenário 08, PRs #69-#71):
- Backend: `apps/api/src/auth/tenant-selection.{controller,service}.ts` (my-tenants + select-tenant, Redis 30d, valida membership)
- Frontend: `apps/web/app/(authenticated)/selecionar-igreja/` + `src/components/tenant/tenant-switcher.tsx` + `src/lib/tenant/use-active-tenant-id.ts`
- Contratos: `packages/types/src/auth/tenant-selection.ts`
- RequestContext popula tenant_id via Redis override no `keycloak.guard.ts`

Escopo residual:
1. **Auto-select** quando `myTenants.length === 1` no pós-login (AC#8-9) — hoje sempre mostra a tela.
2. **Robustez JWT↔Redis** (AC#4) — select-tenant só seta Redis; se Redis cair, JWT antigo prevalece. Definir fallback/refresh.
3. **DEFERIDO p/ Epic 11**: indicador de plano expirado + view limitada (AC#13-15). Não implementar na 2-5; depende de `planStatus` que é escopo de planos/limites.

## Impacto no plano

- W1a.1 cai de 3 stories full para: **1 marcação direta (2-6)** + **2 stories de escopo reduzido (2-4, 2-5)**.
- AC#13-15 da 2-5 migram para o Epic 11 (W1b.8) — anotar dependência cruzada.
