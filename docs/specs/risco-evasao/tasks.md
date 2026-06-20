# Tarefas — Detecção de Risco de Evasão (FR66 / Story 13.3)

> **Spec autoritativa:** `docs/specs/risco-evasao/spec.md` + `plan.md`
> **Legenda de criticidade:** `[crit]` = bloqueante / sem isso a feature não funciona · `[imp]` = importante mas não bloqueia CI · `[opt]` = melhoria opcional
> **Convenção de checkbox:** `- [ ]` = pendente · `- [x]` = concluído

---

## Escopo Coberto

- Migrations Prisma: `User.last_seen_at`, `Group.status`+`breakUntil`, `ParticipantRadarStatus.riskReason`+`manualOverrideAt`, `EvasionJobLog`
- Schemas Zod + contratos domain events (risk-detected + risk-resolved)
- `LastSeenInterceptor` global (debounce Redis 15min, fail-open)
- `EvasionDetectionService` + `EvasionRiskRepository` + `DetectEvasionRiskProcessor` (BullMQ cron)
- Recesso de grupo: `GroupsService.update()` + `UpdateGroupRequestSchema` + auto-resume
- `PastoralRiskEventPublisher` (emite domain events, NÃO consumer)
- Radar UI: `riskReason` no card + `CelebrationBanner` (a11y)
- Care timeline: registro via `PastoralNote` (FR66-09)
- Testes RLS, testes unitários, testes de integração, testes de segurança

## Escopo Excluído

- Consumer de notificação (Epic 14) — apenas o domain event é emitido
- Novo controller de grupos — reusar `@Patch(':id')` existente
- Mudanças em `constitution.md` ou `briefing.md`

---

## Matriz de Dependências

```
FASE 1 (Migrations) ──→ FASE 2 (Zod/Types) ──→ FASE 3 (Contratos)
       │                        │
       ↓                        ↓
FASE 4 (Interceptor) ←── FASE 1   FASE 5 (Service/Repo) ←── FASE 1+2+3
       │                                  │
       ↓                                  ↓
FASE 6 (Job BullMQ) ←── FASE 5    FASE 7 (Recesso) ←── FASE 2+5
       │
       ↓
FASE 8 (Events) ←── FASE 3+5+6
       │
       ↓
FASE 9 (UI) ←── FASE 5+8     FASE 10 (Testes) ←── TODAS
```

---

## Resumo por Fase

| Fase | Título | Tasks | Criticidade |
|------|--------|-------|-------------|
| 1 | Migrations Prisma | 4 | `[crit]` |
| 2 | Schemas Zod + Types | 3 | `[crit]` |
| 3 | Contratos Domain Events | 2 | `[crit]` |
| 4 | LastSeenInterceptor | 2 | `[crit]` |
| 5 | EvasionDetectionService + Repository | 4 | `[crit]` |
| 6 | Job BullMQ + Observabilidade | 3 | `[crit]` |
| 7 | Recesso de Grupo | 2 | `[crit]` |
| 8 | Domain Events Publisher | 2 | `[imp]` |
| 9 | UI — Radar + CelebrationBanner | 3 | `[imp]` |
| 10 | Testes RLS, Integração e Segurança | 6 | `[crit]` |

---

## FASE 1 — Migrations Prisma [crit]

> Pré-requisito de todas as demais fases. Rodar em sequência M1→M2→M3→M4.
> Gotcha 13.2b: seed raw em `users`/`groups` precisa incluir `updated_at = now()`.

### 1.1 Migration M1: `users.last_seen_at` [crit]

- [x] Criar migration Prisma: `ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMPTZ NULL`
- [x] Adicionar ao schema Prisma: `lastSeenAt DateTime? @map("last_seen_at") @db.Timestamptz` em `model User`
- [x] Rodar `pnpm --filter @metanoia/api exec prisma generate` após migration
- [x] Verificar que policy RLS em `users` cobre a nova coluna (policy de SELECT/UPDATE deve filtrar por `tenant_id`)
- [x] Criar teste RLS obrigatório (ver FASE 10, task 10.2 — CHK025)

### 1.2 Migration M2: `groups.status` + `groups.break_until` [crit]

- [x] Criar migration: `ALTER TABLE groups ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active', ADD COLUMN break_until TIMESTAMPTZ NULL`
- [x] Adicionar ao schema Prisma:
  ```prisma
  status     String    @default("active") @db.VarChar(16)
  breakUntil DateTime? @map("break_until") @db.Timestamptz
  ```
- [x] Adicionar enum Prisma `GroupStatus { active on_break }` e mapear via `@@map`
- [x] Rodar `pnpm --filter @metanoia/api exec prisma generate`
- [x] Verificar policy RLS em `groups` cobre as novas colunas

### 1.3 Migration M3: `participant_radar_status.risk_reason` + `manual_override_at` [crit]

> **CHK043 — Gap obrigatório:** `manualOverrideAt` necessário para guarda de não-sobrescrita de decisão manual (24h). Sem esta coluna, SC-04 não é verificável de forma determinística.

- [x] **[CHK043]** Verificar rota de override manual do Epic 7 (`ParticipantRadarStatus`): distingue origem manual vs. automática?
  - Se NÃO distingue → criar migration com `manual_override_at TIMESTAMPTZ NULL`
  - Se JÁ distingue → documentar campo existente e pular a sub-tarefa abaixo
- [x] Criar migration: `ALTER TABLE participant_radar_status ADD COLUMN risk_reason VARCHAR(500) NULL`
- [x] Se necessário (CHK043): `ALTER TABLE participant_radar_status ADD COLUMN manual_override_at TIMESTAMPTZ NULL`
- [x] Adicionar ao schema Prisma:
  ```prisma
  riskReason       String?   @map("risk_reason") @db.VarChar(500)
  manualOverrideAt DateTime? @map("manual_override_at") @db.Timestamptz
  ```
- [x] Rodar `pnpm --filter @metanoia/api exec prisma generate`

### 1.4 Migration M4: `evasion_job_log` (modelo de observabilidade) [imp]

> Modelo leve para métricas/alerta. `tenant_id NULL` permitido — policy RLS `tenant_id IS NULL OR tenant_id = current_tenant_id()`.
> **CHK032 — Gap:** definir canal do alerta Super Admin. Decisão: log Pino `level:error` no `worker.on('failed')` após `attemptsMade === 3` + insert em `evasion_job_log` com `status='failed'`. Epic 14 consumirá como evento futuro; documentar no quickstart.md.

- [x] **[CHK032]** Documentar decisão de canal de alerta no `quickstart.md`: log Pino `level:error` + `evasion_job_log.status='failed'` (sem notification service — Epic 14)
- [x] Criar migration: nova tabela `evasion_job_log`:
  ```sql
  CREATE TABLE evasion_job_log (
    id UUID PRIMARY KEY,
    job_run_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL,
    duration_ms INTEGER,
    tenants_processed INTEGER,
    participants_flagged INTEGER,
    tenant_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
- [x] Adicionar model Prisma `EvasionJobLog` com `tenantId String? @map("tenant_id") @db.Uuid`
- [x] Adicionar policy RLS: `USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid)`
- [x] Rodar `pnpm --filter @metanoia/api exec prisma generate`

---

## FASE 2 — Schemas Zod + Types [crit]

> Depende de: FASE 1 (para consistência com o schema Prisma gerado).

### 2.1 Zod: `RiskDetectedEventSchema` + `RiskResolvedEventSchema` [crit]

> **CHK007/CHK036 — Gap obrigatório:** `RiskResolvedEventSchema` e `contracts/risk-resolved.event.json` NÃO existem ainda.

- [x] Criar `packages/types/src/pastoral/risk-event.ts`:
  ```ts
  // Envelope canônico: { eventId, eventType, version, tenantId, timestamp, data, metadata }
  // SEM PII (nome/email/telefone) — apenas IDs
  export const RiskDetectedEventSchema = z.object({ ... }) // conforme spec §FR66-04
  export const RiskResolvedEventSchema = z.object({ ... }) // conforme spec §FR66-04
  ```
- [x] Garantir `additionalProperties: false` equivalente via `.strict()` no Zod
- [x] Exportar de `packages/types/src/index.ts`
- [x] Criar snapshot test: `packages/types/src/__tests__/risk-event.snapshot.spec.ts`
  - Snapshot de `RiskDetectedEventSchema._def` e `RiskResolvedEventSchema._def`
  - Gate contra breaking changes silenciosos (CHK038)

### 2.2 Zod: estender `UpdateGroupRequestSchema` para recesso [crit]

- [x] Editar `packages/types/src/group.ts` (linha ~50): adicionar `GroupStatusSchema` + campos `status` e `breakUntil`
  ```ts
  export const GroupStatusSchema = z.enum(['active', 'on_break']);
  // No UpdateGroupRequestSchema .object():
  status:     GroupStatusSchema.optional(),
  breakUntil: z.string().datetime().nullable().optional(),
  // Nova .refine: !(status === 'on_break' && !breakUntil)
  ```
- [x] Atualizar snapshot test em `packages/types/src/__tests__/group.snapshot.spec.ts` (já existe — estender para incluir novos campos)
- [x] Rodar `pnpm --filter @metanoia/types test` para confirmar snapshot atualizado

### 2.3 Zod: `ParticipantRiskReasonSchema` (valores semânticos) [imp]

- [x] Criar ou adicionar a `packages/types/src/pastoral/radar.ts` (ou `risk-event.ts`):
  ```ts
  export const ParticipantRiskReasonSchema = z.enum([
    'consecutive_absences',
    'platform_inactivity',
    'combined',
  ]);
  ```
- [x] Usar em `RiskDetectedEventSchema.data.riskReason` e em `ParticipantRadarStatus` (type inference)
- [x] Exportar de index

---

## FASE 3 — Contratos Domain Events (JSON Schema) [crit]

> Depende de: FASE 2 (schemas Zod).

### 3.1 `contracts/risk-resolved.event.json` [crit]

> **CHK036 — Gap crítico obrigatório:** este arquivo NÃO existe.

- [x] Criar `docs/specs/risco-evasao/contracts/risk-resolved.event.json` com JSON Schema completo:
  ```json
  {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "pastoral.participant.risk-resolved",
    "type": "object",
    "additionalProperties": false,
    "required": ["eventId","eventType","version","tenantId","timestamp","data","metadata"],
    "properties": {
      "eventId":    { "type": "string", "format": "uuid" },
      "eventType":  { "type": "string", "const": "pastoral.participant.risk-resolved" },
      "version":    { "type": "integer", "const": 1 },
      "tenantId":   { "type": "string", "format": "uuid" },
      "timestamp":  { "type": "string", "format": "date-time" },
      "data": {
        "type": "object",
        "additionalProperties": false,
        "required": ["participantId","groupId","resolvedBy","previousStatus","newStatus"],
        "properties": {
          "participantId":  { "type": "string", "format": "uuid" },
          "groupId":        { "type": "string", "format": "uuid" },
          "resolvedBy":     { "type": "string", "enum": ["attendance","platform_access"] },
          "previousStatus": { "type": "string", "enum": ["amarelo","vermelho"] },
          "newStatus":      { "type": "string", "enum": ["verde","amarelo"] }
        }
      },
      "metadata": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "jobId":         { "type": "string", "format": "uuid" },
          "correlationId": { "type": "string", "format": "uuid" }
        }
      }
    }
  }
  ```
- [x] Validar que `additionalProperties: false` está no envelope raiz E dentro de `data`

### 3.2 Validar `contracts/risk-detected.event.json` já existente [imp]

- [x] Confirmar que `contracts/risk-detected.event.json` já tem `additionalProperties: false` no envelope e em `data` (CHK035 — já confirmado no checklist, mas re-verificar após migrations M1-M3)
- [x] Confirmar que SEM PII (nenhum campo `name`, `email`, `phone`)

---

## FASE 4 — `LastSeenInterceptor` [crit]

> Depende de: FASE 1 (M1 — `users.last_seen_at` presente no schema).

### 4.1 Implementar `LastSeenInterceptor` [crit]

- [x] Criar `apps/api/src/auth/last-seen.interceptor.ts`:
  - Implementa `NestInterceptor`
  - No `intercept()`: `tap()` (fire-and-forget) lê `RequestContext.getStore()` → obtém `userId`
  - Debounce Redis: `redis.set('cache:last-seen:{userId}', '1', 'EX', 900, 'NX')`
    - Se a key já existe (SET NX retorna null) → **pula** a escrita (debounce ativo)
    - Se Redis indisponível → **fail-open**: engole erro, NUNCA lança exceção, NUNCA escreve diretamente sem debounce
  - Quando debounce não existe: `prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } })`
  - Wraps em `try/catch` async — erro loggado via Pino `logger.warn`, request não bloqueada
- [x] Registrar como `APP_INTERCEPTOR` global em `AppModule` (ou `AuthModule`)
- [x] Criar teste unitário: `apps/api/src/auth/last-seen.interceptor.spec.ts`
  - Caso: Redis disponível, key inexistente → escreve `lastSeenAt`
  - Caso: Redis disponível, key existente (debounce ativo) → NÃO escreve
  - Caso: Redis indisponível → fail-open, request continua sem erro (AC-SEC-02)
  - Caso: `userId` ausente (rota pública) → no-op

### 4.2 Testes de integração do interceptor [imp]

- [x] Criar `apps/api/src/auth/last-seen.interceptor.integration-spec.ts`:
  - Usar `docker-compose.test.yml` (Redis real)
  - Verificar que 2 requests em <15min resultam em apenas 1 update de `last_seen_at`
  - Verificar que request com Redis down retorna 200 (fail-open)

---

## FASE 5 — `EvasionDetectionService` + `EvasionRiskRepository` [crit]

> Depende de: FASE 1, FASE 2, FASE 3.

### 5.1 `EvasionRiskRepository` — queries de ausência/atividade [crit]

- [x] Criar `apps/api/src/reports/jobs/evasion-risk.repository.ts`:
  - `findConsecutiveAbsences(participantId, groupId)`:
    - Busca últimas reuniões **realizadas** do grupo (`status ∈ {realizado, ended}`) ordenadas por `scheduledFor DESC`
    - Conta ausências consecutivas a partir da mais recente (sem `MeetingAttendance` OU `presenceType == null`)
    - **`partial` conta como presença** (dec-021 — CHK011-RES confirmado)
    - **Recesso:** reuniões cujo `scheduledFor` cai em `[Group.breakUntil window]` (status `on_break`) **não contam** como ausência
    - **[CHK017]** Após recesso (`status` voltou para `active`): recontabilizar ausências apenas de reuniões após `breakUntil` (reuniões durante recesso ignoradas)
    - Retorna `{ count: number, meetings: MeetingRef[] }`
  - `findPlatformInactivity(userId)`:
    - Retorna `users.last_seen_at` para o usuário
    - Calcula `daysSinceLastAccess = now - last_seen_at` (null → infinito = risco)
  - `findAllParticipantsForTenant(cursor?, take=100)`:
    - Paginação por cursor (`take: 100, cursor, skip: 1`)
    - Retorna `{ participants: ParticipantRef[], nextCursor: string | null }`
  - `findRadarStatus(participantId, groupId)`:
    - Retorna `ParticipantRadarStatus` atual (semáforo + `calculatedAt` + `manualOverrideAt`)
  - `upsertRisk(participantId, groupId, riskData)`:
    - Delega para `RadarStatusRepository.upsertRisk()` (módulo `pastoral/radar/`) — NÃO duplicar lógica
- [x] Criar teste unitário com Prisma mock

### 5.2 `EvasionDetectionService` — lógica central de detecção [crit]

- [x] Criar `apps/api/src/reports/jobs/evasion-detection.service.ts`:
  - `evaluateParticipant(participantId, groupId)`:
    - **Critério A:** `consecutiveAbsences >= 3` → risco
    - **Critério B:** `daysSinceLastAccess >= 14` → risco
    - **Guarda de não-sobrescrita (24h):** se `manualOverrideAt` existe e `now - manualOverrideAt < 24h` → **NÃO sobrescrever** (CHK043 / SC-04)
    - **Transições de semáforo:**
      - `verde → amarelo`: 1ª detecção de risco
      - `amarelo → vermelho`: status permanece amarelo por ≥7 dias (comparar `calculatedAt` do status amarelo)
      - `vermelho → amarelo`: 2 presenças após status vermelho
      - `amarelo → verde`: 2 presenças após status amarelo
    - **[CHK019]** Participante re-adicionado ao grupo: tratar como nova entrada — zerar histórico de ausências consecutivas para o par `(participantId, groupId)` (não influenciar status existente de outros grupos)
    - Retorna `{ changed: boolean, newStatus, riskReason, event? }`
  - `resolveRisk(participantId, groupId, resolvedBy)`:
    - Transiciona vermelho→amarelo ou amarelo→verde após 2 presenças
    - Emite `risk-resolved` domain event (via `PastoralRiskEventPublisher`)
- [x] Criar `apps/api/src/reports/jobs/evasion-detection.service.spec.ts` com cenários determinísticos:
  - Cenário: 3 ausências consecutivas → risco (Critério A)
  - Cenário: presença parcial quebra sequência (dec-021)
  - Cenário: 14 dias sem last_seen_at → risco (Critério B)
  - Cenário: grupo em recesso — reuniões dentro do recesso não contam (CHK017)
  - Cenário: grupo retorna de recesso — ausências recontadas apenas pós-recesso (CHK017)
  - Cenário: manualOverrideAt < 24h → guarda, NÃO sobrescreve (SC-04)
  - Cenário: manualOverrideAt > 24h → sobrescreve normalmente
  - Cenário: amarelo há 7+ dias → vermelho (SC-02)
  - Cenário: 2 presenças após vermelho → amarelo (SC-05 / resolução)
  - Cenário: participante re-adicionado ao grupo → histórico zerado (CHK019)

### 5.3 `RadarStatusRepository.upsertRisk()` — estender método existente [crit]

- [x] Localizar `apps/api/src/pastoral/radar/radar-status.repository.ts` e adicionar/estender `upsertRisk()`:
  - Persiste `riskReason` (VARCHAR 500) + atualiza `status`/`calculatedAt`
  - Persiste `manualOverrideAt` quando a origem é manual (flag de origem)
  - Registra na care timeline via `PastoralNote` (FR66-09 — ver FASE 9, task 9.3)
  - Mantém isolamento RLS (NUNCA passa `tenantId` como parâmetro — usa `AsyncLocalStorage`)

### 5.4 `PastoralRiskEventPublisher` — publicar domain events [imp]

- [x] Criar `apps/api/src/pastoral/pastoral-risk-event-publisher.service.ts`:
  - `publishRiskDetected(event: RiskDetectedEvent)`: publica na queue/Redis com dedup key `rt:risk-detected:{tenantId}:{participantId}:{groupId}:{yyyy-mm-dd}` (TTL 24h)
  - `publishRiskResolved(event: RiskResolvedEvent)`: sem dedup (resolução pode ser re-emitida)
  - Usar `generateId()` (UUID v7) para `eventId`
  - Envelopa conforme contrato: `{ eventId, eventType, version, tenantId, timestamp, data, metadata }`
  - SEM PII nos campos `data` (apenas IDs)
  - Padrão de emissão: seguir `meeting-event.service.ts` (BullMQ ou Redis stream)

---

## FASE 6 — Job BullMQ `detect-evasion-risk` + Observabilidade [crit]

> Depende de: FASE 5.

### 6.1 `DetectEvasionRiskProcessor` — processor BullMQ [crit]

- [x] Criar `apps/api/src/reports/jobs/detect-evasion-risk.processor.ts`:
  - Espelhar estrutura de `refresh-tenant-views.processor.ts`
  - `OnModuleInit`: criar queue `queue:reports` + worker, registrar job repetível:
    ```ts
    await this.queue.upsertJobScheduler('detect-evasion-risk-scheduler', {
      pattern: '0 6 * * *',  // 06:00 UTC
    }, { name: 'detect-evasion-risk' });
    ```
  - `attempts: 3`, backoff exponencial base 30s
  - `processDetection(job)`:
    1. Gerar `correlationId` = UUID v7 único por run (1 por job run, cobre todos os tenants — CHK030-RES)
    2. Criar cliente privilegiado (`DATABASE_URL` superuser, RLS-bypass) — **AC-SEC-01**
    3. `SELECT id FROM tenants WHERE status = 'active'` via cliente privilegiado
    4. `$disconnect()` do cliente privilegiado em bloco `finally` **ANTES** do loop (AC-SEC-01)
    5. Para cada tenant: `RequestContext.run({ tenantId }, () => withTenantTx(...))` — NUNCA passa `tenantId` como parâmetro
    6. Per-tenant: batch de 100 participantes via paginação por cursor (`take: 100, cursor, skip: 1`)
    7. Per-participante-por-grupo: `evasionDetectionService.evaluateParticipant(participantId, groupId)`
    8. Skip+retry por tenant (erro de 1 tenant não aborta os outros)
    9. Métricas finais via Pino: `{ job.duration_ms, job.tenants_processed, job.participants_flagged, correlationId }`
    10. Gravar em `EvasionJobLog`: `{ jobRunId: correlationId, status, durationMs, tenantsProcessed, participantsFlagged, tenantId: null }`
  - `worker.on('failed')`: após `attemptsMade === 3` → log Pino `level:error` + insert em `EvasionJobLog` com `status='failed'` (CHK032)

### 6.2 Registrar processor no `ReportsModule` [crit]

- [x] Registrar `DetectEvasionRiskProcessor`, `EvasionDetectionService`, `EvasionRiskRepository`, `PastoralRiskEventPublisher` nos providers do `ReportsModule`
- [x] Garantir que `BullModule.registerQueue({ name: REPORTS_QUEUE_NAME })` já está configurado (ou adicionar se ausente)
- [x] Verificar que `PastoralModule` está importado em `ReportsModule` (para acesso a `RadarStatusRepository`)

### 6.3 Testes do processor [imp]

- [x] Criar `apps/api/src/reports/jobs/detect-evasion-risk.processor.spec.ts`:
  - Caso: cliente privilegiado é `$disconnect()`-ado ANTES do loop per-tenant (AC-SEC-01)
  - Caso: erro num tenant não aborta os demais (skip+retry)
  - Caso: SLA — mock de 1000 participantes processa em < 30min (assertiva de throughput)
  - Caso: correlationId é o mesmo UUID v7 para todos os tenants do mesmo run (CHK030-RES)

---

## FASE 7 — Recesso de Grupo (FR66-05) [crit]

> Depende de: FASE 1 (M2) + FASE 2 (UpdateGroupRequestSchema estendido).

### 7.1 `GroupsService.update()` — lógica de recesso e auto-resume [crit]

- [x] Editar `apps/api/src/groups/groups.service.ts` → `update(id, dto)`:
  - Ao receber `status: 'on_break'` + `breakUntil`: gravar ambos (migration M2)
  - Validar que `breakUntil > now()` (não pode marcar recesso no passado)
  - **Auto-resume:** no início do update (e no processor do job), checar se `status='on_break' AND breakUntil < now()` → transicionar automaticamente para `'active'`
  - NUNCA passa `tenantId` como parâmetro — usa `AsyncLocalStorage` (regra absoluta)
- [x] Criar ou estender teste unitário `apps/api/src/groups/groups.service.spec.ts`:
  - Caso: POST recesso com `breakUntil` futuro → grava OK
  - Caso: POST recesso sem `breakUntil` → erro validação (Zod refine)
  - Caso: auto-resume quando `breakUntil` já passou → transiciona para `active`
  - Caso: ausências durante período de recesso não contam (CHK017)

### 7.2 Estender `GroupsController` com validação de role [imp]

- [x] Confirmar que `@Patch(':id')` em `GroupsController` usa `ZodValidationPipe(UpdateGroupRequestSchema)` — já validado (C3 resolvido), apenas verificar que a extensão do schema Zod (task 2.2) é carregada corretamente
- [x] Verificar guard de role: apenas líder/pastor pode marcar recesso (não membro)
- [x] Adicionar Swagger `@ApiBody` para documentar os novos campos `status` e `breakUntil`

---

## FASE 8 — Domain Events Publisher [imp]

> Depende de: FASE 3 + FASE 5 + FASE 6.

### 8.1 Integrar emissão de `risk-detected` no job [imp]

- [x] No `EvasionDetectionService.evaluateParticipant()`: após gravar mudança de status via `upsertRisk()`, chamar `pastoralRiskEventPublisher.publishRiskDetected(event)`
- [x] Garantir dedup Redis antes de publicar: `rt:risk-detected:{tenantId}:{participantId}:{groupId}:{yyyy-mm-dd}` (TTL 24h)
- [x] Validar envelope final contra `RiskDetectedEventSchema` (Zod `.parse()`) antes de publicar — falha de schema = log + skip (não aborta o job)
- [x] Criar teste unitário: dedup impede re-emissão no mesmo dia; novo dia permite re-emissão

### 8.2 Integrar emissão de `risk-resolved` na resolução [imp]

- [x] No `EvasionDetectionService.resolveRisk()`: chamar `pastoralRiskEventPublisher.publishRiskResolved(event)`
- [x] Validar envelope contra `RiskResolvedEventSchema` antes de publicar
- [x] Criar teste unitário: resolução emite evento com `resolvedBy: 'attendance' | 'platform_access'`

---

## FASE 9 — UI — Radar + CelebrationBanner + Care Timeline [imp]

> Depende de: FASE 5 (riskReason gravado no banco).

### 9.1 Radar UI — exibir `riskReason` no card do participante [imp]

- [x] Localizar componente de card do participante no Radar (`apps/web/src/...`)
- [x] Adicionar exibição de `riskReason` (texto pastoral PT-BR) ao lado do semáforo:
  - Mapeamento: `consecutive_absences` → "Ausências consecutivas ao grupo", `platform_inactivity` → "Inatividade na plataforma", `combined` → "Ausências e inatividade"
  - Texto em `apps/web/messages/pt-BR.json` (NÃO hardcode)
- [x] **a11y obrigatório:**
  - Semáforo = ícone + texto (não apenas cor) — contraste AA
  - `aria-live="polite"` para atualizações de status
  - Verificar com `axe-core` (scripts Epic 12)
- [x] Atualizar tipo na chamada de API (usar `ParticipantRiskReasonSchema` de `packages/types`)

### 9.2 `CelebrationBanner` — exibir no retorno do risco [imp]

> Reusar Epic 6-5 se disponível; caso contrário criar inline.

- [x] Identificar se `CelebrationBanner` já existe (Epic 6/7)
  - Se existe: reusar com `role="status"` + `aria-live="polite"`
  - Se não existe: criar `apps/web/src/components/pastoral/celebration-banner.tsx` com `role="status"`, `aria-live="polite"`, ícone + texto, contraste AA
- [x] Exibir banner quando status muda de vermelho→amarelo ou amarelo→verde
- [x] Texto em `pt-BR.json`: "Parabéns! {Nome} voltou para {status}" (vocabulário pastoral)
- [x] Testar com `axe-core` (componente isolado)

### 9.3 Care Timeline — registrar via `PastoralNote` (FR66-09) [imp]

> **CHK006 — Gap:** FR66-09 sem detalhamento de eventos/permissões.

- [x] **[CHK006]** Definir e documentar no `quickstart.md`:
  - **Eventos registrados:** `risk_detected` (status verde→amarelo ou amarelo→vermelho) + `risk_resolved` (status amarelo→verde ou vermelho→amarelo)
  - **Campos da PastoralNote:** `type: 'system_event'`, `content: { eventType, previousStatus, newStatus, riskReason, detectedAt }`, `authorId: null` (sistema), `visibility: 'leader_and_above'`
  - **Permissões:** líderes e pastores podem visualizar; apenas sistema pode criar (origem automática)
- [x] No `RadarStatusRepository.upsertRisk()` (task 5.3): após upsert, criar `PastoralNote` via `PastoralNoteService` (módulo Epic 7)
  - Verificar que `PastoralNoteService` está injetável em `ReportsModule` (ou via evento interno)
  - Alternativa: publicar evento interno `pastoral.note.create` para desacoplar módulos
- [x] Criar teste unitário: mudança de status → `PastoralNote` criada com campos corretos

---

## FASE 10 — Testes RLS, Segurança e E2E [crit]

> Depende de: TODAS as fases anteriores.

### 10.1 Teste de segurança: isolamento multi-tenant do job [crit]

- [x] Criar `apps/api/test/rls/evasion-job-isolation.spec.ts`:
  - Setup: 2 tenants (A e B) com participantes em risco
  - Verificar que o job processa tenant A sem vazar dados de B
  - Verificar que `EvasionJobLog` com `tenantId=null` é visível por ambos os tenants (policy `tenant_id IS NULL`)
  - Espelhar padrão de `multi-tenant-isolation.spec.ts`
  - Gotcha 13.2b: seed raw em `users`/`groups` inclui `updated_at = now()`

### 10.2 Teste RLS: `users.last_seen_at` isolamento por tenant [crit]

> **CHK025 — Gap obrigatório:** teste RLS de `users.last_seen_at` é MANDATÓRIO (tabela `users` tem RLS ativa confirmada).

- [x] **[CHK025]** Criar `apps/api/test/rls/users-lastseen.rls.spec.ts`:
  - Verificar que tenant A NÃO pode ler `last_seen_at` de usuário do tenant B
  - Verificar que UPDATE de `last_seen_at` respeita RLS (usuário só atualiza o próprio registro)
  - Validar contra Postgres real (`docker-compose.test.yml`)
  - Gotcha 13.2b: seed raw inclui `updated_at = now()`

### 10.3 Teste RLS: `groups.status`/`break_until` isolamento [crit]

- [x] Criar ou estender `apps/api/test/rls/groups.rls.spec.ts`:
  - Verificar que tenant A NÃO pode alterar `status`/`break_until` de grupo do tenant B
  - Verificar que policy de INSERT/UPDATE para `groups` cobre os novos campos

### 10.4 Teste de segurança: cliente privilegiado confinado (AC-SEC-01) [crit]

- [x] Em `apps/api/src/reports/jobs/detect-evasion-risk.processor.spec.ts` (task 6.3):
  - Adicionar assertiva explícita: `prismaPrivileged.$disconnect()` chamado ANTES do início do loop per-tenant
  - Verificar que nenhuma query de domínio roda via cliente privilegiado (mock spy)

### 10.5 Teste: cenário `manualOverrideAt` — guarda 24h (SC-04) [crit]

- [x] Em `evasion-detection.service.spec.ts` (task 5.2), adicionar cenários específicos de SC-04:
  - Caso: `manualOverrideAt` = now - 2h → guarda ativa, status NÃO sobrescrito
  - Caso: `manualOverrideAt` = now - 25h → guarda expirada, status sobrescrito normalmente
  - Caso: `manualOverrideAt` = null → sem guarda, status atualizado normalmente

### 10.6 Snapshot tests dos schemas Zod [crit]

- [x] Confirmar que `packages/types/src/__tests__/risk-event.snapshot.spec.ts` (task 2.1) passa
- [x] Confirmar que `packages/types/src/__tests__/group.snapshot.spec.ts` (task 2.2) atualizado passa
- [x] Rodar `pnpm --filter @metanoia/types test` — todos os snapshots verdes

---

## Notas de Implementação

### Gotchas e Anti-padrões

- **NUNCA** passar `tenantId` como parâmetro de função — sempre via `AsyncLocalStorage` (`RequestContext`)
- **NUNCA** usar `@default(uuid())` no Prisma — usar `uuidv7()` / `generateId()` para novas linhas
- **NUNCA** incluir PII nos domain events — apenas IDs
- `pnpm --filter @metanoia/api exec prisma generate` após cada migration (não `prisma generate` diretamente)
- `$disconnect()` do cliente privilegiado SEMPRE em bloco `finally` (AC-SEC-01)
- `LastSeenInterceptor`: fail-open obrigatório — Redis down não pode bloquear request

### Dependências Externas Confirmadas

- Epic 7 (`PastoralNote`, `RadarStatusRepository`) — status: existente
- BullMQ + Redis — status: existente (`queue:reports` já ativo em `refresh-tenant-views`)
- `RequestContext` + `withTenantTx` — status: existente
- `generateId()` / `uuidv7()` — status: existente

### Dependência Futura (Excluída desta Story)

- Epic 14 (Notificações): consumirá `pastoral.participant.risk-detected` — NÃO implementar nesta story
