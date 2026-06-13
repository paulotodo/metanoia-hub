# Research — onboarding-wizard (Story 10-1)

> Phase 0. Resolve unknowns ANTES do design. Cada decisão traz Decision /
> Rationale / Alternatives. As 5 ambiguidades críticas já foram resolvidas na
> clarify (Session 2026-06-13, dec-007..dec-011) e são tratadas como input
> autoritativo — aqui apenas consolidamos a fundamentação técnica.

## Contexto empírico (ETAPA 0 — verificado no código real @ dev `c83e473`)

- `model Tenant` (apps/api/prisma/schema.prisma): possui `metadata Json @default("{}") @db.JsonB`, `provisioningState Json?`, `isDemo`, `focusIndicatorEnabled`. **NÃO** possui `onboardingProgress`, `logoUrl`, `onboardingSkippedAt`, nem `denomination`/`city`/`state`.
- `model User`: possui `name`, `onboardingCompletedAt DateTime?`, `isDemoData`. **NÃO** possui `profilePhotoUrl`, `roleTitle`, nem `displayName` (usa `name`).
- `tenants` e `users` já têm **RLS habilitada** (migrations `20260413131927_add_pastoral_rls` e `20260414120000_add_invites_and_tenant_rls` / `20260409231601_create_users_...`).
- Endpoints existentes: `GET /api/v1/tenants/me`; `users.controller` tem `GET me`, `PATCH me/onboarding-complete`, `GET me/onboarding-status`; `onboarding.controller` tem `GET demo-radar`, `GET demo-status`, `PATCH demo-nudge-dismiss`.
- Reuso confirmado: `groups.controller @Post()`; módulo `apps/api/src/invites/`; `apps/api/src/storage/storage.service.ts`; `packages/types/src/vocabulary/vocabulary.ts`; `apps/web/app/(authenticated)/_components/onboarding-redirect-guard.tsx`; `packages/types/src/onboarding.ts` (já existe — DemoRadar/DemoStatus/OnboardingComplete schemas).
- FE: `apps/web/src/components/onboarding/` já existe; rotas autenticadas em `apps/web/app/(authenticated)/app/admin/` (PT-BR, SEM `src/` no caminho de rotas).

---

## Decision 1 — Persistência das URLs de mídia (foto/logo): colunas tipadas

**Decision**: criar colunas Prisma tipadas `User.profilePhotoUrl String?` e
`Tenant.logoUrl String?`. NÃO armazenar essas URLs dentro de JSONB.

**Rationale**: clarify Q2/dec-008 (score=2). Constitution Princípio II
(Type-Safety NON-NEGOTIABLE, `strict: true`) — JSONB não dá type-safety em
Prisma v7; uma URL tipada é contrato estável consumido por FE/BE e por
templates de mídia. Custo: 2 colunas nullable, migration aditiva sem RLS
policy change.

**Alternatives considered**:
- URLs dentro de `metadata`/`onboardingProgress.stepData` JSONB — REJEITADO:
  perde type-safety, força casts no acesso, viola II.
- Tabela de mídia dedicada — REJEITADO: overhead sem requisito (uma URL por
  entidade; upload permanente via storage.service já existente).

---

## Decision 2 — completedAt / skippedAt dentro do JSONB onboardingProgress

**Decision**: `completedAt` e `skippedAt` vivem DENTRO de
`Tenant.onboardingProgress` (JSONB), como `onboardingProgress.completedAt` e
`onboardingProgress.skippedAt`. **NÃO** criar coluna `onboardingSkippedAt`.

**Rationale**: clarify Q5/dec-011 (score=2) e spec FR-02 (define a estrutura
JSONB explicitamente com `completedAt?` e `skippedAt?`). Minimiza DDL (1 coluna
JSONB vs 3 colunas). A menção a `onboardingSkippedAt` em RECONCILIACAO §4 era
recomendação pré-clarify ("recomendo dentro do JSONB"); a clarify finalizou
dentro do JSONB. Validação de shape via `OnboardingProgressSchema` (Zod).

**Conflito resolvido**: o prompt do orquestrador citou "RECONCILIACAO §1/§5:
`Tenant.onboardingSkippedAt DateTime?`". A spec (Clarifications dec-011,
score=2) prevalece sobre a RECONCILIACAO (Constitution-first; spec é o
contrato). **Sem coluna `onboardingSkippedAt`.**

**Alternatives considered**:
- Coluna `onboardingSkippedAt DateTime?` separada — REJEITADO por dec-011.
- `onboardingCompletedAt` do tenant em coluna própria — REJEITADO: o
  `onboardingCompletedAt` existente é do `User` (gate user-scoped, Story 7-1);
  o tenant-scoped "completed" vive em `onboardingProgress.completedAt`.

---

## Decision 3 — Denominação / cidade / UF: metadata JSON vs colunas

**Decision**: armazenar `denomination`, `city`, `state` dentro de
`Tenant.metadata` (JSON existente), NÃO criar colunas DDL para esses campos.

**Rationale**: spec Key Entities lista "metadata (logo, denominação,
cidade/UF)". São campos opcionais, livres, sem consulta/filtro/ordenação
indexada exigida pelos FRs (nenhum cenário busca por denominação). Minimiza
DDL. O Zod (`TenantMetadataSchema` parcial) garante o shape no ponto de
escrita (`PATCH /tenants/me`), mantendo type-safety na borda mesmo com JSON no
banco — diferente das URLs de mídia, que são contrato cross-camada estável
(Decision 1). A distinção (logo em coluna tipada, denominação em metadata) é
deliberada: logo é referência de asset reutilizada em múltiplas telas; os
demais são texto de perfil.

**Alternatives considered**:
- Colunas tipadas `denomination`/`city`/`state` — aceitável mas adiciona 3
  colunas para campos puramente descritivos; preterido por minimização de DDL.
  Reabrir se um épico futuro exigir filtro/busca por esses campos.

---

## Decision 4 — Evento de domínio via EventEmitter2 (in-process síncrono)

**Decision**: `onboarding.wizard.step_completed` emitido via **EventEmitter2**
(`@nestjs/event-emitter`), síncrono in-process. NÃO usar BullMQ.

**Rationale**: clarify Q3/dec-009 (score=2). Consumo é FUTURO (Epic 13
analytics, sem consumer concreto no MVP). Onboarding é supporting subdomain
(service direto, sem infra adicional — Constitution Architecture Decisions).
BullMQ sem consumer = overhead (fila, worker, retry) sem benefício. Payload
segue o formato de evento de domínio da Constitution IV:
`{ eventId, eventType: 'onboarding.wizard.step_completed', version, tenantId, timestamp, data: { step, stepName }, metadata }`.

**Alternatives considered**:
- BullMQ (`queue:*`) — REJEITADO: sem consumer no MVP; reintroduz risco de nome
  de fila com `:` (guardrail CI §8.2). EventEmitter2 não tem fila.
- Sem evento (só persistir progresso) — REJEITADO: FR-10 exige o evento para
  consumo futuro de analytics; emitir agora evita retrofit.

---

## Decision 5 — Coexistência GET /onboarding/status (tenant) × /users/me/onboarding-status (user)

**Decision**: criar `GET /api/v1/onboarding/status` (tenant-scoped, lê
`Tenant.onboardingProgress`) coexistindo com o já existente
`GET /api/v1/users/me/onboarding-status` (user-scoped, lê
`User.onboardingCompletedAt`). Dois endpoints distintos, propósitos distintos.

**Rationale**: RECONCILIACAO §10.1 / Clarifications da spec. O **user-flag**
(`onboardingCompletedAt` no User, Story 7-1) é o gate de "primeiro login por
usuário" que dispara o redirect. O **tenant-progress**
(`onboardingProgress` no Tenant) é o estado do wizard do admin (retomada por
etapa, modo-demo, completed/skipped). Não recriar o user-flag nem o redirect
guard — o wizard *engata* no guard existente.

**Alternatives considered**:
- Unificar num só endpoint — REJEITADO: misturaria escopos (user vs tenant) e
  exigiria mexer no gate de primeiro login (Story 7-1), fora do escopo 10-1.
- Reusar `GET /users/me/onboarding-status` para o progresso do wizard —
  REJEITADO: é user-scoped e não carrega `currentStep`/`completedSteps`/
  `stepData` do tenant.

---

## Decision 6 — Condição TRIPLA de disparo do wizard (FR-01)

**Decision**: o guard redireciona ao wizard quando, para `admin_tenant`:
`onboardingProgress.completed != true` **AND** `onboardingProgress.skippedAt == null`
**AND** `count(grupos reais do tenant) == 0`. `super_admin` nunca vê o wizard.

**Rationale**: clarify Q1/dec-007 (score=1) e FR-01 (define as três condições
explicitamente). Implicação: o guard precisa de um count de grupos do tenant
(via `GET /onboarding/status`, que pode agregar `hasRealGroups` derivado de
`groups`). Score=1 documentado: a alternativa (remover a 3ª condição) violaria
FR-01 diretamente — não há opção compatível com a spec que dispense o count.

**Alternatives considered**:
- Condição dupla (sem count de grupos) — REJEITADO: viola FR-01.
- Count de grupos no FE — REJEITADO: dado de tenant deve vir do backend
  RLS-scoped; FE recebe `hasRealGroups` já agregado.

---

## Decision 7 — "Rever tutorial" como modo read-only real

**Decision**: prop `readOnly?: boolean` no `OnboardingWizard`; em replay os
formulários ficam `disabled` e NÃO há submit ao backend. Rota
`/app/admin/configuracoes/rever-tutorial`.

**Rationale**: clarify Q4/dec-010 (score=2), FR-09 ("modo leitura — sem salvar
dados novamente"), P7 AC ("sem editar dados"). Reusa o mesmo componente do
wizard com um flag, evitando duplicação.

**Alternatives considered**:
- Componente de tutorial separado — REJEITADO: duplica UI e diverge do wizard
  real.
- Permitir edição no replay — REJEITADO: viola FR-09/P7.

---

## Decision 8 — Upload de foto/logo: storage.service permanente + degradação graciosa

**Decision**: reusar `apps/api/src/storage/storage.service.ts` (MinIO, política
permanente). Falha de upload retorna erro acionável PT-BR e NÃO bloqueia avanço
da etapa (campos opcionais).

**Rationale**: spec FR-03/FR-04/FR-13 + RECONCILIACAO (storage policy
permanent). Sem TTL de link pré-assinado relevante (mídia permanente). FE faz
upload e recebe a URL final; a URL é persistida via `PATCH /users/me`
(profilePhotoUrl) ou `PATCH /tenants/me` (logoUrl).

**Alternatives considered**:
- Upload bloqueante — REJEITADO: viola FR-13 (degradação graciosa) e Success
  Criteria 6.

---

## Decision 9 — RLS: colunas aditivas nullable, sem mudança de policy

**Decision**: a migration adiciona apenas colunas nullable a `tenants` e
`users` (tabelas que JÁ têm RLS habilitada). NÃO há `CREATE POLICY` /
`ALTER POLICY` novos. Ainda assim, escrever uma **RLS isolation spec** focada
nos novos write paths (`PATCH /tenants/me`, `PATCH /users/me`,
`onboardingProgress`) como defesa em profundidade.

**Rationale**: Constitution Princípio I exige RLS isolation spec "para
migration que toque policy de RLS". Esta migration NÃO toca policy (só adiciona
colunas), então o spec não é estritamente obrigatório por essa cláusula — mas
os endpoints novos escrevem dados de tenant/user e o teste de isolamento
(2 tenants, UPDATE cross-tenant negado) é barato e fecha o gate de segurança
do produto pastoral. Decisão: incluir o spec (SHOULD forte).

**Alternatives considered**:
- Pular RLS spec (policy não mudou) — tecnicamente aceitável, mas o risco
  cross-tenant em write path novo justifica o spec. Incluído.

---

## Stack confirmada (sem NEEDS CLARIFICATION restantes)

| Dimensão | Valor | Fonte |
|----------|-------|-------|
| Backend | NestJS 11, Prisma v7, PostgreSQL+RLS, EventEmitter2 | CLAUDE.md, schema.prisma |
| Frontend | Next.js 16 App Router, Zustand, TanStack Query, shadcn/ui, Tailwind v4 | CLAUDE.md |
| Contratos | Zod em `packages/types` + snapshot | constitution IV |
| Upload | storage.service (MinIO permanente) | apps/api/src/storage |
| Eventos | EventEmitter2 in-process | dec-009 |
| Testes | Vitest unit/integration, Playwright e2e, jest-axe WCAG AA | constitution VI |

**NEEDS CLARIFICATION restantes: 0.**
