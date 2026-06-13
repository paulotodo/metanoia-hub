# Tasks: dados-demonstracao (Story 10-2)

**Feature:** dados-demonstracao
**Epic:** 10 — Onboarding Avançado
**Story:** 10-2 — Dados de Demonstração por Tenant
**Branch base:** `dev`
**Gerado em:** 2026-06-13
**Status:** pronto para execução

---

## Legenda de Criticidade

- **`[C]`** — Crítico: bloqueante para a story funcionar
- **`[A]`** — Alta: requisito de aceitação, não bloqueia outras tarefas
- **`[M]`** — Médio: melhoria de qualidade, não bloqueia CI

## Legenda de Status

- `[ ]` — Pendente
- `[x]` — Concluída

---

## Resumo Quantitativo

| FASE | Tarefas | Subtarefas | Criticidade |
|------|---------|------------|-------------|
| FASE 0 — Pré-flight Empírico | 2 | 9 | 2×`[C]` |
| FASE 1 — Migration + Schema | 3 | 10 | 3×`[C]` |
| FASE 2 — Seed + DemoDataService | 4 | 23 | 3×`[C]` 1×`[A]` |
| FASE 3 — Controller + Endpoints | 3 | 13 | 3×`[C]` |
| FASE 4 — RLS Specs | 3 | 13 | 2×`[C]` 1×`[A]` |
| FASE 5 — Zod + Types | 2 | 6 | 1×`[C]` 1×`[A]` |
| FASE 6 — Frontend Hooks + Componentes | 8 | 27 | 4×`[C]` 4×`[A]` |
| FASE 7 — Integração nas Páginas | 3 | 8 | 1×`[C]` 1×`[A]` 1×`[M]` |
| FASE 8 — Testes Finais | 6 | 18 | 4×`[C]` 2×`[A]` |
| **Total** | **34** | **127** | **23×`[C]` 10×`[A]` 1×`[M]`** |

---

## Escopo Coberto

- Migration `isDemoData` nas 12 tabelas confirmadas (User, Group, GroupMember, Trail, Module, Lesson, TrailProgress, ModuleProgress, Meeting, MeetingAttendance, MeetingTelemetry, PastoralAction)
- Seed idempotente `seedDemoData(tenantId)` com UUIDs v7 fixos (prefixo `01989b10-1002-7000-8000-`)
- `DemoDataService` (NestJS) + 3 endpoints: DELETE/GET/PATCH
- RLS specs de isolamento (demo não vaza entre tenants) + cleanup (delete só afeta tenant do contexto)
- Zod `DemoStatusResponseSchema` + snapshot test
- Frontend: 3 hooks (`useDemoStatus`, `useDeleteDemoData`, `useDismissDemoNudge`) + 3 componentes (`DemoOverlay`, `DemoDataNudge`, `DemoCleanupButton`) + i18n PT-BR
- Integração na página de grupos (DemoOverlay em itens demo + DemoDataNudge condicional)
- Gaps tratados: CHK008 (placeholder DemoCleanupButton), CHK016 (revalidação), CHK030 (race condition documentada), CHK032 (coexistência radar documentada), CHK038 (a11y badge/nudge), CHK041 (dependência circular), SEC011 (interface LGPD documentada)

## Escopo Excluído

- Filtro automático de dados demo em relatórios/Radar — dec-010: deferido para pós-MVP
- Integração do `DemoCleanupButton` em rota de Configurações — bloqueado até Story 10-1 definir path exato (CHK008)
- Contas Keycloak para usuários fictícios — apenas registros de dados sem autenticação (FR-12)
- E2E Playwright — cobertos por testes de integração e RLS specs

---

## Matriz de Dependências

```
FASE 0 → FASE 1 → FASE 2 → FASE 3 → FASE 4
                    ↓
                  FASE 5
                    ↓
                  FASE 6 → FASE 7
                              ↓
                            FASE 8
```

- FASE 0 (pré-flight empírico) → FASE 1: confirmar tabelas antes de migrar
- FASE 1 (migration): prerequisito de todas as fases de backend
- FASE 5 (Zod/types): pode correr em paralelo com FASE 2–4 após FASE 1
- FASE 6 (frontend): depende de FASE 5 para os tipos Zod
- FASE 7 (integração): depende de FASE 6
- FASE 8 (testes finais): depende de todas as fases anteriores

---

## FASE 0 — Pré-flight Empírico

> Motivação (plan.md §Complexidade, RECONCILIACAO-EPIC10 §10 dec-5): confirmar empiricamente nomes reais de tabela/coluna antes da migration.

### 0.1 Confirmar modelos e campos no schema Prisma `[C]`

- [x] Abrir `apps/api/prisma/schema.prisma` e verificar os 12 modelos alvo: User, Group, GroupMember, Trail, Module, Lesson, TrailProgress, ModuleProgress, Meeting, MeetingAttendance, MeetingTelemetry, PastoralAction
- [x] Confirmar que cada modelo tem `tenantId` — prerequisito do índice `@@index([tenantId, isDemoData])` (User.tenantId é nullable String? — Postgres aceita índice com nullable)
- [x] Confirmar que `MeetingTelemetry` tem `tenantId` (CONFIRMADO: linha 109 do schema — `tenantId String @map("tenant_id") @db.Uuid`)
- [x] Verificar que nenhum modelo já tem `isDemoData` (evitar colisão de campo) — NENHUM tinha antes da migration
- [x] Confirmar que `LessonProgress` NÃO está na lista — tem `onDelete: Cascade` via Lesson (confirmado linha 734: `lesson Lesson @relation(... onDelete: Cascade, onUpdate: Cascade)`)

### 0.2 Confirmar ponto de hook no provisioning `[C]`

- [x] Abrir `apps/api/src/super-admin/super-admin-tenants.service.ts` e localizar o método de provisioning (`runSaga()` — linha 213)
- [x] Identificar o passo após criação do admin user onde inserir `Step 4: seedDemoData(tenantId)`: após Step 3 (linha 239), antes de `updateStatus(id, 'active')` (linha 242)
- [x] Confirmar que importar `OnboardingModule` no `SuperAdminTenantsModule` não cria dependência circular (CHK041) — `OnboardingModule` não importa `SuperAdminTenantsModule`

---

## FASE 1 — Migration + Schema

> Gate: `pnpm turbo build` verde após migration.
> Commit: `feat(dados-demo): migration isDemoData em 12 tabelas [C]`

### 1.1 Editar schema.prisma nos 12 modelos `[C]`

- [x] Em cada um dos 12 modelos confirmados na FASE 0: adicionado `isDemoData Boolean @default(false) @map("is_demo_data")` (24 ocorrências no schema — 12 campos + 12 índices, grep -c confirmado)
- [x] Em cada modelo: adicionado `@@index([tenantId, isDemoData])` após o índice existente de `tenantId`
- [x] Rodar `pnpm --filter @metanoia/api exec prisma format` — output: "Formatted prisma/schema.prisma in 42ms"

### 1.2 Gerar e revisar migration SQL `[C]`

- [x] Migration criada manualmente em `apps/api/prisma/migrations/20260621000000_10-2-is-demo-data/migration.sql` (DB não disponível em CI — padrão do repo: migrations SQL handwritten, igual às 9-x)
- [x] Confirmado na migration: exatamente 12 `ALTER TABLE ... ADD COLUMN` + 12 `CREATE INDEX` (grep -c verificado) sem nenhuma instrução destrutiva (apenas no comentário do header)
- [x] Migration não contém instruções extras ou destrutivas — confirmado via grep

### 1.3 Regenerar Prisma client e validar build `[C]`

- [x] `pnpm --filter @metanoia/api exec prisma generate` — "Generated Prisma Client (v7.7.0) in 336ms"
- [x] `pnpm --filter @metanoia/api exec tsc --noEmit`: 0 erros em código de produção; 129 erros em spec files (138 preexistentes antes de nossas mudanças — introduzimos 0 novos, corrigimos 9)
- [x] Spot-check: grep -c "isDemoData" no generated index.d.ts retornou 503 ocorrências — tipos exportados corretamente

---

## FASE 2 — Seed + DemoDataService

> Gate: `pnpm --filter @metanoia/api test demo-data.service.spec.ts` verde.
> Commit: `feat(dados-demo): DemoDataService + seedDemoData idempotente`

### 2.1 Criar demo-data.seed.ts com seedDemoData idempotente `[C]`

- [ ] Criar `apps/api/src/onboarding/seed/demo-data.seed.ts`
- [ ] Definir UUIDs v7 fixos com prefixo `01989b10-1002-7000-8000-` para todos os registros (4 users, 1 group, 4 groupMembers, 1 trail, 2 modules, 4 lessons, 3 trailProgress, 3 moduleProgress, 1 meeting, 3 meetingAttendance, 3 meetingTelemetry, 3 pastoralActions)
- [ ] Semáforo por participante: Ana Costa (verde: TrailProgress 100%, presenceType `integral`, PastoralAction positiva), Pedro Santos (amarelo: TrailProgress 50%, presenceType `parcial`), Maria Oliveira (vermelho: TrailProgress 0%, presenceType `ausente`, PastoralAction urgente), Marcos Silva (líder com role=leader)
- [ ] `seedDemoData(tenantId: string)`: upserts na ordem correta (pais antes de filhos — User → Group → GroupMember → Trail → Module → Lesson → TrailProgress → ModuleProgress → Meeting → MeetingAttendance → MeetingTelemetry → PastoralAction)
- [ ] Cada upsert usa `where: { id: UUID_FIXO }` + `isDemoData: true` em todos os registros
- [ ] Implementar `main()` para CLI: parsear `--tenant-id` de `process.argv` e chamar `seedDemoData(tenantId)`

### 2.2 Criar DemoDataService (NestJS) `[C]`

- [ ] Criar `apps/api/src/onboarding/demo-data.service.ts` com decorator `@Injectable()`
- [ ] `seedDemoData(tenantId: string)`: delega para a função do arquivo de seed; envolve em try/catch (falha loga mas não propaga — FR-05)
- [ ] `deleteDemoData(tenantId: string)`: `prisma.$transaction()` com `withTenantTx` deletando na ordem inversa (PastoralAction → MeetingTelemetry → MeetingAttendance → Meeting → ModuleProgress → TrailProgress → Lesson → Module → Trail → GroupMember → Group → User), filtrando `where: { isDemoData: true }`; idempotente (retorna sem erro se sem dados demo)
- [ ] `getDemoStatus(tenantId: string)`: queries `count()` com `isDemoData: true` + check `Tenant.metadata.demoDismissedAt`; retorna objeto compatível com `DemoStatusResponse`
- [ ] `dismissNudge(tenantId: string)`: `prisma.tenant.update` com spread de metadata e `demoDismissedAt: new Date().toISOString()`

### 2.3 Adicionar script CLI e entrada turbo `[A]`

- [ ] Em `apps/api/package.json`: adicionar `"db:seed:demo-data": "tsx src/onboarding/seed/demo-data.seed.ts"` (ou `ts-node`); confirmar não duplica `db:seed:demo` do Story 7-2 (RECONCILIACAO §6)
- [ ] Em `turbo.json`: adicionar pipeline `"db:seed:demo-data": { "cache": false }`
- [ ] Testar execução: `pnpm --filter @metanoia/api db:seed:demo-data -- --tenant-id <UUID>`

### 2.4 Criar testes unitários do DemoDataService `[C]`

- [ ] Criar `apps/api/src/onboarding/demo-data.service.spec.ts`
- [ ] Mock do PrismaService com `vi.fn()` para os modelos usados
- [ ] Teste: `seedDemoData` invoca upsert para as 12 entidades
- [ ] Teste: `deleteDemoData` invoca transação com deleções na ordem correta
- [ ] Teste: `getDemoStatus` retorna `{ hasDemoData: true, hasRealData: false, demoRecordCount: N, nudgeDismissed: false }` com dados demo e sem dados reais
- [ ] Teste: `getDemoStatus` retorna `nudgeDismissed: true` quando `Tenant.metadata.demoDismissedAt` está setado
- [ ] Teste: `dismissNudge` chama `tenant.update` com o campo correto
- [ ] Teste: `seedDemoData` não propaga exceção quando o seed lança erro (FR-05)

---

## FASE 3 — Controller + Endpoints

> Gate: testes de integração do controller + smoke test via curl.
> Commit: `feat(dados-demo): endpoints DELETE/GET/PATCH onboarding demo-data`

### 3.1 Adicionar 3 endpoints ao OnboardingController `[C]`

- [ ] Abrir `apps/api/src/onboarding/onboarding.controller.ts`
- [ ] `@Delete('demo-data') @Roles('admin_tenant') @HttpCode(204)`: chama `demoDataService.deleteDemoData(ctx.tenantId)`, responde 204 sem corpo
- [ ] `@Get('demo-status') @Roles('admin_tenant')`: chama `demoDataService.getDemoStatus(ctx.tenantId)`, responde `{ data: result }`
- [ ] `@Patch('demo-nudge-dismiss') @Roles('admin_tenant') @HttpCode(204)`: chama `demoDataService.dismissNudge(ctx.tenantId)`, responde 204 sem corpo
- [ ] `ctx.tenantId` via `getRequestContext()` (AsyncLocalStorage) — nunca parâmetro na assinatura (SEC003)
- [ ] Adicionar `@ApiTags` e `@ApiBearerAuth` para Swagger se o controller já os usa

### 3.2 Registrar DemoDataService no OnboardingModule `[C]`

- [ ] Abrir `apps/api/src/onboarding/onboarding.module.ts`
- [ ] Adicionar `DemoDataService` em `providers: [...]`
- [ ] Adicionar `DemoDataService` em `exports: [...]` (necessário para injeção no SuperAdminTenantsModule — CHK041)

### 3.3 Integrar DemoDataService no SuperAdminTenantsModule `[C]`

- [ ] Abrir `apps/api/src/super-admin/super-admin-tenants.module.ts` e importar `OnboardingModule`
- [ ] Abrir `apps/api/src/super-admin/super-admin-tenants.service.ts`
- [ ] Injetar `DemoDataService` via construtor
- [ ] No método de provisioning, após criação do admin user, adicionar Step 4:
  ```ts
  try {
    await this.demoDataService.seedDemoData(newTenant.id);
  } catch (err) {
    this.logger.error('seedDemoData failed (non-fatal)', err);
  }
  ```
- [ ] Confirmar que a injeção não cria ciclo de dependência

---

## FASE 4 — RLS Specs

> Gate: `pnpm turbo test --filter=@metanoia/api -- --run rls` verde.
> Commit: `test(dados-demo): RLS specs isolamento + cleanup demo data`

### 4.1 Criar demo-data-isolation.rls-spec.ts `[C]`

- [ ] Criar `apps/api/test/rls/demo-data-isolation.rls-spec.ts`
- [ ] Setup: criar 2 tenants com UUIDs fixos; `PrismaPg({ connectionString: DATABASE_APP_URL })`
- [ ] Seed demo data no tenant A
- [ ] No contexto do tenant B: verificar que `SELECT` com `isDemoData=true` retorna 0 registros (pelo menos: users, groups, meetings, pastoral_actions)
- [ ] SEC011: RLS bloqueia acesso cross-tenant — não é filtro manual, é política aplicada pelo DB
- [ ] Cleanup: excluir apenas tabelas mutáveis (padrão do projeto); `beforeEach` com função nomeada (não `.bind(undefined)`)

### 4.2 Criar demo-data-cleanup.rls-spec.ts `[C]`

- [ ] Criar `apps/api/test/rls/demo-data-cleanup.rls-spec.ts`
- [ ] Setup: criar tenants A e B; seed demo data nos dois
- [ ] Chamar `deleteDemoData(tenantIdA)` no contexto de A
- [ ] Verificar: tenant A → 0 registros demo em todas as tabelas
- [ ] Verificar: tenant B → registros demo intactos
- [ ] Teste de idempotência: chamar `deleteDemoData(tenantIdA)` novamente → sem erro (204 no-op)
- [ ] CHK030: documentar em comentário que race condition seed+cleanup simultâneo está fora do escopo (baixo risco: seed ocorre no provisionamento, cleanup só após login do admin)

### 4.3 Documentar interface LGPD (SEC011) `[A]`

- [ ] Em `apps/api/src/onboarding/demo-data.service.ts`, no método `getDemoStatus`, adicionar comentário JSDoc documentando o comportamento da interface com o exportador LGPD da Story 9-1: usuários demo (`isDemoData=true`) aparecem no export LGPD como dados técnicos do tenant; o admin deve executar `DELETE /onboarding/demo-data` antes do export caso não queira exportar dados demo; não há filtro automático por `isDemoData` no exportador (dec-010, SEC010)

---

## FASE 5 — Zod + Types

> Gate: snapshot criado; `pnpm turbo build --filter=@metanoia/types` verde.
> Commit: `feat(dados-demo): DemoStatusResponseSchema + snapshot`

### 5.1 Adicionar DemoStatusResponseSchema em packages/types `[C]`

- [ ] Abrir `packages/types/src/onboarding.ts`
- [ ] Adicionar:
  ```ts
  export const DemoStatusResponseSchema = z.object({
    hasDemoData: z.boolean(),
    hasRealData: z.boolean(),
    demoRecordCount: z.number().int().nonnegative(),
    nudgeDismissed: z.boolean(),
  });
  export type DemoStatusResponse = z.infer<typeof DemoStatusResponseSchema>;
  ```
- [ ] Verificar export no barrel principal (`packages/types/src/index.ts`)

### 5.2 Adicionar snapshot test `[A]`

- [ ] Abrir `packages/types/src/__tests__/onboarding.spec.ts`
- [ ] Adicionar: `it('DemoStatusResponseSchema snapshot', () => { expect(DemoStatusResponseSchema.shape).toMatchSnapshot(); })`
- [ ] Rodar `pnpm --filter @metanoia/types test --run` para gerar snapshot inicial
- [ ] Confirmar que o arquivo `.snap` foi gerado e incluído no commit

---

## FASE 6 — Frontend Hooks + Componentes

> Gate: `pnpm turbo build --filter=@metanoia/web` verde + testes de componente.
> Commit: `feat(dados-demo): hooks + componentes demo overlay/nudge/cleanup`

### 6.1 Adicionar chaves i18n PT-BR `[A]`

- [ ] Abrir `apps/web/messages/pt-BR.json`
- [ ] Adicionar namespace `demo` com chaves: `overlayBadge`, `overlayAriaLabel`, `nudgeTitle`, `nudgeDescription`, `nudgeClean`, `nudgeKeep`, `cleanupButtonLabel`, `cleanupConfirmTitle`, `cleanupConfirmDescription`, `cleanupConfirmAction`, `cleanupConfirmCancel`, `cleanupSuccess`, `cleanupError`

### 6.2 Criar hook useDemoStatus `[C]`

- [ ] Criar `apps/web/src/hooks/use-demo-status.ts`
- [ ] `useQuery` TanStack com key `['demo-status']`, fetch `GET /api/v1/onboarding/demo-status`, parse com `DemoStatusResponseSchema.parse(json.data)`
- [ ] `refetchOnWindowFocus: true` para revalidar quando o admin volta à janela (CHK016)
- [ ] Comentário: `onSuccess` do `useDeleteDemoData` invalida esta query via `queryClient.invalidateQueries(['demo-status'])`

### 6.3 Criar hook useDeleteDemoData `[C]`

- [ ] Criar `apps/web/src/hooks/use-delete-demo-data.ts`
- [ ] `useMutation<undefined, Error, void>` com `mutationFn: async () => { await fetch(...DELETE...); return undefined; }` (padrão RECONCILIACAO §8.6)
- [ ] `onSuccess`: `queryClient.invalidateQueries(['demo-status'])`
- [ ] `onError`: toast de erro com mensagem do namespace `demo.cleanupError`

### 6.4 Criar hook useDismissDemoNudge `[A]`

- [ ] Criar `apps/web/src/hooks/use-dismiss-demo-nudge.ts`
- [ ] `useMutation<undefined, Error, void>` com fetch `PATCH /api/v1/onboarding/demo-nudge-dismiss`; `return undefined`
- [ ] `onSuccess`: `queryClient.invalidateQueries(['demo-status'])`

### 6.5 Criar componente DemoOverlay `[C]`

- [ ] Criar `apps/web/src/components/onboarding/demo-overlay.tsx`
- [ ] Props: `children: ReactNode`, opcional `className?: string`
- [ ] Renderiza `children` + `<Badge variant="secondary" aria-label={t('demo.overlayAriaLabel')}>{t('demo.overlayBadge')}</Badge>` (shadcn/ui Badge)
- [ ] CHK038 (gap a11y): badge com `aria-label` descritivo; verificar contraste WCAG AA com Badge `variant="secondary"` em inspetor; container com `opacity-75` ou `border border-dashed` (decisão do implementador)

### 6.6 Criar componente DemoDataNudge `[C]`

- [ ] Criar `apps/web/src/components/onboarding/demo-data-nudge.tsx` (`'use client'`)
- [ ] Usa `useDemoStatus`, `useDismissDemoNudge`, `useDeleteDemoData`
- [ ] Exibe AlertDialog shadcn/ui com título/descrição e 2 botões
- [ ] Condição: `hasDemoData && hasRealData && !nudgeDismissed`
- [ ] "Manter por enquanto" → `dismissNudge()` (dec-007: estado persistido via `demoDismissedAt`)
- [ ] "Remover dados de demonstração" → `deleteDemoData()` → nudge some ao invalidar query
- [ ] CHK038 (gap a11y): foco de teclado gerenciado pelo AlertDialog shadcn/ui (`role="alertdialog"`, `aria-modal`, foco em `AlertDialogAction`)

### 6.7 Criar componente DemoCleanupButton `[A]`

- [ ] Criar `apps/web/src/components/onboarding/demo-cleanup-button.tsx` (`'use client'`)
- [ ] Usa `useDemoStatus`, `useDeleteDemoData`
- [ ] Visível somente quando `hasDemoData === true` (CHK016, FR-09)
- [ ] AlertDialog de confirmação antes de executar
- [ ] CHK008 (gap): adicionar comentário `// TODO(10-1): integrar na rota de Configurações após 10-1 definir o path exato`; exportar o componente mas não integrá-lo em nenhuma rota nesta story

### 6.8 Atualizar barrel de exports `[A]`

- [ ] Abrir `apps/web/src/components/onboarding/index.ts`
- [ ] Adicionar: `export * from './demo-overlay'`, `export * from './demo-data-nudge'`, `export * from './demo-cleanup-button'`

---

## FASE 7 — Integração nas Páginas

> Gate: `pnpm turbo test --filter=@metanoia/web` verde + inspeção visual.
> Commit: `feat(dados-demo): DemoOverlay + DemoDataNudge na página de grupos`

### 7.1 Integrar DemoOverlay e DemoDataNudge na página de grupos `[C]`

- [ ] Abrir `apps/web/app/(authenticated)/app/admin/grupos/page.tsx`
- [ ] Identificar se é Server Component ou Client Component (SSR vs CSR boundary)
- [ ] Para cada grupo com `isDemoData=true` na listagem: envolver em `<DemoOverlay>`
- [ ] Adicionar `<DemoDataNudge />` abaixo do header (Client Component via boundary separado se a página for Server Component)
- [ ] Adicionar testes de componente: DemoOverlay presente em grupos demo, ausente em grupos reais

### 7.2 Documentar regra de coexistência demo+real no Radar (CHK032) `[M]`

- [ ] Em `docs/specs/dados-demonstracao/spec.md`, seção `## Escopo Excluído` (ou `## Notas de Implementação`), adicionar nota formal sobre CHK032: semáforos demo (fixos por design) coexistem com semáforos reais (calculados); o admin é informado pelo `DemoDataNudge` e pode remover quando quiser; filtro automático por `isDemoData` no Radar está deferido para pós-MVP (dec-010)

### 7.3 Verificar revalidação de query após limpeza (CHK016) `[A]`

- [ ] Confirmar que `useDeleteDemoData.onSuccess` invalida `['demo-status']` (implementado na FASE 6.3)
- [ ] Adicionar teste: após `mutate()` do cleanup, `useDemoStatus` re-fetcha e retorna `hasDemoData: false`
- [ ] Confirmar que `DemoCleanupButton` desaparece após a query ser invalidada (FR-09)

---

## FASE 8 — Testes Finais + Validação

> Gate: todos os testes passam; lint 0 warnings; CI verde via PR.
> Commit: `test(dados-demo): testes finais idempotência, isolamento, roundtrip`

### 8.1 Teste de idempotência do seed `[C]`

- [ ] Criar teste de integração: `seedDemoData(tenantId)` 2× consecutivas no mesmo tenant
- [ ] Verificar: contagem de registros com `isDemoData=true` é idêntica (zero duplicatas — SC-03)

### 8.2 Teste de limpeza total `[C]`

- [ ] Teste: seed → delete → 0 registros com `isDemoData=true` no tenant
- [ ] Verificar que dados reais anteriores ao seed permanecem intactos
- [ ] Verificar que `lesson_progress` foi limpo via CASCADE (sem delete explícito)

### 8.3 Teste de isolamento de serviço `[C]`

- [ ] Teste (unit/integration): tenants A e B com seed → `deleteDemoData(tenantIdA)` → tenant A: 0 demo records; tenant B: intacto
- [ ] Complementa as RLS specs da FASE 4 (que testam via DB direto)

### 8.4 Teste de resiliência do provisioning `[C]`

- [ ] Teste: mock `seedDemoData` para lançar exceção → provisioning completa com sucesso, tenant `active`
- [ ] Verificar que erro é logado via `logger.error` (FR-05, SC-04)

### 8.5 Roundtrip E2E do DemoStatusResponse `[A]`

- [ ] Teste de integração: seed → `GET /api/v1/onboarding/demo-status` → `DemoStatusResponseSchema.parse(json.data)` sem exceção Zod
- [ ] Verificar: `hasDemoData: true`, `demoRecordCount >= 1`, `hasRealData: false`, `nudgeDismissed: false`

### 8.6 Gate final lint + build + testes `[A]`

- [ ] `pnpm turbo lint` — 0 warnings (RECONCILIACAO §8.4)
- [ ] `pnpm turbo build`
- [ ] `pnpm turbo test` (api + web + types)
- [ ] Confirmar 0 regressões de stories anteriores (7-2, Epic 9)
- [ ] Confirmar no `git log` que todos os commits entraram via PR (guardrail feedback_feature00c_direct_push_dev_bypasses_ci)

---

## Referências

- `docs/specs/dados-demonstracao/plan.md` — plano de 8 fases
- `docs/specs/dados-demonstracao/data-model.md` — schema diff + UUIDs fixos
- `docs/specs/dados-demonstracao/research.md` — decisões técnicas (Decision 1–9)
- `docs/specs/dados-demonstracao/contracts/api.md` — contratos backend
- `docs/specs/dados-demonstracao/contracts/frontend.md` — contratos frontend
- `docs/specs/dados-demonstracao/checklists/requirements.md` — gaps CHK008/016/030/032/038/041
- `docs/specs/dados-demonstracao/checklists/security.md` — gap SEC011
- `_bmad-output/implementation-artifacts/RECONCILIACAO-EPIC10.md` — guardrails §8
