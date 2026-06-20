# Plano Técnico — Story 13.3: Detecção de Risco de Evasão (FR66)

**Feature:** risco-evasao
**Épico:** Epic 13 — Relatórios Avançados & Analytics
**Spec:** `docs/specs/risco-evasao/spec.md`
**Referência autoritativa:** `_bmad-output/implementation-artifacts/13-3-deteccao-de-risco-de-evasao-fr66.md`
**Status do plano:** plan — gerado (read-back PRE-DECISÃO consumido, K=4 achados da Story 13.2b injetados)

> Todas as decisões de escopo (C1–C4, DECISÃO-ESCOPO-01/02) foram fechadas no clarify e **não são reabertas**. Este plano detalha o COMO técnico, ancorado em sondas reais contra o código entregue.

---

## 1. Sumário arquitetural

A feature adiciona detecção automática de risco de evasão pastoral como **job diário de background**, integrado ao Radar Pastoral existente (Epic 7). Componentes:

| Componente | Tipo | Módulo destino | Novo/Estende |
|------------|------|----------------|--------------|
| `DetectEvasionRiskProcessor` | BullMQ processor (cron) | `apps/api/src/reports/jobs/` | **Novo** |
| `EvasionDetectionService` | Service (lógica de detecção per-tenant) | `apps/api/src/reports/jobs/` | **Novo** |
| `EvasionRiskRepository` | Repository (queries de ausência/atividade) | `apps/api/src/reports/jobs/` | **Novo** |
| `LastSeenInterceptor` | NestJS Interceptor global | `apps/api/src/auth/` | **Novo** |
| `RadarStatusRepository.upsertRisk()` | método (grava riskReason + transição) | `apps/api/src/pastoral/radar/` | **Estende** |
| `PastoralRiskEventPublisher` | Service (emite domain event) | `apps/api/src/pastoral/` | **Novo** |
| `UpdateGroupRequestSchema` (status, breakUntil) | Zod | `packages/types/src/group.ts` | **Estende** |
| `GroupsService.update()` (lógica recesso/auto-resume) | Service | `apps/api/src/groups/` | **Estende** |
| 3 migrations (User.last_seen_at, Group.status+breakUntil, PRS.riskReason) | Prisma | `apps/api/prisma/migrations/` | **Novo** |

**Decisão de localização do job (read-back 13.2b):** o job vive em `reports/jobs/` (queue `queue:reports` / `REPORTS_QUEUE_NAME`), espelhando `refresh-tenant-views.processor.ts`. A **lógica de detecção** (`EvasionDetectionService`) é colocada junto ao processor (não em `pastoral/`) porque o orquestrador cross-tenant é responsabilidade de reports; o resultado (status do semáforo) é gravado via `RadarStatusRepository` do módulo `pastoral/radar/` (reuso, não duplicação).

---

## 2. Mecanismo cross-tenant (LIÇÃO 13.2b — sonda confirmada)

**Problema:** o job itera **todos os tenants ativos**. Listar tenants é uma leitura cross-tenant. A role da aplicação (`metanoia_app`, `NOSUPERUSER`, `FORCE ROW LEVEL SECURITY`) **não** enxerga linhas de outros tenants nem a tabela `tenants` sem escopo.

**Solução confirmada pela sonda** (`refresh-tenant-views.processor.ts`):

1. **Listagem de tenants** → cliente privilegiado dedicado, idêntico a `createPrivilegedClient()`:
   ```ts
   private createPrivilegedClient(): PrismaClient {
     const connectionString = this.configService.get('DATABASE_URL', { infer: true }); // role metanoia (superuser, RLS-bypass)
     const adapter = new PrismaPg({ connectionString });
     return new PrismaClient({ adapter });
   }
   ```
   - Usa-se **apenas** para `SELECT id FROM tenants WHERE status = 'active'` (campo `Tenant.status` confirmado no schema, default `'active'`).
   - Cliente privilegiado é **descartado** (`$disconnect()` em `finally`) imediatamente após obter a lista. NUNCA usado para ler/escrever dados de domínio.

2. **Processamento por tenant** → cliente da aplicação (`PrismaService`) via `withTenantTx(prisma, fn, { tenantId })`:
   - `withTenantTx` (sonda confirmada) emite `SET LOCAL app.current_tenant_id = '<uuid>'` na mesma transação, ativando RLS. **Aceita `opts.tenantId` explícito** — exatamente o caso do job (não há request HTTP).
   - **Conformidade CLAUDE.md "nunca passar tenant_id como parâmetro de função":** `tenantId` é repassado SOMENTE à fronteira de infraestrutura `withTenantTx({ tenantId })` (o mecanismo oficial de injeção RLS do projeto, já usado por `tenant-selection.selectTenant`), **não** à lógica de negócio. A regra proíbe propagar `tenant_id` por assinaturas de domínio — não proíbe alimentar o injetor RLS. Adicionalmente, o job envolve o processamento em `requestContext.run({ tenantId }, fn)` para que qualquer código de domínio interno resolva o tenant via `AsyncLocalStorage` (conforme FR66-01).
   - Padrão por tenant:
     ```ts
     for (const tenantId of activeTenantIds) {
       try {
         await requestContext.run({ tenantId }, async () => {
           await this.evasionDetection.detectForCurrentTenant(); // lê tenant via ALS
         });
         tenantsProcessed++;
       } catch (err) {
         this.logger.error({ tenantId, error: err.message }, 'detect_evasion_tenant_failed');
         await this.scheduleTenantRetry(tenantId); // skip + retry isolado
       }
     }
     ```

3. **Isolamento de falha:** falha em um tenant não aborta o lote. Após **3 falhas** do job inteiro (BullMQ `attempts: 3`), alerta Super Admin (log Pino `level: error` + `mvRefreshLog`-equivalente; reusar tabela de log de job ou criar `EvasionJobLog` — ver §4).

**Por que NÃO usar `super-admin-tenants.service`:** aquele service é request-scoped (depende de guards/contexto de admin HTTP) e traz dependências pesadas (DemoDataService, AuditService). O job é headless; replicar o `createPrivilegedClient` local é o padrão já estabelecido e auto-contido.

---

## 3. Critérios de detecção (FR66-02) — queries reais

Avaliação **per-participant-per-group**, dentro de `withTenantTx` (RLS ativo).

### Critério A — Ausências consecutivas (≥3 reuniões do grupo)
- Fonte: `MeetingAttendance` (`@@unique([meetingId, userId])`, campo `presenceType`) + `Meeting` (`scheduledFor`, `status`, `groupId`).
- Algoritmo por (participante, grupo): ordenar as últimas reuniões **realizadas** do grupo (`status ∈ {realizado, ended}`) por `scheduledFor DESC`; contar ausências consecutivas (sem linha de `MeetingAttendance` OU `presenceType` nulo) a partir da mais recente. Flag se `>= 3`.
- **Recesso (FR66-05):** reuniões cujo `scheduledFor` cai dentro de `[Group.status='on_break' window]` ou antes de `Group.breakUntil` **não contam** como ausência. Filtro aplicado na query (ver `EvasionRiskRepository`).

### Critério B — Inatividade na plataforma (≥2 semanas)
- Fonte: `User.last_seen_at` (**campo novo**, migration). Global por usuário.
- Flag se `last_seen_at IS NULL` **E** usuário criado há ≥ 14 dias, OU `last_seen_at < now() - interval '14 days'`.
- **Nota de robustez:** enquanto `last_seen_at` não é populado retroativamente, usuários antigos terão `NULL`. Para evitar falso-positivo em massa no primeiro run, o critério B só dispara se `User.createdAt < now() - 14d` **e** (`last_seen_at IS NULL` **ou** expirado). Documentado como acceptance criterion (ver §8).

Participante é flagged se **A OU B**. `riskReason` registra qual(is): valores `'absences'`, `'inactivity'`, `'absences+inactivity'` (VARCHAR(500), mensagem pastoral em PT-BR derivada — ver §5 riskReason).

---

## 4. Job `detect-evasion-risk` (FR66-01)

| Atributo | Valor |
|----------|-------|
| Queue | `queue:reports` (`REPORTS_QUEUE_NAME`) |
| Job name | `detect-evasion-risk` |
| Job id (scheduler) | `detect-evasion-risk-scheduler` |
| Cron | `0 6 * * *` (06:00 UTC) |
| Attempts | 3, backoff exponencial base 30s (espelha 13.2b) |
| Batch | 100 participantes por página (cursor por `participantId`) |
| SLA | ≤ 30 min; métrica `job.duration_ms` |
| Métricas Pino | `job.duration_ms`, `job.tenants_processed`, `job.participants_flagged` |

**Estrutura do processor** (espelha `RefreshTenantViewsProcessor`): `OnModuleInit` cria queue + worker, registra repeatable job. `dispatch` → `processDetection`. Wave por tenant com `requestContext.run` + `withTenantTx`. Batch de 100 via paginação por cursor (`take: 100`, `cursor`, `skip: 1`).

**Log de job:** reusar padrão `mvRefreshLog` se genérico, OU adicionar model leve `EvasionJobLog` (id, durationMs, tenantsProcessed, participantsFlagged, status, tenantId=null, createdAt) com RLS permitindo `tenant_id IS NULL` insert (igual `mv_refresh_log`). **Decisão:** criar `EvasionJobLog` para não acoplar semântica de relatório a detecção (research.md D-LOG).

---

## 5. Transição do semáforo (FR66-03) + riskReason (C2)

`RadarStatusRepository.upsert` (sonda: raw `INSERT ... ON CONFLICT (tenant_id, group_id, participant_id)`) é **estendido** com `riskReason`:

- **Migration C2:** `ALTER TABLE participant_radar_status ADD COLUMN risk_reason VARCHAR(500) NULL;` → Prisma `riskReason String? @map("risk_reason") @db.VarChar(500)`. Migration toca tabela com RLS → **teste RLS obrigatório** em `apps/api/test/rls/`.
- Novo método `upsertRisk({ participantId, groupId, status, trend, riskReason, calculatedAt })` (ou estender `upsert` com `riskReason` opcional no `RadarStatusUpsertData` + na cláusula INSERT/UPDATE). Grava status + riskReason no **mesmo upsert** (C2).
- `riskReason` carrega mensagem pastoral PT-BR curta (ex.: `"3 faltas consecutivas nas reuniões do grupo"` / `"sem acesso há mais de 2 semanas"`). Texto exibido no card do Radar.

**Máquina de transição (avaliada no MESMO job — C4):**

| De | Para | Gatilho |
|----|------|---------|
| 🟢 verde | 🟡 amarelo | 1ª detecção de risco (A ou B) |
| 🟡 amarelo | 🔴 vermelho | ainda flagged após +7 dias (compara `calculatedAt` do status amarelo atual) |
| 🔴 vermelho | 🟡 amarelo | 1ª atividade (reunião presente OU `last_seen_at` recente) — per-group |
| 🟡 amarelo | 🟢 verde | 2 presenças consecutivas nas próximas 2 reuniões agendadas do grupo |

**Regra de não-sobrescrita (24h):** se o líder alterou o status manualmente nas últimas 24h, o job **não** sobrescreve. Detecção: comparar `calculatedAt`/`updatedAt` da linha + flag de origem. Sonda atual de `ParticipantRadarStatus` **não tem** coluna de "origem manual". **Decisão (research D-MANUAL):** usar a tabela `ParticipantStatusImproved` (transições positivas registradas) + um critério de janela: o job verifica se há um `calculatedAt` dentro das últimas 24h cuja origem não seja o próprio job (a coluna `calculated_at` é atualizada a cada cálculo do job; uma alteração manual via Radar UI também a atualiza). Como não há flag de origem, o caminho mais limpo é **adicionar `manualOverrideAt DateTime?`** — porém isso amplia escopo. **Resolução conservadora:** a Radar UI de override pastoral (Epic 7) é o ponto que marca decisão manual; se aquela rota já grava `calculatedAt`, o job aplica a guarda "não recalcular se `updatedAt > now()-24h` E status divergente do esperado". Detalhar contra o código de Epic 7 de override na fase execute-task (sub-dependência de baixo risco; flag como item de verificação, não bloqueia o plano). Transições positivas gravam `ParticipantStatusImproved` (CelebrationBanner Epic 6-5, já existente).

**Retorno per-group:** "2 presenças consecutivas nas próximas 2 reuniões agendadas do grupo específico" — avaliado por grupo via `MeetingAttendance` das 2 reuniões realizadas mais recentes do grupo após a entrada em amarelo.

---

## 6. `last_seen_at` — mecanismo de população (C1 / DECISÃO-ESCOPO-02)

**Decisão fixada (dec-006):** `LastSeenInterceptor` global, acoplado ao fluxo autenticado.

- **Onde encaixa:** `KeycloakAuthGuard` (sonda: `keycloak.guard.ts`, `canActivate`) popula `requestContext` com o usuário autenticado. O interceptor roda **após** o guard (NestJS: guards → interceptors). Registrar `LastSeenInterceptor` como `APP_INTERCEPTOR` global em `app.module.ts` (ou no módulo auth). Lê `requestContext.getStore()` para obter `userId` + `tenantId`.
- **Fire-and-forget (não impacta latência):** o interceptor NÃO `await` a escrita no caminho da resposta. Usa `tap()` no observable de resposta e dispara a atualização de forma assíncrona (`void this.updateLastSeen(userId, tenantId)`), com erro **engolido** (best-effort: `.catch(err => logger.debug(...))`). Falha de atualização NUNCA quebra a request.
- **Debounce Redis (TTL 15min):** antes de escrever, `SET cache:last-seen:{userId} 1 NX EX 900`. Se a key já existe (não-NX), pula a escrita. Isso limita 1 UPDATE por usuário a cada 15 min, evitando DoS de escrita no `users` (sonda `RedisService` disponível, namespace `cache:*` conforme CLAUDE.md).
- **Escrita:** `UPDATE users SET last_seen_at = now() WHERE id = $userId` via `withTenantTx({ tenantId })` (RLS) — ou, como `last_seen_at` é global e o user pode não ter contexto de escrita de domínio, usar update escopado pelo tenant do token. UUID v7 não se aplica (update). 
- **Migration C-LASTSEEN:** `ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMPTZ NULL;` → Prisma `lastSeenAt DateTime? @map("last_seen_at") @db.Timestamptz`. Tabela `users` tem RLS? (tem `tenantId` nullable + `@@index([tenantId])`). Se houver policy → teste RLS.
- **Tratamento de erro:** best-effort total. Redis down → FAIL-OPEN: pula a escrita (best-effort, nunca escrita direta não-debounced — ver AC-SEC-02); DB down → log debug, segue. Nunca propaga, nunca bloqueia a request.

**Resposta ao FOCO de segurança (LastSeenInterceptor / DoS):** o debounce Redis NX EX 900 é a defesa primária contra amplificação de escrita. Sem ele, cada request autenticado geraria um UPDATE — vetor de DoS de I/O no `users`. Com TTL 15min, o teto é ~4 writes/hora/usuário ativo.

---

## 7. Recesso de grupo (FR66-05) + GroupsController (C3)

**NÃO criar controller novo.** `GroupsController` já tem `@Patch(':id')` com `ZodValidationPipe(UpdateGroupRequestSchema)` (sonda confirmada).

- **Estender `UpdateGroupRequestSchema`** (`packages/types/src/group.ts`, linha 50, é um `.object().refine(len>0)`):
  ```ts
  export const GroupStatusSchema = z.enum(['active', 'on_break']);
  export const UpdateGroupRequestSchema = z
    .object({
      // ...campos existentes...
      status: GroupStatusSchema.optional(),
      breakUntil: z.string().datetime().nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'at_least_one_field_required' })
    .refine((v) => !(v.status === 'on_break' && !v.breakUntil), {
      message: 'breakUntil_required_when_on_break',
    });
  ```
  → **Snapshot test** obrigatório (`packages/types/src/__tests__/group.snapshot.spec.ts` já existe — estender).
- **Migration C-GROUP:** `ALTER TABLE groups ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active', ADD COLUMN break_until TIMESTAMPTZ NULL;` → Prisma `status String @default("active") @db.VarChar(16)`, `breakUntil DateTime? @map("break_until") @db.Timestamptz`. Tabela `groups` tem RLS → teste RLS.
- **`GroupsService.update()` (estender):** ao receber `status: 'on_break'` + `breakUntil`, grava ambos. **Auto-resume:** quando o job (ou um check no update) detecta `status='on_break' AND breakUntil < now()`, transiciona de volta para `'active'`. Implementar a checagem de auto-resume no **próprio job detect-evasion-risk** (já itera grupos por tenant — barato), garantindo recesso expirado volta a contar ausências. Documentar no plan que o auto-resume é avaliado no job diário.
- **Efeito na detecção:** ausências dentro da janela de recesso (`scheduledFor` enquanto `status='on_break'` / antes de `breakUntil`) são excluídas da contagem do Critério A.

---

## 8. Domain Event (FR66-04 / DECISÃO-ESCOPO-01)

**NÃO implementar notification service.** Apenas **emitir** o evento; Epic 14 consome.

- Evento: `pastoral.participant.risk-detected`.
- **Padrão de emissão (sonda `meeting-event.service.ts`):** publicar via BullMQ (queue dedicada de eventos ou Redis stream) com `generateId()` (UUID v7) + dedup Redis TTL. Seguir o envelope canônico do projeto:
  ```
  { eventId, eventType, version, tenantId, timestamp, data, metadata }
  ```
- `data` carrega **apenas o necessário** (sem PII além de IDs): `{ participantId, groupId, riskReason, status, detectedAt }`. **NÃO** incluir nome/email/telefone — o consumidor (Epic 14) resolve PII sob o tenant. (Resposta ao FOCO de segurança: domain event não vaza PII.)
- Contrato completo em `contracts/risk-detected.event.json`.
- Idempotência: dedup key `rt:risk-detected:{tenantId}:{participantId}:{groupId}:{yyyy-mm-dd}` para não re-emitir no mesmo dia.

---

## 9. UI (Radar / CelebrationBanner) — a11y

- Card do participante no Radar UI exibe `riskReason` (texto pastoral PT-BR) ao lado do semáforo.
- **a11y:** contraste AA; cor do semáforo **acompanhada de ícone + texto** (não cor isolada); `aria-live="polite"` para atualizações; CelebrationBanner (transição positiva, reuso Epic 6-5) com `role="status"`. Página autenticada → fora do gate axe público, mas segue os scripts a11y do Epic 12.

---

## 10. Migrations & RLS (resumo)

| Migration | Tabela | Coluna(s) | Teste RLS |
|-----------|--------|-----------|-----------|
| C-LASTSEEN | `users` | `last_seen_at TIMESTAMPTZ NULL` | sim (se policy em users) |
| C-GROUP | `groups` | `status VARCHAR(16) DEFAULT 'active'`, `break_until TIMESTAMPTZ NULL` | sim |
| C2-RISKREASON | `participant_radar_status` | `risk_reason VARCHAR(500) NULL` | sim |
| C-JOBLOG (opcional) | `evasion_job_log` (novo) | log de job, `tenant_id NULL` permitido | policy `tenant_id IS NULL` |

UUID v7 (`uuidv7()`/`generateId()`) para qualquer nova linha. Datas ISO 8601 / TIMESTAMPTZ. Nulls explícitos.

---

## 11. Sequência de implementação (entrada para create-tasks)

1. **FASE 1 — Schema & contratos:** migrations (C-LASTSEEN, C-GROUP, C2-RISKREASON, C-JOBLOG) + `prisma generate` + estender `UpdateGroupRequestSchema` + snapshot tests + GroupStatusSchema.
2. **FASE 2 — last_seen_at:** `LastSeenInterceptor` + registro global + debounce Redis + testes.
3. **FASE 3 — Detecção:** `EvasionRiskRepository` (queries A/B, exclusão de recesso) + `EvasionDetectionService` (lógica per-tenant-per-group + máquina de transição) + `RadarStatusRepository.upsertRisk` + testes unitários.
4. **FASE 4 — Job:** `DetectEvasionRiskProcessor` (cron, privileged client p/ tenants, batch 100, RequestContext.run, skip+retry, métricas Pino) + auto-resume de recesso + testes + teste de isolamento multi-tenant.
5. **FASE 5 — Evento:** `PastoralRiskEventPublisher` (envelope, dedup, sem PII) + contrato + testes.
6. **FASE 6 — Recesso UI/Service:** `GroupsService.update` (recesso/auto-resume) + testes.
7. **FASE 7 — Radar UI:** card riskReason + a11y + CelebrationBanner reuso.
8. **FASE 8 — RLS & integração:** testes RLS por migration + integração end-to-end do job.

---

## 12. Acceptance Criteria de Segurança (Quality Gate owasp-security — MANDATÓRIO pela constituição)

Findings do gate `owasp-security` incorporados como critérios de aceite (severidade LOW; nenhum critical/high). Verificados contra código literal (`refresh-tenant-views.processor.ts`, `with-tenant-tx.ts`, `meeting-event.service.ts`).

- **AC-SEC-01 (A03/A01 — confinamento do cliente privilegiado):** o cliente privilegiado (`DATABASE_URL`, superuser, RLS-bypass) é usado EXCLUSIVAMENTE para `SELECT id FROM tenants WHERE status='active'` e DEVE ser `$disconnect()`-ado em bloco `finally` **ANTES** do início do loop por tenant. Ele NUNCA permanece aberto durante o processamento de domínio, e NUNCA executa query de dados de participante/reunião/radar. Todo dado de domínio passa pelo cliente da app sob `withTenantTx` (RLS ativa; guard UUID `Refusing SET LOCAL` antes de `SET LOCAL app.current_tenant_id`). Teste: asserção de que nenhuma query de domínio roda no cliente privilegiado + teste de isolamento multi-tenant (espelha `multi-tenant-isolation.spec.ts`).
- **AC-SEC-02 (A06/A04:resource — debounce fail-open do LastSeenInterceptor):** a escrita de `last_seen_at` usa `redis.set('cache:last-seen:{userId}', '1', 'EX', 900, 'NX')` (idioma nativo do projeto, idêntico ao dedup de `meeting-event.service.ts`). Se a key já existe → pula a escrita. **Se o Redis estiver indisponível → FAIL-OPEN: pula a escrita (best-effort), NUNCA cai para escrita direta não-debounced** (evita amplificação de writes / DoS no `users`). A request NUNCA é bloqueada nem falha por causa do interceptor (fire-and-forget no `tap()`, erro engolido em `debug`).
- **AC-SEC-03 (LLM02/A09 — sem PII no domain event):** `pastoral.participant.risk-detected.data` carrega SOMENTE `{participantId, groupId, riskReason(enum), status(enum), detectedAt}` com `additionalProperties:false`. NENHUM nome/email/telefone. Resolução de PII é responsabilidade do consumidor (Epic 14) sob o tenant. Teste: schema do evento rejeita propriedades extras; asserção de que o publisher não inclui campos de User além de `participantId`.
- **AC-SEC-04 (A05 — SET LOCAL injection):** `tenantId` passado a `withTenantTx`/`requestContext.run` provém de `SELECT id FROM tenants` (UUIDs do DB), e `withTenantTx` reaplica o guard `UUID_RE` antes do `SET LOCAL` interpolado. Nenhum input de usuário alcança a interpolação. Mantido por construção.

> Correção aplicada ao §6: a frase "Redis down → tenta escrita direta" foi substituída pela política fail-open de AC-SEC-02 (pular escrita). A população retroativa de `last_seen_at` não é requisito; usuários sem acesso recente permanecem `NULL` e o Critério B trata `NULL + createdAt > 14d` corretamente.
