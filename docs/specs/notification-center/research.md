# Research & Decisions: Notification Center UI

Decisões técnicas resolvidas (cada uma com evidência empírica do código real em
`dev @3727339`). Formato: Decision / Rationale / Alternatives / Evidence.

## D1 — Tempo relativo via `Intl.RelativeTimeFormat` nativo
- **Decision**: usar `new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })`
  numa função pura `formatRelativeTime`.
- **Rationale**: nenhuma lib de datas instalada no projeto; clarificação da spec
  exige zero nova dependência; cobertura PT-BR nativa do runtime.
- **Alternatives rejected**: date-fns / dayjs (nova dep, viola clarify Q2).
- **Evidence**: `grep -rn "date-fns\|dayjs\|luxon" apps/web/package.json` → nenhum.
  Clarifications §Session 2026-06-20 Q2 → "Intl.RelativeTimeFormat nativo".

## D2 — Lista de "não lidas": filtro por status
- **Decision**: consultar `GET /notifications?status=pending&perPage=20` para a
  lista do painel; `unreadCount` derivado de `meta.total`. (Status não-`read` =
  não lido; o canal in-app grava `pending`→`sent`; a leitura grava `read`.)
- **Rationale**: `findByUser` aceita filtro `status` único (cap perPage 100);
  `NotificationStatusSchema = z.enum(['pending','sent','failed','read'])`. "Não
  lida" = qualquer status ≠ `read`. CONFIRMAR no create-tasks se o backend
  precisa de filtro `status<>read` (a API atual filtra por igualdade de status
  único); se necessário, ampliar `findByUser` para aceitar `unread=true` que
  filtra `status <> 'read'`.
- **Alternatives**: filtrar no cliente (rejeitado — perde precisão do `meta.total`).
- **Evidence**: `packages/types/src/notification.ts:17` enum com `read`;
  controller `findByUser` com `NotificationsQuerySchema` (status opcional, perPage≤100).
- **OPEN (resolver no create-tasks)**: se a API só faz `status = X` (igualdade),
  uma task de backend adiciona suporte a `unread`/`status<>read`. Marcado como
  task explícita, não bloqueio (default fiel: ampliar findByUser preservando contrato).

## D3 — Realtime: EventSource com `?token=`
- **Decision**: `EventSource("${API_BASE_URL}/sse/notifications?token=<accessToken>")`,
  `addEventListener('notification', ...)`, invalida `notificationKeys.unread()`.
- **Rationale**: `EventSource` não envia headers Authorization custom; o
  `KeycloakAuthGuard` aceita fallback `?token=`. Precedente de EventSource no
  front em `use-attendance-live.ts` (story 5.5).
- **Alternatives**: cookie-based (rejeitado — token está em `sessionStorage`,
  não cookie; `apiClient` usa `Authorization: Bearer`). Polling (rejeitado —
  SC-001 exige ≤2s, SSE já existe).
- **Evidence**: backend agent — guard `?token=` fallback (keycloak.guard.ts
  L143-156); `apps/web/src/hooks/use-attendance-live.ts` usa `new EventSource(url)`;
  `apps/web/src/lib/api/client.ts:20-23` token de `sessionStorage.getItem('accessToken')`.

## D4 — Navegação segura para `metadata.actionUrl` (anti open-redirect/XSS)
- **Decision**: `safeNavigate(actionUrl)` — aceita SOMENTE paths relativos
  same-origin (começando com `/`, sem `//`, sem esquema). Qualquer outra coisa
  (absoluto externo, `javascript:`, `//evil`, ausente, malformado) → no-op
  gracioso (item ainda é marcado lido). Usar `next/navigation` `router.push`
  para o path validado.
- **Rationale**: `metadata` é `z.record(z.string(), z.unknown())` (free-form,
  NÃO confiável); o snapshot test mostra `actionUrl: '/app/radar'` (relativo).
  Sem validação = open-redirect (LLM/OWASP A01) e potencial `javascript:` XSS.
- **Alternatives**: confiar no backend (rejeitado — metadata é livre); allowlist
  de rotas (over-engineering; same-origin path-relativo basta para o MVP).
- **Evidence**: `packages/types/src/notification.ts:28` `metadata: z.record(...)`;
  `packages/types/src/__tests__/notification.snapshot.spec.ts:125`
  `metadata: { actionUrl: '/app/radar' }`.

## D5 — Render de title/body: texto, nunca HTML
- **Decision**: renderizar `title` e `body` como conteúdo de texto JSX
  (`{notification.title}`), nunca `dangerouslySetInnerHTML`. Preview = `slice(0,100)`.
- **Rationale**: title/body vêm do backend e podem conter conteúdo de terceiros
  (group_message etc.); React escapa por padrão. Evita XSS armazenado (SR-2
  herdado da 14-2a).
- **Evidence**: schema `title: z.string().max(200)`, `body: z.string()` — texto livre.

## D6 — Dropdown acessível: Radix Popover em packages/ui
- **Decision**: adicionar `@radix-ui/react-popover` a `packages/ui/package.json`
  e exportar um wrapper `Popover` (mirror do `dialog.tsx` existente). Usar para o
  NotificationCenter.
- **Rationale**: packages/ui só exporta Dialog/Card/Input/Button/Sidebar/BottomTabs;
  não há DropdownMenu/Popover. Radix entrega foco-trap, Escape, ARIA e teclado
  corretos — críticos para o gate a11y (SC-004/005). O projeto já usa Radix
  (`@radix-ui/react-dialog`).
- **Alternatives**: Dialog reposicionado (rejeitado — semântica modal errada para
  um painel não-modal); dropdown custom (rejeitado — reinventa foco/teclado, alto
  risco de violação axe).
- **Evidence**: `packages/ui/package.json:17-18` só `react-dialog`+`react-slot`;
  `packages/ui/src/index.ts` sem Popover/DropdownMenu.

## D7 — Toggle Silenciar: localStorage hook (sem Zustand)
- **Decision**: `use-notification-silence` espelhando `use-active-tenant-id.ts`
  (key `metanoia:notificationSilence`, SSR-safe, `storage` listener cross-tab).
- **Rationale**: preferência local ao dispositivo, sem server state; CLAUDE.md
  proíbe misturar client state com TanStack Query; Zustand seria over-engineering
  para um booleano. Silenciar suprime SÓ alerta visual/sonoro; badge sempre atualiza.
- **Alternatives**: Zustand store (rejeitado — over-engineering); TanStack (rejeitado
  — não é server state).
- **Evidence**: `apps/web/src/lib/tenant/use-active-tenant-id.ts` padrão existente.

## D8 — aria-live: reuso de `useAsyncAnnouncer`
- **Decision**: anunciar novas notificações via `useAsyncAnnouncer().announce(...,
  { politeness: 'polite' })` em vez de criar nova região aria-live.
- **Rationale**: `AsyncAnnouncerProvider` JÁ envolve `NavigationShell` (L50) e
  expõe regiões `role=status aria-live=polite` e `role=alert aria-live=assertive`.
  Reuso = menos superfície a11y, consistência.
- **Evidence**: `navigation-shell.tsx:10,50,75` import + wrap do provider;
  `apps/web/src/components/a11y/async-announcer.tsx` regiões + hook.

## D9 — Inserção do sino no NavigationShell
- **Decision**: editar SOMENTE `navigation-shell.tsx`: (a) mobile header
  (~L53-58) ao lado de `<TenantSwitcher/>`; (b) desktop via prop `header` do
  `Sidebar` (~L63), agrupando TenantSwitcher+Bell num flex. Sem novo slot em
  `packages/ui` (menor blast radius — clarify Q1).
- **Evidence**: `navigation-shell.tsx` L53-58 mobile header com TenantSwitcher;
  L59-65 `<Sidebar ... header={<TenantSwitcher.../>}>`; `Sidebar` tem prop
  `header?: React.ReactNode` (sidebar.tsx L161 renderiza `header`).

## D10 — Resposta do read-all: envelope `{ data: { updatedCount } }`
- **Decision**: `markAllRead` retorna `{ data: { updatedCount } }` validado por
  `ReadAllResponseSchema`. Service retorna `number` (linhas efetivamente mudadas).
- **Rationale**: contrato do projeto `{ data, meta? }`; count dá observabilidade
  e confirma o lote ao front; snapshot test cobre breaking change (FR-009).
- **Note**: o handler `:id/read` existente retorna `{ success: true }` (legado);
  o novo segue o envelope `{ data }` canônico do CLAUDE.md — divergência aceitável
  pois é endpoint novo. (Registrar como decisão informativa no create-tasks.)
- **Evidence**: CLAUDE.md "Success: `{ data, meta? }`"; controller atual
  `markRead` → `{ success: true }`.
