# Tasks: SSE Reconnection & Gap Fill (Story 14-2c / FR77)

**Feature**: `sse-reconnection`
**Pipeline**: create-tasks
**Created**: 2026-06-21
**Story**: 14-2c — Epic 14: Notificações
**Branch**: `feat/sse-reconnection-14-2c`
**Depends on**: Story 14-2a (SSE backend), Story 14-2b (Notification Center UI)

## Legenda de Criticidade

- `[CRIT]` — Crítica: bloqueia funcionalidade principal ou segurança; CI não pode passar sem ela.
- `[IMP]` — Importante: requerida pela spec, mas não bloqueia outras tasks se reordenada.
- `[OPT]` — Opcional/Melhoria: valor incremental; pode ser adiada sem quebrar MVP.

## Legenda de Status

- `[ ]` — Pendente
- `[x]` — Concluída

## Escopo Coberto

- Extensão do hook `use-notification-stream.ts` com máquina de reconexão + backoff exponencial
- Novo componente `connection-status.tsx` (4 estados: connected / reconnecting / extended-outage / auth-error)
- Extensão do `notification-bell.tsx` para consumir `connectionState` + `retryNow`
- Textos PT-BR pastorais em `apps/web/messages/pt-BR.json` (namespace `notificationCenter.connection.*`)
- Filtro `since` no `NotificationsQuerySchema` de `packages/types/src/notification.ts`
- Extensão do `notifications.controller.ts` (remover schema inline duplicado, importar shared)
- Extensão do `notifications.service.ts → findByUser` com bind posicional `since`
- Testes: unit (Vitest), integration (controller spec), E2E (Playwright), RLS spec
- Snapshot Zod atualizado para `NotificationsQuerySchema`
- Tratamento diferenciado de 401 (loop de reconexão interrompido; estado `auth-error`)
- Gap-fill paginado completo quando notificações perdidas excedem `perPage`
- Assertion obrigatória de ausência de `token=` em logs do caminho de erro (CHK043/044)
- Tratamento de corrida no gap-fill (fetch em andamento + nova desconexão — CHK064)
- Todos os checks de lint do CI antes do PR

## Escopo Excluído

- Persistência de `lastReceivedAt` (localStorage / sessionStorage / cookie)
- Novo store Zustand para estado de conexão
- Nova migration de banco (feature é read-only sobre `created_at`)
- Índice composto `(tenant_id, created_at)` — decisão de DBA/produto fora do escopo desta story
- Métricas de observabilidade / logging estruturado para `since` — decisão SRE fora do escopo
- SLO de performance para gap-fill — fora do escopo desta story
- Revisão de vocabulário pastoral dos textos (CHK031) — aceito como válido; tech debt documentado

## Matriz de Dependências

```
FASE 1: Contratos (independente)
  1.1 → (nenhuma)
  1.2 → 1.1

FASE 2: Backend (filtro since)
  2.1 → 1.1
  2.2 → 2.1
  2.3 → 2.1, 2.2
  2.4 → 2.3

FASE 3: Frontend — hook e componente
  3.1 → 1.1
  3.2 → 3.1
  3.3 → 3.1, 3.2
  3.4 → 3.1

FASE 4: Segurança e Robustez
  4.1 → 3.1
  4.2 → 3.1
  4.3 → 3.1, 2.1
  4.4 → 3.1

FASE 5: Testes
  5.1 → 3.1
  5.2 → 3.2
  5.3 → 2.2
  5.4 → 2.4
  5.5 → 3.1, 3.2, 3.3, 4.2, 4.3
  5.6 → 1.1
  5.7 → 2.1

FASE 6: Qualidade e Entrega
  6.1 → todas
  6.2 → 6.1
```

## Resumo Quantitativo

| FASE | Tasks | Criticidade dominante |
|------|-------|-----------------------|
| FASE 1 — Contratos Zod | 1.1, 1.2 | `[CRIT]` |
| FASE 2 — Backend `since` | 2.1, 2.2, 2.3, 2.4 | `[CRIT]` |
| FASE 3 — Frontend hook + UI | 3.1, 3.2, 3.3, 3.4 | `[CRIT]` |
| FASE 4 — Segurança + Robustez | 4.1, 4.2 `[CRIT]` / 4.3, 4.4 `[IMP]` | misto |
| FASE 5 — Testes | 5.1–5.6 `[CRIT]` / 5.7 `[IMP]` | misto |
| FASE 6 — Qualidade + Entrega | 6.1, 6.2 | `[CRIT]` |
| **Total** | **24 tasks** | 20 `[CRIT]` + 4 `[IMP]` |

---

## FASE 1 — Contratos Zod (packages/types)

### 1.1 Adicionar `since` ao `NotificationsQuerySchema` `[CRIT]`

**Arquivo**: `packages/types/src/notification.ts`

- [x] Localizar `NotificationsQuerySchema` (linha ~95 do arquivo atual)
- [x] Adicionar campo `since: z.string().datetime().optional()` ao objeto — após `unread` e antes do fechamento do `z.object({})`, conforme contrato `contracts/notifications-since.md`:
  ```ts
  export const NotificationsQuerySchema = z.object({
    status: NotificationStatusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(20),
    unread: z.coerce.boolean().optional(),
    since: z.string().datetime().optional(), // ISO 8601 — gap-fill (FR-015/FR-017)
  });
  ```
- [x] Verificar que o tipo inferido `NotificationsQuery` inclui `since?: string`
- [x] Confirmar que `NotificationListItemSchema` e `NotificationsListSchema` não precisam de alteração (response shape inalterado)
- [x] Rodar `pnpm --filter @metanoia/types build` sem erros

**Critério de aceitação**: `pnpm --filter @metanoia/types build` passa sem erros.

---

### 1.2 Atualizar snapshot Zod para `NotificationsQuerySchema` `[CRIT]`

**Arquivo**: `packages/types/src/__tests__/notification.snapshot.spec.ts`

- [x] Rodar `pnpm --filter @metanoia/types test -- --update-snapshots` para regenerar o snapshot incluindo `since`
- [x] Verificar que o snapshot em `__snapshots__/notification.snapshot.spec.ts.snap` reflete o novo campo `since`
- [x] Confirmar que os demais snapshots do arquivo não foram alterados (diff visual)
- [x] Commitar o snapshot atualizado (não ignorar o arquivo .snap)
- [x] Rodar `pnpm --filter @metanoia/types test` e confirmar 0 falhas

**Critério de aceitação**: `pnpm --filter @metanoia/types test` passa com 0 falhas.

---

## FASE 2 — Backend: filtro `since` (apps/api)

### 2.1 Migrar `notifications.controller.ts` para schema compartilhado `[CRIT]`

**Arquivo**: `apps/api/src/notifications/notifications.controller.ts`

- [x] Remover o `NotificationsQuerySchema` inline do controller (o `z.object({ status, page, perPage })` local sem `unread`/`since`)
- [x] Remover a importação local de `z` usada apenas para esse schema inline (se não usada em outro lugar)
- [x] Importar `NotificationsQuerySchema` e `NotificationsQuery` de `@metanoia/types`:
  ```ts
  import { NotificationStatusSchema, NotificationsQuerySchema, type NotificationsQuery } from '@metanoia/types';
  ```
- [x] Atualizar a anotação de tipo no método `list()` para usar o `NotificationsQuery` importado
- [x] Verificar que `@Query(new ZodValidationPipe(NotificationsQuerySchema))` continua correto (schema agora inclui `unread` e `since`)
- [x] Passar `query` completo para `this.notificationsService.findByUser(ctx.userId ?? '', query)` — o serviço receberá `since` automaticamente

**Critério de aceitação**: `pnpm --filter @metanoia/api build` passa; endpoint aceita `since` e `unread` via `ZodValidationPipe`.

---

### 2.2 Estender `notifications.service.ts → findByUser` com filtro `since` `[CRIT]`

**Arquivo**: `apps/api/src/notifications/notifications.service.ts`

- [x] Atualizar a interface local `NotificationsQuery` para incluir `since?: string`
- [x] No método `findByUser`, após construir `statusFilter`, construir `sinceFilter`:
  - O SELECT atual usa: `$1` (userId), `$2` (perPage), `$3` (offset). O `statusFilter` é string literal hardcoded com enum, não usa bind posicional para o valor de status. Logo `since` será `$4` quando presente.
  - `const sinceFilter = query.since ? 'AND created_at > $4::timestamptz' : '';` (bind posicional — NUNCA interpolação de string — CHK048/049/050 / OWASP L1)
- [x] Atualizar `$queryRawUnsafe` do SELECT para incluir `${sinceFilter}` na cláusula WHERE:
  ```ts
  const selectParams: unknown[] = [userId, perPage, offset];
  if (query.since) selectParams.push(query.since);
  // tx.$queryRawUnsafe(SQL_com_sinceFilter, ...selectParams)
  ```
- [x] Aplicar o mesmo `sinceFilter` e params adicionais ao `COUNT(*)` (CHK067: filtro em ambos SELECT e COUNT)
- [x] Confirmar que `since` ausente → `sinceFilter = ''` e params sem o valor de since (backward compatibility — CHK009)

**Critério de aceitação**: `GET /api/v1/notifications?since=2026-01-01T00:00:00Z&status=unread` retorna apenas notificações após o timestamp; sem `since`, comportamento idêntico ao atual.

---

### 2.3 Testes de integração do controller para `since` `[CRIT]`

**Arquivo**: `apps/api/src/notifications/notifications.controller.spec.ts`

- [x] Adicionar describe block `"GET /api/v1/notifications — filtro since"` com os cenários:
  - `"since válido (ISO 8601) → 200 com notificações filtradas"` — passar `since` no passado, verificar que apenas itens com `created_at > since` aparecem
  - `"since inválido (não-ISO 8601) → 400 via ZodValidationPipe"` — ex: `since=not-a-date`
  - `"since futuro → 200 com data vazia"` — `since` setado para amanhã, verificar `data: []`
  - `"since ausente → 200 com comportamento idêntico ao atual"` — verificar que a lista retorna normalmente
- [x] Mockar `notificationsService.findByUser` para isolar o controller (padrão do spec existente)
- [x] Confirmar que os testes existentes de `status` e `unread` continuam passando após a migração do schema (task 2.1)

**Critério de aceitação**: `pnpm --filter @metanoia/api test -- notifications.controller.spec.ts` passa com 0 falhas.

---

### 2.4 Teste RLS para isolamento cross-tenant sob filtro `since` `[CRIT]`

**Arquivo**: `apps/api/test/rls/notifications.rls-spec.ts` (existente — acrescentar caso)

- [x] Adicionar describe block `"RLS: filtro since preserva isolamento de tenant"` com:
  - Criar 2 tenants distintos (tenant-A e tenant-B) com 1 notificação cada, ambas com `created_at` no passado
  - Chamar `findByUser(userA, { since: <timestamp anterior às notificações> })` autenticado como tenant-A
  - Asseverar que apenas a notificação de tenant-A aparece (notificação de tenant-B não aparece)
  - Repetir com roles invertidas (tenant-B não vê tenant-A) — idempotência
- [x] Confirmar que o teste usa integração real com Postgres (não mock)
- [x] O teste deve rodar 2× no CI (padrão do projeto — MEMORY epic-13: "teste RLS idempotente roda 2x no CI")
- [x] Documentar no comentário do teste: "Rodado 2× no CI por padrão (idempotência RLS)"

**Critério de aceitação**: `pnpm --filter @metanoia/api test -- notifications.rls-spec.ts` passa 2× sem falhas.

---

## FASE 3 — Frontend: hook + componente + textos

### 3.1 Estender `use-notification-stream.ts` com máquina de reconexão + gap-fill `[CRIT]`

**Arquivo**: `apps/web/src/hooks/use-notification-stream.ts`

Task central. Estender sem reescrever — preservar comportamento atual.

**Estado de conexão (client state — `useState`/`useRef`, NUNCA Zustand/TanStack — FR-012):**
- [x] Adicionar tipo `ConnectionState = 'connected' | 'reconnecting' | 'extended-outage' | 'auth-error'`
- [x] Adicionar `useState<ConnectionState>('connected')` para `connectionState`
- [x] Adicionar `useRef<number>(0)` para `failureCount`
- [x] Adicionar `useRef<string | null>(null)` para `lastReceivedAt` (FR-008; NUNCA persistido — FR-009)
- [x] Adicionar `useRef<ReturnType<typeof setTimeout> | null>(null)` para `retryTimerRef`
- [x] Adicionar `useRef<AbortController | null>(null)` para `gapFillControllerRef` (cancelamento — CHK064)

**Atualização de `lastReceivedAt` no evento `notification`:**
- [x] No handler do evento `notification`, quando `parsed.success`, atualizar `lastReceivedAt.current` com `parsed.data.createdAt` se for mais recente
- [x] Quando `connectionState !== 'connected'`, transitar para `'connected'` e resetar `failureCount.current = 0`

**Backoff exponencial (FR-001):**
- [x] Implementar `calcBackoff(attempt: number): number` → `Math.min(Math.pow(2, attempt) * 1000, 30000)` (1000, 2000, 4000, 8000, ..., 30000)
- [x] No `onerror` do EventSource: fechar fonte, executar probe de 401 (ver task 4.2), agendar reconexão com backoff
- [x] Após 5 falhas consecutivas no teto (30s): transitar para `'extended-outage'` (FR-004)
- [x] **NUNCA logar a URL (contém `?token=`)** (CHK042–044)

**Gap-fill ao reconectar (FR-010/FR-011):**
- [x] Implementar `executeGapFill()` chamada após reconexão bem-sucedida:
  - Se `lastReceivedAt.current === null`, retornar imediatamente (edge case primeira conexão)
  - Cancelar gap-fill anterior: `gapFillControllerRef.current?.abort()` (CHK064)
  - Criar novo `AbortController` e guardar em `gapFillControllerRef.current`
  - Loop paginado (CHK021/055: gap-fill > perPage): buscar com `perPage=100` até `fetchedIds.size >= total`
  - Se `res.status === 401` durante gap-fill: transitar para `'auth-error'`, parar loop
  - Falha de rede no gap-fill: silenciosa (spec §Edge Cases — CHK062)
  - Após completar: `queryClient.invalidateQueries({ queryKey: notificationKeys.unread() })` (FR-011)
  - Capturar `AbortError` silenciosamente

**Retorno do hook:**
- [x] Retornar `{ connectionState, retryNow }` além do comportamento original
- [x] `retryNow`: cancela timer, reseta `failureCount.current = 0`, reconecta imediatamente (FR-005)

**Cleanup no desmonte:**
- [x] `return () => { source.close(); clearTimeout(retryTimerRef.current ?? undefined); gapFillControllerRef.current?.abort(); }` (CHK071/072)

**Critério de aceitação**: hook exporta `{ connectionState, retryNow }`; unit tests passam (ver 5.1).

---

### 3.2 Criar `connection-status.tsx` `[CRIT]`

**Arquivo**: `apps/web/src/components/notifications/connection-status.tsx` (NOVO)

- [x] Criar componente `ConnectionStatus` com props `{ connectionState: ConnectionState; onRetry: () => void }`
- [x] `connectionState === 'connected'`: renderizar `null` (sem DOM — FR-013; evita anúncio vazio em aria-live — CHK035)
- [x] `connectionState === 'reconnecting'`: texto "Reconectando..." sutil (abaixo do sino, text-sm text-muted-foreground, sem overlay — CHK025: posicionamento documentado em comentário) com `aria-live="polite"` (CHK032)
- [x] `connectionState === 'extended-outage'`: mensagem de outage + botão "Tentar agora" (FR-004/005); mesma região `aria-live="polite"`
- [x] `connectionState === 'auth-error'`: mensagem "Sessão expirada. Faça login novamente." + link para `/login` (CHK046/047)
- [x] Transições com `motion-safe:transition-all` (CHK034)
- [x] Focus-ring no botão: `focus-visible:ring-2 focus-visible:ring-brand-teal/30` (CHK033)
- [x] Botão com `type="button"` explícito (CHK038)
- [x] Textos via `useTranslations('notificationCenter.connection')` (CHK029 — chaves de task 3.4)
- [x] Contraste: usar tokens `text-foreground`/`bg-background` (WCAG 4.5:1 por construção dos tokens do projeto — CHK037; documentar em comentário)
- [x] Exportar como named export: `export function ConnectionStatus(...)`

**Critério de aceitação**: 4 estados renderizam corretamente; unit tests passam (ver 5.2).

---

### 3.3 Atualizar `notification-bell.tsx` para consumir `connectionState` + `retryNow` `[CRIT]`

**Arquivo**: `apps/web/src/components/notifications/notification-bell.tsx`

- [x] Atualizar chamada de `useNotificationStream`:
  ```ts
  const { connectionState, retryNow } = useNotificationStream({ silenced, announce });
  ```
- [x] Importar `ConnectionStatus` de `./connection-status`
- [x] Importar tipo `ConnectionState` de `@/hooks/use-notification-stream`
- [x] Renderizar `<ConnectionStatus connectionState={connectionState} onRetry={retryNow} />` dentro do JSX do bell, posicionado abaixo do ícone/badge
- [x] Verificar que o seletor de bell no E2E existente (`aria-label`) não é afetado pela adição (ver `apps/web/e2e/notifications/notification-center.spec.ts`)

**Critério de aceitação**: `NotificationBell` renderiza `ConnectionStatus`; E2E existente `notification-center.spec.ts` continua passando.

---

### 3.4 Adicionar textos PT-BR pastorais em `pt-BR.json` `[CRIT]`

**Arquivo**: `apps/web/messages/pt-BR.json`

- [x] Localizar o namespace `notificationCenter` existente no JSON
- [x] Adicionar sub-namespace `connection` (CHK030):
  ```json
  "connection": {
    "reconnecting": "Reconectando...",
    "offline": "Sem conexão. Notificações podem estar atrasadas.",
    "retryNow": "Tentar agora",
    "authError": "Sessão expirada. Faça login novamente.",
    "authErrorLink": "Fazer login"
  }
  ```
- [x] Verificar que `check-i18n-scf.sh --strict` passa com as novas chaves (ver task 6.1)
- [x] Vocabulário: textos funcionais aceitos como adequados para o contexto (CHK031 — tech debt de revisão pastoral adiado)

**Critério de aceitação**: `check-i18n-scf.sh --strict` passa; textos aparecem corretamente no componente.

---

## FASE 4 — Segurança e Robustez

### 4.1 Assertion obrigatória: `token=` ausente em logs de erro `[CRIT]`

**Arquivo**: `apps/web/src/hooks/__tests__/use-notification-stream.spec.ts` (parte da task 5.1)

- [x] Adicionar suite `"segurança: URL não vaza em logs"` (CHK043/044 — requisito obrigatório, M1):
  - Espiar `console.error`, `console.warn`, `console.log` com `vi.spyOn`
  - Simular falha do `EventSource` (trigger `onerror`)
  - Asseverar que nenhuma chamada aos spies contém substring `"token="`
  - Asseverar que nenhuma chamada contém a URL base do SSE endpoint
- [x] Cobrir também o caso de erro do `executeGapFill` falhando com erro de rede
- [x] Documentar no comentário do teste: "CHK043/044 — obrigatório por OWASP M1 / spec §Edge Cases"

**Critério de aceitação**: qualquer `console.*` com `token=` faz o teste falhar.

---

### 4.2 Tratamento diferenciado de 401 no loop de reconexão `[CRIT]`

**Arquivo**: `apps/web/src/hooks/use-notification-stream.ts` (parte da task 3.1)

O `EventSource` nativo não expõe o status HTTP no `onerror` — detecção de 401 via probe fetch separado (CHK015/046/047 — OWASP M2):

- [x] No `onerror` do EventSource, executar sonda de autenticação:
  ```ts
  // Probe: endpoint /notifications (sem ?token= no query — usa header Bearer)
  // CHK015: interromper loop cego com credencial morta
  fetch(`${API_BASE_URL}/notifications?unread=true&perPage=1`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(res => {
    if (res.status === 401) {
      setConnectionState('auth-error'); // CHK047: estado distinto de outage
      source.close(); // parar tentativas
    } else {
      scheduleReconnect(); // falha transitória de rede — backoff normal
    }
  }).catch(() => scheduleReconnect()); // sonda falhou → rede down → reconectar
  ```
- [x] Implementar `scheduleReconnect()` como função interna (reusada pelo `retryNow`)
- [x] Garantir que `auth-error` não agenda retry (`setTimeout` não chamado)
- [x] Confirmar que o endpoint `/notifications` usa header `Authorization` (não query param `?token=`) — a sonda não vaza token em URL

**Critério de aceitação**: com token expirado, hook transita para `auth-error` e para de tentar reconectar; unit test verifica.

---

### 4.3 Gap-fill paginado completo (quando perdidas > perPage) `[IMP]`

**Arquivo**: `apps/web/src/hooks/use-notification-stream.ts` (parte da task 3.1)

Formaliza CHK021/055 como implementação verificável:

- [x] Confirmar que `executeGapFill()` usa `perPage=100` (máximo — minimiza requests)
- [x] Confirmar que o loop `while (hasMore)` para ao constatar `fetchedIds.size >= total` (não apenas quando `data.length < perPage`)
- [x] Adicionar teste específico em `use-notification-stream.spec.ts` (task 5.1): simular gap-fill com `total: 150`, primeira página com 100 itens, segunda com 50 — verificar que o hook faz 2 fetches e `invalidateQueries` é chamado após o último
- [x] Documentar no código: `// gap-fill paginado: busca até total (CHK021/055 — sem truncamento silencioso)`

**Critério de aceitação**: unit test com > perPage notificações passa; não trunca silenciosamente.

---

### 4.4 Tratamento de corrida no gap-fill `[IMP]`

**Arquivo**: `apps/web/src/hooks/use-notification-stream.ts` (parte da task 3.1)

Resolve CHK064 (race condition: fetch em andamento + nova desconexão):

- [x] Confirmar que `gapFillControllerRef.current?.abort()` é chamado antes de criar novo `AbortController` em cada `executeGapFill()`
- [x] Confirmar que `AbortError` é capturado silenciosamente (fetch cancelado = comportamento esperado)
- [x] Confirmar que o cleanup no desmonte também chama `gapFillControllerRef.current?.abort()`
- [x] Adicionar teste em `use-notification-stream.spec.ts`: simular gap-fill em andamento + novo `onerror` → apenas 1 gap-fill executado (fetch anterior cancelado, novo iniciado)

**Critério de aceitação**: sem race conditions; `AbortError` não produz log de erro.

---

## FASE 5 — Testes

### 5.1 Testes unitários do hook `use-notification-stream` `[CRIT]`

**Arquivo**: `apps/web/src/hooks/__tests__/use-notification-stream.spec.ts` (NOVO)

- [x] Setup: mock do `EventSource` com `vi.stubGlobal`, mock do `fetch` para gap-fill, mock de `useQueryClient`
- [x] Suite `"backoff exponencial"`:
  - `calcBackoff(0)` → 1000; `calcBackoff(1)` → 2000; `calcBackoff(2)` → 4000; `calcBackoff(3)` → 8000; `calcBackoff(5)` → 30000; `calcBackoff(10)` → 30000 (teto)
- [x] Suite `"lastReceivedAt"`:
  - Após evento `notification` com `createdAt`, `lastReceivedAt.current` é atualizado
  - `lastReceivedAt.current` nunca escrito em localStorage/sessionStorage (spy verifica)
  - Após desmonte e remontagem, `lastReceivedAt.current` começa `null` (FR-009)
- [x] Suite `"estados de conexão"`:
  - Conexão inicial → `'connected'`
  - `onerror` (sonda retorna 200) → `'reconnecting'`; 5 falhas no teto → `'extended-outage'`
  - Reconexão bem-sucedida após `extended-outage` → `'connected'`, aviso desaparece
  - `retryNow()` → reset de `failureCount`, reconexão imediata
  - `onerror` (sonda retorna 401) → `'auth-error'`, loop parado (task 4.2)
- [x] Suite `"gap-fill"`:
  - Reconexão com `lastReceivedAt !== null` → fetch `?since=...&status=unread` chamado
  - Reconexão sem `lastReceivedAt` → gap-fill NÃO executado
  - Deduplicação: mock 2 fetches sobrepostos, `invalidateQueries` chamado 1× após completar
  - Paginado (task 4.3): total > perPage → 2 fetches sequenciais
  - Race condition (task 4.4): gap-fill em andamento + novo `onerror` → fetch anterior cancelado
- [x] Suite `"segurança"` (task 4.1): `console.*` espionados, nenhum com `token=`
- [x] Suite `"cleanup"`: desmonte chama `source.close()`, cancela timer, aborta gap-fill

**Critério de aceitação**: `pnpm --filter @metanoia/web test -- use-notification-stream.spec.ts` passa com 0 falhas.

---

### 5.2 Testes unitários do `connection-status.tsx` `[CRIT]`

**Arquivo**: `apps/web/src/components/notifications/__tests__/connection-status.spec.tsx` (NOVO)

- [x] `connectionState="connected"` → componente renderiza `null` (nada no DOM)
- [x] `connectionState="reconnecting"` → texto "Reconectando..." presente; `aria-live="polite"` no container
- [x] `connectionState="extended-outage"` → mensagem de outage presente; botão "Tentar agora" com `role="button"`
- [x] Clicar "Tentar agora" → `onRetry` chamado 1× (FR-005)
- [x] `connectionState="auth-error"` → mensagem de sessão expirada; link de login presente
- [x] Botão "Tentar agora" tem `type="button"` (CHK038)
- [x] Transições: verificar que classes `motion-safe:` estão presentes (snapshot ou class assertion)

**Critério de aceitação**: `pnpm --filter @metanoia/web test -- connection-status.spec.tsx` passa com 0 falhas.

---

### 5.3 Testes de integração do controller para `since` `[CRIT]`

_(Ver task 2.3 — confirmação final de cobertura)_

- [x] Confirmar que `notifications.controller.spec.ts` cobre: `since` válido, inválido, futuro, ausente
- [x] Confirmar que testes existentes de `status` e `unread` continuam passando após migração do schema
- [x] Rodar: `pnpm --filter @metanoia/api test -- notifications.controller.spec.ts` com 0 falhas

**Critério de aceitação**: 0 falhas; todos os 4 cenários de `since` passam.

---

### 5.4 Teste RLS sob filtro `since` `[CRIT]`

_(Ver task 2.4 — confirmação de execução dupla)_

- [x] Rodar `notifications.rls-spec.ts` 2× consecutivas localmente sem falhas intermitentes
- [x] Verificar que o CI script de RLS detecta automaticamente os novos describe blocks

**Critério de aceitação**: 0 falhas nas 2 execuções.

---

### 5.5 Testes E2E Playwright: cenários de reconexão SSE `[CRIT]`

**Arquivo**: `apps/web/e2e/notifications/sse-reconnection.spec.ts` (NOVO)

**Gotchas documentados** (MEMORY epic-12-e2e-autenticado-ci + feature-00c-vps-operational):
- `networkidle` nunca resolve com SSE ativo — usar `domcontentloaded` + `waitForSelector`
- Seletor do sino: usar `data-testid` ou `aria-label` com seletor específico `:visible` (pode haver sino duplicado no NavigationShell)
- Mocks com UUID v7 válidos
- SSE mockado via `page.route()` para `**/sse/notifications*`

- [x] Setup: mock SSE via `page.route('**/sse/notifications*', ...)` (Content-Type: text/event-stream)
- [x] Setup: `loginAs` via `fixtures/auth.fixture.ts`
- [x] Mock `GET /api/v1/notifications*` para controlar gap-fill com UUID v7 válidos

- [x] **Cenário 1 — Reconexão automática + gap-fill** (US1, FR-020a):
  - Abrir Notification Center com SSE ativo e 0 notificações
  - Simular desconexão: `page.route('**/sse/notifications*', r => r.abort())`
  - `waitForSelector('[aria-live="polite"]')` com texto "Reconectando..."
  - Mock gap-fill retornando 2 notificações novas (verificar que query contém `since=`)
  - Restaurar SSE com heartbeat
  - `waitForSelector` confirmando badge atualizado (unreadCount > 0)
  - Verificar que "Reconectando..." sumiu
  - Verificar as 2 notificações do gap-fill no centro (sem duplicatas)

- [x] **Cenário 2 — Outage estendido → aviso + retry manual** (US2, FR-020b):
  - Simular 5 falhas consecutivas (usando `page.clock` se disponível, ou mock time via env)
  - `waitForSelector` com texto "Sem conexão. Notificações podem estar atrasadas."
  - Verificar que botão "Tentar agora" está visível e focável via Tab
  - Clicar "Tentar agora" → verificar nova chamada ao SSE route

- [x] **Cenário 3 — Reconexão após outage: indicador some + gap-fill** (US2 AC3, FR-020c):
  - Continuação do Cenário 2: restaurar SSE
  - Aguardar transição `extended-outage` → `connected` (aviso desaparece)
  - Verificar que gap-fill foi executado (rota `GET /notifications?since=...` chamada)

- [x] Não usar `networkidle` em nenhum test (usar `domcontentloaded` + `waitForSelector`)
- [x] Seletores específicos com `data-testid` ou aria attributes não-duplicados

**Critério de aceitação**: `pnpm --filter @metanoia/web e2e -- sse-reconnection.spec.ts` passa com 0 falhas.

---

### 5.6 Confirmar snapshot Zod atualizado e commitado `[CRIT]`

_(Ver task 1.2 — confirmação pré-PR)_

- [x] Arquivo `packages/types/src/__tests__/__snapshots__/notification.snapshot.spec.ts.snap` atualizado
- [x] `pnpm --filter @metanoia/types test` com 0 falhas e snapshot atual

**Critério de aceitação**: 0 falhas; diff do PR inclui o .snap atualizado.

---

### 5.7 Roundtrip real FE→BE: cenário 6 do quickstart `[IMP]`

**Arquivo**: `apps/web/e2e/notifications/sse-reconnection.spec.ts` (adicionar no mesmo arquivo)

- [x] Chamar `GET /api/v1/notifications?since=<timestamp>&status=unread` contra backend local real (sem mock de API)
- [x] Verificar shape `{ data: NotificationListItemSchema[], meta }` com `created_at` snake_case
- [x] Verificar que `since` ISO 8601 retorna apenas itens posteriores ao timestamp
- [x] Verificar que `since` inválido retorna 400
- [x] Marcar como `test.skip` se backend local não disponível no CI headless (integração condicional)

**Critério de aceitação**: teste passa com backend local; documentado como "roundtrip real (opcional em CI)".

---

## FASE 6 — Qualidade e Entrega

### 6.1 Rodar todos os checks de lint do CI antes do PR `[CRIT]`

Scripts relevantes (MEMORY epic-12-a11y: lint CI vai além de `turbo lint`):

- [x] `pnpm turbo lint` — lint TypeScript / ESLint base
- [x] `bash scripts/check-focus-ring-variants.sh` — botão "Tentar agora" tem `focus-visible:ring-brand-teal/30` (task 3.2)
- [x] `bash scripts/check-motion-safe.sh` — `transition-*` usa `motion-safe:` no connection-status (task 3.2)
- [x] `node scripts/check-contrast-tokens.mjs` — tokens de contraste nos novos textos (task 3.2)
- [x] `npx tsx scripts/check-contrast.ts` — contraste WCAG nos novos elementos (task 3.2)
- [x] `bash scripts/check-i18n-scf.sh --strict` — todas as chaves de `pt-BR.json` usadas e vice-versa (task 3.4)
- [x] Corrigir qualquer achado antes de abrir o PR
- [x] `pnpm turbo build` — build completo cross-package (`@metanoia/types` → `@metanoia/api` e `@metanoia/web`)

**Critério de aceitação**: todos os scripts saem com código 0; `pnpm turbo build` sem erros.

---

### 6.2 Abrir PR e finalizar story `[CRIT]`

- [x] Confirmar branch `feat/sse-reconnection-14-2c`
- [x] Confirmar que todos os commits usam conventional commits em PT-BR (ex: `feat(notifications): adiciona reconexão SSE com backoff exponencial`)
- [x] PR inclui: referência à Story 14-2c e FR77; checklist de review com cenários E2E; link ao `docs/specs/sse-reconnection/quickstart.md`
- [x] CI passa (lint + test + build) antes de solicitar review
- [x] Atualizar `docs/planning/` com story 14-2c marcada como done (se existir arquivo de progresso — verificar padrão dos EPICs anteriores)
- [x] Após merge: fechar PR e marcar story 14-2c como done

**Critério de aceitação**: PR aberto com CI verde; story marcada como done após merge.
