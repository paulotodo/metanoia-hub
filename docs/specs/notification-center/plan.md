# Implementation Plan: Notification Center UI

**Feature**: `notification-center` | **Story**: 14-2b (Epic 14 — Notificações) | **FR ref**: FR77
**Spec**: `docs/specs/notification-center/spec.md` (clarificada)
**Created**: 2026-06-20 | **Stage**: plan

## 1. Summary

Camada de UI para o centro de notificações in-app, construída SOBRE a
infraestrutura já entregue:

- **Story 14-1** (`apps/api/src/notifications/`): `NotificationsService.findByUser`
  (lista paginada `{data, meta}`), `updateStatusForUser` (mark-read com checagem
  de ownership por `user_id`), tudo tenant-scoped via `withTenantTx` + RLS policy
  `tenant_isolation`. Endpoints `GET /api/v1/notifications` e
  `PATCH /api/v1/notifications/:id/read`.
- **Story 14-2a** (`apps/api/src/notifications/sse/`): `GET /api/v1/sse/notifications`
  (SSE, evento `notification`, payload `{id,type,title,body,createdAt}`); o
  `KeycloakAuthGuard` aceita `Authorization: Bearer` OU `?token=` (fallback).

Novo trabalho:

1. **Backend** — um único endpoint novo `PATCH /api/v1/notifications/read-all`
   (batch mark-all-read do usuário autenticado, tenant via RLS, retorna count) +
   método de serviço `markAllAsRead` + schema Zod de resposta compartilhado.
2. **Frontend** (`apps/web`, Client Components) — `NotificationBell` (sino +
   badge 99+, a11y) e `NotificationCenter` (dropdown: lista, ícone por tipo,
   preview 100 chars, tempo relativo via `Intl.RelativeTimeFormat`, empty state
   pastoral), ações marcar-lida e marcar-todas, toggle Silenciar (localStorage),
   TanStack Query para server state + EventSource (SSE) para invalidação realtime.
3. **i18n / a11y / testes** — textos PT-BR pastorais, gate a11y (axe + contraste
   WCAG AA + teclado), E2E Playwright cobrindo P1–P4.

**Princípio orientador**: REUSO máximo. Zero nova dependência de datas
(`Intl.RelativeTimeFormat` nativo). Uma única dep nova no front: o primitivo
Radix de popover para o dropdown acessível (justificada na §Research).

## 2. Technical Context

| Aspecto | Decisão |
|---------|---------|
| Linguagem | TypeScript strict (FE Next.js 16.2 App Router, BE NestJS 11) |
| Server state | TanStack Query 5.x (provider já em `apps/web/src/lib/query/`) |
| Client/UI state | localStorage hook (toggle silenciar) — NÃO misturar com TanStack Query |
| Realtime | `EventSource` nativo (precedente: `use-attendance-live.ts`) |
| Tempo relativo | `Intl.RelativeTimeFormat('pt-BR')` — zero dep nova |
| Contrato FE↔BE | Zod compartilhado em `packages/types` (snapshot test obrigatório) |
| Multi-tenant | `withTenantTx` (`SET LOCAL app.current_tenant_id`) + RLS — `user_id`/`tenant_id` NUNCA por parâmetro de URL/body; via `getRequestContext()` |
| i18n | import direto de `apps/web/messages/pt-BR.json` (sem next-intl) |
| a11y | reuso `useAsyncAnnouncer()` (provider já envolve `NavigationShell`); gate axe + `scripts/check-contrast.ts` + teclado |

## 3. Constitution & Project-Rules Check

| Regra (CLAUDE.md / constitution) | Conformidade no plano |
|----------------------------------|------------------------|
| `tenant_id` em toda query; nunca por parâmetro | `markAllAsRead` usa `withTenantTx` (tenant via context). `user_id` via `getRequestContext()`. ✓ |
| RLS obrigatória | Reusa policy `tenant_isolation` existente na tabela `notifications` (USING + WITH CHECK). Novo UPDATE em lote herda RLS. ✓ |
| Datas ISO 8601 string; nulls explícitos; sem `undefined` em JSON | Resposta `{ data: { updatedCount } }`; `read_at` ISO. ✓ |
| Contrato sucesso `{ data, meta? }`; PATCH para update parcial | `read-all` é `@Patch`, retorna `{ data: { updatedCount } }`. ✓ |
| `ZodValidationPipe` custom; sem libs 3rd-party de validação | Schema de resposta validado/serializado via Zod compartilhado. ✓ |
| Server Components default; TanStack só em Client Components | Bell/Center são `'use client'` (hooks/EventSource). ✓ |
| Zustand não-misturado com TanStack Query | Toggle silenciar = localStorage hook simples (sem store). ✓ |
| UI em PT-BR, vocabulário pastoral | Empty state pastoral; chaves em `pt-BR.json`. ✓ |
| Snapshot test p/ schemas Zod | `ReadAllResponseSchema` ganha snapshot (gate breaking change). ✓ |
| Gate a11y permanente no CI | E2E axe + contraste + teclado planejados. ✓ |
| Naming: kebab files, plural kebab endpoints | `read-all`, `use-notifications.ts`, `notification-bell.tsx`. ✓ |

**Resultado**: nenhuma violação MUST. Plano aprovado para create-tasks.

## 4. Project Structure (arquivos a criar/tocar)

### Backend (`apps/api`)
```
src/notifications/notifications.controller.ts   [EDIT] + @Patch('read-all')  (ANTES de :id/read)
src/notifications/notifications.service.ts       [EDIT] + markAllAsRead(userId, readAt): Promise<number>
src/notifications/notifications.controller.spec.ts [EDIT/NEW] cobre read-all
src/notifications/notifications.service.spec.ts  [NEW] unit markAllAsRead (mock withTenantTx)
test/rls/notifications.rls-spec.ts               [EDIT] caso: mark-all não cruza tenant
test/factories/notification.factory.ts           [NEW] createNotification(...)  (se necessário p/ RLS)
```

### Shared (`packages/types`)
```
src/notification.ts                  [EDIT] + ReadAllResponseSchema  ({ updatedCount: number })
src/__tests__/notification.snapshot.spec.ts  [EDIT] snapshot do novo schema
```

### Frontend (`apps/web`)
```
app/(authenticated)/_components/navigation-shell.tsx  [EDIT] inserir <NotificationBell/>
                                                       (mobile header ~L53-58 ao lado de TenantSwitcher;
                                                        desktop via Sidebar header prop ~L63)
src/components/notifications/notification-bell.tsx     [NEW] 'use client' — sino + badge + aria-live
src/components/notifications/notification-center.tsx   [NEW] 'use client' — dropdown (Radix Popover)
src/components/notifications/notification-item.tsx     [NEW] item: ícone+título+preview+tempo relativo
src/components/notifications/notification-icon.tsx      [NEW] map type→ícone
src/lib/api/hooks/use-notifications.ts                 [NEW] useUnreadNotifications/useMarkRead/useMarkAllRead
src/hooks/use-notification-stream.ts                   [NEW] EventSource → invalida query (respeita silenciar p/ alerta)
src/hooks/use-notification-silence.ts                  [NEW] localStorage toggle (mirror use-active-tenant-id)
src/lib/notifications/relative-time.ts                 [NEW] formatRelativeTime(date) via Intl.RelativeTimeFormat
src/lib/notifications/safe-navigate.ts                 [NEW] validação same-origin de metadata.actionUrl
messages/pt-BR.json                                    [EDIT] + chave "notificationCenter"
e2e/notifications/notification-center.spec.ts          [NEW] E2E P1–P4
e2e/a11y/axe-*.spec.ts                                 [EDIT] incluir área autenticada com sino
```

### Shared UI (`packages/ui`)
```
package.json                         [EDIT] + @radix-ui/react-popover  (única dep nova)
src/components/popover.tsx           [NEW] wrapper acessível (mirror dialog.tsx)
src/components/badge.tsx             [NEW] Badge (cap 99+ feito no NotificationBell, não no Badge)
src/index.ts                         [EDIT] export Popover*, Badge
```

## 5. Backend Design — `PATCH /api/v1/notifications/read-all`

### Controller (ordem importa: declarar ANTES de `:id/read`)
```ts
@Patch('read-all')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Mark all unread notifications as read for the authenticated user' })
async markAllRead() {
  const ctx = getRequestContext();
  const updatedCount = await this.notificationsService.markAllAsRead(
    ctx.userId ?? '',
    new Date(),
  );
  return { data: { updatedCount } };
}
```
NOTA de roteamento: `read-all` é estático de 1 segmento; `:id/read` é 2 segmentos.
NestJS resolve o estático corretamente, mas **declarar `read-all` antes de
`:id/read`** elimina qualquer ambiguidade e é defesa explícita.

### Service (mirror de `updateStatusForUser`, tenant via RLS)
```ts
async markAllAsRead(userId: string, readAt: Date): Promise<number> {
  return withTenantTx(this.prisma, async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE notifications
          SET status = 'read'::"notification_status", read_at = $1, updated_at = now()
        WHERE user_id = $2::uuid AND status <> 'read'::"notification_status"
        RETURNING id`,
      readAt, userId,
    );
    return rows.length;
  });
}
```
- Tenant isolation: o `SET LOCAL app.current_tenant_id` dentro de `withTenantTx`
  faz a RLS policy `tenant_isolation` (USING + WITH CHECK) restringir o UPDATE às
  linhas do tenant corrente. `user_id` no WHERE garante escopo do usuário.
- `status <> 'read'` evita reescrever linhas já lidas (idempotente, conta só as
  efetivamente mudadas) — atende SC-003 (≤200 notificações, ≤3s).
- Retorna count para observabilidade e para o front confirmar o lote.

### Contrato Zod compartilhado (`packages/types/src/notification.ts`)
```ts
export const ReadAllResponseSchema = z.object({ updatedCount: z.number().int().nonnegative() });
export type ReadAllResponse = z.infer<typeof ReadAllResponseSchema>;
```
Snapshot test obrigatório (gate breaking change — FR-009).

### Decisão sobre RLS test
SIM, requer caso novo em `test/rls/notifications.rls-spec.ts`: a query é
tenant-scoped (UPDATE em lote). Caso: Tenant A roda mark-all → só as notificações
de A viram `read`; as de B permanecem `pending`/`sent`. Reusa helpers
`TENANT_A_ID`/`TENANT_B_ID` e o cliente `app` (NOSUPERUSER, RLS enforced).

## 6. Frontend Design

### 6.1 Hooks de dados (`src/lib/api/hooks/use-notifications.ts`)
Query keys hierárquicos (padrão do repo):
```ts
export const notificationKeys = {
  all: ['notifications'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
};
```
- `useUnreadNotifications()` → `apiClient.getEnvelope('/notifications?status=pending&perPage=20', NotificationsListSchema)`
  (status não-lido = não `read`; ver §Research D2). Deriva `unreadCount` de `meta.total`.
- `useMarkRead()` → `useMutation` → `apiClient.patch('/notifications/${id}/read', ...)` →
  `onSuccess: invalidateQueries(notificationKeys.unread())`.
- `useMarkAllRead()` → `useMutation` → `apiClient.patch('/notifications/read-all', ReadAllResponseSchema, {})` →
  `onSuccess: invalidateQueries(notificationKeys.unread())`. `onError`: mantém estado (FR rollback — SC US3-2).

### 6.2 Realtime (`src/hooks/use-notification-stream.ts`)
Mirror de `use-attendance-live.ts`, MAS com `?token=` (o guard aceita):
```ts
const token = getAccessToken();              // sessionStorage 'accessToken'
const url = `${API_BASE_URL}/sse/notifications${token ? `?token=${encodeURIComponent(token)}` : ''}`;
const source = new EventSource(url);
source.addEventListener('notification', (e) => {
  const parsed = NotificationRealtimeEventSchema.safeParse(JSON.parse(e.data)); // {id,type,title,body,createdAt}
  if (!parsed.success) return;
  queryClient.invalidateQueries({ queryKey: notificationKeys.unread() }); // badge SEMPRE atualiza
  if (!silenced) announce(`Nova notificação: ${parsed.data.title}`, { politeness: 'polite' });
});
source.addEventListener('heartbeat', () => { /* keep-alive */ });
source.onerror = () => { /* manter último valor conhecido (edge case SSE perdido) */ };
return () => source.close();
```
- **Silenciar suprime SÓ o alerta** (announce/som); o badge invalida e atualiza
  sempre (FR-010, US4-1).

### 6.3 NotificationBell (`src/components/notifications/notification-bell.tsx`)
- `'use client'`. Lê `unreadCount` de `useUnreadNotifications()`. Monta
  `use-notification-stream`.
- Badge: oculto se 0; mostra número; `99+` se >99 (cap visual sem flicker:
  `count > 99 ? '99+' : String(count)`).
- a11y: botão com `aria-label` dinâmico em PT-BR ("3 notificações não lidas" /
  "99 ou mais notificações não lidas" / "Nenhuma notificação não lida");
  `aria-expanded`/`aria-haspopup` no trigger; anúncio via `useAsyncAnnouncer()`
  (provider já existente). Badge ícone+texto (não só cor) — contraste WCAG AA.

### 6.4 NotificationCenter (`src/components/notifications/notification-center.tsx`)
- Dropdown via `@metanoia/ui` Popover (Radix, foco/teclado/Escape nativos).
- Lista até 20 itens (`NotificationItem`): ícone por tipo (`notification-icon.tsx`),
  título completo, preview do body truncado a 100 chars, tempo relativo.
- Empty state pastoral (chave i18n) + ilustração.
- Ações: "Marcar todas como lidas" (`useMarkAllRead`); toggle "Silenciar"
  (`use-notification-silence`).
- Item click: `useMarkRead(id)` e então `safeNavigate(metadata.actionUrl)`
  (validação same-origin — ver §Research D4); navegação falha graciosamente
  sem erro exposto se actionUrl ausente/inválido.

### 6.5 Tempo relativo (`src/lib/notifications/relative-time.ts`)
```ts
const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
export function formatRelativeTime(iso: string, now = Date.now()): string { /* min→h→dia */ }
```
Pura, testável por unit (FR-005, SC sem nova dep).

### 6.6 Silenciar (`src/hooks/use-notification-silence.ts`)
Mirror de `use-active-tenant-id.ts`: key `metanoia:notificationSilence`, SSR-safe,
`storage` listener para sync entre abas. Retorna `{ silenced, setSilenced }`.

## 7. i18n (`apps/web/messages/pt-BR.json`)
Nova chave `notificationCenter` (vocabulário pastoral):
```json
"notificationCenter": {
  "bell": {
    "labelCount": "{count} notificações não lidas",
    "labelCountOne": "1 notificação não lida",
    "labelOverflow": "99 ou mais notificações não lidas",
    "labelNone": "Nenhuma notificação não lida",
    "newAnnouncement": "Nova notificação: {title}"
  },
  "panel": { "title": "Notificações", "markAll": "Marcar todas como lidas", "silence": "Silenciar notificações" },
  "empty": { "title": "Tudo tranquilo por aqui!", "body": "Suas notificações aparecerão aqui." }
}
```

## 8. a11y & Testing Strategy
- **Unit (Vitest)**: `formatRelativeTime`, `safeNavigate`, `markAllAsRead`
  (service mock), controller `read-all`.
- **Snapshot Zod**: `ReadAllResponseSchema`.
- **RLS**: caso mark-all não cruza tenant.
- **E2E (Playwright, `e2e/notifications/`)**: P1 badge/contador + 99+; P2 abrir
  painel, ler item, navegar, empty state; P3 marcar-todas → badge zero; P4
  silenciar suprime alerta mas atualiza badge. Zero `.skip` (SC-009).
- **a11y gate**: axe nas páginas autenticadas com o sino (zero violações novas);
  `scripts/check-contrast.ts` contra `packages/ui/styles/globals.css` (tokens do
  badge); navegação 100% por teclado no dropdown (Arrow/Escape/Enter), foco
  visível, `aria-live` via announcer.

## 9. Risks & Mitigations
| Risco | Mitigação |
|-------|-----------|
| SSE com `?token=` expõe token em logs/URL | XHR/SSE only-same-origin; token de sessão curta; documentar em research; gate owasp |
| `metadata.actionUrl` open-redirect/XSS | `safeNavigate` valida same-origin + path relativo; render de title/body como TEXTO (React escapa) — nunca `dangerouslySetInnerHTML` |
| Route collision `read-all` vs `:id/read` | declarar `read-all` antes; teste de rota |
| Nova dep Radix popover | justificada (a11y dropdown); alternativa custom rejeitada (reinventa foco-trap) |
| Badge flicker em 99→99+ | derivação pura `count>99?'99+':count` sem estado intermediário |
