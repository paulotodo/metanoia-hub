# Data Model: SSE Reconnection & Gap Fill

**Feature**: `sse-reconnection` (Story 14-2c, FR77)
**Phase**: 1 — Design

## Resumo: NENHUMA migration nova

> **Decisão explícita (Decision 6 do research.md)**: esta feature NÃO
> cria nem altera tabelas, colunas, índices ou policies de RLS. A tabela
> `notifications` (entregue em 14-2a/14-2b) já contém todas as colunas
> necessárias. O filtro `since` é uma operação de LEITURA adicional sobre
> a coluna `created_at` existente. Consequentemente:
>
> - Nenhum arquivo em `apps/api/prisma/migrations/`.
> - Nenhuma policy de RLS nova → mas a `notifications.rls-spec.ts` ganha
>   um caso de teste cobrindo que o filtro `since` permanece tenant-scoped
>   (Princípio I + VI: toda mudança que toca leitura sob RLS deve ter
>   teste de isolamento).
> - Sem novos identificadores → a regra UUID v7 via `uuidv7()` (Princípio
>   II) é citada por completude: caso QUALQUER fixture/factory de teste
>   crie linhas, DEVE usar `uuidv7()` (nunca `@default(uuid())`).

## Entity: Notification (EXISTENTE — referência, não modificada)

Tabela `notifications` (snake_case via `@@map`). Reproduzida aqui para
documentar as colunas consumidas pelo filtro `since` e pelo gap-fill.
Fonte da verdade: schema Prisma + migrations de 14-2a.

| Campo | Tipo (DB) | Notas | Usado por esta feature |
|-------|-----------|-------|------------------------|
| `id` | uuid (v7) | PK; chave de deduplicação no cliente | SIM (dedup por id, FR-011) |
| `tenant_id` | uuid | RLS — `SET LOCAL app.current_tenant_id` | SIM (isolamento, FR-018) |
| `user_id` | uuid | dono; filtro BOLA-safe (do RequestContext) | SIM (escopo do usuário) |
| `type` | enum notification_type | — | Não (passthrough) |
| `channel` | enum notification_channel | — | Não |
| `status` | enum notification_status | `pending/sent/failed/read`; `unread` = `<> read` | SIM (status=unread no gap-fill) |
| `title` | text | — | Não (passthrough p/ UI) |
| `body` | text | — | Não |
| `metadata` | jsonb | — | Não |
| `read_at` | timestamptz null | — | Não |
| `created_at` | timestamptz | **coluna do filtro `since`** (`created_at > $since`) | SIM (FR-016) |
| `updated_at` | timestamptz | — | Não |

**State transitions**: nenhuma nova. O filtro `since` é read-only; não
altera status nem cria transições de estado.

## Estado client-side (não-persistido) — frontend

Não é entidade de banco, mas é o "modelo de dados" efêmero do hook de
reconexão. Documentado para o `create-tasks` e os testes unitários.

### `use-notification-stream.ts` — estado interno

| Campo | Tipo (TS) | Mecanismo | Persistido? | FR |
|-------|-----------|-----------|-------------|-----|
| `lastReceivedAt` | `string \| null` (ISO 8601) | `useRef` | **NÃO** (memória) | FR-008/FR-009/SC-006 |
| `connectionState` | `'connected' \| 'reconnecting' \| 'extended-outage'` | `useState` | NÃO | FR-002/FR-004/FR-013 |
| `consecutiveCapFailures` | `number` | `useRef` | NÃO | FR-004 (threshold 5) |
| `backoffAttempt` | `number` | `useRef` | NÃO | FR-001 (1/2/4/8/30s) |
| `reconnectTimerId` | `ReturnType<typeof setTimeout> \| null` | `useRef` | NÃO | cleanup no desmonte (EC) |

> `useRef` para valores de bookkeeping que NÃO devem disparar re-render
> (`lastReceivedAt`, contadores, timer id). `useState` apenas para
> `connectionState`, que dirige a renderização do `connection-status.tsx`.
> Decisão 5 do research.md: client state local, NÃO Zustand, NÃO TanStack.

### Invariantes

- `lastReceivedAt === null` ⇒ gap-fill é PULADO no reconnect (EC linha 69).
- `consecutiveCapFailures` reseta a 0 quando: (a) reconexão bem-sucedida,
  ou (b) usuário clica "Tentar agora" (FR-005).
- `backoffAttempt` mapeia para delay via `min(2^attempt * 1000, 30000)`.
- No desmonte do hook: `eventSource.close()` + `clearTimeout(reconnectTimerId)`
  (EC linha 71 — cancelar timers de backoff).
