# Contrato de Borda: ErrorDetails do 403 PlanLimitReached

**Gerado por**: pipeline feature-00c (plan / Phase 1), 2026-06-14

> Este contrato JÁ está implementado no backend. A feature o **congela** como borda
> BE↔FE; nenhuma mudança de backend é necessária.

---

## Produtor (backend)

Lançado por:
- `apps/api/src/common/plan-limits/plan-limits.guard.ts` (recurso `groups` via `@PlanLimit`)
- `apps/api/src/group-members/group-members.service.ts` (recursos `membersPerGroup`, `leadersPerTenant`)

Moldado pelo `AllExceptionsFilter` (`apps/api/src/common/filters/http-exception.filter.ts`).

## Shape do envelope de erro (resposta HTTP 403)

```jsonc
{
  "statusCode": 403,
  "error": "PlanLimitReached",          // ∈ ALLOWED_DOMAIN_ERRORS; usado por ERROR_NAME_TO_KEY no FE
  "message": "Plan free allows up to 3 groups; current count: 3.",  // INGLÊS — log/debug; FE NUNCA exibe (FR-006/dec-009)
  "details": {
    "resource": "groups",               // ∈ {"groups","membersPerGroup","leadersPerTenant"} — canônico EN
    "plan": "free",                      // "free" | "pro" | "enterprise" — NÃO exibido ao usuário
    "current": 3,                        // count real do tenant (sob RLS via withTenantTx)
    "limit": 3                           // limite efetivo (override > plano > fallback)
  }
}
```

## Consumidor (frontend)

`apps/web/src/lib/api/client.ts` → `ApiError { statusCode, error, message, details }`.
`apps/web/src/lib/errors/error-messages.ts` → `resolveError(error)`.

### Regras de consumo (contrato que a feature implementa)

1. `error.error === 'PlanLimitReached'` → ramo de limite de plano.
2. Selecionar a chave PT-BR a partir de `details.resource` (mapa `RESOURCE_TO_KEY`):
   - `groups` → `error.plan.limit.groups`
   - `membersPerGroup` → `error.plan.limit.membersPerGroup`
   - `leadersPerTenant` → `error.plan.limit.leadersPerTenant`
3. Interpolar `{current}` / `{limit}` a partir de `details`.
4. Fallback `error.plan.limitGeneric` se: `details` ausente, `resource` desconhecido,
   OU o template ainda contém `{` após interpolação (FR-005).
5. `message` (inglês) NUNCA é exibido ao usuário (FR-006). Teste
   `'never echoes the raw backend message'` protege esta regra.

## Invariantes de borda

| Invariante | Garantia |
|------------|----------|
| `resource` sempre em inglês canônico | produtor (backend) — fonte da verdade `plan-limits.config.ts` |
| `current`/`limit` refletem override do tenant | `hasCapacity` resolve antes de lançar |
| `enterprise` (Infinity) nunca gera 403 | `hasCapacity` retorna `allowed: true` |
| Sem validação Zod do `details` | mantido como está (dec-011); FE faz narrowing defensivo |

## Versionamento

Sem mudança de contrato. Caso futuro adicione um novo `resource`, o FE deve cair no
fallback genérico (FR-005) até a chave PT-BR correspondente ser adicionada — sem
quebra, sem placeholder visível.
