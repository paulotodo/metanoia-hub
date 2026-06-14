# Contract: GET /api/v1/users/check-emails

Verifica quais e-mails de uma lista já estão cadastrados **no tenant corrente**.
Leitura pura, stateless, tenant-scoped (FR-18/19/20/21).

---

## Endpoint

```
GET /api/v1/users/check-emails?emails=<csv-list>
```

- **Controller**: `apps/api/src/users/users.controller.ts` (`@Controller('api/v1/users')`)
- **Auth**: `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN_TENANT)`
- **Rate-limit**: `@UseGuards(CheckEmailsRateLimitGuard)` (in-memory, padrão do projeto)
- **Validação query**: `@Query(new ZodValidationPipe(checkEmailsQuerySchema))`

---

## Request

| Param | Local | Tipo | Regras |
|-------|-------|------|--------|
| `emails` | query | string (CSV) | `?emails=a@x.com,b@y.com`; cada item e-mail válido; **≤ 500 itens** (FR-20); cap defensivo de bytes de URL no cliente |

`checkEmailsQuerySchema` (Zod 4, em `packages/types`):
```
z.object({
  emails: z.string()
    .transform((s) => s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
    .pipe(z.array(z.string().email()).min(1).max(500)),
})
```

> Cliente divide automaticamente em batches de ≤500 quando o total excede o
> limite (FR-20); o servidor valida ≤500 por request como hard cap.

---

## Response — 200 OK

Padrão `{ data, meta? }` (Princípio IV), camelCase:

```json
{
  "data": {
    "results": [
      { "email": "joao@igreja.org", "exists": true },
      { "email": "maria@igreja.org", "exists": false }
    ]
  },
  "meta": { "checkedCount": 2, "tenantScoped": true }
}
```

- `exists`: true SOMENTE se o e-mail existe no **tenant corrente** (RLS).
- Ordem de `results` espelha a entrada (cliente correlaciona por `email`).

---

## Erros (padronizados, sem stack trace)

| Status | Quando | Body |
|--------|--------|------|
| 400 | `emails` ausente, vazio, item inválido, ou > 500 | `{ statusCode, error, message }` |
| 401 | sem token Keycloak | `{ statusCode, error, message }` |
| 403 | role ≠ admin_tenant | `{ statusCode, error, message }` |
| 429 | rate-limit excedido | `{ statusCode, error, message }` |

> Frontend trata 429/5xx/timeout como **degradação graciosa** (FR-21): exibe
> preview sem indicador de duplicatas + aviso discreto. Não bloqueia o preview.

---

## Implementação (backend)

- `users.service.checkEmailsInTenant(emails: string[]): Promise<{ email, exists }[]>`
- Dentro de `withTenantTx`: `prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } })` → RLS confina ao tenant.
- Mapear: para cada e-mail de entrada, `exists = encontrados.has(email)`.
- **Sem `$queryRaw`** → sem nomes de coluna manuais; Prisma client + RLS.

---

## Segurança (OWASP — ver research.md Decision 6)

- **A01/API3 (user-enumeration)**: mitigado por auth + role + tenant-scope +
  rate-limit. Enumeração restrita a e-mails do próprio tenant (que o Admin já
  gerencia). Sem vazamento cross-tenant.
- **SC-007**: apenas e-mails trafegam — nenhum outro dado do arquivo é enviado.
