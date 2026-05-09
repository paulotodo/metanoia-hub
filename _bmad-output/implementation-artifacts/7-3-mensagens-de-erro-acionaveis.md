# Story 7.3: Mensagens de Erro Acionáveis

Status: review

## Story

As a usuário,
I want clear and actionable error messages,
so that I understand what went wrong and how to fix it.

## Acceptance Criteria

**Given** the platform needs consistent error messages
**When** errors are displayed
**Then** all user-facing error messages are centralized in `apps/web/messages/pt-BR.json` with standardized keys: `error.{context}.{action}` (ex: `error.group.create.limit_reached`, `error.auth.permission_denied`)
**And** the backend returns error keys that the frontend maps to localized messages

**Given** an error occurs
**When** the message is displayed
**Then** each error includes: what happened + what to do:
- Permission: "Você não tem permissão para esta ação. Fale com o administrador do seu grupo."
- Plan limit: "Limite do plano atingido (3/3 grupos). Fale com o administrador para upgrade."
- Not found: "Recurso não encontrado. Verifique o endereço ou volte ao início."
**And** no error displays stack traces or technical codes to the user (API format: `{ statusCode, error, message, details? }`)
**And** vocabulary pastoral is used where applicable (via `vocabulary.ts`)

**Given** a network error occurs
**When** the request fails
**Then** a skeleton loading state is shown while retrying with exponential backoff (1s, 2s, 4s — 3 attempts)
**And** after 3 failed attempts, a friendly error message replaces the skeleton: "Não foi possível carregar. Verifique sua conexão e tente novamente." with a retry button

**Given** an unhandled error occurs anywhere in the app
**When** the error propagates
**Then** a global error boundary (`error.tsx` per route segment + root fallback) catches it and displays a friendly message instead of a white screen
**And** the error is reported to Sentry (Epic 1 observability)

## Tasks / Subtasks

- [x] Task 1: Centralizar mensagens de erro em pt-BR.json (AC: #1)
  - [x] Definir schema de chaves: `error.{context}.{action}`
  - [x] Adicionar mensagens de permissão, limite de plano, not found, etc.
  - [x] Criar utility function para mapear error keys → mensagens localizadas
  - [x] Backend retorna error key no campo `message` ou `details.errorKey`
- [x] Task 2: Implementar mensagens acionáveis (AC: #2)
  - [x] Cada mensagem inclui: o que aconteceu + o que fazer
  - [x] Permission: "Você não tem permissão para esta ação. Fale com o administrador do seu grupo."
  - [x] Plan limit: "Limite do plano atingido (X/Y grupos). Fale com o administrador para upgrade."
  - [x] Not found: "Recurso não encontrado. Verifique o endereço ou volte ao início."
  - [x] Nunca exibir stack traces ou códigos técnicos
  - [x] Usar vocabulário pastoral quando aplicável
- [x] Task 3: Implementar retry com exponential backoff (AC: #3)
  - [x] Criar hook `useRetryQuery` ou configurar TanStack Query retry
  - [x] Backoff: 1s, 2s, 4s (3 attempts)
  - [x] Mostrar skeleton durante retry
  - [x] Após 3 falhas: mensagem amigável com botão retry
  - [x] Criar componente `NetworkErrorState`
- [x] Task 4: Implementar error boundaries (AC: #4)
  - [x] Criar `error.tsx` per route segment (Next.js App Router convention)
  - [x] Criar root fallback `apps/web/app/error.tsx` + `app/global-error.tsx`
  - [x] Mensagem amigável: nunca tela branca
  - [x] Botão "Tentar novamente" que reseta o error boundary
- [x] Task 5: Integrar com Sentry (AC: #4)
  - [x] Error boundary reporta para Sentry (via endpoint POST /api/v1/observability/client-errors → Sentry server-side)
  - [x] Incluir contexto: userId, tenantId, route, timestamp, digest, componentStack
  - [x] Não enviar dados sensíveis para Sentry (Zod schema rejeita PII; payload limitado a IDs UUID + metadados)
- [x] Task 6: Criar componente ErrorMessage reutilizável (AC: #2)
  - [x] Criar `apps/web/src/components/ui/error-message.tsx`
  - [x] Props: errorKey, retry callback, showRetry boolean
  - [x] Renderizar mensagem localizada de pt-BR.json
  - [x] Integrar vocabulário pastoral quando aplicável
- [x] Task 7: Padronizar respostas de erro no backend (AC: #1, #2)
  - [x] Garantir format: `{ statusCode, error, message, details? }`
  - [x] Incluir errorKey em details para frontend mapping
  - [x] Exception filters no NestJS para padronizar (`AllExceptionsFilter`)
  - [x] Nunca enviar stack traces para frontend
- [x] Task 8: Testes (AC: #1, #2, #3, #4)
  - [x] Teste: mensagem de permissão exibe texto correto
  - [x] Teste: mensagem de limite de plano com valores dinâmicos
  - [x] Teste: retry 3x com backoff exponencial (unit + integration com QueryClient real)
  - [x] Teste: após 3 falhas mostra mensagem com botão retry
  - [x] Teste: error boundary captura erro e exibe mensagem amigável
  - [x] Teste: nenhum stack trace visível no frontend
  - [x] Snapshot do contrato Zod ClientErrorReport (gate contra breaking changes)

## Dev Notes

- Mensagens centralizadas em `apps/web/messages/pt-BR.json` — single source of truth
- Backend retorna error keys, frontend mapeia para mensagens localizadas
- TanStack Query já tem retry built-in — configurar `retry: 3` e `retryDelay`
- Next.js App Router tem `error.tsx` convention para error boundaries
- Sentry integration da Epic 1 — reutilizar setup existente
- Exponential backoff: 1s, 2s, 4s (fator 2x)

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Core domains (Pastoral, Meetings, Content): Repository pattern
- Supporting subdomains: Service direto com Prisma
- Events: { eventId, eventType, version, tenantId, timestamp, data, metadata }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Epic 1, Story 1.5: Observabilidade (Sentry integration)
- Epic 6, Story 6.1: Vocabulário Pastoral (termos pastorais em mensagens)
- Nenhuma dependência hard — pode ser desenvolvida em paralelo com outras stories

### Project Structure Notes
```
apps/web/messages/
  └── pt-BR.json  (adicionar seção error.*)
apps/web/src/app/
  ├── error.tsx              (root error boundary)
  └── (authenticated)/
      └── [segment]/
          └── error.tsx      (per-segment error boundary)
apps/web/src/components/ui/
  ├── error-message.tsx
  └── network-error-state.tsx
apps/web/src/hooks/
  └── use-error-handler.ts
apps/api/src/common/filters/
  └── http-exception.filter.ts  (padronizar responses)
```

### References
- `_bmad-output/planning-artifacts/epics/epic-07.md` — Story 7.3
- `docs/project-context.md` — API error format { statusCode, error, message, details? }
- `docs/architecture.md` — Error handling patterns, Sentry integration

## Dev Agent Record

### Implementation Plan
Decomposição em 8 tasks alinhadas aos 4 ACs. Ordem de execução priorizou definir o contrato de erro do backend primeiro (Task 7 → `AllExceptionsFilter`) para que FE pudesse depender de envelope estável; em seguida i18n + utility (Tasks 1+2), componentes (3+6), boundaries (4), Sentry wiring (5), e testes (8). `SentryExceptionFilter` legado foi consolidado dentro do novo `AllExceptionsFilter`, mantendo todas as tags Sentry existentes (tenantId/userId/requestId/correlationId) e adicionando envelope padronizado.

Sentry no FE: como `@sentry/nextjs` não está instalado e o escopo da story diz "reutilizar setup existente", optei por um endpoint público `POST /api/v1/observability/client-errors` (rate-limited, validação Zod estrita) que o boundary chama via `navigator.sendBeacon` (com fallback fetch + keepalive). O endpoint repassa o evento ao `Sentry.captureMessage` no backend — assim o canal único de Sentry continua sendo o backend, evitando duas DSNs e novas dependências.

Retry policy: TanStack Query configurado globalmente em `query-provider.tsx` com `retry: shouldRetryQuery` (não tenta 4xx, retry 3x para 5xx + network errors) e `retryDelay: exponentialRetryDelay` (1s/2s/4s capped). `NetworkErrorState` consome esses estados via prop `isRetrying` para alternar entre skeleton e fallback.

### Completion Notes
- ✅ AC #1: chaves `error.{context}.{action}` centralizadas (10 sub-namespaces). Utility `resolveError()` mapeia ApiError + TypeError + Error genérico para mensagem localizada com interpolação `{var}` de `details`.
- ✅ AC #2: mensagens acionáveis verificadas literalmente nos testes (`/permissão.*administrador/i`, `/3\/3 grupos.*upgrade/i`, `/não encontrado.*volte ao início/i`). Stack traces nunca expostos: `AllExceptionsFilter` strip + teste explícito.
- ✅ AC #3: retry exponencial 1s/2s/4s ≤3 attempts validado em integration test com `QueryClient` real. 4xx não-retriado (preserva UX em erros determinísticos).
- ✅ AC #4: 5 error boundaries (root + 4 segmentos + global-error com `<html>`/`<body>`). `BoundaryFallback` chama `reportError()` no `useEffect`, que envia para o endpoint `/api/v1/observability/client-errors` → Sentry server-side.
- Vocabulário pastoral: tom adotado ("Fale com o administrador do seu grupo", "volte ao início" — não corporativo). `vocabulary.ts` ainda não existe (Story 6.1 não implementada); textos foram escritos diretamente em pt-BR.json com tom alinhado.
- 79 testes web + 17 testes API (filter + observability + sentry-context redirecionado) + 6 testes types (snapshot do contrato Zod). Lint clean, tsc clean, build clean.

### Debug Log
- Removido `apps/api/src/common/sentry/sentry.filter.ts` + `__tests__/sentry.filter.spec.ts` (superseded por `AllExceptionsFilter`); `test/observability/sentry-context.spec.ts` redirecionado para o novo filter.
- Zod v4 strict UUID forçou ajuste de fixtures de teste (UUIDs RFC4122-válidos) em `observability.spec.ts` e `observability.controller.spec.ts`.
- Falhas pré-existentes: `*.integration-spec.ts` e `*.rls-spec.ts` no API exigem Postgres ao vivo (`DATABASE_APP_URL missing`); não relacionadas a esta story.

## File List

### Backend
- **NEW** `apps/api/src/common/filters/http-exception.filter.ts` — `AllExceptionsFilter` global + helper `buildEnvelope`
- **NEW** `apps/api/src/common/filters/__tests__/http-exception.filter.spec.ts`
- **NEW** `apps/api/src/observability/observability.module.ts`
- **NEW** `apps/api/src/observability/observability.controller.ts` — `POST /api/v1/observability/client-errors`
- **NEW** `apps/api/src/observability/client-error-rate-limit.guard.ts`
- **NEW** `apps/api/src/observability/__tests__/observability.controller.spec.ts`
- **MODIFIED** `apps/api/src/main.ts` — registra `AllExceptionsFilter` no lugar de `SentryExceptionFilter`
- **MODIFIED** `apps/api/src/app.module.ts` — importa `ObservabilityModule`
- **MODIFIED** `apps/api/test/observability/sentry-context.spec.ts` — redirecionado para `AllExceptionsFilter`
- **DELETED** `apps/api/src/common/sentry/sentry.filter.ts`
- **DELETED** `apps/api/src/common/sentry/__tests__/sentry.filter.spec.ts`

### Types
- **NEW** `packages/types/src/observability.ts` — `ClientErrorReportSchema` + tipo
- **NEW** `packages/types/src/__tests__/observability.spec.ts`
- **MODIFIED** `packages/types/src/index.ts` — re-export

### Frontend
- **NEW** `apps/web/src/lib/errors/error-messages.ts` — `resolveError()` + interpolation
- **NEW** `apps/web/src/lib/errors/__tests__/error-messages.spec.ts`
- **NEW** `apps/web/src/lib/observability/report-error.ts` — beacon→fetch fallback para Sentry
- **NEW** `apps/web/src/lib/observability/__tests__/report-error.spec.ts`
- **NEW** `apps/web/src/lib/query/retry-policy.ts` — `shouldRetryQuery`, `exponentialRetryDelay`
- **NEW** `apps/web/src/lib/query/__tests__/retry-policy.spec.ts`
- **NEW** `apps/web/src/lib/query/__tests__/retry-integration.spec.tsx`
- **NEW** `apps/web/src/components/ui/error-message.tsx`
- **NEW** `apps/web/src/components/ui/__tests__/error-message.spec.tsx`
- **NEW** `apps/web/src/components/ui/network-error-state.tsx`
- **NEW** `apps/web/src/components/ui/__tests__/network-error-state.spec.tsx`
- **NEW** `apps/web/src/components/ui/boundary-fallback.tsx`
- **NEW** `apps/web/src/components/ui/__tests__/boundary-fallback.spec.tsx`
- **NEW** `apps/web/app/error.tsx`
- **NEW** `apps/web/app/global-error.tsx`
- **NEW** `apps/web/app/(authenticated)/error.tsx`
- **NEW** `apps/web/app/(marketing)/error.tsx`
- **NEW** `apps/web/app/(public)/error.tsx`
- **NEW** `apps/web/app/(onboarding)/error.tsx`
- **MODIFIED** `apps/web/src/lib/query/query-provider.tsx` — usa `RETRY_POLICY`
- **MODIFIED** `apps/web/messages/pt-BR.json` — namespace `error` com 10 sub-namespaces

## Change Log

| Date | Change |
|------|--------|
| 2026-05-08 | Story 7.3 implementada e marcada para review. AllExceptionsFilter padroniza envelope `{ statusCode, error, message, details? }` com Sentry tracking; FE retry policy 3x exponencial; 5 error boundaries; canal Sentry FE→BE via `/api/v1/observability/client-errors`. |
