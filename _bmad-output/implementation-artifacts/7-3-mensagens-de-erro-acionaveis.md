# Story 7.3: Mensagens de Erro Acionáveis

Status: ready-for-dev

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

- [ ] Task 1: Centralizar mensagens de erro em pt-BR.json (AC: #1)
  - [ ] Definir schema de chaves: `error.{context}.{action}`
  - [ ] Adicionar mensagens de permissão, limite de plano, not found, etc.
  - [ ] Criar utility function para mapear error keys → mensagens localizadas
  - [ ] Backend retorna error key no campo `message` ou `details.errorKey`
- [ ] Task 2: Implementar mensagens acionáveis (AC: #2)
  - [ ] Cada mensagem inclui: o que aconteceu + o que fazer
  - [ ] Permission: "Você não tem permissão para esta ação. Fale com o administrador do seu grupo."
  - [ ] Plan limit: "Limite do plano atingido (X/Y grupos). Fale com o administrador para upgrade."
  - [ ] Not found: "Recurso não encontrado. Verifique o endereço ou volte ao início."
  - [ ] Nunca exibir stack traces ou códigos técnicos
  - [ ] Usar vocabulário pastoral quando aplicável
- [ ] Task 3: Implementar retry com exponential backoff (AC: #3)
  - [ ] Criar hook `useRetryQuery` ou configurar TanStack Query retry
  - [ ] Backoff: 1s, 2s, 4s (3 attempts)
  - [ ] Mostrar skeleton durante retry
  - [ ] Após 3 falhas: mensagem amigável com botão retry
  - [ ] Criar componente `NetworkErrorState`
- [ ] Task 4: Implementar error boundaries (AC: #4)
  - [ ] Criar `error.tsx` per route segment (Next.js App Router convention)
  - [ ] Criar root fallback `apps/web/src/app/error.tsx`
  - [ ] Mensagem amigável: nunca tela branca
  - [ ] Botão "Tentar novamente" que reseta o error boundary
- [ ] Task 5: Integrar com Sentry (AC: #4)
  - [ ] Error boundary reporta para Sentry (Epic 1 observability)
  - [ ] Incluir contexto: userId, tenantId, route, timestamp
  - [ ] Não enviar dados sensíveis para Sentry
- [ ] Task 6: Criar componente ErrorMessage reutilizável (AC: #2)
  - [ ] Criar `apps/web/src/components/ui/error-message.tsx`
  - [ ] Props: errorKey, retry callback, showRetry boolean
  - [ ] Renderizar mensagem localizada de pt-BR.json
  - [ ] Integrar vocabulário pastoral quando aplicável
- [ ] Task 7: Padronizar respostas de erro no backend (AC: #1, #2)
  - [ ] Garantir format: `{ statusCode, error, message, details? }`
  - [ ] Incluir errorKey em details para frontend mapping
  - [ ] Exception filters no NestJS para padronizar
  - [ ] Nunca enviar stack traces para frontend
- [ ] Task 8: Testes (AC: #1, #2, #3, #4)
  - [ ] Teste: mensagem de permissão exibe texto correto
  - [ ] Teste: mensagem de limite de plano com valores dinâmicos
  - [ ] Teste: retry 3x com backoff exponencial
  - [ ] Teste: após 3 falhas mostra mensagem com botão retry
  - [ ] Teste: error boundary captura erro e exibe mensagem amigável
  - [ ] Teste: nenhum stack trace visível no frontend
  - [ ] E2E: fluxo de erro completo

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
