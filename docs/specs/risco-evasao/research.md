# Research — Story 13.3: Detecção de Risco de Evasão (FR66)

Cada decisão abaixo é ancorada em **sonda empírica** contra o código entregue (não memória).

## D1 — Mecanismo de listagem cross-tenant (LIÇÃO 13.2b)

**Sonda:** `apps/api/src/reports/jobs/refresh-tenant-views.processor.ts` → método `createPrivilegedClient()`.

**Evidência (literal):**
> Build a dedicated PRIVILEGED Prisma client (DATABASE_URL, role `metanoia` superuser). [...] The application role (`metanoia_app`, NOSUPERUSER) is neither the owner nor RLS-bypassing (FORCE ROW LEVEL SECURITY on base tables), so the refresh must run here.
> `const connectionString = this.configService.get('DATABASE_URL', { infer: true });`
> `finally { await privileged.$disconnect(); }`

**Decision:** o job `detect-evasion-risk` replica `createPrivilegedClient()` localmente, usa-o **apenas** para `SELECT id FROM tenants WHERE status='active'`, e descarta (`$disconnect`) antes de processar qualquer tenant. Processamento per-tenant usa o cliente da app com RLS via `withTenantTx`.

**Alternativa rejeitada:** `SuperAdminTenantsService.list()` — request-scoped, dependências pesadas (DemoDataService, AuditService, guards HTTP), inadequado para job headless.

## D2 — Injeção de tenant em job (RLS sem request HTTP)

**Sonda:** `apps/api/src/prisma/with-tenant-tx.ts`.

**Evidência (literal):**
> Tenant resolution: 1. `opts.tenantId` if provided. 2. `RequestContext.tenantId` from AsyncLocalStorage.
> `await tx.$executeRawUnsafe('SET LOCAL app.current_tenant_id = '...'')`
> `if (!UUID_RE.test(tenantId)) throw ... // defense-in-depth`

**Decision:** o job envolve cada tenant em `requestContext.run({ tenantId }, fn)` (FR66-01) e/ou passa `{ tenantId }` a `withTenantTx`. Conforme CLAUDE.md, `tenantId` só toca a fronteira de infraestrutura RLS, nunca assinaturas de domínio. `withTenantTx` já é usado por `tenant-selection.selectTenant` com `opts.tenantId` — precedente do projeto para chamadas pré-contexto.

## D3 — Modelos e campos reais (sonda contra schema.prisma)

**Sonda:** `apps/api/prisma/schema.prisma` linhas 167-196 (User), 264+ (Tenant), 339-365 (Group), 482-528 (RadarStatus/ParticipantRadarStatus).

| Model | Tabela | Campos confirmados | Falta (migration) |
|-------|--------|--------------------|--------------------|
| `User` | `users` | id (uuid), email, name, status, tenantId?, createdAt | **`last_seen_at`** |
| `Tenant` | `tenants` | id, **status** (default 'active'), plan | — (status já existe p/ filtro) |
| `Group` | `groups` | id, tenantId, name, dayOfWeek, time, recurrence, notes | **`status`, `break_until`** |
| `ParticipantRadarStatus` | `participant_radar_status` | id, tenantId, groupId, **participantId**, status (`RadarStatus`), trend, presencePercentage, lastActiveAt, calculatedAt; `@@unique([tenantId,groupId,participantId])` | **`risk_reason`** |
| `ParticipantStatusImproved` | `participant_status_improved` | previousStatus, newStatus, trend, seenAt, createdAt | — (reuso CelebrationBanner) |

`enum RadarStatus { verde, amarelo, vermelho }`, `enum RadarTrend { melhorando, estavel, declinio }`.

**Correção de memória:** a chave do radar é `participantId` (não `userId`); a unique é `(tenantId, groupId, participantId)`.

## D4 — RadarStatusRepository.upsert (extensão riskReason)

**Sonda:** `apps/api/src/pastoral/radar/radar-status.repository.ts`.

**Evidência (literal):**
> `async upsert(data: RadarStatusUpsertData): Promise<void>` — usa `withTenantTx` + raw `INSERT INTO participant_radar_status (...) VALUES (...)` (ON CONFLICT pela unique).

**Decision:** estender `RadarStatusUpsertData` com `riskReason: string | null` e adicionar a coluna no INSERT/UPDATE raw. Grava status + riskReason no mesmo upsert (C2). Idempotência preservada pela unique `(tenantId, groupId, participantId)`.

## D5 — LastSeenInterceptor (ponto de encaixe)

**Sonda:** `apps/api/src/auth/keycloak.guard.ts` (`KeycloakAuthGuard implements CanActivate, OnModuleInit`; popula `requestContext`), `apps/api/src/common/context/request-context.ts` (AsyncLocalStorage).

**Decision:** Interceptor global `APP_INTERCEPTOR` roda após o guard (ordem NestJS guards→interceptors). Lê `requestContext.getStore()`. Fire-and-forget no `tap()` do observable. Debounce Redis `SET cache:last-seen:{userId} 1 NX EX 900`. Erro engolido (best-effort). Não impacta latência da resposta.

**Alternativa rejeitada:** atualizar em eventos de presença/check-in (dec-006 escolheu interceptor global — cobre TODO acesso à plataforma, não só reuniões; "2 semanas sem acesso à plataforma" é mais amplo que presença).

## D6 — Domain event (padrão de emissão)

**Sonda:** `apps/api/src/meetings/events/meeting-event.service.ts` → BullMQ queue + `generateId()` (UUID v7) + Redis dedup (`DEDUP_TTL_SECONDS`).

**Decision:** `PastoralRiskEventPublisher` emite `pastoral.participant.risk-detected` no envelope canônico `{eventId, eventType, version, tenantId, timestamp, data, metadata}`. `data` = `{participantId, groupId, riskReason, status, detectedAt}` (sem PII). Dedup `rt:risk-detected:{tenant}:{participant}:{group}:{date}`. Consumidor = Epic 14 (não implementado aqui).

## D7 — Job log (alerta após 3 falhas)

**Sonda:** `refresh-tenant-views.processor.ts` usa `mvRefreshLog` (model com `tenantId: null` permitido por RLS) + BullMQ `attempts: 3`, `backoff exponential 30s`.

**Decision:** criar `EvasionJobLog` (model leve, `tenant_id NULL` permitido) para métricas/alerta, sem acoplar à semântica de relatório. Alerta Super Admin = log Pino `level:error` no `worker.on('failed')` após `attemptsMade === 3`.

## D8 — UpdateGroupRequestSchema (extensão)

**Sonda:** `packages/types/src/group.ts` linha 50 — `z.object({...}).refine(len>0)`. Há snapshot test em `packages/types/src/__tests__/group.snapshot.spec.ts`.

**Decision:** adicionar `status` (`z.enum(['active','on_break']).optional()`) e `breakUntil` (`z.string().datetime().nullable().optional()`) + `.refine` para exigir `breakUntil` quando `status='on_break'`. Estender snapshot test (gate contra breaking change).

## D-MANUAL — Guarda de não-sobrescrita (24h)

**Sonda:** `ParticipantRadarStatus` não tem coluna de origem manual; tem `calculatedAt`/`updatedAt`(via @updatedAt? — verificar). `ParticipantStatusImproved` registra transições positivas.

**Decision (conservadora):** o job aplica guarda temporal "não recalcular se houve update nas últimas 24h divergente do esperado". A marcação precisa de origem manual será verificada contra a rota de override pastoral do Epic 7 na fase execute-task (sub-dependência de baixo risco). Se a rota não distinguir origem, considerar adicionar `manualOverrideAt` (escopo incremental, documentado, não bloqueia o plano). **Não reabre decisão de produto** — é detalhe de implementação.
