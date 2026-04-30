# Cenário 06 — Participante abre seus grupos (validação manual)

Checklist reproduzível para validar localmente o golden flow do Cenário 06 (Juliana / Bruno) contra o backend real (sem MSW).

> Tempo estimado: ~10 min após setup. Use sempre que tocar em `apps/api/src/participant-groups/**`, `apps/web/src/lib/api/hooks/use-participant-groups.ts` ou `apps/web/app/(authenticated)/app/consumo/grupos/**`.

---

## Pré-requisitos

- Docker + Docker Compose
- Node 22+, pnpm 10.33+
- `pnpm install` executado

---

## Setup

### 1. Subir infra local

```bash
docker compose up -d
```

✅ Postgres `:5432`, Redis `:6379`, Keycloak `:8080`.

### 2. Migrar BD + RLS

```bash
pnpm --filter @metanoia/api db:setup
```

✅ migrations + RLS policies sem erro.

### 3. Semear dados do Cenário 03 (reaproveitado)

```bash
pnpm --filter @metanoia/api db:seed:scenario-03
```

O seed do Cenário 03 cobre Cenário 06: cria **Bruno Almeida** (`bruno@caminhonovo.org`) como membro do **Grupo Quarta 19h** (líder Marcos Silva). Carla e Diana também são membros — peers visíveis no detalhe.

### 4. Iniciar API

```bash
pnpm --filter @metanoia/api dev
```

✅ NestJS em `http://localhost:3001`.

### 5. Iniciar Web (sem MSW)

```bash
NEXT_PUBLIC_API_MOCKING=disabled NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 pnpm --filter @metanoia/web dev
```

✅ Next em `http://localhost:3000`. DevTools → Network: requests devem ir direto a `localhost:3001` (ou via rewrite Next se `NEXT_PUBLIC_API_URL` apontar para `/api/v1`). **Nenhum request interceptado pelo MSW worker.**

🐛 Se aparecer `[MSW]` no console: variável `NEXT_PUBLIC_API_MOCKING` ficou em `enabled` em algum `.env.local`. Rebote o dev server depois de ajustar.

---

## Golden flow

### 6. Login como Bruno

- Abre `http://localhost:3000` → login com `bruno@caminhonovo.org` (senha definida no Keycloak local).
- ✅ Após login, redirect para área autenticada de participante.

### 7. Lista de grupos (`/app/consumo/grupos`)

- Navegar a `/app/consumo/grupos`.
- ✅ Vê 1 card: **Grupo Quarta 19h**, líder **Marcos**, próximo encontro com horário/dia.
- ✅ Primeira visita: banner / boas-vindas (`firstVisit: true`). Refresh da página → banner some (`firstVisit: false`). Flag está em Redis (`participant:first-visit-groups:{userId}`), nunca expira.

🐛 Se nada aparecer: DevTools → Network → `GET /api/v1/participant/groups` deve dar `200` com `data.length > 0`. Se vier `[]`, a `Group.members` do Bruno não foi seeded — re-rodar seed.

### 8. Detalhe do grupo (`/app/consumo/grupos/[id]`)

- Clicar no card.
- ✅ Vê header: nome, líder (apenas primeiro nome + avatar opcional), recurrence, próxima reunião, formato/duração quando disponíveis.
- ✅ Lista de **outros participantes** (peers) mostra **Carla**, **Diana** — apenas primeiro nome, sem avatar nem contacto.
- ✅ Bruno **NÃO aparece** na lista de peers (privacy 06.5).

### 9. 404 para grupo de outro tenant / não-membro

- Manualmente, navegar a `/app/consumo/grupos/00000000-0000-0000-0000-000000000000`.
- ✅ UI mostra estado de "não encontrado" (sem distinção entre "não existe" e "você não é membro" — privacy spec).
- ✅ Network: `GET /api/v1/participant/groups/00000000-...` → `404`.

---

## Sanity checks adicionais

### Auth header

DevTools → Network → qualquer request `/api/v1/participant/...`:

- ✅ `Authorization: Bearer <jwt>` presente.
- ✅ JWT decodifica para `sub` = userId do Bruno.

### Multi-tenant isolation

- Em sessão paralela, logar com utilizador de outro tenant.
- Acessar `/app/consumo/grupos`.
- ✅ Lista NÃO mostra "Grupo Quarta 19h" (nem qualquer grupo de Caminho Novo).

🐛 Se houver leak: RLS quebrada — NÃO deploy.

### MSW desligado em dev/prod

- Inspecionar `apps/web/public/mockServiceWorker.js` está apenas se MSW foi executado uma vez. O gate `NEXT_PUBLIC_API_MOCKING !== 'enabled'` em `apps/web/src/lib/msw/msw-bootstrap.ts` impede `worker.start()` em dev/prod por default.
- ✅ `console.log` do app não imprime nada relacionado a `[MSW]`.

---

## Como reportar bug encontrado

1. Captura passo + comportamento esperado vs. observado.
2. Anexa:
   - Screenshot da UI.
   - Print DevTools → Network → request (URL, status, headers, body).
   - Console NestJS dos últimos 10s.
3. Issue com labels `cenario-06` + `bug`, linkando linha desta checklist.

---

## Quando rodar

- ✅ Antes de PR que mexa em `apps/api/src/participant-groups/**` ou `apps/web/app/(authenticated)/app/consumo/grupos/**` ou `use-participant-groups.ts`.
- ✅ Em qualquer release que inclua Cenário 06.
- ✅ Sempre que mudar contracts de `@metanoia/types/participant-group.ts`.
