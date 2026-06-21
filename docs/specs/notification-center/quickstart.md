# Quickstart & Test Scenarios: Notification Center UI

## Dev setup
```bash
# da raiz do repo
pnpm install                 # instala @radix-ui/react-popover (nova dep em packages/ui)
docker compose up -d         # postgres + redis + keycloak
pnpm dev                     # web :3000, api :3001
```
Login na área autenticada (`/app/...`) com um usuário que tenha notificações
seedadas (demo-data) para ver o sino com badge.

## Validação local do PAI (antes do PR — lições Epic 13)
```bash
# 1. typecheck + lint
pnpm -w turbo run lint typecheck

# 2. unit (FE + BE) + snapshot Zod
pnpm --filter @metanoia/api test
pnpm --filter web test

# 3. RLS (Postgres real) — roda 2x p/ idempotência (lição CI)
pnpm --filter @metanoia/api test:rls
pnpm --filter @metanoia/api test:rls

# 4. contraste WCAG AA (tokens do badge)
NODE_PATH=apps/web/node_modules npx tsx scripts/check-contrast.ts \
  --tokens-path packages/ui/styles/globals.css --level AA

# 5. E2E + axe (autenticado)
pnpm --filter web test:e2e -- notifications
pnpm --filter web test:e2e -- a11y
```

## Test scenarios → Acceptance mapping

### P1 — Badge (US1)
| Cenário | Verificação |
|---------|-------------|
| 3 não-lidas | sino mostra "3"; `aria-label`="3 notificações não lidas" |
| ≥100 não-lidas | badge "99+"; `aria-label`="99 ou mais notificações não lidas" |
| 0 não-lidas | sino sem badge; `aria-label`="Nenhuma notificação não lida" |
| nova via SSE | badge incrementa ≤2s (SC-001); announce polite "Nova notificação: {title}" |

### P2 — Painel e leitura (US2)
| Cenário | Verificação |
|---------|-------------|
| abrir painel | ≤20 itens; cada um ícone+título+preview(100)+tempo relativo; carrega ≤1,5s (SC-002) |
| clicar item | marca lida, some da lista, navega para `actionUrl` (se same-origin); ≤1s (SC-006) |
| sem não-lidas | empty state pastoral "Tudo tranquilo por aqui!" (SC-007) |
| actionUrl ausente/inválido | marca lida; navegação no-op gracioso (sem erro) |

### P3 — Marcar todas (US3)
| Cenário | Verificação |
|---------|-------------|
| 5 não-lidas → "Marcar todas" | lista vazia; badge → 0; ≤3s p/ ≤200 (SC-003) |
| erro de rede no lote | feedback de erro; estado anterior mantido (sem marcação parcial) |

### P4 — Silenciar (US4)
| Cenário | Verificação |
|---------|-------------|
| silenciar ON + SSE chega | badge atualiza; SEM alerta visual/sonoro |
| fechar/reabrir navegador | preferência mantida (localStorage) (SC-008) |
| silenciar OFF + SSE | alertas voltam |

### a11y transversal (SC-004/005)
- 100% operável por teclado: Tab para o sino, Enter/Space abre, Arrow navega
  itens, Escape fecha e devolve foco ao sino.
- axe: zero violações novas nas páginas autenticadas com o sino.
- contraste: badge passa WCAG AA (texto sobre `--destructive`/surface).

## Definition of Done (story 14-2b)
- [ ] `PATCH /notifications/read-all` + service + RLS test + unit + snapshot Zod
- [ ] NotificationBell + NotificationCenter integrados no NavigationShell
- [ ] TanStack Query (queries+mutations+invalidation) + EventSource SSE
- [ ] Tempo relativo Intl; toggle silenciar localStorage; empty state pastoral
- [ ] i18n PT-BR pastoral em pt-BR.json
- [ ] E2E P1–P4 (zero .skip) + axe + contraste + teclado verdes
- [ ] owasp-security gate sem findings critical/high pendentes
- [ ] validação local do PAI (lint/typecheck/unit/RLS×2/contraste/E2E) verde antes do PR
