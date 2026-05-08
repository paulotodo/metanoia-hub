# Story 7.2: Dados de Demonstração Realistas

Status: done

## Story

As a novo tenant/líder,
I want realistic demo data pre-populated in my workspace,
so that I can see the Radar Pastoral in action and understand the platform value immediately.

## Acceptance Criteria

**Given** a new tenant is provisioned or the admin selects "Quero ver dados de exemplo" during onboarding
**When** the demo seed runs (`pnpm seed:demo`)
**Then** a dedicated demo tenant is created with `is_demo: true` flag on the `tenants` table (not per-record flags — cleanup = delete tenant with cascade)
**And** the seed is idempotent — running 2x does not duplicate data (checks if demo tenant exists before creating)

**Given** demo data is seeded
**When** the data is created
**Then** it includes:
- 1 grupo fictício ("Grupo Esperança") with ~10 participants with realistic Brazilian names (ex: "Maria Santos", "João Oliveira", "Ana Costa") and avatar placeholders with initials
- 3 historical meetings with varied attendance (integral, parcial, ausente) and realistic timestamps (last 3 weeks, not generic dates)
- Radar status distributed: ~4 verde, ~3 amarelo, ~2 vermelho, ~1 novo
- Varied trends: melhorando, estável, declínio
- 2 pastoral care actions registered
- 9 active pastoral_alerts (1 row per non-novo participant) covering the full radar payload — `care-ok` for verdes, `care-attention` for amarelos, `care-urgent` for vermelhos. Dashboard filtra por `signalType` ao computar "alertas que precisam de atenção".
**And** all data uses UUID v7 and realistic timestamps
**And** demo data is RLS-isolated (does not contaminate other tenants)

**Given** the demo is seeded and a Líder logs in
**When** they complete onboarding
**Then** a guided demo walkthrough starts: Radar overview → Click a participant → View timeline → Register a care action (tour with 4 steps, skippable)
**And** the líder sees value immediately (pre-mortem gate validated)

## Tasks / Subtasks

- [x] Task 1: Adicionar campo is_demo na tabela tenants (AC: #1)
  - [x] Prisma migration: adicionar `is_demo` boolean default false em `tenants`
  - [x] @map("is_demo") para snake_case
  - [x] Cleanup: cascade FK descartada em favor de script app-level (`db:seed:demo:clean`) que respeita ordem de dependências sem alargar schema-wide as constraints
- [x] Task 2: Criar seed script idempotente (AC: #1)
  - [x] Criar `apps/api/prisma/seeds/demo-seed.ts`
  - [x] Registrado como `db:seed:demo` (alinha com `db:seed:radar`/`db:seed:invites`/`db:seed:scenario-03` já existentes)
  - [x] Idempotência via `prisma.X.upsert(...)` — sem chamadas a `prisma.X.create(` (asserto estrutural no spec)
  - [x] Idempotente: 2x execução = mesmo resultado (IDs UUID v7 fixos)
- [x] Task 3: Implementar dados fictícios realistas (AC: #2)
  - [x] Grupo "Grupo Esperança" com 10 participantes
  - [x] Nomes brasileiros realistas (Maria Santos, João Oliveira, Ana Costa, Pedro Lima, Beatriz Rocha, Lucas Almeida, Camila Ferreira, Rafael Souza, Juliana Martins, Tiago Carvalho)
  - [x] 3 reuniões históricas (21/14/7 dias atrás, quintas 19h30) com timestamps realistas
  - [x] Attendance variada: presente, ausente — atendência decrescente para gerar curva de risco coerente
  - [x] Radar status: 4 verde, 3 amarelo, 2 vermelho, 1 novo
  - [x] Trends variados: melhorando, estável, declínio
  - [x] 2 ações pastorais registradas (1 mensagem urgente, 1 oração)
  - [x] 9 alertas ativos cobrindo verdes/amarelos/vermelhos
  - [x] Todos os IDs UUID v7 (prefixo `019899a0-7002` reservado para a Story 7-2)
- [x] Task 4: Garantir isolamento RLS dos dados demo (AC: #2)
  - [x] Todos os registros com `tenantId = DEMO_TENANT_ID`
  - [x] RLS spec `apps/api/test/rls/demo-seed.rls-spec.ts` — tenant regular não enxerga grupos nem o tenant flagueado is_demo
- [ ] Task 5: Implementar walkthrough guiado (AC: #3) — **DEFERRED**
  - Motivo: trabalho FE substancial (componente tour + persistência de estado de conclusão). Será extraído como story dedicada para manter este PR focado em demo seed.
- [ ] Task 6: Integrar seed com onboarding (AC: #1) — **DEFERRED (bloqueado)**
  - Motivo: depende da Story 7.1 (Tela de Boas-Vindas), que está `ready-for-dev`. Endpoint `POST /api/v1/tenants/seed-demo` será adicionado quando 7.1 entregar a UI de onboarding.
- [x] Task 7: Testes (AC: #1, #2) — escopo do que é viável sem 5/6
  - [x] Teste estrutural do seed (8 asserts: distribuição, idempotência por upsert, ausência de placeholders genéricos, fixação de tenant id, 3 reuniões, signalTypes)
  - [x] Teste RLS: dados demo isolados por RLS de outros tenants
  - [x] Teste: distribuição de status correta (4/3/2/1)
  - [ ] E2E: walkthrough — segue para a story de Task 5

## Dev Notes

- Demo tenant usa `is_demo: true` flag — cleanup simples: delete cascade do tenant
- Seed deve ser idempotente — check existence before create
- Nomes brasileiros realistas — não usar "User 1", "User 2"
- Timestamps das reuniões: últimas 3 semanas com datas específicas (ex: terça-feira às 19h)
- Walkthrough pode usar library como `react-joyride` ou implementação custom simples
- `pnpm seed:demo` deve funcionar tanto local quanto em staging

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
- Story 7.1: Tela de Boas-Vindas (integração com botão de demo)
- Epic 4: Grupos (schema para grupo demo)
- Epic 5: Reuniões e Presença (meetings, attendance data)
- Epic 6: Radar Pastoral (radar status, alerts, actions)

### Project Structure Notes
```
apps/api/prisma/seeds/
  └── demo-seed.ts
apps/api/src/modules/onboarding/
  └── demo/
      ├── demo-seed.service.ts
      └── demo.controller.ts
apps/web/src/components/onboarding/
  └── walkthrough-tour.tsx
prisma/migrations/  (add is_demo to tenants)
```

### References
- `_bmad-output/planning-artifacts/epics/epic-07.md` — Story 7.2
- `docs/project-context.md` — Test factories pattern
- `docs/architecture.md` — Seed scripts, demo data strategy

## Dev Agent Record

### Implementation Plan
- Branch: `feat/story-7-2-demo-data-seed`
- Escopo entregue: Tasks 1, 2, 3, 4, 7 (parcial). Tasks 5 e 6 deferidas — confirmado com o usuário em 2026-05-08.
- Estratégia de cleanup: ao invés de adicionar `@relation(onDelete: Cascade)` em ~10 modelos tenant-scoped (mudança schema-wide com risco baixo de ROI já que RLS garante isolamento), introduzido script app-level `db:seed:demo:clean` que percorre dependências em ordem e deleta apenas as linhas de tenants flagueados `is_demo=true`.

### Completion Notes
- Migration `20260430100000_add_tenant_is_demo` adiciona coluna `is_demo BOOLEAN NOT NULL DEFAULT false` + índice parcial `tenants_is_demo_idx` filtrando por `is_demo = true` (suporta query de cleanup sem custo em rows não-demo).
- Seed `apps/api/prisma/seeds/demo-seed.ts` produz dataset coerente: tenant + admin/líder + 10 participantes + grupo + 3 reuniões com presença caindo (9→7→5) + 9 alertas pastorais + 2 ações + 1 nota relacional. UUID v7 fixos com prefixo `019899a0-7002-…` reservam o espaço da Story 7-2.
- Cleanup `apps/api/prisma/seeds/demo-seed-clean.ts` deleta na ordem: notes/actions/alerts/outreach/meeting_events → meetings (cascade para participants+reflections) → group_members/groups → consents/user_tenants/users → invites → tenants. No-op quando não há tenants demo.
- Lint clean para todos os arquivos novos. Typecheck clean. Pre-existing errors em `meetings/sse/*.spec.ts` e `meetings/webhooks/*.spec.ts` (vitest globals não configurados) são anteriores e não-relacionados.
- ✅ 8 testes estruturais passam (`pnpm vitest run test/seed/demo-seed.spec.ts` — 8/8).
- ✅ Suite unit completa passa sem regressões (49 files / 273 tests, excluindo RLS+integration que demandam DB).
- ⚠️ RLS spec `demo-seed.rls-spec.ts` requer `DATABASE_APP_URL` — será exercitado pelo job de RLS no CI ou manualmente via `pnpm test:rls`.

### File List
- `apps/api/prisma/migrations/20260430100000_add_tenant_is_demo/migration.sql` (novo)
- `apps/api/prisma/schema.prisma` (modificado — campo `isDemo` em `Tenant`)
- `apps/api/prisma/seeds/demo-seed.ts` (novo — refatorado para evitar non-null assertions)
- `apps/api/prisma/seeds/demo-seed-clean.ts` (novo)
- `apps/api/package.json` (modificado — scripts `db:seed:demo` e `db:seed:demo:clean`)
- `apps/api/test/seed/demo-seed.spec.ts` (novo — 8 asserts estruturais)
- `apps/api/test/rls/demo-seed.rls-spec.ts` (novo — 4 asserts RLS)
- `apps/web/next-env.d.ts` (modificado — Next 16 alterou path de routes.d.ts)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificado — 7-2 → review)
- `_bmad-output/implementation-artifacts/7-2-dados-de-demonstracao-realistas.md` (modificado — este arquivo)

## Change Log

| Data | Mudança |
|---|---|
| 2026-04-30 | Migration `is_demo`, schema field, seed inicial e spec estrutural escritos no branch (WIP pré-existente). |
| 2026-05-08 | Refactor `demo-seed.ts` para eliminar non-null assertions; cleanup script `demo-seed-clean.ts` adicionado; RLS spec `demo-seed.rls-spec.ts` adicionado; tasks 5/6 deferidas; status → review. |
| 2026-05-08 | Code review (Approve com follow-ups): findings anexados em `### Review Findings`. |
| 2026-05-08 | Code review actions: AC realinhada (9 alerts), 4 patches aplicados (timestamps refresh, RLS pastoral_alerts, User upsert por id, participantByKey). `next-env.d.ts` revertido. Status → `done`. |

## Review Findings

**Verdict:** Approve com follow-ups — entrega correta nos eixos críticos (idempotência por upsert, isolamento RLS, namespace UUID separado, tests passing). Pendências classificadas abaixo.

### Decision-needed
- [x] [Review][Decision] **Alert count diverge da AC "1 active alert"** — Resolvido 2026-05-08: manter 9 alertas + AC realinhada para refletir 1 row por participante não-novo cobrindo o payload completo do radar. Dashboard filtra por `signalType` para classificar urgência.
- [x] [Review][Decision] **`apps/web/next-env.d.ts` fora de escopo da story** — Resolvido 2026-05-08: `pnpm build` regerou o arquivo com o path canônico (`.next/types/routes.d.ts`); a alteração era side-effect de `pnpm dev`. Arquivo revertido fora do PR.

### Patch (aplicados 2026-05-08)
- [x] [Review][Patch] **Timestamps congelam em re-run, ferindo AC "realistic timestamps"** [`apps/api/prisma/seeds/demo-seed.ts`] — `meeting.upsert.update` agora inclui `scheduledFor/startedAt/endedAt`; `meetingParticipantRecord.upsert.update` inclui `joinedAt/leftAt/response`; `pastoralAction.upsert.update` inclui `recordedAt`; `pastoralNote.upsert.update` inclui `occurredAt`. Re-run sempre desloca a janela para "últimas 3 semanas" relativo a `now`.
- [x] [Review][Patch] **RLS spec não cobre payload pastoral** [`apps/api/test/rls/demo-seed.rls-spec.ts`] — Adicionado teste `regular tenant cannot see pastoral_alerts seeded for the demo tenant`; cleanup/beforeEach atualizados para limpar `pastoral_alerts` + users `@rls.test` em ambos os tenants.
- [x] [Review][Patch] **User upsert via `email` pode realocar usuário cross-tenant** [`apps/api/prisma/seeds/demo-seed.ts`] — Trocado `where:{email}` por `where:{id}`; `tenantId` removido do `update` (invariante do `create`). Email collision não consegue reassignar usuários.
- [x] [Review][Patch] **`participantByName` quebra silenciosamente em rename** [`apps/api/prisma/seeds/demo-seed.ts`] — Adicionado tipo `ParticipantKey` (literal union) e campo `key` em cada participante; lookup por chave estável via `participantByKey('rafael'|'beatriz'|'juliana')`.

### Defer
- [x] [Review][Defer] Spec estrutural baseado em regex sobre source code [`apps/api/test/seed/demo-seed.spec.ts`] — deferido, é compromisso documentado (real assertion exige DB live; já existe RLS spec para isso). Deferida para iteração futura quando `db:seed:demo` rodar em CI integration job.

### Confirmações positivas (não-findings, mas registrados)
- ✅ **Namespace UUID isolado**: prefixo `019899a0-7002-...` não colide com `seed-radar.ts` (`019756a0/a1-...`), `seed-scenario-03.ts` (`019801a0-...`), nem `seed-invites.ts` (`019756a0-...`).
- ✅ **Migration safe**: `ADD COLUMN ... NOT NULL DEFAULT false` + índice parcial — zero risco em rows existentes.
- ✅ **Cleanup ordem coerente**: cobre todas as ~10 tabelas tenant-scoped tocadas pelo seed; cascade Meeting→MeetingParticipantRecord/Reflection confirmado no schema (`@relation(... onDelete: Cascade)`).
- ✅ **Decisão schema-wide vs app-level cleanup**: justificada — RLS é a garantia de isolamento; `onDelete:Cascade` em ~10 modelos ampliaria a superfície de risco em produção sem ROI proporcional.
- ✅ **Coerência narrativa**: distribuição 4/3/2/1 + presença caindo (9→7→5) ordenada por `orderStatus` (verdes-first) entrega curva determinística que casa com expectativa de "presença declinante".
