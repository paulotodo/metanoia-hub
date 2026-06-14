# Research — Story 10-4 (import-csv-process)

Probe do código REAL (validado 1:1, não suposição). Datado 2026-06-14.

## R1 — Padrão BullMQ canônico (Story 8-7 Reports)

- `apps/api/src/bullmq/bullmq.service.ts` expõe:
  - `createQueue(name: string): Queue` — `new Queue(name, { connection, prefix: QUEUE_PREFIX })`, `QUEUE_PREFIX = 'queue'`. **Nome passado SEM `:`**; o prefixo `queue` é aplicado internamente → Redis key `queue:<name>`.
  - `createWorker(name, processor): Worker` — `new Worker(name, processor, { connection, prefix: QUEUE_PREFIX })`.
  - Cache de filas por nome (idempotente).
- Filas já registradas: `reports`, `audit-export`, `lesson-progress`, `trail-progress-events`, `privacy-export`, `privacy-deletion`, `radar-calculation`, `radar-aggregate`.
- **DECISÃO**: fila desta feature = `csv-import` (sem `:`). O artifact BMad escreve `queue:csv-import` — **ERRADO**; ignorado.
- `reports.service.ts`:
  - `onModuleInit()` → `this.queue = this.bullMqService.createQueue('reports')`.
  - `add`: `this.queue.add('export-trail-csv', payload, { attempts: 3, backoff: {type:'exponential',delay:2000}, removeOnComplete:{count:50}, removeOnFail:false })`.
  - Status do job NÃO usa `job.updateProgress()` — usa Redis cache key `cache:reports:export-job:{jobId}` (via `RedisService`). `getJobStatus(jobId)` lê essa key. **Vamos seguir o mesmo padrão**: `cache:csv-import:job:{jobId}`.
- `reports.processor.ts`: `onModuleInit()` → `createWorker('reports', handler)`; handler delega a `reportsService.processExportJob(...)`.
- `reports.controller.ts`: `@Get('jobs/:jobId')` `@Roles(...)` `@HttpCode(OK)` → `{ data: status }`; export grande retorna `res.status(ACCEPTED).json({ data: { jobId } })`.

## R2 — group-members (reuso de criação + plano)

- `apps/api/src/group-members/group-members.service.ts`:
  - `add(groupId, input)`: `requireGroup` → `findUserInTenant` → `findMembership` (conflito) → `enforceMembersPerGroup` → (se lider) `enforceLeadersTenantWide` → `repo.create({groupId,userId,role})`.
  - `enforceMembersPerGroup(groupId)`: `getRequestContext().tenantId` → `planLimits.getPlan(tenantId)` → `getLimit(plan,'membersPerGroup')` → se `!Number.isFinite(limit)` retorna (enterprise=Infinity) → `repo.countByGroup(groupId)` → se `current >= limit` lança `ForbiddenException` `{statusCode:403,error:'PlanLimitReached',message:'...',details:{resource:'membersPerGroup',plan,current,limit}}`.
  - Injeta `GroupMembersRepository`, `PlanLimitsService`, `PrismaService`.
- `group-members.controller.ts`: `@Controller('api/v1/groups/:groupId/members')` `@UseGuards(KeycloakAuthGuard, RolesGuard)` `@Roles(Role.ADMIN_TENANT)`; `@Post()` `@HttpCode(CREATED)` `@UsePipes(new ZodValidationPipe(AddGroupMemberInputSchema))`.

## R3 — PlanLimitsService (FR04, validação de limite ANTES de processar)

- `apps/api/src/common/plan-limits/plan-limits.service.ts`:
  - `hasCapacity(tenantId, resource)` retorna `{allowed,current,limit,plan}` MAS **`membersPerGroup` faz short-circuit**: `if (resource === 'membersPerGroup') return { allowed:true, current:0, limit, plan }` (caller-enforced; ver comentário em `packages/types/src/group-members.ts:9-10` e teste `plan-limits.service.spec.ts:65`).
  - `getPlan(tenantId)` → string `'free'|'pro'|'enterprise'`.
- `plan-limits.config.ts`: `getLimit(plan, resource)`; `membersPerGroup`: free=30, pro=100, enterprise=Infinity.
- **DECISÃO FR04**: NÃO usar `hasCapacity('membersPerGroup')` (curto-circuita). Enforce manual: `plan=getPlan(tenant)`; `limit=getLimit(plan,'membersPerGroup')`; se `Number.isFinite(limit)`: `current = repo.countByGroup(groupId)`; `novos = nº de linhas que criarão/adicionarão membro novo neste grupo`; se `current + novos > limit` → rejeitar import inteiro (sem parcial) com `ForbiddenException` `PlanLimitReached` + mensagem PT-BR acionável. Espelha `enforceMembersPerGroup`.

## R4 — Multi-tenant FR03 (regra por linha)

- `apps/api/prisma/schema.prisma`:
  - `User.email String @unique` → **GLOBAL** (cross-tenant). FR03 §10.3: a checagem cross-tenant de email é server-side AQUI (10-3 só checou tenant corrente).
  - `User.tenantId` nullable; join `UserTenant` `@@unique([userId,tenantId])`, `role @default("participante")`.
  - `GroupMember` `role @default("membro")` (schema), MAS enum CSV usa `'participante'|'lider'`. **Ao criar membership, gravar o `role` da linha (`'participante'` por padrão)**, não confiar no default `'membro'`.
  - `Group`: id, tenantId, name (lookup por nome do CSV → resolver groupId; ausente → linha falha).
- Decisão por linha (RECONCILIACAO §10 / spec FR03):
  - email inédito na plataforma → cria User + UserTenant(`participante`) + GroupMember → `action: created`.
  - email em OUTRO tenant (existe global mas sem UserTenant neste) → convite/consentimento via Story 4-3, SEM auto-vincular → `action: invited`.
  - email já NESTE tenant → `action: existing` (ignorado, não é erro).
  - grupo da coluna "grupo" inexistente no tenant → `action: failed`, motivo "Grupo '{nome}' não encontrado no tenant".

## R5 — Story 4-3 convite (reuso cross-tenant)

- `apps/api/src/admin-invites/admin-invites.service.ts`:
  - `create(input: CreateAdminInviteInput): Promise<AdminInviteCreateResponse>`; `input` = {kind, inviteeEmail, inviteeName, groupId, expiresInDays}.
  - `KIND_TO_ROLE` = {tenant_member:'participante', tenant_leader:'lider', group_member:'participante', group_leader:'lider'}.
  - **Atualmente apenas loga URL do convite** (Story 14-3 fará email Resend). **NÃO há stub BullMQ `notifications`** — o artifact assume isso ERRADO. Reuso = chamar `adminInvitesService.create({kind:'group_member', inviteeEmail, inviteeName, groupId, expiresInDays})` por linha cross-tenant.

## R6 — Audit (Story 9-3) + evento de domínio (FR10)

- `apps/api/src/audit/audit.service.ts`: `createEvent(dto: CreateAuditEventDto)`; `dto = {userId, action: AuditAction, resource, resourceId, ipAddress, userAgent, newState}`.
- **`AUDIT_ACTIONS` (packages/types/src/audit/index.ts:25) NÃO contém `'import'`** — apenas create/update/delete/login/logout/auth_failure/config_change/export. **DECISÃO**: adicionar `'import'` ao enum `AUDIT_ACTIONS` (mudança de Zod enum → atualizar snapshot do schema audit). `getAuditSeverity` mapeia severidade (import não está em WARNING_RESOURCES → `info`).
- Evento de domínio: NestJS `EventEmitter2` (`EventEmitterModule.forRoot()` em app.module.ts:48). Padrão (onboarding-events.spec): `eventEmitter.emit('onboarding.csv_import.completed', payload)` com payload `{eventId: generateId()/uuidv7(), eventType, version:1, tenantId, timestamp(ISO), data:{...}, metadata:{...}}`. `generateId` exportado de `packages/types/src/id.ts`.

## R7 — Storage (Story 8-2 MinIO) p/ relatório (FR07)

- `apps/api/src/storage/storage.service.ts`:
  - `upload(objectKey, buffer, mimeType): Promise<string>` (MinIO putObject).
  - `getSignedUrl(objectKey, expirationSeconds=14400): Promise<string>` (presigned GET, default 4h).
- **DECISÃO FR07/BACKUP**: gerar CSV de resultado (linhas originais + colunas status/detalhe), `upload('csv-import-result/<tenant>/<jobId>.csv', buffer, 'text/csv')`, `getSignedUrl(key, 86400)` (24h conforme spec §BACKUP). Link no `ImportResultSummary.reportUrl`.

## R8 — Contratos 10-3 + 10-4 (Zod)

- `packages/types/src/onboarding/csv-import.ts` (10-3): `CSVRowSchema {nome,email,telefone(nullable),papel('participante'|'lider'),status('critico'|'aviso'|'ok'),messages[],rowIndex}`; `CSVValidationResultSchema {...}`.
- **DECISÃO 10-4 novo arquivo**: `packages/types/src/onboarding/csv-import-result.ts` (spec FR / Key Entities): `ImportRequestSchema`, `ImportResultLineSchema` (action: created|existing|invited|failed), `ImportResultSummarySchema` (totais + reportUrl + jobId), `ImportJobStatusSchema` (status processing|completed|failed + progress + result). Snapshot test obrigatório (gate Zod silent-breaking). Exportar em `packages/types/src/onboarding/` index (criar se não existir) e re-export no `packages/types/src/index.ts`.

## R9 — Frontend 10-3 (wire-up)

- `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/importar/`: `page.tsx` (Server, Suspense) + `import-client.tsx` (Client: upload→parse→validate→email check).
- `apps/web/src/components/onboarding/`: `csv-preview-table.tsx`, `file-upload-zone.tsx`, `index.ts`, etc.
- `apps/web/src/lib/onboarding/`: `csv-parser.ts`, `csv-validator.ts`, `csv-template.ts` (+ specs/fixtures).
- **DECISÃO**: novo componente `import-result-summary.tsx` em `components/onboarding/` + confirmation UI no `import-client.tsx` (botão confirmar habilitado só com ≥1 linha válida — FR09). Hook TanStack para POST import + polling GET status (TanStack só em Client Component). i18n em `apps/web/messages/pt-BR.json` (já tem chave `"import"`); vocabulário pastoral.

## R10 — Convenções obrigatórias (constitution + CLAUDE.md)

- AsyncLocalStorage `getRequestContext()` p/ tenantId; NUNCA tenant_id param. `withTenantTx(prisma, fn, {tenantId})` p/ transações multi-membro.
- UUID v7 via `generateId()`/`uuidv7()`; ISO 8601; nulls explícitos.
- Contratos API: `{data, meta?}` / erro `{statusCode,error,message,details?}`. Create 201, Async 202.
- `ZodValidationPipe` custom (`apps/api/src/common/pipes/zod-validation.pipe.ts`); SEM libs terceiras.
- Código + log em inglês; mensagens user-facing PT-BR pastoral.
- RLS: reusar specs 4-2 (membership criado via service já testado). Nomes de coluna REAIS confirmados em schema.prisma (R3/R4).

## R11 — OWASP / segurança (para o gate PASSAR)

- AuthZ: `@Roles(Role.ADMIN_TENANT)` no controller import + status (FR11).
- Validação de pertencimento grupo↔tenant (`requireGroup`/`findUserInTenant`) antes de processar.
- Rate-limit: import em massa → aplicar throttle (verificar `@Throttle`/guard existente, ex. marketing endpoints Story 04 usam rate-limit custom; reusar mecanismo).
- Convites idempotentes (não duplicar convite p/ mesmo email/grupo).
- Sanitização: payload validado por `ZodValidationPipe` (ImportRequestSchema); emails normalizados (lowercase/trim); proteção contra CSV injection no relatório gerado (prefixar células que iniciam com `= + - @` com `'`).
- Limite de tamanho do payload (defesa DoS): rejeitar listas absurdamente grandes (ex. > limite configurável) antes de enfileirar.
