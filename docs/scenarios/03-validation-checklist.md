# Cenário 03 — Pastor abre vista agregada (validação manual)

Checklist reproduzível para validar localmente o golden flow do Cenário 03 contra o backend real (sem MSW).

> Tempo estimado: ~15 min após setup. Use sempre que tocar em `apps/api/src/admin-pastoral/**` ou `apps/web/app/(authenticated)/app/admin/igreja/**`.

---

## Pré-requisitos

- Docker + Docker Compose
- Node 22+, pnpm 10.33+
- Repositório clonado e com dependências instaladas (`pnpm install`)

---

## Setup

### 1. Subir infra local

```bash
docker compose up -d
```

Verifica:
- ✅ Postgres em `localhost:5432`
- ✅ Redis em `localhost:6379`
- ✅ Keycloak em `http://localhost:8080`

### 2. Migrar BD + RLS

```bash
pnpm --filter @metanoia/api db:setup
```

✅ migrations + RLS policies aplicadas sem erro.

### 3. Semear dados do Cenário 03

```bash
pnpm --filter @metanoia/api db:seed:scenario-03
```

✅ Seed idempotente. Cria tenant **Igreja Caminho Novo**, pastor **Daniel Costa**, 4 grupos com líderes, reuniões, alertas e reflexões para cobrir os 4 estados pastorais.

| Grupo                 | Líder              | Status esperado |
|-----------------------|--------------------|-----------------|
| Grupo Quarta 19h      | Marcos Silva       | `healthy`       |
| Jovens Quinta         | Ana Costa          | `attention`     |
| Casais Sexta          | Carlos Ferreira    | `call`          |
| Intercessão Sábado    | Juliana Lima       | `no-signal`     |

> Pode rodar uma 2ª vez para confirmar idempotência (sem erros, sem duplicação).

### 4. Iniciar API

```bash
pnpm --filter @metanoia/api dev
```

✅ NestJS sobe em `http://localhost:3001`.

### 5. Iniciar Web (sem MSW)

```bash
NEXT_PUBLIC_API_MOCKING=disabled NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @metanoia/web dev
```

✅ Next sobe em `http://localhost:3000`. Network tab DevTools NÃO deve mostrar requests interceptados pelo MSW.

---

## Golden flow

### 6. Login como pastor

- Abre `http://localhost:3000` → entra com `pastor@caminhonovo.org` (senha definida no Keycloak local).
- ✅ Após login, deve haver redirect automático para `/app/admin/igreja/vista`.

🐛 Se redirecionar para `/app/admin/` (home) em vez da vista, verificar middleware `apps/web/middleware.ts` e o redirect do Session 1.

### 7. Vista agregada (`/app/admin/igreja/vista`)

- ✅ 4 cards aparecem (um por grupo).
- ✅ Cada card mostra: nome do grupo, líder, status (cor + frase pastoral), última reunião, contagem de membros.
- ✅ Status batem com a tabela acima (verde / amarelo / vermelho / cinza).

🐛 Se status não bater: inspecionar `GET /api/v1/admin/church/overview` no DevTools network — comparar `status` e `statusPhrase` por grupo. Se response vier vazia, verificar logs NestJS (lib `pino-pretty`).

### 8. Filtro `Atenção pastoral`

- Clicar no chip **"Pede atenção"** (filter-status-atencao).
- ✅ Restam visíveis apenas **Jovens Quinta** + **Casais Sexta** (status `attention` e `call`).

### 9. Filtro `Sem sinal`

- Clicar no chip **"Sem sinal"** (filter-status-sem-sinal).
- ✅ Resta visível apenas **Intercessão Sábado**.

### 10. Voltar para `Todos`

- Clicar no chip **"Todos"** (filter-status-all).
- ✅ Os 4 cards voltam.

### 11. Drill-down de grupo

- Clicar no card **Casais Sexta**.
- ✅ Navega para `/app/admin/igreja/grupos/<groupId>` com:
  - Header com nome do grupo + líder + status + frase pastoral + horário/local/membros (`group-header`).
  - Timeline com entradas dos últimos 90 dias: 1 reunião + 2 alertas de cuidado urgente.

🐛 Se timeline vazia: confirmar `GET /api/v1/admin/church/groups/:groupId/timeline` retornou `data.entries.length > 0`. Se resposta tem entries mas UI não mostra: verificar mapeamento `entry.type === 'meeting' | 'care'`.

### 12. Drill-down de líder

- Clicar no nome **Carlos Ferreira** na timeline / header.
- ✅ Navega para `/app/admin/igreja/lideres/<leaderId>` com:
  - Card de perfil (`leader-profile`) com nome, grupo, tenure.
  - Última conversa registada.
  - Lista de actividade recente.
  - Form de outreach intent — sem intent activa para esta semana, deve abrir em modo edit.

### 13. Criar outreach intent

- No textarea (`outreach-note-input`), escrever: `Ligar nesta semana para alinhar cuidado dos casais.`
- Clicar **Salvar** (`outreach-save`).
- ✅ Form troca para modo `view`, mostra a nota guardada + flash de "saved".
- ✅ DevTools network mostra `POST /api/v1/admin/outreach-intents` → `201`.

### 14. Editar outreach intent

- Clicar **Editar**.
- Substituir nota por: `Liguei: pediu visita no sábado.`
- Clicar **Salvar**.
- ✅ Form volta para `view` com nova nota. Network: `PUT /api/v1/admin/outreach-intents/:id` → `200`.

### 15. Apagar outreach intent

- Clicar **Limpar** (`outreach-clear`).
- ✅ Confirma diálogo → clicar **Sim, limpar**.
- ✅ Form volta para modo `edit` vazio. Network: `DELETE /api/v1/admin/outreach-intents/:id` → `204`.

### 16. Persistência cross-refresh

- Criar nova intent qualquer (passos 13).
- F5 (refresh duro).
- ✅ Intent persiste — chega no servidor, sobrevive ao reload.

### 17. Cache invalidation

- Após qualquer mutation (criar/editar/apagar), inspecionar DevTools network:
- ✅ Deve haver re-fetch automático de `GET /api/v1/admin/church/leaders/:leaderId` (TanStack Query invalida `pastoralAdminKeys.leader(leaderId)`).

---

## Sanity checks adicionais

### Auth header

DevTools network → qualquer request `/api/v1/admin/...`:

- ✅ Header `Authorization: Bearer <jwt>` presente.
- ✅ JWT decodifica para `realm_access.roles` contendo `admin_tenant`.

### Multi-tenant isolation

- Em sessão paralela, logar com utilizador de **outro tenant** (criar manualmente no Keycloak ou usar tenant do `seed-radar`).
- Aceder `/app/admin/igreja/vista`.
- ✅ Vê apenas os grupos do próprio tenant — nunca os do "Caminho Novo".

🐛 Se houver leak: alertar — RLS está quebrada, NÃO deploy.

---

## Como reportar um bug encontrado neste flow

1. Capturar passo + comportamento esperado vs. observado.
2. Anexar:
   - Screenshot da UI no momento do bug.
   - Print do DevTools → Network → request relevante (URL, status, headers, response body).
   - Print do console NestJS dos últimos 10 segundos.
3. Abrir issue com label `cenario-03` + `bug` + linkar para a linha desta checklist que falhou.

---

## Quando rodar esta checklist

- ✅ Antes de abrir PR que mexa em `apps/api/src/admin-pastoral/**` ou `apps/web/app/(authenticated)/app/admin/igreja/**`.
- ✅ Antes de cada release que inclua mudanças no Cenário 03.
- ✅ Após qualquer migração nova em `outreach_intents` ou em qualquer tabela RLS-aware lida pelos hooks `use-pastoral-admin.ts`.
