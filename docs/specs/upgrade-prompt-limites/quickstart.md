# Quickstart / Cenários de Teste: upgrade-prompt-limites

**Gerado por**: pipeline feature-00c (plan / Phase 1), 2026-06-14

Cenários de verificação para `resolveError` + `pt-BR.json`. Todos exercitam o
contrato real do backend (`details.resource` em inglês canônico).

---

## Cenário 1 — Limite de grupos (P1, happy path do erro)

1. Backend lança 403: `error: 'PlanLimitReached'`, `details: { resource: 'groups', plan: 'free', current: 3, limit: 3 }`.
2. FE captura `ApiError` e chama `resolveError(err)`.
3. **Expected**:
   - `errorKey === 'plan.limit.groups'`
   - `message` contém "comunidades de cuidado"
   - `message` contém "3/3" (ou "3" e "3" interpolados)
   - `message` contém orientação ("administrador" / "ampliar o plano")
   - `message` NÃO contém "groups" (termo técnico) nem "{" (placeholder)

## Cenário 2 — Limite de membros por grupo (P2)

1. Backend (group-members.service) lança 403: `details: { resource: 'membersPerGroup', plan: 'pro', current: 100, limit: 100 }`.
2. `resolveError(err)`.
3. **Expected**:
   - `errorKey === 'plan.limit.membersPerGroup'`
   - `message` contém "participantes do grupo"
   - texto diferencia capacidade do grupo de limite da conta (frase específica)
   - sem "membersPerGroup", sem "{"

## Cenário 3 — Limite de líderes por tenant (P3)

1. Backend lança 403: `details: { resource: 'leadersPerTenant', plan: 'pro', current: 50, limit: 50 }`.
2. `resolveError(err)`.
3. **Expected**:
   - `errorKey === 'plan.limit.leadersPerTenant'`
   - `message` contém "pastores/líderes ativos"
   - sem "leadersPerTenant", sem "leaders", sem "{"

## Cenário 4 — Fallback genérico (P4, FR-005)

1a. Backend lança 403 SEM `details` (`new ApiError(403, 'PlanLimitReached', 'plan exceeded')`).
1b. OU `details.resource` desconhecido (ex: `resource: 'futureResource'`).
2. `resolveError(err)`.
3. **Expected**:
   - `errorKey === 'plan.limitGeneric'`
   - `message` é pastoral e acionável
   - `message` NÃO contém "{" (nenhum placeholder literal)

## Cenário 5 — Tenant com override (Edge Case da spec)

1. Tenant com `planLimitsOverride` → backend lança 403 com `current/limit` JÁ
   resolvidos pelo override (ex: `{ resource: 'groups', current: 10, limit: 10 }`).
2. `resolveError(err)`.
3. **Expected**: mensagem usa "10/10" (valor real do override), não o default do
   plano. (FE não faz nada especial — os valores chegam prontos no `details`.)

## Cenário 6 — Não vazar `message` técnico (FR-006, regressão a preservar)

1. `new ApiError(403, 'PlanLimitReached', 'TypeError-ish internal log text', { ... })`.
2. `resolveError(err)`.
3. **Expected**: `message` resolvido NÃO contém o texto do `message` do backend
   (só o texto PT-BR de `pt-BR.json`).

## Cenário 7 — Snapshot do mapa por recurso (SC-3)

1. Para cada `resource` ∈ {groups, membersPerGroup, leadersPerTenant}, resolver com
   `current: 1, limit: 1`.
2. **Expected**: os 3 textos resolvidos são distintos entre si e estáveis (snapshot),
   garantindo cobertura/contextualização por recurso.

## Cenário 8 — Roundtrip conceitual (borda BE↔FE)

1. Tomar o payload EXATO que `plan-limits.guard.ts:48-53` produz (`resource` em
   inglês), construir `ApiError` com esse shape e passar ao `resolveError`.
2. **Expected**: nenhum cenário acima depende de o backend enviar substantivo PT — o
   FE traduz a partir do `resource` canônico. (Este cenário existe para impedir o
   retorno do bug do teste antigo que assumia `resource: 'grupos'`.)

---

## Regressões a preservar (não quebrar)

- Testes existentes de `resolveError`: `permission.denied`, `notFound.generic`,
  `conflict.consentRequired`, `network.failed`, `unknown.generic`, preservação de
  `statusCode`, "never echoes raw backend message".
- Testes de backend (`plan-limits.guard.spec.ts`, `plan-limits.service.spec.ts`,
  `http-exception.filter.spec.ts`) — **inalterados** (backend não muda).
