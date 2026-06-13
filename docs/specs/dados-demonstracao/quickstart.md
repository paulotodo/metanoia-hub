# Quickstart: dados-demonstracao (Story 10-2)

---

## Pré-requisitos

```bash
# Docker rodando
docker compose up -d

# Deps instaladas
pnpm install

# Build dos packages (inclui @metanoia/types)
pnpm turbo build --filter=@metanoia/types

# Migration aplicada
pnpm --filter @metanoia/api exec prisma migrate dev
```

---

## Cenário 1 — Seed manual (dev/test)

```bash
# Seed para um tenant específico (ex: tenant de dev local)
pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id <uuid-do-tenant>

# Verificar registros criados
pnpm --filter @metanoia/api exec prisma studio
# → groups WHERE is_demo_data = true → deve ter "Grupo Alpha"
# → users WHERE is_demo_data = true → deve ter Marcos Silva, Ana Costa, Pedro Santos, Maria Oliveira
```

**Expected:** 4 usuários demo, 1 grupo, 4 membros, 1 trilha, 2 módulos, 4 aulas, progresso por participante, 1 reunião, 3 ações pastorais. Total: ~13 registros distribuídos nas 12 tabelas.

---

## Cenário 2 — Seed automático no provisioning

1. Criar tenant via super-admin: `POST /api/v1/super-admin/tenants`
2. Aguardar provisioning completar (polling `GET /api/v1/super-admin/tenants/:id/provision-status`)
3. Verificar status `active`
4. Chamar `GET /api/v1/onboarding/demo-status` com token de `admin_tenant` do novo tenant
5. **Expected:** `{ hasDemoData: true, hasRealData: false, nudgeDismissed: false, demoRecordCount: 13 }`

---

## Cenário 3 — Idempotência do seed

```bash
# Rodar seed duas vezes no mesmo tenant
pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id <uuid>
pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id <uuid>

# Verificar contagem (deve ser idêntica nas duas execuções)
pnpm --filter @metanoia/api exec prisma studio
# → groups WHERE is_demo_data = true → exatamente 1 registro
# → users WHERE is_demo_data = true → exatamente 4 registros
```

**Expected:** zero duplicatas. Upsert via UUID fixos garante idempotência.

---

## Cenário 4 — Limpeza via endpoint

```bash
# Com token admin_tenant
curl -X DELETE http://localhost:3001/api/v1/onboarding/demo-data \
  -H "Authorization: Bearer <token>" \
  -v

# Expected: HTTP 204 No Content

# Verificar limpeza total
curl http://localhost:3001/api/v1/onboarding/demo-status \
  -H "Authorization: Bearer <token>"
# Expected: { "data": { "hasDemoData": false, "hasRealData": false, ... } }
```

---

## Cenário 5 — Isolamento de tenant (RLS)

```bash
# Rodar seed para tenant A
pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id <uuid-tenant-A>

# Chamar DELETE com token de tenant B
curl -X DELETE http://localhost:3001/api/v1/onboarding/demo-data \
  -H "Authorization: Bearer <token-tenant-B>"

# Expected: HTTP 204 — mas dados do tenant A intactos
curl http://localhost:3001/api/v1/onboarding/demo-status \
  -H "Authorization: Bearer <token-tenant-A>"
# Expected: { "data": { "hasDemoData": true, ... } }  ← ainda tem demo data
```

---

## Cenário 6 — Roundtrip End-to-End (shape validation)

```bash
# 1. Seed tenant
pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id <uuid>

# 2. Chamar endpoint real (não mock)
curl http://localhost:3001/api/v1/onboarding/demo-status \
  -H "Authorization: Bearer <token>" \
  | jq .

# 3. Validar shape com Zod
node -e "
const { DemoStatusResponseSchema } = require('@metanoia/types');
const payload = { hasDemoData: true, hasRealData: false, nudgeDismissed: false, demoRecordCount: 13 };
console.log(DemoStatusResponseSchema.safeParse(payload));
"
```

**Expected:** `success: true` — payload do backend parseável pelo schema Zod do frontend sem erros. Este cenário detecta divergência camelCase vs snake_case antes de acumular drift.

---

## Cenário 7 — Badge visual (FE)

1. Logar como admin do tenant com demo data
2. Navegar para `/app/admin/grupos`
3. **Expected:** grupo "Grupo Alpha" exibe badge "Dados de demonstração" com opacidade/borda diferenciada

---

## Cenário 8 — Nudge primeiro grupo real

1. Tenant com demo data (sem grupos reais)
2. Admin cria um grupo real via UI
3. **Expected:** banner "Você já tem dados reais! Deseja remover os dados de demonstração?" aparece
4. Clicar "Manter por enquanto"
5. Recarregar página
6. **Expected:** nudge não reaparece (dismiss permanente via `demoDismissedAt` no metadata)

---

## Troubleshooting

| Problema | Diagnóstico |
|----------|-------------|
| Seed falha com FK violation | Verificar se a migration foi aplicada (`prisma migrate status`) |
| `isDemoData` não aparece no Prisma Studio | Executar `prisma generate` após migration |
| RLS spec falha com `PrismaClientKnownRequestError` | Usar `PrismaPg({ connectionString: DATABASE_APP_URL })` e não `DATABASE_URL` |
| Seed idempotência falha (duplicatas) | Verificar que os UUIDs fixos têm prefixo `01989b10-1002-7...` (não `019899a0-7002-...` do 7-2) |
| CI falha em `lesson_progress` cascade | `lesson_progress` não tem `isDemoData` — limpeza ocorre por cascade ao deletar `lessons` |
