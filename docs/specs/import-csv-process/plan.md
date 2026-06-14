# Technical Plan — Story 10-4 (import-csv-process)

**Feature**: Importação CSV — Confirmação e Processamento (Epic 10, last story)
**Continuação direta de**: Story 10-3 (`import-csv-preview`, mergeada em dev)
**Branch**: `feat/story-10-4-import-csv-process` (commitar só nela; nunca push direto em dev)
**Spec**: `docs/specs/import-csv-process/spec.md` · **Research**: `research.md` · **Data model**: `data-model.md`

> Todas as referências de path/símbolo abaixo foram sondadas no código REAL
> (ver `research.md`). Onde o artifact BMad diverge do código, o código vence
> (notado inline). Memória `feedback_explore_agent_phantom_content` aplicada.

---

## 1. Arquitetura geral

Fluxo: 10-3 (client) valida CSV → usuário confirma → FE envia JSON validado ao backend
→ backend valida grupo/tenant/limite de plano → processa (SYNC ≤100 / ASYNC >100 via BullMQ)
→ resultado (`ImportResultSummary`) + relatório CSV (MinIO signed URL) + audit + evento de domínio.

Módulo backend: **FLAT** em `apps/api/src/onboarding/` (repo NÃO usa `modules/`). Adiciona
`csv-import.controller.ts`, `csv-import.service.ts`, `csv-import.processor.ts` ao
`OnboardingModule` existente; reusa serviços de outros módulos via imports.

**Sem migration** (resultado em Redis + MinIO; ver `data-model.md`). Única mudança de schema
de tipos: adicionar `'import'` ao enum `AUDIT_ACTIONS`.

---

## 2. Backend — endpoints

### 2.1 `POST /api/v1/groups/:groupId/members/import`
- `apps/api/src/onboarding/csv-import.controller.ts`.
- `@Controller('api/v1/groups/:groupId/members')` + `@Post('import')`
  `@UseGuards(KeycloakAuthGuard, RolesGuard)` `@Roles(Role.ADMIN_TENANT)`
  `@UsePipes(new ZodValidationPipe(ImportRequestSchema))`.
- Body `ImportRequest` (`{ defaultGroupId, rows[] }`); `:groupId` path === `defaultGroupId`
  (validar igualdade ou ignorar body.defaultGroupId e usar path — **usar path `:groupId` como fonte**).
- Fluxo:
  1. `requireGroup(groupId)` (pertence ao tenant via `getRequestContext().tenantId`).
  2. Validação de limite de plano (FR04 — ver §2.4) → rejeita import inteiro se exceder.
  3. Se `rows.length <= IMPORT_SYNC_THRESHOLD` (100): processa inline → `201` + `{ data: ImportResultSummary }` (`jobId: null`).
  4. Se `> 100`: enfileira job BullMQ `csv-import` → `202` + `{ data: { jobId, message } }` (status inicial gravado em Redis).
- Status codes: SYNC 201 (Create), ASYNC 202 (Async). Contrato `{data}`/erro `{statusCode,error,message,details?}`.

### 2.2 `GET /api/v1/import/jobs/:jobId`
- Mesmo controller OU controller dedicado em `onboarding/`. Path **`api/v1/import/jobs/:jobId`** (conforme prompt).
  `@Roles(Role.ADMIN_TENANT)` `@HttpCode(OK)` → `{ data: ImportJobStatus }`.
- Lê `cache:csv-import:job:{jobId}` no Redis (`RedisService`). `404` se não existir.
- **Tenant binding (finding MEDIUM #2)**: payload Redis inclui `tenantId`; comparar com `getRequestContext().tenantId` → mismatch retorna **404** (não 403). Impede vazar emails/`reportUrl` entre tenants.
- Idempotente (IDEMP): só consulta, nunca reprocessa.

### 2.3 Processor BullMQ
- `apps/api/src/onboarding/csv-import.processor.ts`, `implements OnModuleInit`.
- `onModuleInit()` → `this.bullMqService.createWorker(CSV_IMPORT_QUEUE_NAME, handler)`.
  `CSV_IMPORT_QUEUE_NAME = 'csv-import'` (SEM `:`; prefixo `queue` aplicado internamente).
- Handler delega a `csvImportService.processJob(job)`; processa em lotes, atualiza progresso
  gravando `cache:csv-import:job:{jobId}` (status/progress/result) — espelha padrão reports
  (NÃO usar `job.updateProgress`). TTL `CSV_IMPORT_JOB_TTL_SECONDS` (24h).
- `add('process-csv-import', payload, { attempts: 3, backoff:{type:'exponential',delay:2000}, removeOnComplete:{count:50}, removeOnFail:false })`.

### 2.4 `CsvImportService` — núcleo de processamento
- `apps/api/src/onboarding/csv-import.service.ts`. Injeta: `PrismaService`, `PlanLimitsService`,
  `GroupMembersRepository` (ou `GroupMembersService.add`), `AdminInvitesService`, `AuditService`,
  `StorageService`, `EventEmitter2`, `RedisService`, `BullMqService`.
- **`onModuleInit`**: `this.queue = this.bullMqService.createQueue(CSV_IMPORT_QUEUE_NAME)`.
- **`enforcePlanLimit(groupId, projectedNewMembers)`** (FR04): espelha `enforceMembersPerGroup`
  do `group-members.service`. NÃO usar `hasCapacity('membersPerGroup')` (curto-circuita —
  ver research R3). `plan=getPlan(tenant)`; `limit=getLimit(plan,'membersPerGroup')`; se
  `Number.isFinite(limit)` e `countByGroup(groupId)+projectedNew > limit` → `ForbiddenException`
  `PlanLimitReached` com mensagem PT-BR acionável (limite + excesso). **Rejeição total, sem parcial.**
- **`processRows(rows, defaultGroupId)`** dentro de `withTenantTx(prisma, fn, {tenantId})`:
  máquina de estados FR03 (ver `data-model.md`):
  - resolve grupo (`row.grupo` por nome → groupId; null → defaultGroupId); inexistente → `failed`.
  - `findUserByEmailGlobal(email)` (email `@unique` GLOBAL — checagem cross-tenant FR03 §10.3 aqui).
  - inédito → cria `User` (`generateId()`/uuidv7) + `UserTenant('participante')` + `GroupMember(row.papel)` → `created`.
  - existe neste tenant (tem `UserTenant`) → `existing` (ignora; não duplica).
  - existe em OUTRO tenant → `AdminInvitesService.create({kind:'group_member', inviteeEmail, inviteeName, groupId, expiresInDays})` → `invited` (sem auto-vincular). **Idempotente**: não recriar convite p/ mesmo email+grupo.
  - acumula `ImportResultLine[]` → agrega `ImportResultSummary`.
- **`generateReport(summary)`** (FR07): monta CSV (linhas originais + colunas status/reason),
  **sanitiza CSV injection** (prefixa `'` em células iniciando com `= + - @`), `storage.upload('csv-import-result/{tenant}/{jobId}.csv', buffer, 'text/csv')`, `storage.getSignedUrl(key, 86400)` → `summary.reportUrl`.
- **`audit + evento`** (FR10): `auditService.createEvent({userId, action:'import', resource:'group', resourceId:groupId, ipAddress, userAgent, newState:{imported,existing,invited,failed}})`; `eventEmitter.emit('onboarding.csv_import.completed', { eventId: generateId(), eventType:'onboarding.csv_import.completed', version:1, tenantId, timestamp: new Date().toISOString(), data:{groupId,total,imported,...}, metadata:{} })`.

### 2.5 Mudança de tipo
- `packages/types/src/audit/index.ts`: adicionar `'import'` a `AUDIT_ACTIONS` → atualizar snapshot audit.

---

## 3. Contratos Zod (packages/types)

- Novo: `packages/types/src/onboarding/csv-import-result.ts` (schemas em `data-model.md`):
  `ImportRowInputSchema`, `ImportRequestSchema`, `ImportResultLineSchema`,
  `ImportResultSummarySchema`, `ImportJobStatusSchema`, consts (`IMPORT_SYNC_THRESHOLD=100`,
  `IMPORT_MAX_ROWS=5000`, `CSV_IMPORT_QUEUE_NAME='csv-import'`, `CSV_IMPORT_JOB_TTL_SECONDS=86400`).
- Criar `packages/types/src/onboarding/index.ts` (re-export csv-import + csv-import-result) se ausente;
  re-export em `packages/types/src/index.ts`.
- Snapshot test: `packages/types/src/onboarding/__tests__/csv-import-result.snapshot.spec.ts`.

---

## 4. Frontend

- Wire-up no fluxo 10-3: `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/importar/import-client.tsx`
  ganha etapa de confirmação após preview/validação.
- Novo `apps/web/src/components/onboarding/import-result-summary.tsx`: contadores
  (importados/existentes/convites/falhas) expansíveis por linha (FR08) + link "Baixar relatório" (FR07).
- Botão "Confirmar Importação" habilitado só com ≥1 linha válida (FR09).
- Hook TanStack (Client Component apenas): `useImportMembers` (POST) + `useImportJobStatus` (polling GET status
  com refetchInterval enquanto `processing`; barra de progresso FR06). Server Components NÃO usam TanStack.
- i18n: `apps/web/messages/pt-BR.json` (chave `"import"` já existe) — adicionar labels de resultado/erros;
  vocabulário pastoral (não corporativo). Mensagens user-facing PT-BR; código/log inglês.

---

## 5. Segurança (OWASP gate — auditado, findings incorporados)

- **AuthZ (A01/API5 BFLA)**: `@Roles(Role.ADMIN_TENANT)` em import + status (FR11).
- **Pertencimento grupo↔tenant (A01/API1 BOLA)**: `requireGroup`/`getRequestContext` (sem tenant_id param).
- **Validação total** do payload via `ZodValidationPipe(ImportRequestSchema)`; emails normalizados (trim/lowercase).
- **Mass-assignment (API3 BOPLA) [finding MEDIUM #1]**: ao criar `User`/`UserTenant`/`GroupMember`, mapear campo-a-campo (`nome,email,telefone,role`) — **NUNCA** espalhar (`...row`) o objeto da linha no Prisma `create`. O `ImportRowInputSchema` já restringe a shape do wire; o mapeamento explícito é defesa em profundidade.
- **IDOR no GET status (API1 BOLA) [finding MEDIUM #2]**: o job DEVE ser ligado ao tenant. Gravar `tenantId` no payload Redis `cache:csv-import:job:{jobId}`; no GET, comparar com `getRequestContext().tenantId` → mismatch retorna **404** (não 403, evita enumeração). Sem isso, um `jobId` do tenant A vazaria emails + `reportUrl` para o tenant B.
- **Sensitive data / signed URL (A04) [finding MEDIUM #3 — aceito com controle]**: relatório CSV contém PII (emails). Objeto namespaced por tenant (`csv-import-result/{tenantId}/{jobId}.csv`); `reportUrl` só retornado ao tenant dono (ver finding #2). Signed URL 24h conforme spec §BACKUP.
- **DoS (API4)**: teto `IMPORT_MAX_ROWS` (5000) antes de enfileirar/processar; rate-limit (throttle) no endpoint import (reusar mecanismo existente — confirmar `@Throttle`/guard; padrão endpoints públicos marketing Story 04).
- **Invite idempotency / race (A06) [finding LOW #4]**: dedup key = `(inviteeEmail, groupId, tenantId)`; serializar por tenant/grupo (decisão §LOCK da spec) para evitar convite duplicado em imports concorrentes.
- **CSV injection (A05) no relatório**: sanitizar células iniciando com `= + - @` (prefixo `'`).
- **A10 Exception**: sem stack traces ao FE; erros no contrato `{statusCode,error,message,details?}`; fail-closed.
- **RLS**: criação via service/repository já testado (specs 4-2); reusar specs de membership; teste de isolamento cross-tenant (SC#3).

> **Resultado do gate owasp-security**: maior severidade = MEDIUM (findings #1-#3) + LOW (#4). Nenhum CRITICAL/HIGH → não bloqueia. Findings incorporados acima.

---

## 6. Testes

- Unit (`*.spec.ts`): `csv-import.service` — máquina FR03 (created/existing/invited/failed), FR04 rejeição total, sanitização CSV, agregação summary.
- RLS (`apps/api/test/rls/`): isolamento — import não cria/vincula em outro tenant sem consentimento (SC#3). Reusar padrão specs 4-2 com nomes de coluna reais (`schema.prisma`).
- Integration (`*.integration-spec.ts`): SYNC 201 / ASYNC 202 + polling.
- Snapshot Zod (`csv-import-result.snapshot.spec.ts`).
- FE: botão desabilitado sem linha válida (SC#6); summary render; polling.
- Audit/evento: `action:'import'` gravado + evento emitido (espelha onboarding-events.spec).

---

## 7. Divergências do artifact BMad (registradas)

1. Fila = `csv-import` **sem `:`** (artifact escreve `queue:csv-import` — ERRADO; prefixo aplicado internamente por `bullmq.service`).
2. Story 4-3 **não tem stub BullMQ `notifications`** — apenas loga URL do convite. Reuso = `AdminInvitesService.create(...)`.
3. `AUDIT_ACTIONS` **não inclui `'import'`** — precisa adicionar ao enum + snapshot.
4. `PlanLimitsService.hasCapacity('membersPerGroup')` **curto-circuita** — FR04 enforce manual (espelha `enforceMembersPerGroup`).
5. Progresso do job via Redis cache key (padrão reports), **não** `job.updateProgress`.

---

## 8. Ordem de implementação (tasks na próxima fase)

1. Contratos Zod `csv-import-result.ts` + index + snapshot + add `'import'` em AUDIT_ACTIONS (+snapshot audit).
2. `CsvImportService` (enforcePlanLimit, processRows FR03, generateReport, audit+evento).
3. `csv-import.controller.ts` (POST import 201/202, GET status).
4. `csv-import.processor.ts` (worker BullMQ) + registrar no `OnboardingModule`.
5. Specs: unit + RLS + integration + snapshot.
6. FE: hooks TanStack, `import-result-summary.tsx`, wire-up `import-client.tsx`, i18n.
7. Build/lint/test verde antes de declarar done (memória feedback_feature00c_direct_push: auditar git real + validar CI; nunca push direto em dev).
