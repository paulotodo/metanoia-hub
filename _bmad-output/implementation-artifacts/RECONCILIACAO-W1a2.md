# Reconciliação WDS↔BMad — Wave W1a.2

> Pré-flight executado 2026-06-10. Auditoria do código real (apps/api + apps/web)
> contra o escopo de 3-1, 3-2, 2-9. 3 agentes independentes.

## Resultado

| Story | Classificação | Ação recomendada |
|---|---|---|
| 3-1 Provisionamento transacional | **JÁ-COBERTA** | Marcar `done` (Cenário 09) |
| 2-9 Recuperação de senha | **JÁ-COBERTA funcional** (divergência + email deferido) | Marcar `done` com ADR + deferir email p/ 14-3 |
| 3-2 Gestão de tenants super-admin | **PARCIAL ~85%** | `/feature-00c` só p/ AC#5; AC#7/#8 deferidos |

## 3-1 — JÁ-COBERTA (100%)
Cenário 09 (PRs #82-#86). `apps/api/src/super-admin/super-admin-tenants.{controller,service,repository}.ts`:
saga de provisionamento (DB → Keycloak → invite), retry de `provisioning_failed` (202),
slug regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` (422) + slug duplicado (409), RLS na tabela tenants,
Tenant model (UUID v7, status/plan enum, plan_limits_override JSONB), testes service+snapshot,
frontend `app/admin/super/tenants/novo` + `[id]` (retry). Keycloak steps mockados (consistente com MVP).
**Residual: nenhum.**

## 2-9 — JÁ-COBERTA funcional, 2 ressalvas
Cenário 07 (PRs #72-#75). Cobertura por AC: AC#1 link login ✅, AC#2 form + resposta genérica
anti-enumeration ✅, AC#4 reset + validação OWASP + auto-login + redirect role-based ✅,
AC#5 token expirado/usado (mensagens pastorais 404/410) ✅, AC#6 rate-limit Redis (3/h) ✅.
Backend `password-recovery.{controller,service}.ts`, worker `recovery-email.worker.ts`,
frontend `/recuperar-senha` + `/nova-senha/[token]`, schemas em `packages/types/src/auth/password-recovery.ts`.

**Ressalva 1 (divergência arquitetural)**: a story pedia o realm action `FORGOT_PASSWORD`
nativo do Keycloak; a impl usa **tokens Redis próprios (UUID, TTL 900s) + BullMQ**. Funcional e
controlado, mas diverge. → Decisão: aceitar e documentar em ADR, OU reimplementar via Keycloak.

**Ressalva 2 (email transport)**: `recovery-email.worker.ts` é placeholder (TODO: SendGrid/Resend),
só loga. Transporte real de e-mail é escopo do **Epic 14 / Story 14-3 (Resend)**. → Deferir.

## 3-2 — PARCIAL (~85%)
Cenário 09. Coberto: AC#1 listar paginado, AC#2 filtros (status/plan/search), AC#3 RLS bypass
via PrismaAdminService, AC#4 detalhe, AC#5 PATCH (name+status). Frontend + Zod + guards `super_admin`.

Escopo residual:
1. **AC#5 (implementável já)**: retornar `updated_at` na response do PATCH e suportar `metadata`
   genérico (hoje só name+status). Pequeno e self-contained.
2. **AC#7 (DEFERIR)**: ao suspender tenant, invalidar sessões Keycloak + logout forçado.
   TODO explícito em `super-admin-tenants.service.ts`. Depende de Keycloak Admin API real
   (hoje mockada em todo o MVP). Deferir até integração Keycloak real.
3. **AC#8 (DEFERIR)**: audit log formal `action: "tenant.suspended"` (hoje só `Logger.log`).
   Depende de infraestrutura de auditoria imutável — **Epic 9 / Story 9-3**.

## Impacto no plano
- W1a.2: 2 marcações diretas (3-1, 2-9) + 1 PR pequeno (3-2 AC#5).
- Novos itens de deferimento cross-epic: AC#7 (Keycloak real), AC#8 (→9-3), email 2-9 (→14-3).
