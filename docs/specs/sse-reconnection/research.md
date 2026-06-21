# Research: SSE Reconnection & Gap Fill

**Feature**: `sse-reconnection` (Story 14-2c, FR77)
**Phase**: 0 — Research
**Date**: 2026-06-21

## Context

Esta feature ESTENDE código já entregue nas stories 14-2a (SSE backend
endpoint) e 14-2b (Notification Center UI). Nenhuma tecnologia nova é
introduzida — todas as decisões abaixo reusam a stack herdada do projeto
(Next.js 16.2, NestJS 11, Zod 4, TanStack Query 5, EventSource nativo,
Playwright/Vitest). Não há NEEDS CLARIFICATION pendentes na spec.

## Decision 1 — EventSource nativo vs. biblioteca de reconexão

**Decision**: Estender o `EventSource` nativo já usado em
`apps/web/src/hooks/use-notification-stream.ts`, implementando a lógica
de reconexão/backoff manualmente no próprio hook. NÃO adotar biblioteca
de terceiros (ex: `eventsource-parser`, `reconnecting-eventsource`).

**Rationale**:
- A 14-2b já usa `new EventSource(url)` nativo; a borda de autenticação
  por `?token=` na query string já está estabelecida (o navegador não
  permite headers customizados no EventSource nativo, daí o token na URL).
- `EventSource` nativo já tem reconexão automática própria, mas SEM
  backoff controlável, SEM contagem de tentativas e SEM hook de
  gap-fill — exatamente o que a feature precisa controlar. Por isso a
  estratégia é: `eventSource.close()` no `onerror` e reabrir manualmente
  via `setTimeout` com o delay calculado, dando controle total do timing.
- Adicionar dependência nova violaria o anti-pattern do projeto de não
  inflar o bundle e introduziria superfície de manutenção para um
  comportamento que cabe em ~60 linhas de hook.

**Alternatives considered**:
- `reconnecting-eventsource` (npm): abstrai backoff, mas não expõe
  contador de tentativas nem hook de "reconectou agora" de forma
  ergonômica para o gap-fill; e esconde o `close()`/reopen que
  precisamos controlar para o cleanup de desmonte.
- WebSocket: overkill — o backend 14-2a é SSE (unidirecional), trocar de
  transporte está fora de escopo e quebraria o endpoint existente.

## Decision 2 — Estratégia de backoff exponencial

**Decision**: Backoff exponencial com sequência fixa `1s, 2s, 4s, 8s, 16s`
e teto de `30s` (`min(2^attempt * 1000, 30000)`). Sem jitter aleatório.
Contador de "falhas consecutivas no teto" separado: incrementa apenas
quando uma tentativa no intervalo máximo (30s) falha; ao atingir 5,
dispara o estado de outage estendido (FR-004).

**Rationale**:
- A spec fixa explicitamente a sequência `1s/2s/4s/8s` com teto `30s`
  (FR-001) e threshold de 5 falhas consecutivas no teto (FR-004). São
  parâmetros de produto, não de pesquisa — apenas implementar fielmente.
- Sem jitter: a feature é client-side single-connection (uma aba, uma
  conexão); o problema de thundering-herd que jitter resolve não se
  aplica a um único cliente. Manter determinístico facilita o teste
  unitário do backoff (FR-021).
- "Falhas consecutivas no teto" é a métrica do aviso de outage: somente
  após a reconexão já estar saturada no intervalo máximo é que faz
  sentido avisar o usuário (US2).

**Alternatives considered**:
- Backoff com jitter (full/equal jitter AWS): descartado — complexidade
  sem benefício para conexão única e teste menos determinístico.
- Resetar o contador de tentativas a cada `setTimeout`: descartado —
  precisamos do contador acumulado para o threshold de 5 e para o reset
  no "Tentar agora" (FR-005).

## Decision 3 — Deduplicação do gap-fill por `id`

**Decision**: Deduplicação no cliente por `id` da notificação. O gap-fill
busca via `GET /api/v1/notifications?since={lastReceivedAt}&status=unread`
e o merge no Notification Center é feito reusando o cache da TanStack
Query (`notificationKeys.unread()`): após o fetch, invalida/atualiza a
query unread; a fonte de verdade da lista exibida continua sendo a query
existente, que já é deduplicada por `id` no React (`key={n.id}`).

**Rationale**:
- A 14-2b já lista via `useUnreadNotifications()` (TanStack Query,
  `notificationKeys.unread()`), e o `notification-center.tsx` renderiza
  com `key={n.id}`. O caminho de menor risco é: gap-fill apenas garante
  que o servidor tem o estado correto e força `invalidateQueries`/refetch
  da query unread — o servidor já retorna a lista canônica sem duplicatas
  (o `id` é PK). Assim a dedup "no cliente por id" é satisfeita
  estruturalmente sem manter uma segunda lista paralela.
- Edge case "mesma notificação no stream SSE + gap-fill": como ambos
  convergem para a mesma query unread invalidada, o React reconcilia por
  `key={n.id}` — uma única renderização por id (EC spec linha 70).

**Alternatives considered**:
- Manter uma lista local (useState) mesclando stream + gap-fill com
  `Map<id, notification>`: descartado — duplicaria a fonte de verdade já
  detida pela TanStack Query (violaria FR-012 / Princípio V: não misturar
  client state com server state). A query unread JÁ é o server state.

## Decision 4 — `lastReceivedAt` em memória, não persistido

**Decision**: `lastReceivedAt` é armazenado em `useRef<string | null>`
(em memória, escopo do componente montado), NUNCA em
localStorage/sessionStorage/cookie. Atualizado a cada evento `notification`
recebido via SSE com o `createdAt` do payload. Um refresh da página
descarta o ref; o estado inicial é então obtido pela query existente de
todas as notificações não lidas (`useUnreadNotifications`).

**Rationale**:
- FR-008/FR-009/SC-006 fixam: rastrear em memória, não persistir. Refresh
  = recarrega tudo unread (que é barato e correto). `useRef` (não
  `useState`) porque o valor não deve causar re-render quando muda — é um
  ponteiro de bookkeeping para o gap-fill, não estado de UI.
- Segurança (SC-006): nenhuma informação de sessão (token nem
  `lastReceivedAt`) persistida além da sessão do navegador. Auditável via
  inspeção de storages após refresh.
- Edge case "lastReceivedAt nulo" (primeira conexão / pós-refresh): se o
  ref é null no reconnect, o gap-fill é PULADO; a query inicial unread já
  cobre o estado (EC spec linha 69).

**Alternatives considered**:
- Persistir `lastReceivedAt` em sessionStorage para sobreviver a refresh:
  descartado — viola FR-009/SC-006 e cria risco de divergência
  (timestamp velho gerando gap-fill de janela enorme). A query unread no
  mount já é a fonte de verdade pós-refresh.

## Decision 5 — Connection state como client state (sem TanStack/Zustand)

**Decision**: O estado de conexão (reconnecting / extended-outage /
connected + contador de tentativas) é client state LOCAL do hook
`use-notification-stream.ts`, exposto via `useState` e RETORNADO pelo
hook ao componente consumidor (`connection-status.tsx`). NÃO usar Zustand
(não é estado global compartilhado entre concerns) NEM TanStack Query
(não é server state).

**Rationale**:
- FR-012 + Princípio V (constitution): "nunca misturar server state
  (TanStack) com client state (Zustand)". O estado de conexão é efêmero,
  local ao componente do sino, e não cruza concerns — não justifica um
  store Zustand global. `useState` no hook é o nível correto de
  granularidade.
- O hook já é o dono do ciclo de vida do EventSource; expor o status de
  conexão como retorno do hook mantém uma única fonte de verdade para o
  estado de conexão, consumido pelo `connection-status.tsx`.

**Alternatives considered**:
- `useUIStore` (Zustand): descartado — o estado de conexão não é UI
  global; é local ao sino de notificações. Zustand seria over-engineering
  e contraria o padrão "one store per concern" sem um concern global.
- Context API dedicado: descartado — o único consumidor é o
  `connection-status.tsx` renderizado adjacente ao hook; retorno direto
  do hook é mais simples e testável.

## Decision 6 — Filtro `since` no backend: schema compartilhado vs. inline

**Decision**: Alinhar o controller a IMPORTAR/ESTENDER o
`NotificationsQuerySchema` compartilhado de `@metanoia/types`, eliminando
a duplicação inline atual. Adicionar o campo `since` (opcional,
`z.string().datetime()`) AO schema compartilhado em
`packages/types/src/notification.ts`. O filtro no
`findByUser` adiciona `AND created_at > $since` ao WHERE com parâmetro
BINDADO (nunca interpolado), preservando o isolamento RLS via
`withTenantTx`.

**Rationale**:
- Hoje há DUAS definições de `NotificationsQuerySchema`: uma inline no
  `notifications.controller.ts` (status/page/perPage) e a compartilhada
  em `packages/types` (status/page/perPage/unread). Adicionar `since`
  apenas a uma criaria drift silencioso entre FE e BE — exatamente o
  anti-pattern que o Princípio IV (contratos Zod compartilhados) proíbe.
  Alinhar o controller ao shared é a oportunidade de fechar a dívida.
- `created_at > $since` com bind param (`$N::timestamptz`) evita SQL
  injection (o serviço já usa `$queryRawUnsafe` com binds posicionais —
  manter o padrão). RLS (`SET LOCAL app.current_tenant_id` via
  `withTenantTx`) já restringe ao tenant; o `since` é filtro adicional
  ortogonal (FR-018).
- `z.string().datetime()` (Zod 4) valida ISO 8601; input inválido →
  `ZodValidationPipe` retorna 400 automaticamente (FR-019), sem código
  extra.

**Alternatives considered**:
- Adicionar `since` apenas no schema inline do controller (sem tocar o
  shared): descartado — o FE precisa do mesmo schema para tipar a query
  string do gap-fill; manter dois schemas diverge contratos (Princípio
  IV). 
- Janela temporal máxima para `since` (ex: rejeitar > 30 dias):
  descartado — a spec (EC linha 73) declara explicitamente que `since`
  reflete sempre interrupções recentes (lastReceivedAt em memória), então
  na prática nunca é antigo; adicionar restrição seria complexidade sem
  caso de uso real. Documentado como decisão de NÃO-restrição.

## Open Questions

Nenhuma. Todos os parâmetros de comportamento estão fixados na spec
(backoff 1/2/4/8/30s, threshold 5, dedup por id, memória não-persistida,
since ISO 8601). Clarify executado e validado como no-op.
