# Plano de Implementação: dados-demonstracao (Story 10-2)

**Feature:** dados-demonstracao
**Epic:** 10 — Onboarding Avançado
**Story:** 10-2
**Branch base:** `dev @ cbb3b5f`
**Data:** 2026-06-13
**Versão:** 1.0.0

---

## Summary

Implementar dados de demonstração por-registro para novos tenants. O seed `seedDemoData(tenantId)` é injetado no provisioning do Epic 3 e popula o tenant do admin real com dados fictícios realistas (Grupo Alpha, 3 participantes com semáforo verde/amarelo/vermelho, trilha de conteúdo, reunião passada e ações pastorais). O endpoint `DELETE /api/v1/onboarding/demo-data` remove transacionalmente todos os registros marcados. O frontend exibe badge `DemoOverlay`, nudge contextual e botão em Configurações.

**Arquitetura:** extensão additive — 12 tabelas ganham `is_demo_data BOOLEAN DEFAULT false`, nenhum breaking change. Módulo `onboarding/` existente é estendido com `DemoDataService` + 3 endpoints novos.

---

## Constitution Check

*Gate executado antes de plan. Re-verificado após design.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | **PASS** | `isDemoData` em todas as tabelas; limpeza usa `getRequestContext().tenantId` via RLS; `withTenantTx` na transação; RLS specs obrigatórias cobrindo 2-tenant isolation |
| II. Type-Safety & Identificadores | **PASS** | UUID v7 fixos via `uuidv7()` (não `@default(uuid())`); `strict: true` mantido; ISO 8601 nas datas; `null` explícito |
| III. Idioma & Vocabulário Pastoral | **PASS** | Código em inglês (`isDemoData`, `seedDemoData`, `DemoOverlay`); UI em PT-BR (`pt-BR.json`); vocabulário pastoral (dados de demonstração, não "fake data") |
| IV. Contratos de API Padronizados | **PASS** | `DemoStatusResponseSchema` Zod em `packages/types`; snapshot test; `{ data: T }`; DELETE→204; PATCH→204; GET→200 |
| V. Separação de Estado Frontend | **PASS** | `useDemoStatus` TanStack Query (server state); sem Zustand para este estado; Server Components usam fetch nativo se necessário |
| VI. Qualidade Verificável | **PASS** | RLS specs para isolamento demo; snapshot Zod; testes de idempotência e limpeza; WCAG via shadcn/ui Badge |
| VII. Processo de Entrega Auditável | **PASS** | PR obrigatório (nunca push direto em dev); conventional commits PT-BR; 1 story = 1 branch |

**Veredicto: PASS.** Sem violações de MUST.

---

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem/Runtime | TypeScript strict, Node.js 22 |
| Backend | NestJS 11.1.17, `apps/api/src/` |
| ORM | Prisma v7 com `PrismaPg` adapter |
| DB | PostgreSQL + pgvector, RLS multi-tenant |
| Frontend | Next.js 16.2, App Router |
| UI | shadcn/ui (Badge, AlertDialog, Button) |
| Validação | Zod 4.3.6 em `packages/types` |
| Auth | `KeycloakAuthGuard`, `getRequestContext()` |
| UUIDs | `uuidv7()` / `generateId()` de `@metanoia/types` |
| Testes | Vitest 4.1.2, RLS specs em `apps/api/test/rls/` |
| CI | Turborepo, GitHub Actions (`pull_request` trigger) |

---

## Convencoes de Borda

| Camada | Case style | Validação | Fonte da verdade |
|--------|-----------|-----------|-----------------|
| DB columns (`is_demo_data`) | `snake_case` | migration + `prisma generate` | `apps/api/prisma/schema.prisma` |
| Prisma model field | `camelCase` (`isDemoData`) | `@map("is_demo_data")` automático | `schema.prisma` `@map` |
| Backend DTO response | `camelCase` | `ZodValidationPipe` + Zod schemas | `packages/types/src/onboarding.ts` |
| API JSON payload | `camelCase` | `DemoStatusResponseSchema.parse(json.data)` no fetch | `contracts/api.md` + `contracts/frontend.md` |
| URL paths | `kebab-case` | NestJS router | `/api/v1/onboarding/demo-data` |
| i18n keys | `camelCase` aninhado | — | `apps/web/messages/pt-BR.json` |

**ORM auto-mapping:** Prisma serializa `isDemoData` (TS) ↔ `is_demo_data` (DB) via `@map`. Sem mapper layer adicional.

**Validação cross-layer:** `DemoStatusResponseSchema` declarado em `packages/types` é importado tanto pelo backend (serialização) quanto pelo frontend (parse do response). Qualquer divergência de shape é detectada em tempo de build (TypeScript) e em runtime (Zod parse no fetch).

---

## Project Structure

### Documentação da feature

```
docs/specs/dados-demonstracao/
  spec.md           ← spec + clarifications (atualizada)
  research.md       ← decisões técnicas (gerado)
  data-model.md     ← schema diff + UUIDs fixos (gerado)
  plan.md           ← este arquivo
  quickstart.md     ← cenários de teste (gerado)
  contracts/
    api.md          ← contratos backend (gerado)
    frontend.md     ← componentes + hooks + Zod (gerado)
```

### Código-fonte a criar/modificar

```
apps/api/
  prisma/
    schema.prisma                          ← MODIFY: isDemoData em 12 modelos
    migrations/<ts>_add_is_demo_data/
      migration.sql                        ← CREATE: ALTER TABLE + CREATE INDEX x12
  src/
    onboarding/
      onboarding.controller.ts             ← MODIFY: 3 novos endpoints
      onboarding.module.ts                 ← MODIFY: registrar DemoDataService
      demo-data.service.ts                 ← CREATE: seedDemoData + cleanup + status
      demo-data.service.spec.ts            ← CREATE: testes unitários
      seed/
        demo-data.seed.ts                  ← CREATE: script CLI + seedDemoData fn
    super-admin/
      super-admin-tenants.service.ts       ← MODIFY: Step 4 no runSaga()
      super-admin-tenants.module.ts        ← MODIFY: import OnboardingModule
  test/
    rls/
      demo-data-isolation.rls-spec.ts      ← CREATE: isolamento tenant A vs B
      demo-data-cleanup.rls-spec.ts        ← CREATE: DELETE só afeta tenant corrente

packages/types/
  src/
    onboarding.ts                          ← MODIFY: DemoStatusResponseSchema
    __tests__/
      onboarding.spec.ts                   ← MODIFY: snapshot DemoStatusResponseSchema

apps/web/
  messages/
    pt-BR.json                             ← MODIFY: chaves demo.*
  src/
    components/
      onboarding/
        demo-overlay.tsx                   ← CREATE
        demo-cleanup-button.tsx            ← CREATE
        demo-data-nudge.tsx                ← CREATE
        index.ts                           ← MODIFY: export novos componentes
    hooks/
      use-demo-status.ts                   ← CREATE
      use-delete-demo-data.ts              ← CREATE
      use-dismiss-demo-nudge.ts            ← CREATE
  app/
    (authenticated)/app/admin/grupos/
      page.tsx                             ← MODIFY: DemoOverlay + DemoDataNudge
```

---

## Plano de Implementação por Fase

### Fase 1 — Migration + Schema (backend, sem breaking change)

**Objetivo:** adicionar `isDemoData` e índices nas 12 tabelas. Migration additive — sem downtime, sem alteração de lógica existente.

**Tarefas:**
1. Editar `apps/api/prisma/schema.prisma`: adicionar `isDemoData Boolean @default(false) @map("is_demo_data")` + `@@index([tenantId, isDemoData])` nos 12 modelos.
2. `pnpm --filter @metanoia/api exec prisma migrate dev --name add_is_demo_data`
3. Verificar migration gerada (12 `ALTER TABLE`, 12 `CREATE INDEX`).
4. `pnpm --filter @metanoia/api exec prisma generate`

**Gate:** `pnpm turbo build` verde após migration.

---

### Fase 2 — Seed + DemoDataService (backend)

**Objetivo:** implementar `seedDemoData(tenantId)` idempotente e `DemoDataService`.

**Tarefas:**
1. Criar `apps/api/src/onboarding/seed/demo-data.seed.ts`:
   - UUIDs fixos com prefixo `01989b10-1002-7000-8000-`
   - `seedDemoData(tenantId)`: 12 upserts na ordem de inserção (pai antes de filho)
   - Função `main()` para execução CLI com `--tenant-id` de `process.argv`
2. Criar `apps/api/src/onboarding/demo-data.service.ts` (NestJS `@Injectable()`):
   - `seedDemoData(tenantId: string)`: delega para `seedDemoData()` do arquivo de seed
   - `deleteDemoData(tenantId: string)`: `prisma.$transaction()` na ordem de deleção (research Decision 5)
   - `getDemoStatus(tenantId: string)`: queries de contagem + check `metadata.demoDismissedAt`
   - `dismissNudge(tenantId: string)`: `prisma.tenant.update(metadata spread)`
3. Adicionar `db:seed:demo-data` em `apps/api/package.json`
4. Adicionar entrada em `turbo.json` (`"cache": false`)

**Gate:** `pnpm --filter @metanoia/api test demo-data.service.spec.ts` verde.

---

### Fase 3 — Controller + Endpoints (backend)

**Objetivo:** expor os 3 novos endpoints no `OnboardingController`.

**Tarefas:**
1. Modificar `onboarding.controller.ts`:
   - `@Delete('demo-data') @Roles('admin_tenant')` → `demoDataService.deleteDemoData(ctx.tenantId)` → `res.status(204).send()`
   - `@Get('demo-status') @Roles('admin_tenant')` → `demoDataService.getDemoStatus(ctx.tenantId)` → `{ data: result }`
   - `@Patch('demo-nudge-dismiss') @Roles('admin_tenant')` → `demoDataService.dismissNudge(ctx.tenantId)` → `res.status(204).send()`
2. Modificar `onboarding.module.ts`: adicionar `DemoDataService` em `providers` e `exports`.
3. Modificar `super-admin-tenants.module.ts`: importar `OnboardingModule`.
4. Modificar `super-admin-tenants.service.ts`: injetar `DemoDataService`, adicionar Step 4 no `runSaga()`.

**Gate:** testes de integração do controller passando; smoke test manual via curl.

---

### Fase 4 — RLS Specs (backend)

**Objetivo:** garantir isolamento de tenant para os dados demo.

**Tarefas:**
1. Criar `apps/api/test/rls/demo-data-isolation.rls-spec.ts`:
   - Seed demo data no tenant A
   - Verificar SELECT no contexto do tenant B retorna 0 registros com `isDemoData=true` do tenant A
2. Criar `apps/api/test/rls/demo-data-cleanup.rls-spec.ts`:
   - Seed demo data nos tenants A e B
   - Chamar `deleteDemoData(tenantIdA)` no contexto de A
   - Verificar tenant A: 0 registros demo
   - Verificar tenant B: registros demo intactos
3. Padrão: `PrismaPg({ connectionString: DATABASE_APP_URL })`, UUIDs fixos, cleanup só mutável.

**Gate:** `pnpm turbo test --filter=@metanoia/api -- --run rls` verde.

---

### Fase 5 — Zod + Types (shared)

**Objetivo:** adicionar `DemoStatusResponseSchema` em `packages/types` com snapshot.

**Tarefas:**
1. Modificar `packages/types/src/onboarding.ts`: adicionar `DemoStatusResponseSchema` + tipo.
2. Modificar `packages/types/src/__tests__/onboarding.spec.ts`: adicionar snapshot do novo schema.
3. `pnpm --filter @metanoia/types test --run` para gerar snapshot inicial.

**Gate:** snapshot criado; `pnpm turbo build --filter=@metanoia/types` verde.

---

### Fase 6 — Frontend Hooks + Componentes

**Objetivo:** implementar os 3 hooks + 3 componentes + i18n.

**Tarefas:**
1. Adicionar chaves `demo.*` em `apps/web/messages/pt-BR.json`.
2. Criar hooks em `apps/web/src/hooks/`: `use-demo-status.ts`, `use-delete-demo-data.ts`, `use-dismiss-demo-nudge.ts`.
3. Criar componentes em `apps/web/src/components/onboarding/`: `demo-overlay.tsx`, `demo-cleanup-button.tsx`, `demo-data-nudge.tsx`.
4. Atualizar `apps/web/src/components/onboarding/index.ts`.

**Gate:** `pnpm turbo build --filter=@metanoia/web` verde; testes de componente.

---

### Fase 7 — Integração nas páginas

**Objetivo:** integrar `DemoOverlay` e `DemoDataNudge` na página de grupos.

**Tarefas:**
1. Modificar `apps/web/app/(authenticated)/app/admin/grupos/page.tsx`:
   - Envolver itens de grupo demo em `DemoOverlay`
   - Condicionar exibição do `DemoDataNudge` (Client Component)
2. Adicionar `DemoCleanupButton` onde configurações de tenant forem expostas.

**Gate:** `pnpm turbo test --filter=@metanoia/web` verde; inspeção visual.

---

### Fase 8 — Testes finais + Validação

**Objetivo:** confirmar idempotência, limpeza, isolamento e resiliência do provisioning.

**Tarefas:**
1. Teste de idempotência: seed 2x no mesmo tenant → contagem idêntica.
2. Teste de limpeza total: DELETE → 0 registros demo, dados reais intactos.
3. Teste de isolamento: 2 tenants, cleanup de um não afeta o outro.
4. Teste de resiliência: provisioning com seed que falha → tenant `active`, admin consegue login.
5. Roundtrip E2E: payload de `GET /onboarding/demo-status` parseável por `DemoStatusResponseSchema`.

---

## Complexidade e Riscos

| Risco | Mitigação |
|-------|-----------|
| FK violation na transação de limpeza | Ordem de deleção definida em research Decision 5; testada em RLS spec |
| `lesson_progress` sem `isDemoData` não limpa se cascade falhar | `lesson_progress` tem `onDelete: Cascade` via `Lesson` — confirmado no schema. Se necessário, adicionar deleção explícita na transação. |
| Nudge sem `onboardingProgress` no Tenant | Usar `Tenant.metadata` JSONB com chave `demoDismissedAt` (Decision 2) |
| Colisão UUID com seed 7-2 | Prefixo distinto `01989b10-1002-7...` vs `019899a0-7002-...` |
| Push direto em dev | Guardrail CI explícito — somente `pull_request` trigger |
| `MeetingAttendance` vs `MeetingTelemetry` para presença | Seed cria ambos: `MeetingAttendance` (presenceType: integral/parcial/ausente) + `MeetingTelemetry` (cameraOnSeconds, focusScore) |

---

## Artefatos Gerados

| Arquivo | Status |
|---------|--------|
| `docs/specs/dados-demonstracao/plan.md` | Criado |
| `docs/specs/dados-demonstracao/research.md` | Criado |
| `docs/specs/dados-demonstracao/data-model.md` | Criado |
| `docs/specs/dados-demonstracao/contracts/api.md` | Criado |
| `docs/specs/dados-demonstracao/contracts/frontend.md` | Criado |
| `docs/specs/dados-demonstracao/quickstart.md` | Criado |

---

## Próximos Passos

1. `/checklist` — gerar quality gate antes de implementar
2. `/create-tasks` — decompor em backlog executável por fase
3. Implementação: Fase 1 → migration → PR → CI → merge → Fase 2 → ...
