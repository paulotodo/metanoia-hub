# Implementation Plan: SSE Reconnection & Gap Fill

**Feature**: `sse-reconnection`
**Story Source**: Story 14-2c (FR77) — Epic 14: Notificações
**Depends On**: 14-2a (SSE backend), 14-2b (Notification Center UI)
**Phase**: completo (Research + Design)
**Date**: 2026-06-21

## Summary

Adicionar reconexão automática resiliente ao Notification Center: quando a
conexão SSE cai, o hook `use-notification-stream.ts` (entregue na 14-2b)
reconecta com backoff exponencial (1s/2s/4s/8s, teto 30s), informa o
usuário via um novo componente `connection-status.tsx` ("Reconectando..."
e, após 5 falhas no teto, "Sem conexão" + retry manual), e executa
gap-fill das notificações perdidas via `GET
/api/v1/notifications?since={lastReceivedAt}&status=unread`. No backend,
estende-se o endpoint de notificações com o filtro `since` (ISO 8601,
estritamente posterior), unificando o schema Zod compartilhado FE/BE.
Abordagem: ESTENDER código existente (não reescrever); zero migrations;
client state local (sem Zustand/TanStack para o estado de conexão).

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript `strict: true` (Princípio II) |
| Frontend | Next.js 16.2 (App Router), Client Components; TanStack Query 5; EventSource nativo |
| Backend | NestJS 11.1.17; Prisma v7 + Postgres + RLS; `ZodValidationPipe` |
| Contratos | Zod 4 em `packages/types` (compartilhado FE/BE) |
| Testes | Vitest 4, Playwright 1.59 (E2E), RLS specs |
| Storage | Nenhuma migration nova — feature read-only sobre `notifications.created_at` |
| Identificadores | UUID v7 via `uuidv7()` (apenas em fixtures/factories, se houver) |
| NEEDS CLARIFICATION | 0 (clarify no-op) |

## Constitution Check

*GATE: passou antes do Phase 0; re-checado após Phase 1.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | PASS | Filtro `since` ortogonal ao RLS; `withTenantTx` (`SET LOCAL app.current_tenant_id`) mantido; RLS spec ganha caso `since`. `userId` do RequestContext (BOLA-safe). Sem novo `tenant_id` em parâmetro. |
| II. Type-Safety & UUID v7 | PASS | `strict` mantido; `since` tipado via Zod; datas ISO 8601 string; sem `@default(uuid())` (nenhuma escrita nova). |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs em inglês; textos de conexão em PT-BR pastoral em `messages/pt-BR.json` (`notificationCenter.connection.*`). |
| IV. Contratos de API Padronizados | PASS | `since` no `NotificationsQuerySchema` COMPARTILHADO; controller passa a importar o shared (elimina duplicação inline); envelope `{data,meta}` inalterado; `/api/v1/`; 400 via ZodValidationPipe. |
| V. Separação de Estado no Frontend | PASS | Connection state = client state local (`useState`/`useRef` no hook), NÃO Zustand, NÃO TanStack; server state (lista) permanece na TanStack Query existente. |
| VI. Qualidade Verificável | PASS | unit + integration + E2E + RLS spec; WCAG AA (aria-live polite, motion-safe:, focus-ring ring-brand-teal/30); snapshot Zod atualizado; CI verde antes de done. |
| VII. Processo de Entrega Auditável | PASS | 1 story = 1 branch = 1 PR; conventional commits PT-BR. |

**Resultado**: PASS em todos os MUST. Sem violações → Complexity Tracking
vazio.

## Project Structure

### Documentação (feature dir)
```
docs/specs/sse-reconnection/
├── spec.md                         (existente)
├── plan.md                         (este arquivo)
├── research.md                     (Phase 0)
├── data-model.md                   (Phase 1)
├── quickstart.md                   (Phase 1)
└── contracts/
    └── notifications-since.md      (Phase 1)
```

### Source code (árvore real do projeto — caminhos verificados)
```
apps/web/src/
├── hooks/
│   ├── use-notification-stream.ts          (ESTENDER: backoff/reconnect/gap-fill/state)
│   └── __tests__/                          (unit: backoff, lastReceivedAt, dedup, states)
├── components/notifications/
│   ├── notification-bell.tsx               (monta useNotificationStream; renderiza connection-status)
│   ├── notification-center.tsx             (existente; lista via useUnreadNotifications)
│   ├── connection-status.tsx               (NOVO: 3 estados + retry manual)
│   └── __tests__/                          (unit do connection-status)
└── lib/api/hooks/
    └── use-notifications.ts                (existente: notificationKeys, useUnreadNotifications)
apps/web/messages/
└── pt-BR.json                              (NOVO namespace notificationCenter.connection.*)
apps/web/e2e/
└── (NOVO) sse-reconnection.spec.ts         (E2E: cenários 1, 2)

apps/api/src/notifications/
├── notifications.controller.ts             (importar schema shared; aceitar since)
├── notifications.service.ts                (findByUser: filtro since bindado)
└── notifications.controller.spec.ts        (integration: since 400/futuro/sem-since)
apps/api/test/rls/
└── notifications.rls-spec.ts               (ADD caso: since permanece tenant-scoped)

packages/types/src/
├── notification.ts                         (NotificationsQuerySchema += since)
└── __tests__/notification.snapshot.spec.ts (atualizar snapshot)
```

## Convenções de Borda

Feature atravessa borda BE↔FE (filtro `since` + gap-fill). Fonte da
verdade de cada convenção:

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case (`created_at`, `read_at`) | migration existente 14-2a | `apps/api/prisma/migrations/*` |
| Backend SELECT/payload | **snake_case** (preservado — sem mapper) | SQL raw em `findByUser` | `apps/api/src/notifications/notifications.service.ts` |
| Shared DTO (Zod) | snake_case no item, camelCase nos params | Zod parse | `packages/types/src/notification.ts` (`NotificationListItemSchema`, `NotificationsQuerySchema`) |
| Frontend DTO | snake_case (consome `NotificationListItemSchema`) | `.parse()` no fetch | re-export de `@metanoia/types` |
| API query params | `since`/`status`/`unread`/`page`/`perPage` (camelCase simples) | `NotificationsQuerySchema` (ambos os lados) | `contracts/notifications-since.md` |
| URL query string | `?since=&status=unread&perPage=` | router/EventSource URL | `use-notification-stream.ts` / `use-notifications.ts` |

**Mapper layer (DB ↔ DTO)**: NÃO HÁ mapper camelCase. O backend retorna
colunas snake_case diretamente no SELECT e o frontend as consome via
`NotificationListItemSchema` (que declara `read_at`/`created_at`/
`updated_at` em snake_case). Convenção MANTIDA por esta feature — NÃO
introduzir mapper. ORM auto-mapping: NÃO (SQL raw via `$queryRawUnsafe`).

**Validação Zod**: na borda de REQUEST (query params via
`ZodValidationPipe` no controller) e na borda de RESPONSE (frontend
`.parse()` com `NotificationsListSchema`). Schema compartilhado:
`packages/types/src/notification.ts`. O cenário 6 do quickstart
(roundtrip real) é o guard contra drift snake/camel.

## Abordagem de Implementação (resumo por área)

### Backend (US3 — pré-requisito técnico do gap-fill)
1. `packages/types`: adicionar `since: z.string().datetime().optional()`
   ao `NotificationsQuerySchema` compartilhado; atualizar snapshot test.
2. `notifications.controller.ts`: REMOVER o `NotificationsQuerySchema`
   inline e IMPORTAR o compartilhado de `@metanoia/types` (fecha a dívida
   de duplicação; ganha `unread` + `since`).
3. `notifications.service.ts → findByUser`: aceitar `since`; quando
   presente, adicionar `AND created_at > $N::timestamptz` (bind
   posicional, nunca interpolado) ao SELECT e ao COUNT.
4. Testes: integration (controller spec) para `since` válido/inválido/
   futuro/ausente; RLS spec para isolamento sob `since`.

### Frontend — reconexão/backoff/gap-fill (US1 + US2)
5. `use-notification-stream.ts`: ESTENDER com máquina de reconexão
   (estados `connected`/`reconnecting`/`extended-outage`), backoff
   `min(2^attempt*1000, 30000)`, `lastReceivedAt` em `useRef`, contador
   de falhas no teto, cleanup de timer no desmonte; gap-fill no reconnect
   (se `lastReceivedAt` definido) → fetch `?since&status=unread` +
   `invalidateQueries(notificationKeys.unread())`. Retornar
   `{ connectionState, retryNow }` ao consumidor. NUNCA logar a URL
   (contém `?token=`).
6. `connection-status.tsx` (NOVO): renderiza nada quando `connected`;
   "Reconectando..." sutil em `reconnecting`; aviso + botão "Tentar
   agora" em `extended-outage`. aria-live polite; `motion-safe:` em
   transições; focus-ring `ring-brand-teal/30`.
7. `notification-bell.tsx`: consumir `connectionState`/`retryNow` do hook
   e renderizar `<ConnectionStatus />`.
8. `messages/pt-BR.json`: `notificationCenter.connection.reconnecting`,
   `.offline`, `.retryNow` (PT-BR pastoral).

### Testes (US1/US2/US3)
9. Unit (Vitest): backoff, lastReceivedAt, dedup, estados do
   connection-status. E2E (Playwright): cenários 1 e 2 (com os gotchas
   SSE documentados). Roundtrip real (cenário 6).

## Re-check pós-design (Phase 1)

Design NÃO introduziu camada/serviço novo, NÃO criou store global, NÃO
adicionou dependência. Reusa hook + endpoint existentes; client state
local. Todos os MUST permanecem PASS. **Re-check: PASS.**

## Complexity Tracking

N/A — nenhuma violação de constitution a justificar.

## Artefatos

| Arquivo | Status |
|---------|--------|
| docs/specs/sse-reconnection/plan.md | Criado |
| docs/specs/sse-reconnection/research.md | Criado |
| docs/specs/sse-reconnection/data-model.md | Criado |
| docs/specs/sse-reconnection/contracts/notifications-since.md | Criado |
| docs/specs/sse-reconnection/quickstart.md | Criado |

## Próximos Passos

1. `/checklist` — quality gate dos requisitos antes de implementar.
2. `/create-tasks` — decompor em backlog executável.
3. `/analyze` — validar consistência cross-artifact após tasks.
