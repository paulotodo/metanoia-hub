# Checklist de Implementação — Story 10-4 (import-csv-process)

**Feature**: Importação CSV — Confirmação e Processamento  
**Branch**: `feat/story-10-4-import-csv-process`  
**Spec**: `spec.md` · **Plan**: `plan.md` · **Data Model**: `data-model.md`

> Regra de ouro: nunca dar push direto em `dev`. CI deve passar (lint + unit + RLS + build) antes de abrir PR.  
> Tamanho estimado: ~7 tasks. Ordem de implementação obrigatória: contratos Zod → backend core → testes → frontend → integração final.

---

## FASE 1 — Contratos Zod e tipos

### 1.1 `csv-import-result.ts` (packages/types/src/onboarding/)
- [ ] Criar `packages/types/src/onboarding/csv-import-result.ts` com todos os schemas do `data-model.md`:
  - `ImportRowInputSchema` (nome, email, telefone, papel, grupo, rowIndex)
  - `ImportRequestSchema` (defaultGroupId uuid, rows min(1) max(IMPORT_MAX_ROWS))
  - `importActionSchema` enum `created|existing|invited|failed`
  - `ImportResultLineSchema` (rowIndex, email, nome, groupName, action, reason)
  - `ImportResultSummarySchema` (total, imported, existing, invited, failed, lines[], reportUrl, jobId)
  - `importJobStatusSchema` enum `processing|completed|failed`
  - `ImportJobStatusSchema` (jobId, status, progress 0-100, result, failureReason)
  - Consts: `IMPORT_SYNC_THRESHOLD=100`, `IMPORT_MAX_ROWS=5000`, `CSV_IMPORT_QUEUE_NAME='csv-import'`, `CSV_IMPORT_JOB_TTL_SECONDS=86400`
- [ ] O schema `ImportRequestSchema` usa `IMPORT_MAX_ROWS` — declarar const ANTES do schema (evitar hoisting issue)
- [ ] Import de `CSVRowSchema` de `./csv-import` (grupo coluna existe lá como campo opcional)

### 1.2 Index e re-exports
- [ ] Criar `packages/types/src/onboarding/index.ts` re-exportando `./csv-import` + `./csv-import-result`
- [ ] Em `packages/types/src/index.ts`: adicionar re-export de todos os símbolos de `csv-import-result.ts` (padrão das linhas 450+855 existentes)
- [ ] Verificar que nenhum símbolo conflita com exports existentes (`ImportResult` pode colidir — verificar)

### 1.3 AUDIT_ACTIONS += `'import'`
- [ ] Em `packages/types/src/audit/index.ts`, adicionar `'import'` ao array `AUDIT_ACTIONS` (linha ~34)
- [ ] Atualizar snapshot: `packages/types/src/__tests__/__snapshots__/` — o snapshot de audit deve refletir o novo enum
- [ ] Rodar `pnpm -F @metanoia/types test --update-snapshots` para regenerar snapshot (ou ajustar manualmente o `.snap`)

### 1.4 Snapshot test csv-import-result
- [ ] Criar `packages/types/src/__tests__/csv-import-result.snapshot.spec.ts` com snapshot dos schemas `ImportResultSummarySchema`, `ImportJobStatusSchema`, `ImportRequestSchema` (padrão dos specs existentes em `__tests__/`)
- [ ] Verificar que snapshot roda verde: `pnpm -F @metanoia/types test`

---

## FASE 2 — Backend: CsvImportService

### 2.1 Arquivo e injeção
- [ ] Criar `apps/api/src/onboarding/csv-import.service.ts`
- [ ] Injeções (construtor): `PrismaService`, `PlanLimitsService`, `GroupMembersRepository`, `AdminInvitesService`, `AuditService`, `StorageService`, `EventEmitter2`, `RedisService`, `BullMqService`
- [ ] `onModuleInit`: `this.queue = this.bullMqService.createQueue(CSV_IMPORT_QUEUE_NAME)` — sem `:`

### 2.2 `enforcePlanLimit(groupId, projectedNewMembers)` (FR04)
- [ ] **NÃO usar** `planLimitsService.hasCapacity('membersPerGroup')` — curto-circuita (research R3)
- [ ] Implementação manual espelhando `group-members.service.ts:141` `enforceMembersPerGroup`:
  - `plan = await planLimitsService.getPlan(tenantId)` (ou padrão equivalente)
  - `limit = getLimit(plan, 'membersPerGroup')` (importar de `plan-limits.config`)
  - Se `Number.isFinite(limit)` e `currentCount + projectedNewMembers > limit` → `ForbiddenException({ message: '...PT-BR acionável...', error: 'PlanLimitReached' })`
  - Mensagem PT-BR deve citar: limite do plano + quantos excede
- [ ] Rejeição total: nenhum row é criado se limite estourar (lançar antes de `processRows`)
- [ ] `currentCount` = soma de `GroupMembersRepository.countByGroup(groupId)` por grupo destino afetado

### 2.3 `processRows(rows, defaultGroupId)` — máquina de estados FR03
- [ ] Executar dentro de `withTenantTx(prisma, fn, { tenantId })` (ver padrão em `meetings.repository.ts`)
- [ ] **Resolver grupo por linha**: `row.grupo ?? defaultGroupId`
  - Se `row.grupo` presente: busca por nome no tenant → `GroupId` ou `null`
  - Se null → `action=failed`, `reason="Grupo '{nome}' não encontrado no tenant"`
- [ ] **`findUserByEmailGlobal(email)`**: query sem filtro tenant (email é `@unique` global)
- [ ] Máquina de estados:
  - `user == null` → CREATE `User` (uuidv7) + `UserTenant('participante')` + `GroupMember(row.papel)` → `created`
  - `user` tem `UserTenant` neste tenant → `existing` (ignora, independente de pertencer ao grupo)
  - `user` existe em outro tenant (sem `UserTenant` aqui) → `AdminInvitesService.create({kind:'group_member', inviteeEmail, inviteeName, groupId, expiresInDays:30})` → `invited`
  - **Idempotência convite**: não recriar convite p/ mesmo `(inviteeEmail, groupId, tenantId)` — verificar existência antes via `AdminInvitesRepository` ou capturar `ConflictException`
- [ ] **Anti mass-assignment (OWASP MEDIUM #1)**: ao criar `User`/`UserTenant`/`GroupMember`, mapear campo-a-campo NUNCA `...row` no Prisma `create`
- [ ] Acumular `ImportResultLine[]` → agregar `ImportResultSummary`

### 2.4 `generateReport(summary, tenantId, jobId)` (FR07)
- [ ] Montar CSV: header original + colunas `status`, `reason`
- [ ] **Sanitização CSV injection (OWASP A05)**: células iniciando com `= + - @` → prefixar `'`
- [ ] `storageService.upload('csv-import-result/{tenantId}/{jobId}.csv', buffer, 'text/csv')`
- [ ] `storageService.getSignedUrl(key, 86400)` → preencher `summary.reportUrl`

### 2.5 Audit + evento de domínio (FR10)
- [ ] `auditService.createEvent({ userId, action: 'import', resource: 'group', resourceId: groupId, ipAddress, userAgent, newState: { imported, existing, invited, failed } })`
  - `action: 'import'` agora válido (FASE 1.3)
- [ ] `eventEmitter.emit('onboarding.csv_import.completed', { eventId: generateId(), eventType: 'onboarding.csv_import.completed', version: 1, tenantId, timestamp: new Date().toISOString(), data: { groupId, total, imported, existing, invited, failed }, metadata: {} })`
- [ ] Snapshot do evento: estrutura padrão domain event do projeto

---

## FASE 3 — Backend: Controller

### 3.1 `csv-import.controller.ts`
- [ ] Criar `apps/api/src/onboarding/csv-import.controller.ts`
- [ ] `@Controller('api/v1/groups/:groupId/members')` + `@Post('import')`
- [ ] Guards: `@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN_TENANT)` (FR11)
- [ ] `@UsePipes(new ZodValidationPipe(ImportRequestSchema))`
- [ ] Validar pertencimento do grupo ao tenant: `requireGroup(groupId)` via `getRequestContext().tenantId` (sem passar tenantId como parâmetro — regra multi-tenancy)
- [ ] Fluxo SYNC (≤ IMPORT_SYNC_THRESHOLD):
  - Chamar `enforcePlanLimit` antes de processar
  - `processRows` → `generateReport` → `audit+evento`
  - Retornar `201` + `{ data: ImportResultSummary }` (jobId: null)
- [ ] Fluxo ASYNC (> IMPORT_SYNC_THRESHOLD):
  - Chamar `enforcePlanLimit` antes de enfileirar
  - Gerar `jobId` (uuidv7)
  - Gravar status inicial em Redis: `cache:csv-import:job:{jobId}` com `{ status:'processing', progress:0, result:null, tenantId }` (TTL 24h)
  - `queue.add('process-csv-import', { rows, defaultGroupId, groupId, jobId, tenantId }, { attempts:3, backoff:{type:'exponential',delay:2000}, removeOnComplete:{count:50}, removeOnFail:false })`
  - Retornar `202` + `{ data: { jobId, message: 'Importação iniciada. Acompanhe o progresso pelo jobId.' } }`

### 3.2 `GET /api/v1/import/jobs/:jobId`
- [ ] Pode ser método adicional em `csv-import.controller.ts` ou `@Controller('api/v1/import/jobs')`
- [ ] `@Roles(Role.ADMIN_TENANT)` + `@HttpCode(HttpStatus.OK)`
- [ ] Ler `cache:csv-import:job:{jobId}` no Redis
- [ ] Se não existe → `404 NotFoundException`
- [ ] **Tenant binding (OWASP MEDIUM #2)**: comparar `payload.tenantId` com `getRequestContext().tenantId` → mismatch retorna `404` (não 403 — evita enumeração)
- [ ] Retornar `{ data: ImportJobStatus }`

---

## FASE 4 — Backend: Processor BullMQ

### 4.1 `csv-import.processor.ts`
- [ ] Criar `apps/api/src/onboarding/csv-import.processor.ts`
- [ ] `implements OnModuleInit`
- [ ] `onModuleInit()` → `this.worker = this.bullMqService.createWorker(CSV_IMPORT_QUEUE_NAME, this.handleJob.bind(this))`
- [ ] Handler `handleJob(job)`:
  - Chamar `csvImportService.processRows(job.data.rows, job.data.defaultGroupId)`
  - A cada lote, atualizar Redis: `cache:csv-import:job:{jobId}` com progresso percentual
  - Ao concluir: `generateReport` → gravar resultado final no Redis + `audit+evento`
  - Em falha: gravar `{ status:'failed', failureReason: err.message }` no Redis
- [ ] **NÃO usar** `job.updateProgress()` — progresso via Redis key (padrão reports)

### 4.2 Registrar no OnboardingModule
- [ ] Em `apps/api/src/onboarding/onboarding.module.ts`:
  - Adicionar `CsvImportService` e `CsvImportProcessor` ao array `providers`
  - Adicionar `CsvImportController` ao array `controllers`
  - Importar módulos necessários: `BullMqModule`, `GroupMembersModule`, `AdminInvitesModule`, `StorageModule`, `PlanLimitsModule`, `AuditModule`, `EventEmitterModule` (verificar se já importados)

---

## FASE 5 — Testes

### 5.1 Unit: `csv-import.service.spec.ts`
- [ ] Criar `apps/api/src/onboarding/csv-import.service.spec.ts`
- [ ] Mocks de todos os serviços injetados
- [ ] Testar máquina FR03 (4 cenários): email inédito→created, email mesmo tenant→existing, email outro tenant→invited, grupo inexistente→failed
- [ ] Testar FR04: rejeição total quando limite estourado (`ForbiddenException PlanLimitReached`)
- [ ] Testar sanitização CSV injection (células com `= + - @` ganham `'` prefixo)
- [ ] Testar agregação `ImportResultSummary` (contadores corretos)
- [ ] Testar idempotência de convite (não recriar se já existe)
- [ ] Testar anti mass-assignment: spy no `prisma.user.create` — args NÃO contêm campo extra do row

### 5.2 RLS: `csv-import.rls-spec.ts`
- [ ] Criar `apps/api/test/rls/csv-import.rls-spec.ts` (padrão `group-members.rls-spec.ts`)
- [ ] Usar colunas reais do `schema.prisma` (sem UUID inventado — usar hex fixos do padrão)
- [ ] SC#3 — Isolamento cross-tenant: import do tenant A não cria/vincula User no tenant B sem consentimento
- [ ] Verificar que `UserTenant` criado pertence apenas ao tenant correto
- [ ] Verificar que `GroupMember` criado pertence ao grupo do tenant correto
- [ ] **Padrão obrigatório**: `beforeEach` com `bind` (armadilha `beforeEach.bind→undefined` da memória `cstk_w1b1_story_8_1_done`)

### 5.3 Integration: sync + async polling
- [ ] Criar `apps/api/src/onboarding/csv-import.integration-spec.ts`
- [ ] SYNC: `POST /api/v1/groups/:groupId/members/import` com ≤100 rows → `201` + `ImportResultSummary`
- [ ] ASYNC: POST com >100 rows → `202` + `{ jobId }`
- [ ] Polling: `GET /api/v1/import/jobs/:jobId` → `ImportJobStatus`
- [ ] IDOR: GET com jobId do tenant A com credencial tenant B → `404`
- [ ] Limite de plano: POST excedendo limite → `403 PlanLimitReached`
- [ ] Botão desabilitado: POST com `rows: []` → erro de validação Zod (400)

### 5.4 Audit/evento: verificar emissão
- [ ] No unit spec ou integration spec, verificar que `action: 'import'` é gravado no `AuditService`
- [ ] Verificar que `onboarding.csv_import.completed` é emitido com shape correta (espelhar `onboarding-events.spec.ts`)

### 5.5 Snapshot Zod
- [ ] Rodar `pnpm -F @metanoia/types test` → snapshot `csv-import-result.snapshot.spec.ts` deve ser verde
- [ ] Se snapshot mudar por ajuste de schema, fazer `--update-snapshots` e commitar o `.snap` atualizado

---

## FASE 6 — Frontend

### 6.1 Hooks TanStack (Client Component)
- [ ] Criar `apps/web/src/hooks/use-import-members.ts`:
  - `useImportMembers`: `useMutation` → `POST /api/v1/groups/${groupId}/members/import`
  - Tipos de response: `ImportResultSummary` (sync 201) ou `{ jobId }` (async 202)
- [ ] Criar (ou expandir) `apps/web/src/hooks/use-import-job-status.ts`:
  - `useImportJobStatus(jobId)`: `useQuery` com `refetchInterval: (data) => data?.status === 'processing' ? 2000 : false`
  - Para polling somente enquanto `status === 'processing'`
  - Retorna `ImportJobStatus`
- [ ] Hooks em Client Components APENAS — nunca importar em Server Components

### 6.2 `import-result-summary.tsx` (FR08)
- [ ] Criar `apps/web/src/components/onboarding/import-result-summary.tsx`
- [ ] Props: `summary: ImportResultSummary`
- [ ] Contadores: importados / já existentes / convites enviados / falhas (badges coloridos)
- [ ] Cada categoria expansível (Accordion/Collapsible shadcn) para ver linhas individuais
- [ ] Link "Baixar relatório" (`<a href={summary.reportUrl} download>`) visível quando `reportUrl` não nulo
- [ ] Estado vazio para cada contador = 0 (não exibir seção colapsável)
- [ ] Vocabulário pastoral PT-BR (não corporativo) — seguir padrão `messages/pt-BR.json`
- [ ] `jest-axe` a11y: sem violações (headings hierárquicos, labels, ARIA correta)

### 6.3 Wire-up em `import-client.tsx`
- [ ] Abrir `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/importar/import-client.tsx`
- [ ] Adicionar etapa "confirmação" após preview/validação (machine state ou step counter)
- [ ] Botão "Confirmar Importação" (FR09):
  - Habilitado somente quando `validRows.length >= 1`
  - Desabilitado + mensagem explicativa quando `validRows.length === 0`
  - Loading state durante `isPending` do `useImportMembers`
- [ ] Fluxo SYNC: ao receber `201`, exibir `<ImportResultSummary summary={data} />`
- [ ] Fluxo ASYNC: ao receber `202 + jobId`, exibir barra de progresso usando `useImportJobStatus(jobId).data?.progress`; substituir por `<ImportResultSummary>` quando `status === 'completed'`
- [ ] Estado de erro: exibir `ForbiddenException PlanLimitReached` como mensagem acionável PT-BR

### 6.4 i18n (pt-BR.json)
- [ ] Adicionar chaves sob `"import"` (já existe) em `apps/web/messages/pt-BR.json`:
  - `import.confirm.button` = "Confirmar Importação"
  - `import.confirm.disabled` = "Não há participantes válidos para importar."
  - `import.result.imported` = "Importados"
  - `import.result.existing` = "Já existentes"
  - `import.result.invited` = "Convites enviados"
  - `import.result.failed` = "Falhas"
  - `import.result.download` = "Baixar relatório"
  - `import.result.processing` = "Importação em andamento..."
  - `import.error.planLimit` = "Limite do plano atingido. Seu plano permite {limit} membros por grupo e o grupo já tem {current}."
- [ ] Substituir strings hardcoded nos componentes pelas chaves i18n

---

## FASE 7 — Quality Gates

### 7.1 a11y (jest-axe)
- [ ] Testar `ImportResultSummary` com jest-axe: `expect(results).toHaveNoViolations()`
- [ ] Testar botão "Confirmar Importação" desabilitado: verificar `aria-disabled` ou `disabled` + mensagem via `aria-describedby`
- [ ] Testar barra de progresso: `role="progressbar"` + `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### 7.2 Testes de botão (SC#6)
- [ ] `import-client.spec.tsx` (ou vitest): botão desabilitado quando `validRows.length === 0` → snapshot ou `expect(button).toBeDisabled()`
- [ ] Botão habilitado quando `validRows.length >= 1`

### 7.3 E2E (CI only)
- [ ] E2E somente no CI (`import-csv-process.e2e-spec.ts`) — NÃO rodar localmente
- [ ] Cenário happy path: upload CSV pequeno → preview → confirmar → ver resultado importado
- [ ] Cenário limit exceeded: preview com muitos participantes → confirmar → mensagem PT-BR de limite
- [ ] Usar fixtures existentes em `apps/web/e2e/fixtures/` ou criar `import-csv-process.csv`

---

## FASE 8 — Segurança (checklist OWASP do plano)

- [ ] **Anti mass-assignment (MEDIUM #1)**: revisão de código — confirmar que `prisma.user.create` só recebe campos `{ id, name, email, createdAt }` mapeados explicitamente, não `{ ...row }`
- [ ] **IDOR tenant-binding (MEDIUM #2)**: testar GET `/import/jobs/:jobId` com jobId de outro tenant → `404` (confirmar no integration spec)
- [ ] **PII namespaced (MEDIUM #3)**: objeto MinIO inicia com `csv-import-result/{tenantId}/` (verificar em `generateReport`)
- [ ] **Idempotência convite (LOW #4)**: dedup key `(inviteeEmail, groupId, tenantId)` — confirmar que segundo import com mesmo email+grupo não duplica `AdminInvite`
- [ ] **CSV injection**: confirmar sanitização de células `= + - @` no CSV gerado (unit test já cobre)
- [ ] **DoS teto**: `ImportRequestSchema` tem `.max(IMPORT_MAX_ROWS)` (5000) — validação antes de enfileirar
- [ ] **Rate limit**: verificar se `@Throttle()` ou guard equivalente está ativo no controller de import (padrão dos outros endpoints auth)
- [ ] **Sem stack traces ao FE**: erros retornam `{ statusCode, error, message, details? }` — `AllExceptionsFilter` já instalado (Story 7-3)

---

## FASE 9 — Integração e build final

### 9.1 Lint e TypeScript
- [ ] `pnpm -F @metanoia/api lint` → zero erros
- [ ] `pnpm -F @metanoia/web lint` → zero erros
- [ ] `pnpm -F @metanoia/types lint` → zero erros
- [ ] `pnpm -F @metanoia/api typecheck` e `pnpm -F @metanoia/web typecheck` → zero erros ts

### 9.2 Testes
- [ ] `pnpm -F @metanoia/types test` → verde (snapshots atualizados)
- [ ] `pnpm -F @metanoia/api test` → verde (unit + integration + RLS)
- [ ] `pnpm -F @metanoia/web test` → verde (componentes, hooks, botão)

### 9.3 Build
- [ ] `pnpm build` no root (turborepo) → sem erro de compilação

### 9.4 Git
- [ ] Todos os commits na branch `feat/story-10-4-import-csv-process`
- [ ] **Nunca** `git push origin dev` — PR via `gh pr create --base dev`
- [ ] Mensagem de commit em português (conventional commits)

---

## Divergências BMad (registradas no plan.md §7 — não regredir)

| # | Divergência | Regra correta |
|---|-------------|---------------|
| 1 | Artifact BMad escreve `queue:csv-import` | Fila = `csv-import` SEM `:` |
| 2 | Story 4-3 não tem stub BullMQ `notifications` | Reuso = `AdminInvitesService.create(...)` |
| 3 | `AUDIT_ACTIONS` não inclui `'import'` | Adicionar em `packages/types/src/audit/index.ts` |
| 4 | `PlanLimitsService.hasCapacity('membersPerGroup')` curto-circuita | Enforce manual espelhando `enforceMembersPerGroup` |
| 5 | `job.updateProgress()` | Progresso via Redis key (padrão reports) |

---

## Critérios de conclusão (Success Criteria da spec)

- [ ] SC#1: Admin completa fluxo SYNC ≤100 linhas em <30s do clique ao resumo
- [ ] SC#2: Import 500 participantes conclui <5min no modo ASYNC com progresso visível
- [ ] SC#3: Zero participantes criados em outro tenant sem consentimento (coberto por RLS spec)
- [ ] SC#4: Import que excede limite do plano é integralmente rejeitado antes de criar qualquer registro
- [ ] SC#5: 100% das importações concluídas têm entrada no audit log + relatório para download
- [ ] SC#6: Botão desabilitado sem linhas válidas — verificado por teste automatizado

---

_Gerado pela onda `checklist` da pipeline feature-00c — Story 10-4 (import-csv-process)_
