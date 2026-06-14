# Tasks — Story 10-4 (import-csv-process)

**Feature**: Importação CSV — Confirmação e Processamento (Epic 10, Story 10-4)
**Branch**: `feat/story-10-4-import-csv-process`
**Spec**: `spec.md` · **Plan**: `plan.md` · **Data Model**: `data-model.md` · **Checklist**: `checklist.md`

> Regra de ouro: nunca fazer push direto em `dev`. CI deve passar (lint + unit + RLS + build) antes de abrir PR.

---

## Matriz de Dependências

```
FASE 1 (Contratos Zod)
  └─► FASE 2 (CsvImportService)
        └─► FASE 3 (Controller)
              └─► FASE 4 (Processor BullMQ)
  └─► FASE 6 (Frontend) ─ paralelo após FASE 1
FASE 2 + FASE 3 + FASE 4
  └─► FASE 5 (Testes)
FASE 5 + FASE 6
  └─► FASE 7 (Quality Gates + E2E)
FASE 7
  └─► FASE 8 (Segurança final)
FASE 8
  └─► FASE 9 (Build/Lint/Git)
```

---

## Resumo de FASEs

| FASE | Escopo | Criticidade |
|------|--------|-------------|
| 1 | Contratos Zod + AUDIT_ACTIONS + snapshot | [crit] |
| 2 | CsvImportService (enforcePlanLimit, processRows, generateReport, audit+evento) | [crit] |
| 3 | Controller POST 201/202 + GET polling | [crit] |
| 4 | Processor BullMQ + OnboardingModule | [crit] |
| 5 | Testes (unit, RLS, integration, snapshot) | [crit] |
| 6 | Frontend (hooks, ImportResultSummary, wire-up, i18n) | [crit] |
| 7 | Quality Gates (a11y, E2E CI-only) | [high] |
| 8 | Auditoria de segurança (OWASP checklist) | [high] |
| 9 | Build/lint/typecheck final + disciplina git | [crit] |

---

## Escopo Coberto

- Contratos Zod (`csv-import-result.ts`): `ImportRequestSchema`, `ImportResultSummarySchema`, `ImportJobStatusSchema`, consts
- Backend: `CsvImportService`, `csv-import.controller.ts`, `csv-import.processor.ts`
- Registro no `OnboardingModule`
- Testes: unit (máquina FR03/FR04/sanitização/anti-mass-assignment), RLS (isolamento cross-tenant), integration (sync+async+IDOR+planLimit), snapshot Zod
- Frontend: `useImportMembers`, `useImportJobStatus`, `import-result-summary.tsx`, wire-up `import-client.tsx`, i18n PT-BR
- Quality gates: jest-axe, E2E Playwright CI-only, build/lint/typecheck
- Auditoria OWASP: anti-mass-assignment, IDOR, PII namespace, CSV injection, idempotência de convite

## Escopo Excluído

- Migration Prisma (sem migration — resultado em Redis + MinIO; ver `data-model.md`)
- Autenticação/Keycloak (reuso dos guards existentes)
- Story 10-3 (import-csv-preview) — pré-requisito já mergeado
- Módulos externos (GroupMembersModule, AdminInvitesModule, StorageModule, PlanLimitsModule, AuditModule) — reuso via imports

---

## Legenda de Criticidade

- `[crit]` — bloqueante; não avançar sem completar
- `[high]` — alto impacto; deve ser concluído antes do PR
- `[low]` — melhoria; pode ser deferido com justificativa

---

## FASE 1 — Contratos Zod e tipos [crit]

### 1.1 `csv-import-result.ts` [crit]

- [ ] Criar `packages/types/src/onboarding/csv-import-result.ts`
- [ ] Declarar consts ANTES dos schemas (evitar hoisting): `IMPORT_SYNC_THRESHOLD=100`, `IMPORT_MAX_ROWS=5000`, `CSV_IMPORT_QUEUE_NAME='csv-import'`, `CSV_IMPORT_JOB_TTL_SECONDS=86400`
- [ ] `ImportRowInputSchema`: `{ nome: z.string(), email: z.string().email(), telefone: z.string().optional(), papel: z.string(), grupo: z.string().optional(), rowIndex: z.number().int() }`
- [ ] `ImportRequestSchema`: `{ defaultGroupId: z.string().uuid(), rows: z.array(ImportRowInputSchema).min(1).max(IMPORT_MAX_ROWS) }`
- [ ] `importActionSchema`: `z.enum(['created', 'existing', 'invited', 'failed'])`
- [ ] `ImportResultLineSchema`: `{ rowIndex, email, nome, groupName, action: importActionSchema, reason: z.string().optional() }`
- [ ] `ImportResultSummarySchema`: `{ total, imported, existing, invited, failed: z.number().int().min(0), lines: z.array(ImportResultLineSchema), reportUrl: z.string().url().nullable(), jobId: z.string().uuid().nullable() }`
- [ ] `importJobStatusSchema`: `z.enum(['processing', 'completed', 'failed'])`
- [ ] `ImportJobStatusSchema`: `{ jobId: z.string().uuid(), status: importJobStatusSchema, progress: z.number().min(0).max(100), result: ImportResultSummarySchema.nullable(), failureReason: z.string().nullable() }`
- [ ] Exportar todos os tipos inferidos: `ImportRowInput`, `ImportRequest`, `ImportResultLine`, `ImportResultSummary`, `ImportJobStatus`

**AC coberto**: data-model.md §Schemas Zod; checklist 1.1

### 1.2 Index e re-exports [crit]

- [ ] Criar `packages/types/src/onboarding/index.ts` re-exportando `./csv-import` (se existir) e `./csv-import-result`
- [ ] Em `packages/types/src/index.ts`: adicionar re-export `export * from './onboarding'` (ou linha específica); verificar colisão com `ImportResult` já exportado — usar alias se necessário
- [ ] Verificar via `grep -r "ImportResult" packages/types/src/index.ts` que não há símbolo conflitante

**AC coberto**: checklist 1.2

### 1.3 AUDIT_ACTIONS += `'import'` [crit]

- [ ] Abrir `packages/types/src/audit/index.ts`; localizar array `AUDIT_ACTIONS` (linha ~34)
- [ ] Adicionar `'import'` ao array mantendo ordem alfabética ou ao final do bloco
- [ ] Atualizar snapshot de audit: rodar `pnpm -F @metanoia/types test --update-snapshots` OU ajustar manualmente o arquivo `.snap` correspondente
- [ ] Verificar que `pnpm -F @metanoia/types test` passa verde após ajuste

**AC coberto**: spec FR10; checklist 1.3; divergência BMad #3

### 1.4 Snapshot test csv-import-result [crit]

- [ ] Criar `packages/types/src/__tests__/csv-import-result.snapshot.spec.ts`
- [ ] Importar `ImportResultSummarySchema`, `ImportJobStatusSchema`, `ImportRequestSchema`
- [ ] Para cada schema: `expect(schema.shape).toMatchSnapshot()` (padrão dos specs existentes em `__tests__/`)
- [ ] Rodar `pnpm -F @metanoia/types test` → verde (snapshot gerado automaticamente na primeira vez)
- [ ] Commitar o arquivo `.snap` gerado

**AC coberto**: checklist 1.4; spec §Testes snapshot

---

## FASE 2 — Backend: CsvImportService [crit]

### 2.1 Arquivo e injeção de dependências [crit]

- [ ] Criar `apps/api/src/onboarding/csv-import.service.ts`
- [ ] Decorator `@Injectable()`
- [ ] Construtor com injeções: `PrismaService`, `PlanLimitsService`, `GroupMembersRepository`, `AdminInvitesService`, `AuditService`, `StorageService`, `@InjectQueue` não usar — injetar `BullMqService`, `RedisService`, `EventEmitter2`
- [ ] `implements OnModuleInit`
- [ ] `onModuleInit()`: `this.queue = this.bullMqService.createQueue(CSV_IMPORT_QUEUE_NAME)` — SEM `:` no nome da fila (divergência BMad #1)
- [ ] Declarar `private queue: Queue` no corpo da classe

**AC coberto**: plan.md §2.4; checklist 2.1

### 2.2 `enforcePlanLimit(groupId, projectedNewMembers)` (FR04) [crit]

- [ ] Método público `async enforcePlanLimit(groupId: string, projectedNewMembers: number): Promise<void>`
- [ ] Obter `tenantId` via `getRequestContext().tenantId` (AsyncLocalStorage — sem passar como parâmetro)
- [ ] `plan = await this.planLimitsService.getPlan(tenantId)` (espelhar `group-members.service.ts:141 enforceMembersPerGroup`)
- [ ] `limit = getLimit(plan, 'membersPerGroup')` (importar `getLimit` de `plan-limits.config`)
- [ ] `currentCount = await this.groupMembersRepository.countByGroup(groupId)`
- [ ] Se `Number.isFinite(limit)` E `currentCount + projectedNewMembers > limit` → lançar `ForbiddenException({ message: 'Limite do plano atingido. Seu plano permite {limit} membros e o grupo já tem {currentCount} ({projectedNewMembers} novos excederiam o limite).', error: 'PlanLimitReached' })`
- [ ] **NÃO** usar `planLimitsService.hasCapacity('membersPerGroup')` — curto-circuita (research R3; divergência BMad #4)
- [ ] Rejeição TOTAL: chamar ANTES de `processRows`; nenhum row criado se limite estourar

**AC coberto**: spec FR04; checklist 2.2; SC#4

### 2.3 `processRows(rows, defaultGroupId)` — máquina de estados FR03 [crit]

- [ ] Método `async processRows(rows: ImportRowInput[], defaultGroupId: string): Promise<ImportResultSummary>`
- [ ] Executar dentro de `withTenantTx(this.prismaService, async (tx) => { ... }, { tenantId })` (padrão `meetings.repository.ts`)
- [ ] Para cada row, resolver grupo: `row.grupo ?? defaultGroupId`
  - Se `row.grupo` presente: buscar por nome no tenant → `groupId` ou `null`
  - Se null → `action='failed'`, `reason="Grupo '{nome}' não encontrado no tenant"`
- [ ] `findUserByEmailGlobal(email: string)`: query `tx.user.findUnique({ where: { email } })` SEM filtro tenant (email `@unique` global)
- [ ] **Máquina de 4 estados** (FR03):
  - `user === null` → criar `User` (`uuidv7()`) + `UserTenant('participante')` + `GroupMember(row.papel)` → `action='created'`
  - `user` + `UserTenant` existe no tenant corrente → `action='existing'` (ignorar, sem duplicar)
  - `user` existe MAS sem `UserTenant` neste tenant → `AdminInvitesService.create({ kind: 'group_member', inviteeEmail: row.email, inviteeName: row.nome, groupId, expiresInDays: 30 })` → `action='invited'`
  - grupo não encontrado → `action='failed'`
- [ ] **Idempotência de convite**: verificar existência `(inviteeEmail, groupId, tenantId)` antes de criar; capturar `ConflictException` ou verificar via repository (divergência BMad #2)
- [ ] **Anti-mass-assignment (OWASP MEDIUM #1)**: em `prisma.user.create`, mapear campos EXPLICITAMENTE: `{ id: uuidv7(), name: row.nome, email: row.email, ... }` — NUNCA `{ ...row }`
- [ ] Acumular `ImportResultLine[]`; ao final agregar `ImportResultSummary` com contadores

**AC coberto**: spec FR03; checklist 2.3; SC#3; plan.md §5 MEDIUM #1

### 2.4 `generateReport(summary, tenantId, jobId)` (FR07) [crit]

- [ ] Método `async generateReport(summary: ImportResultSummary, tenantId: string, jobId: string): Promise<string>`
- [ ] Montar CSV: header `nome,email,status,reason` + uma linha por `ImportResultLine`
- [ ] **Sanitização CSV injection (OWASP A05)**: células iniciando com `= + - @` → prefixar `'` antes de escrever
- [ ] `this.storageService.upload('csv-import-result/' + tenantId + '/' + jobId + '.csv', buffer, 'text/csv')`
- [ ] `const url = await this.storageService.getSignedUrl(key, 86400)`
- [ ] Atribuir `summary.reportUrl = url`; retornar `url`

**AC coberto**: spec FR07; checklist 2.4; plan.md §5 MEDIUM #3; SC#5

### 2.5 Audit + evento de domínio (FR10) [crit]

- [ ] Método `async emitAuditAndEvent(userId, groupId, summary, ipAddress?, userAgent?): Promise<void>`
- [ ] `await this.auditService.createEvent({ userId, action: 'import', resource: 'group', resourceId: groupId, ipAddress, userAgent, newState: { imported: summary.imported, existing: summary.existing, invited: summary.invited, failed: summary.failed } })`
  - `action: 'import'` válido após FASE 1.3
- [ ] `this.eventEmitter.emit('onboarding.csv_import.completed', { eventId: uuidv7(), eventType: 'onboarding.csv_import.completed', version: 1, tenantId: getRequestContext().tenantId, timestamp: new Date().toISOString(), data: { groupId, total: summary.total, imported: summary.imported, existing: summary.existing, invited: summary.invited, failed: summary.failed }, metadata: {} })`
- [ ] Estrutura do evento espelha o padrão domain event (`onboarding-events.spec.ts`)

**AC coberto**: spec FR10; checklist 2.5; SC#5

---

## FASE 3 — Backend: Controller [crit]

### 3.1 `POST /api/v1/groups/:groupId/members/import` [crit]

- [ ] Criar `apps/api/src/onboarding/csv-import.controller.ts`
- [ ] `@Controller('api/v1/groups/:groupId/members')` + `@Post('import')`
- [ ] Decorators: `@UseGuards(KeycloakAuthGuard, RolesGuard)`, `@Roles(Role.ADMIN_TENANT)`, `@UsePipes(new ZodValidationPipe(ImportRequestSchema))`
- [ ] Injetar `CsvImportService`
- [ ] Validar pertencimento do grupo ao tenant: `this.requireGroup(groupId)` usando `getRequestContext().tenantId` — sem passar tenantId como parâmetro (regra multi-tenancy)
- [ ] Fluxo SYNC (`rows.length <= IMPORT_SYNC_THRESHOLD`):
  - `await this.csvImportService.enforcePlanLimit(groupId, rows.length)`
  - `const summary = await this.csvImportService.processRows(rows, groupId)`
  - `await this.csvImportService.generateReport(summary, tenantId, uuidv7())`
  - `await this.csvImportService.emitAuditAndEvent(userId, groupId, summary, ip, ua)`
  - `@HttpCode(HttpStatus.CREATED)` → `{ data: summary }`
- [ ] Fluxo ASYNC (`rows.length > IMPORT_SYNC_THRESHOLD`):
  - `await this.csvImportService.enforcePlanLimit(groupId, rows.length)`
  - `const jobId = uuidv7()`
  - Gravar Redis `cache:csv-import:job:{jobId}`: `{ status: 'processing', progress: 0, result: null, tenantId }` com TTL `CSV_IMPORT_JOB_TTL_SECONDS` (86400s)
  - `await this.queue.add('process-csv-import', { rows, defaultGroupId: groupId, groupId, jobId, tenantId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { count: 50 }, removeOnFail: false })`
  - `@HttpCode(HttpStatus.ACCEPTED)` → `{ data: { jobId, message: 'Importação iniciada. Acompanhe o progresso pelo jobId.' } }`

**AC coberto**: spec FR02/FR06; checklist 3.1; plan.md §2.1; SC#1/SC#2

### 3.2 `GET /api/v1/import/jobs/:jobId` [crit]

- [ ] Adicionar em `csv-import.controller.ts` (ou controller dedicado): `@Controller('api/v1/import/jobs')` + `@Get(':jobId')`
- [ ] `@Roles(Role.ADMIN_TENANT)` + `@HttpCode(HttpStatus.OK)`
- [ ] Ler `cache:csv-import:job:{jobId}` via `RedisService`
- [ ] Se não existe → `throw new NotFoundException()`
- [ ] **Tenant binding (OWASP MEDIUM #2)**: `payload.tenantId !== getRequestContext().tenantId` → `throw new NotFoundException()` (não `ForbiddenException` — evita enumeração)
- [ ] Validar `ImportJobStatusSchema.parse(payload)` antes de retornar
- [ ] Retornar `{ data: ImportJobStatus }`

**AC coberto**: spec FR05; checklist 3.2; plan.md §2.2; SC#2; plan.md §5 MEDIUM #2

---

## FASE 4 — Backend: Processor BullMQ [crit]

### 4.1 `csv-import.processor.ts` [crit]

- [ ] Criar `apps/api/src/onboarding/csv-import.processor.ts`
- [ ] `@Injectable()` + `implements OnModuleInit`
- [ ] Injetar `CsvImportService`, `BullMqService`, `RedisService`
- [ ] `onModuleInit()`: `this.worker = this.bullMqService.createWorker(CSV_IMPORT_QUEUE_NAME, this.handleJob.bind(this))`
- [ ] Handler `async handleJob(job: Job<{ rows, defaultGroupId, groupId, jobId, tenantId }>)`:
  - Processar em lotes (ex: 50 rows por lote); a cada lote atualizar Redis `cache:csv-import:job:{jobId}` com `{ progress: percentual }` — **NÃO** usar `job.updateProgress()` (divergência BMad #5)
  - Ao concluir: `await this.csvImportService.generateReport(summary, tenantId, jobId)`
  - Atualizar Redis: `{ status: 'completed', progress: 100, result: summary }`
  - `await this.csvImportService.emitAuditAndEvent(...)` (com `userId` do job payload se disponível)
  - Em falha: atualizar Redis: `{ status: 'failed', failureReason: err.message }`

**AC coberto**: spec FR06; checklist 4.1; plan.md §2.3; SC#2

### 4.2 Registrar no OnboardingModule [crit]

- [ ] Abrir `apps/api/src/onboarding/onboarding.module.ts`
- [ ] Adicionar `CsvImportService`, `CsvImportProcessor` ao array `providers`
- [ ] Adicionar `CsvImportController` ao array `controllers`
- [ ] Verificar se módulos necessários já estão importados: `BullMqModule`, `GroupMembersModule`, `AdminInvitesModule`, `StorageModule`, `PlanLimitsModule`, `AuditModule`, `EventEmitterModule`
- [ ] Adicionar apenas os módulos ausentes (evitar duplicata que gera erros NestJS DI)

**AC coberto**: checklist 4.2

---

## FASE 5 — Testes [crit]

### 5.1 Unit: `csv-import.service.spec.ts` [crit]

- [ ] Criar `apps/api/src/onboarding/csv-import.service.spec.ts`
- [ ] Mocks de todos os serviços injetados (`PrismaService`, `PlanLimitsService`, `GroupMembersRepository`, `AdminInvitesService`, `AuditService`, `StorageService`, `EventEmitter2`, `RedisService`, `BullMqService`)
- [ ] Testar máquina FR03 — 4 cenários:
  - email inédito → `created` (verifica `prisma.user.create` chamado; `action='created'`)
  - email mesmo tenant (tem `UserTenant`) → `existing` (sem `prisma.user.create`)
  - email de outro tenant (sem `UserTenant` aqui) → `invited` (`AdminInvitesService.create` chamado; `action='invited'`)
  - grupo inexistente por nome → `failed` (sem criação, `reason` contém nome do grupo)
- [ ] Testar FR04: quando `countByGroup + projectedNew > limit` → `ForbiddenException` com `error: 'PlanLimitReached'`; nenhum row criado
- [ ] Testar sanitização CSV injection: linha com email `=HYPERLINK(...)` → CSV gerado contém `'=HYPERLINK(...)`
- [ ] Testar agregação de `ImportResultSummary`: contadores `imported + existing + invited + failed === total`
- [ ] Testar idempotência de convite: segundo `processRows` com mesmo email+groupId → `AdminInvitesService.create` chamado apenas 1x
- [ ] Testar anti-mass-assignment: spy no `tx.user.create` → `args.data` NÃO contém campos extras do row (ex: `rowIndex`, `grupo`)

**AC coberto**: checklist 5.1; spec FR03/FR04; SC#4; plan.md §5

### 5.2 RLS: `csv-import.rls-spec.ts` [crit]

- [ ] Criar `apps/api/test/rls/csv-import.rls-spec.ts` (padrão `group-members.rls-spec.ts`)
- [ ] Usar colunas reais do `schema.prisma` (sem UUID inventado — usar hex fixos padrão); sem `updated_at` em `group_members` se não existir
- [ ] `beforeEach` com `.bind()` correto — **não** `beforeEach(cleanupFn)` sem bind (armadilha `beforeEach.bind→undefined`)
- [ ] Cenário SC#3 — isolamento cross-tenant:
  - Tenant A faz import → `User` criado pertence ao `UserTenant` do tenant A
  - Tenant B não consegue ver/acessar o `User` criado pelo tenant A via RLS
  - `GroupMember` criado pertence ao grupo do tenant A (policy `tenant_id` correto)
- [ ] Verificar que `SELECT * FROM user_tenants WHERE tenant_id = 'tenant_b_id'` retorna 0 rows para users criados pelo import do tenant A

**AC coberto**: checklist 5.2; SC#3; spec §Multi-tenant

### 5.3 Integration: sync + async + IDOR + limit [crit]

- [ ] Criar `apps/api/src/onboarding/csv-import.integration-spec.ts`
- [ ] SYNC: `POST /api/v1/groups/{groupId}/members/import` com ≤100 rows → `201` + body `{ data: ImportResultSummary }` (`jobId: null`)
- [ ] ASYNC: POST com >100 rows → `202` + body `{ data: { jobId, message } }`
- [ ] Polling: `GET /api/v1/import/jobs/{jobId}` → `200` + `{ data: ImportJobStatus }`
- [ ] IDOR: GET com `jobId` do tenant A usando credencial do tenant B → `404`
- [ ] Limite de plano: POST excedendo limite → `403` com `{ error: 'PlanLimitReached' }`
- [ ] Validação Zod: POST com `rows: []` → `400` (ZodValidationPipe rejeita)
- [ ] Job inexistente: GET com `jobId` desconhecido → `404`

**AC coberto**: checklist 5.3; SC#1/SC#2/SC#4; plan.md §2.2 IDOR

### 5.4 Audit/evento: verificar emissão [crit]

- [ ] No integration spec ou unit spec: verificar que `AuditService.createEvent` é chamado com `action: 'import'` e `resource: 'group'`
- [ ] Verificar que `EventEmitter2.emit('onboarding.csv_import.completed', ...)` é chamado com shape completa (espelhar `onboarding-events.spec.ts`)
- [ ] Verificar que `eventType`, `version`, `tenantId`, `data.groupId`, `data.total` estão presentes

**AC coberto**: checklist 5.4; spec FR10; SC#5

### 5.5 Snapshot Zod [crit]

- [ ] Confirmar que `pnpm -F @metanoia/types test` passa com snapshot `csv-import-result.snapshot.spec.ts`
- [ ] Se schema for ajustado após geração inicial → rodar `--update-snapshots` e commitar `.snap` atualizado
- [ ] Confirmar também que snapshot do audit (FASE 1.3) está verde

**AC coberto**: checklist 5.5

---

## FASE 6 — Frontend [crit]

### 6.1 Hooks TanStack: `useImportMembers` [crit]

- [ ] Criar `apps/web/src/hooks/use-import-members.ts` (Client Component only — `'use client'` implícito nos hooks)
- [ ] `useImportMembers(groupId: string)`: `useMutation({ mutationFn: async (body: ImportRequest) => fetch(\`/api/v1/groups/${groupId}/members/import\`, { method: 'POST', body: JSON.stringify(body) }).then(res => res.json()) })`
- [ ] Tipo de retorno: union `ImportResultSummary` (sync 201) | `{ jobId: string; message: string }` (async 202)
- [ ] Tratar erros: extrair `{ error, message }` do body e repassar ao caller
- [ ] Confirmar que hook NÃO é importado em Server Components

**AC coberto**: checklist 6.1; plan.md §4

### 6.2 Hook TanStack: `useImportJobStatus` [crit]

- [ ] Criar (ou expandir) `apps/web/src/hooks/use-import-job-status.ts`
- [ ] `useImportJobStatus(jobId: string | null)`: `useQuery({ queryKey: ['import-job', jobId], queryFn: async () => fetch(\`/api/v1/import/jobs/${jobId}\`).then(res => res.json()).then(r => r.data), enabled: !!jobId, refetchInterval: (query) => query.state.data?.status === 'processing' ? 2000 : false })`
- [ ] Retorna `ImportJobStatus | undefined`
- [ ] Parar polling quando `status !== 'processing'`

**AC coberto**: checklist 6.1; spec FR06

### 6.3 `import-result-summary.tsx` (FR08) [crit]

- [ ] Criar `apps/web/src/components/onboarding/import-result-summary.tsx`
- [ ] Props: `summary: ImportResultSummary`
- [ ] Exibir 4 badges coloridos: importados (verde), já existentes (cinza), convites enviados (amarelo), falhas (vermelho)
- [ ] Cada categoria com `> 0` linhas: Accordion/Collapsible shadcn mostrando linhas individuais (email, nome, motivo)
- [ ] Link "Baixar relatório" (`<a href={summary.reportUrl} download>`) visível quando `reportUrl !== null`
- [ ] Categorias com `=== 0`: não exibir seção colapsável (estado vazio silencioso)
- [ ] Vocabulário pastoral PT-BR (não corporativo): usar chaves i18n de FASE 6.4
- [ ] `jest-axe` a11y no spec: sem violações (headings hierárquicos, labels, ARIA correta)

**AC coberto**: spec FR07/FR08; checklist 6.2; SC#5

### 6.4 Wire-up em `import-client.tsx` [crit]

- [ ] Abrir `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/importar/import-client.tsx`
- [ ] Adicionar etapa "confirmação" após preview/validação (step counter ou machine state)
- [ ] Importar `useImportMembers`, `useImportJobStatus`, `ImportResultSummary`
- [ ] Botão "Confirmar Importação":
  - `disabled={validRows.length === 0}` (FR09)
  - `aria-disabled` quando desabilitado + `aria-describedby` apontando para mensagem explicativa
  - Loading state (`disabled` + spinner) durante `isPending`
- [ ] Fluxo SYNC: ao receber `201` (sem jobId), exibir `<ImportResultSummary summary={data} />`
- [ ] Fluxo ASYNC: ao receber `202 + jobId`:
  - Exibir `<progress role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />`
  - Substituir por `<ImportResultSummary>` quando `status === 'completed'`
  - Exibir mensagem de erro se `status === 'failed'`
- [ ] Estado de erro `PlanLimitReached`: exibir mensagem PT-BR acionável (chave `import.error.planLimit`)

**AC coberto**: spec FR09; checklist 6.3; SC#6

### 6.5 i18n PT-BR [crit]

- [ ] Abrir `apps/web/messages/pt-BR.json`; localizar bloco `"import"` (já existe de Story 10-3)
- [ ] Adicionar chaves:
  - `"import.confirm.button"`: `"Confirmar Importação"`
  - `"import.confirm.disabled"`: `"Não há participantes válidos para importar."`
  - `"import.result.imported"`: `"Importados"`
  - `"import.result.existing"`: `"Já existentes"`
  - `"import.result.invited"`: `"Convites enviados"`
  - `"import.result.failed"`: `"Falhas"`
  - `"import.result.download"`: `"Baixar relatório"`
  - `"import.result.processing"`: `"Importação em andamento..."`
  - `"import.error.planLimit"`: `"Limite do plano atingido. Seu plano permite {limit} membros por grupo e o grupo já tem {current}."`
- [ ] Substituir strings hardcoded nos componentes pelas chaves i18n (usar `useTranslations('import')`)

**AC coberto**: checklist 6.4; spec §i18n

---

## FASE 7 — Quality Gates [high]

### 7.1 a11y jest-axe [high]

- [ ] Em spec de `import-result-summary.tsx`: `const { container } = render(<ImportResultSummary summary={mockSummary} />); const results = await axe(container); expect(results).toHaveNoViolations()`
- [ ] Testar botão desabilitado: `expect(button).toBeDisabled()` + verificar `aria-describedby` aponta para mensagem
- [ ] Testar barra de progresso: `expect(progressBar).toHaveAttribute('role', 'progressbar')` + `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

**AC coberto**: checklist 7.1; spec §Acessibilidade

### 7.2 Testes de botão (SC#6) [crit]

- [ ] Em `import-client.spec.tsx` (Vitest/RTL): botão "Confirmar Importação" desabilitado quando `validRows.length === 0` → `expect(button).toBeDisabled()`
- [ ] Botão habilitado quando `validRows.length >= 1` → `expect(button).not.toBeDisabled()`
- [ ] Durante `isPending`: botão desabilitado + spinner visível

**AC coberto**: checklist 7.2; SC#6

### 7.3 E2E Playwright (CI-only) [high]

- [ ] Criar `apps/web/e2e/import-csv-process.e2e-spec.ts` — **NÃO rodar localmente** (CI-only)
- [ ] Fixture: `apps/web/e2e/fixtures/import-csv-small.csv` (≤10 linhas válidas) e `import-csv-large.csv` (>100 linhas para ASYNC)
- [ ] Cenário happy path SYNC: login admin → upload CSV pequeno → preview → confirmar → ver `ImportResultSummary` com `imported > 0`
- [ ] Cenário happy path ASYNC: upload CSV grande → `202` → barra de progresso visível → aguardar `completed` → ver `ImportResultSummary`
- [ ] Cenário limit exceeded: preview com arquivo que excede limite do plano → confirmar → mensagem PT-BR `import.error.planLimit`
- [ ] Marcar com `@ci-only` ou condição `process.env.CI` para não executar localmente

**AC coberto**: checklist 7.3; SC#1/SC#2/SC#4

---

## FASE 8 — Auditoria de Segurança [high]

### 8.1 OWASP checklist (revisão de código) [high]

- [ ] **Anti mass-assignment (MEDIUM #1)**: confirmar que `prisma.user.create` só recebe `{ id, name, email }` mapeados explicitamente, nunca `{ ...row }` — grep: `grep -n '\.\.\.row' apps/api/src/onboarding/csv-import.service.ts` deve retornar vazio
- [ ] **IDOR tenant-binding (MEDIUM #2)**: confirmar via integration spec que GET com `jobId` de outro tenant → `404`; confirmar que Redis payload inclui `tenantId`
- [ ] **PII namespaced (MEDIUM #3)**: confirmar que `storageService.upload` recebe path `'csv-import-result/' + tenantId + '/'` — grep: `grep -n 'csv-import-result' apps/api/src/onboarding/csv-import.service.ts`
- [ ] **Idempotência convite (LOW #4)**: confirmar via unit spec que segundo `processRows` com mesmo `(inviteeEmail, groupId)` não chama `AdminInvitesService.create` novamente
- [ ] **CSV injection**: confirmar sanitização de `= + - @` via unit test (FASE 5.1)
- [ ] **DoS teto**: confirmar `ImportRequestSchema` tem `.max(IMPORT_MAX_ROWS)` — grep: `grep -n 'IMPORT_MAX_ROWS' packages/types/src/onboarding/csv-import-result.ts`
- [ ] **Rate limit**: verificar se `@Throttle()` ou equivalente está ativo no controller de import; se ausente, adicionar (padrão endpoints autenticados)
- [ ] **Sem stack traces**: confirmar que `AllExceptionsFilter` (Story 7-3) intercepta erros do controller — testar via integration spec com 500 forçado → body não contém `stack`

**AC coberto**: checklist FASE 8; plan.md §5; spec §Segurança

---

## FASE 9 — Build/Lint/TypeCheck/Git [crit]

### 9.1 Lint zero warnings [crit]

- [ ] `pnpm -F @metanoia/api lint` → zero erros, zero warnings (flag `--max-warnings 0`)
- [ ] `pnpm -F @metanoia/web lint` → zero erros, zero warnings
- [ ] `pnpm -F @metanoia/types lint` → zero erros

**AC coberto**: checklist 9.1

### 9.2 TypeScript strict [crit]

- [ ] `pnpm -F @metanoia/api typecheck` → zero erros TS
- [ ] `pnpm -F @metanoia/web typecheck` → zero erros TS
- [ ] Confirmar que todos os imports dos novos tipos resolvem (sem `any` implícito)

**AC coberto**: checklist 9.1

### 9.3 Testes verdes [crit]

- [ ] `pnpm -F @metanoia/types test` → verde (snapshots atualizados)
- [ ] `pnpm -F @metanoia/api test` → verde (unit + integration + RLS)
- [ ] `pnpm -F @metanoia/web test` → verde (componentes, hooks, botão)

**AC coberto**: checklist 9.2

### 9.4 Build turborepo [crit]

- [ ] `pnpm build` no root (turborepo) → sem erro de compilação

**AC coberto**: checklist 9.3

### 9.5 Disciplina git [crit]

- [ ] Todos os commits na branch `feat/story-10-4-import-csv-process`
- [ ] **Nunca** `git push origin dev` — abrir PR via `gh pr create --base dev`
- [ ] Mensagens de commit em português (conventional commits): ex: `feat(onboarding): adicionar CsvImportService com máquina de estados FR03`
- [ ] Antes do PR: confirmar `git log --oneline origin/dev..HEAD` mostra apenas commits desta feature
- [ ] CI deve passar (lint + unit + RLS + build) antes de solicitar merge

**AC coberto**: checklist 9.4; memória `feedback_feature00c_direct_push_dev_bypasses_ci`

---

_Gerado pela onda `create-tasks` da pipeline feature-00c — Story 10-4 (import-csv-process)_
