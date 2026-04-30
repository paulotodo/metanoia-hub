# Cenário 09 — Super Admin opera plataforma (validação manual)

Checklist reproduzível para validar o golden flow do Cenário 09 (Paulo / Super Admin) contra o backend real.

> Tempo estimado: ~15 min após setup. Use sempre que tocar em `apps/api/src/super-admin/**` ou `apps/web/app/(authenticated)/app/admin/super/**`.

---

## Pré-requisitos

- Docker + Docker Compose
- Node 22+, pnpm 10.33+
- `pnpm install` executado
- Keycloak local com realm `metanoia` e usuário com role `super_admin`

---

## Setup

### 1. Subir infra

```bash
docker compose up -d
```

✅ Postgres `:5432`, Redis `:6379`, Keycloak `:8080`.

### 2. Migrar BD

```bash
pnpm --filter @metanoia/api db:setup
```

✅ Inclui migration `add_super_admin_tenant_columns` (slug, plan, status, admin_email, provisioning_state).

### 3. Criar usuário super_admin no Keycloak

No console Keycloak (http://localhost:8080), realm `metanoia`:

1. Criar usuário `paulo@metanoia-hub.dev`, definir senha
2. Atribuir role `super_admin` (criar role se não existir)
3. Verificar JWT inclui `realm_access.roles: ["super_admin"]`

### 4. Iniciar API

```bash
pnpm --filter @metanoia/api dev
```

✅ NestJS em `http://localhost:3001`. Endpoints `/api/v1/admin/super/tenants` montados.

### 5. Iniciar Web (sem MSW)

```bash
NEXT_PUBLIC_API_MOCKING=disabled pnpm --filter @metanoia/web dev
```

---

## Golden flow

### 6. Login como Paulo

- Acesse `http://localhost:3000` → login com `paulo@metanoia-hub.dev`
- ✅ Após login, JWT inclui role `super_admin`

### 7. Dashboard (`/app/admin/super/tenants`)

- Navegar a `/app/admin/super/tenants`
- ✅ Lista paginada de tenants existentes (pode estar vazia em DB limpo)
- ✅ Network: `GET /api/v1/admin/super/tenants?page=1&limit=20...` → 200
- ✅ Filtros status/plano funcionam (re-fetch)
- ✅ Search filtra por nome/slug

🐛 Se 403: usuário não tem role `super_admin` no JWT.

### 8. Provisionar novo tenant (`/app/admin/super/tenants/novo`)

- Clicar **"+ Novo Tenant"**
- Preencher: nome `Igreja Teste`, slug auto-suggested `igreja-teste`, email `admin@teste.org`, plano Free
- Clicar **"Criar Tenant"**
- ✅ Network: `POST /api/v1/admin/super/tenants` → 202 com `{ data: { tenantId, status: "provisioning" } }`
- ✅ UI muda para saga stepper view; polling `GET /provision-status` a cada 2s
- ✅ Saga avança steps 1→2→3 (Keycloak/invite **mockados nesta versão** — Sprint 2 implementa real)
- ✅ Quando `status: "done"`, redirect automático para `/app/admin/super/tenants/{id}`

### 9. Conflict de slug

- Voltar a `/novo`, tentar criar com slug `igreja-teste` (já existe)
- ✅ Network: `POST` → 409
- ✅ UI mostra mensagem inline em `provision-slug-conflict`: "Esse slug já está em uso..."

### 10. Detalhe (`/app/admin/super/tenants/{id}`)

- ✅ Header com nome + badge status (Active)
- ✅ InfoCard: slug, plan, createdAt, adminEmail, inviteStatus
- ✅ NumbersCard: members/groups/leaders counts (zerados em tenant novo)
- ✅ ActionsCard mostra **Suspend** (status active)

### 11. Editar nome inline

- Clicar **"Editar nome"** → input + Save/Cancel
- Mudar para `Igreja Teste Renomeada`, Save
- ✅ Network: `PATCH /api/v1/admin/super/tenants/{id}` com `{ name }` → 200
- ✅ Header atualiza com novo nome

### 12. Suspender

- Clicar **"Suspender tenant"**
- ✅ Modal `tenant-detail-suspend-dialog` abre com warning
- Clicar **"Sim, suspender"**
- ✅ Network: `PATCH` com `{ status: "suspended" }` → 200
- ✅ Badge muda para Suspended; ActionsCard agora mostra **Reactivate** (não Suspend)

### 13. Reativar

- Clicar **"Reativar tenant"**
- ✅ Network: `PATCH` com `{ status: "active" }` → 200
- ✅ Badge volta para Active

### 14. Privacy boundary check

DevTools → Network → response do `GET /api/v1/admin/super/tenants/{id}`:

- ✅ Body contém apenas: id, name, slug, plan, status, createdAt, adminEmail, inviteStatus, memberCount, groupCount, leaderCount
- ✅ Body **NÃO** contém: lista de members com nomes, lista de groups com nomes, dados de radar/care/reflections

🐛 Se aparecer qualquer dado pastoral individual: alertar imediatamente — quebra de boundary arquitetural.

---

## Sanity checks

### Multi-tenant isolation

- Em sessão paralela, logar como Admin Tenant (não Super Admin) e tentar acessar `/app/admin/super/tenants`
- ✅ Network: 403 Forbidden no `GET /api/v1/admin/super/tenants`

### Migration idempotência

```bash
pnpm --filter @metanoia/api db:setup  # rodar 2ª vez
```

- ✅ Sem erro; migrations já aplicadas são puladas

---

## Pendências documentadas (Sprint 2 backlog)

- Step 2 do saga (Keycloak realm + admin user) está **mockado com logger**. Sprint 2 implementa integração real via admin REST API do Keycloak.
- Step 3 (invite email) também mockado.
- `inviteStatus` retornado é hardcoded `'sent'`; Sprint 2 deriva do estado real do Keycloak invite.
- Suspend não invalida sessões Keycloak ainda (apenas muda status no DB).
- Saga roda in-process; não sobrevive restart de processo. Sprint 2 move para BullMQ.

## Quando rodar

- ✅ Antes de PR que mexa em `apps/api/src/super-admin/**` ou `apps/web/app/(authenticated)/app/admin/super/**`.
- ✅ Em qualquer release que inclua Cenário 09.
- ✅ Sempre que mudar contracts de `@metanoia/types/super-admin-tenant.ts` ou a migration `add_super_admin_tenant_columns`.
