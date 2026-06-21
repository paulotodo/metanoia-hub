# Quickstart / Test Scenarios: SSE Reconnection & Gap Fill

**Feature**: `sse-reconnection` (Story 14-2c, FR77)
**Phase**: 1 — Design

Cada cenário mapeia para testes (E2E Playwright / unit Vitest /
integration). Mapeamento FR/SC → teste na tabela ao final.

## Cenário 1 — Reconexão automática + gap-fill (happy path, US1)

1. Usuário autenticado com Notification Center montado; conexão SSE ativa.
2. Simular queda de rede: mock da rota SSE responde erro / fecha a conexão.
   → **Expected**: hook detecta `onerror`, `connectionState` vira
     `reconnecting`, indicador "Reconectando..." aparece em < 2s (SC-002).
3. Backoff agenda reconexão (1s, depois 2s, ...). Restaurar o mock SSE.
4. Reconexão bem-sucedida.
   → **Expected**: `connectionState` volta a `connected`, indicador some
     em < 2s (FR-003/SC-002); contadores resetam.
5. `lastReceivedAt` estava definido ⇒ gap-fill dispara
   `GET /api/v1/notifications?since={lastReceivedAt}&status=unread`.
   → **Expected**: notificações emitidas durante a queda aparecem no
     centro, SEM duplicatas (SC-001/SC-004). Dedup por `id` (FR-011).

**Gotchas E2E** (memória feature-00c):
- `waitUntil:'networkidle'` NUNCA resolve com SSE aberto → usar
  `domcontentloaded` + `waitForSelector`.
- Sino é duplicado no NavigationShell → seletor `:visible` ou
  `data-testid="notification-bell"`.
- Mocks de notificação precisam de `id` UUID v7 VÁLIDO.

## Cenário 2 — Outage estendido + retry manual (US2)

1. Conexão SSE cai e NÃO volta (mock mantém erro).
2. Backoff escala até o teto de 30s; cada tentativa no teto falha.
   → **Expected**: após **5 falhas consecutivas no teto**,
     `connectionState` vira `extended-outage`; UI exibe "Sem conexão.
     Notificações podem estar atrasadas." + botão "Tentar agora" (FR-004,
     SC-003).
3. Tentativas continuam em background mesmo com o aviso visível (FR-006).
4. Usuário clica "Tentar agora".
   → **Expected**: nova tentativa imediata; `consecutiveCapFailures`
     reseta a 0 (FR-005); reconexão segue em background.
5. Restaurar mock SSE; reconexão bem-sucedida.
   → **Expected**: aviso desaparece, gap-fill executa, notificações
     perdidas aparecem (FR-007).

## Cenário 3 — Filtro `since` no backend (US3, integração)

1. Seed: 3 notificações para o usuário, `created_at` em T0, T1, T2.
2. `GET /api/v1/notifications?since={T1}&status=unread`.
   → **Expected**: retorna apenas a notificação de T2 (created_at > T1,
     estritamente posterior) (FR-016).
3. `GET /api/v1/notifications?since={futuro}`.
   → **Expected**: `{ data: [], meta: { total: 0 } }`.
4. `GET /api/v1/notifications` (sem `since`).
   → **Expected**: comportamento idêntico ao atual (todas conforme
     status/paginação) (FR-003).
5. `GET /api/v1/notifications?since=not-a-date`.
   → **Expected**: HTTP 400 com mensagem clara (FR-019/SC-005).

## Cenário 4 — Isolamento RLS do filtro `since` (US3, RLS spec)

1. Seed: notificações de DOIS tenants, ambas com `created_at > T`.
2. Como usuário do tenant A, `GET /api/v1/notifications?since={T}`.
   → **Expected**: SOMENTE notificações do tenant A retornadas; nenhuma
     do tenant B vaza (FR-018). RLS preservado sob o filtro `since`.
3. (idempotência) Rodar o teste 2x — comportamento estável (padrão CI:
   RLS isolation specs rodam 2x).

## Cenário 5 — Edge cases (unit)

| Edge case (spec) | Cenário de teste | Expected |
|------------------|------------------|----------|
| `lastReceivedAt` nulo (1ª conexão/refresh) | reconnect com ref null | gap-fill PULADO; query inicial unread cobre |
| dedup stream + gap-fill | mesma notif via SSE e via gap-fill | aparece 1x (key=id) |
| desmonte na navegação | unmount do hook durante reconnect | `close()` + `clearTimeout` chamados; sem leak |
| token expirado (401) | SSE retorna 401 | reconexão respeita 401; URL com `?token=` NUNCA logada |
| `since` muito antigo (>30d) | gap-fill com timestamp antigo | retorna normalmente, sem restrição de janela |
| falha do gap-fill (rede) | fetch do gap-fill rejeita | falha silenciosa; retry no próximo reconnect c/ mesmo `lastReceivedAt` |

## Cenário 6 — Roundtrip End-to-End (OBRIGATÓRIO — borda BE↔FE)

> Razão (skill plan §5.3): expor drift snake_case vs camelCase com payload
> REAL do backend, não mock.

1. Subir backend real (Postgres local + NestJS). Seed 1 notificação unread.
2. Chamar de verdade `GET /api/v1/notifications?since={T}&status=unread`
   (sem mock), capturar o payload de resposta.
3. Comparar o SHAPE do payload capturado contra o
   `NotificationListItemSchema` de `@metanoia/types` (`.parse()` real).
   → **Expected**: parse passa; campos em **snake_case** (`read_at`,
     `created_at`, `updated_at`) conforme contrato (notifications-since.md
     §Response). Nenhum campo camelCase inesperado; nenhum `undefined`
     no JSON (null explícito — Princípio II).

## Mapeamento Requisito → Teste

| Req | Cenário | Tipo de teste |
|-----|---------|---------------|
| FR-001 backoff 1/2/4/8/30s | 1, unit backoff | unit Vitest |
| FR-002/FR-003 indicador aparece/some | 1 | E2E |
| FR-004 aviso após 5 falhas no teto | 2 | E2E + unit |
| FR-005 "Tentar agora" reseta | 2 | E2E + unit |
| FR-006 retry em background c/ aviso | 2 | unit |
| FR-007 reconectou após outage → gap-fill | 2 | E2E |
| FR-008/FR-009 lastReceivedAt memória | 5, unit | unit + SC-006 audit |
| FR-010 gap-fill `?since&status=unread` | 1, 6 | E2E + roundtrip |
| FR-011 dedup por id | 1, 5 | E2E + unit |
| FR-012 client state (sem TanStack p/ conexão) | 5 | unit (revisão estrutural) |
| FR-013/FR-014 connection-status + PT-BR | 1, 2 | E2E + unit |
| FR-015..FR-019 filtro `since` | 3 | integration |
| FR-018 RLS preservado | 4 | RLS spec |
| FR-020 E2E completos | 1, 2 | E2E |
| FR-021 unit (backoff/lastReceivedAt/dedup/estados) | 5 | unit |
| SC-001 nenhuma notif perdida | 1 | E2E |
| SC-002 indicador < 2s | 1 | E2E |
| SC-003 100% recebem aviso | 2 | E2E |
| SC-004 sem duplicatas | 1, 5 | E2E + unit |
| SC-005 filtro + 400 | 3 | integration |
| SC-006 nada persistido | 5 | unit + audit storages |
