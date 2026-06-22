# Research (Phase 0): health-check-integracoes

Todos os NEEDS_CLARIFICATION da spec foram resolvidos no `/clarify` (ver spec §Clarifications).
Este documento consolida as decisões técnicas com Decision / Rationale / Alternatives,
incluindo precedentes verificados no código real.

---

## Decision 1 — Probe Resend idempotente: `GET /domains` com timeout 5s

**Decision:** `ResendHealthPort.isHealthy()` faz `GET https://api.resend.com/domains`
com `Authorization: Bearer {RESEND_API_KEY}` e `AbortSignal.timeout(5000)`. Retorna
`true` em 2xx **ou** 4xx de autenticação (401/403 = endpoint alcançável, só credencial
inválida); `false` em 5xx ou timeout/erro de rede. A probe de health (service) classifica:
2xx → healthy; 4xx → degraded (`"API key invalid — connectivity confirmed"`); 5xx/timeout
→ unhealthy.

**Rationale:** `GET /domains` é idempotente e não consome quota. Conectividade é o sinal
relevante para o circuit breaker; distinguir "Resend down" (5xx) de "credencial errada"
(4xx) evita abrir o breaker por erro de config. Consistente com o comentário existente em
`email-circuit-breaker.service.ts` ("Opens when firstFailureAt > 5min — does NOT require
isHealthy() == false to open").

**Alternatives considered:**
- `POST /emails` dry-run → consome quota e tem risco de efeito colateral de envio. Rejeitado.
- Tratar 4xx como unhealthy → abriria o breaker por erro de credencial (falso negativo de
  disponibilidade). Rejeitado.

---

## Decision 2 — Single-execution multi-instância via Redis lock `SET NX EX`

**Decision:** O worker BullMQ adquire `SET rt:health-check:lock:integration 1 NX EX 270`
antes de rodar as probes. TTL 270s (4m30s) < ciclo de 5min garante liberação antes do
próximo tick. Se o lock falha (outra instância já roda), o worker faz `ack` silencioso
sem escrever. Job registrado como repeatable: `queue.add('integration-health-check', {},
{ repeat: { every: 300000 } })` no `onModuleInit` do `AdminHealthModule`.

**Rationale:** Blue-green deploy e múltiplas instâncias NestJS rodam workers BullMQ
concorrentes; sem lock, gravaria pontos duplicados em `integration_health_log`. `SET NX EX`
é o mutex idiomático Redis (atômico). TTL com margem cobre execução travada sem deadlock.
`BullMqService` expõe `createQueue`/`createWorker` (verificado em `detect-evasion-risk.processor.ts`
L43/L45) — **SEM FlowProducer** (carry do read-back loop / metricas-plataforma): não usar
flows, apenas queue+worker repeatable.

**Alternatives considered:**
- `@nestjs/schedule @Cron` → não tem coordenação multi-instância nativa; story proíbe. Rejeitado.
- BullMQ `repeatable` confiando só no jobId determinístico → o repeat dedup do BullMQ evita
  agendamento duplo do MESMO jobId, mas duas INSTÂNCIAS com workers separados ainda podem
  processar; lock é a barreira correta. Mantido o lock.

---

## Decision 3 — RLS platform-level via cliente privilegiado (`createPrivilegedClient()`)

**Decision:** `integration_health_log` sem `tenant_id`. RLS habilitada com
`platform_read ON integration_health_log FOR SELECT USING (true)`. Escrita exclusiva via
`createPrivilegedClient()` — instancia `new PrismaClient({ adapter: new PrismaPg({
connectionString: DATABASE_URL }) })` (usuário `metanoia_admin`, BYPASSRLS implícito) e
usa `$executeRawUnsafe` para o INSERT. **NÃO** usar `SET LOCAL app.current_role = 'service'`
(GUC inexistente no projeto). Nenhum `WITH CHECK` necessário (BYPASSRLS na escrita).

**Rationale:** Precedente direto verificado em `apps/api/src/reports/jobs/detect-evasion-risk.processor.ts`:
`createPrivilegedClient()` L97-100 (`new PrismaClient` com `DATABASE_URL` via ConfigService),
`insertJobLog` usa `$executeRawUnsafe` L270. O `evasion_job_log` (Story 13-3) é a tabela
platform-level homóloga. Leitura `USING(true)` é segura porque o acesso de aplicação está
restrito ao guard `@Roles('super_admin')` (autz na camada de app, não no banco para esta
tabela platform-level).

**Alternatives considered:**
- `tenant_id` nullable + policy `NULLIF` (padrão `audit_events`/`consent_records`) → adiciona
  coluna e policy WITH CHECK sem nenhum acesso tenant-scoped real. Mais complexo. Rejeitado em
  favor do padrão `evasion_job_log` (mais enxuto, já ratificado).
- GUC `app.current_role='service'` → não existe no projeto. Rejeitado.

**Evidência empírica (score 3):** `grep -n createPrivilegedClient apps/api/src/reports/jobs/detect-evasion-risk.processor.ts`
→ L97 `private createPrivilegedClient(): PrismaClient`, L98 `DATABASE_URL`, L100 `new PrismaClient`,
L270 `$executeRawUnsafe`.

---

## Decision 4 — Debounce anti-flapping em Redis (2 checks consecutivos)

**Decision:** Estado de debounce em Redis `rt:health-check:debounce:{integration_name}` →
`{ baselineStatus, candidateStatus, consecutiveCount, firstSeenAt }`, TTL 30 min. Notifica
apenas quando um status novo difere do baseline E persiste por 2 checks consecutivos (10 min).
Mudança transitória (1 check) atualiza o candidato sem notificar; retorno ao baseline reseta
o contador.

**Rationale:** Integrações oscilam (1 spike de latência > 5s). Notificar cada oscilação geraria
ruído para Super Admins. Estado em Redis (não no banco) evita query extra a cada job de 5 min.
TTL 30 min auto-expira em restart prolongado, recomeçando do baseline observado.

**Alternatives considered:**
- Persistir estado de debounce em coluna do banco → query extra por job; estado de controle não
  é dado de domínio. Rejeitado.
- Notificar em toda mudança → flapping/ruído. Rejeitado (é o problema que a feature resolve).

---

## Decision 5 — Resolução de Super Admins via Keycloak realm role

**Decision:** Adicionar `KeycloakAdminService.getUsersByRealmRole(roleName: string)` que faz
`GET {baseUrl}/roles/{roleName}/users` (baseUrl já é `${url}/admin/realms/${realm}`, getter
existente). Mapeia `keycloakId → userId` local via `prisma.client.user.findMany({ where: { id:
{ in: keycloakIds } } })` (non-RLS, padrão `super-admin-tenants.repository.ts`). Para cada
Super Admin, `NotificationsService.dispatch(...)` roda dentro de `requestContext.run({ tenantId:
<tenant do destinatário>, userId: 'system', requestId, correlationId }, cb)`.

**Rationale:** `super_admin` é **realm_role** do Keycloak, não está em `user_tenants.role`
(que só tem participante/lider/admin_tenant). `KeycloakAdminService` já fornece `getAdminToken()`
+ getter `baseUrl` (verificado: L22-26 do `keycloak-admin.service.ts`); o novo método reusa o
mesmo token cacheado e `fetch`. `requestContext.run` é o padrão verificado em
`detect-evasion-risk.processor.ts` L135 e `notifications.worker.ts` L112.

**Alternatives considered:**
- Query Prisma em `user_tenants` por role super_admin → role não existe nessa tabela. Rejeitado.
- Hardcode de IDs de super admin → frágil e não auditável. Rejeitado.

---

## Decision 6 — Reuso dos probes de infra do liveness + segurança da barreira de autz

**Decision (reuso):** Os probes de Redis/PostgreSQL/Keycloak/MinIO devem reaproveitar a lógica
de `apps/api/src/health/health.controller.ts` (checkDatabase/checkRedis/checkKeycloak/checkStorage)
onde possível, extraindo helpers compartilháveis em vez de reescrever. O liveness `GET /api/health`
**não é tocado** (escopo distinto: público, sem auth, sem histórico). O novo `health-check.service.ts`
adiciona medição de latência (`performance.now()`) e a probe Resend (inexistente no liveness).

**Decision (segurança — carry OWASP histórico):** A leitura de `integration_health_log` (dados
platform-level, cross-tenant por natureza) tem **barreira de autz ÚNICA**: o guard `@Roles('super_admin')`
na camada de aplicação. A RLS do banco é `USING(true)` (permissiva), portanto NÃO há segunda barreira
no banco para esta tabela. Isto é um padrão conhecido (idêntico ao finding de `metricas-plataforma`:
"single-barrier super_admin authz na MV cross-tenant"). **Defense-in-depth recomendado** e a ser
verificado no OWASP gate / convertido em AC no execute-task:
1. Garantir que `RolesGuard` está efetivamente aplicado (decorator `@Roles('super_admin')` + guard
   registrado) — testar 403 explicitamente (NFR-SEC-002).
2. `message` nas responses sanitizado: sem stack, sem URLs/hosts internos, sem `RESEND_API_KEY`
   (NFR-SEC-001).
3. Audit de acesso ao endpoint (correlation_id) para rastreabilidade.

**Rationale:** Reuso reduz superfície de bug e divergência entre probes. A barreira única de autz
é aceitável para um endpoint somente-leitura de status operacional (não expõe dado de tenant), mas
deve ser **explicitamente testada** (não confiar em RLS para esta tabela). Documentar evita o
mesmo achado reaparecer no OWASP gate sem contexto.

**Alternatives considered:**
- Reescrever probes do zero → duplicação e risco de divergência com o liveness. Rejeitado.
- RLS restritiva por role no banco para esta tabela → RLS do Postgres opera por tenant/sessão,
  não tem o conceito de realm_role do Keycloak; a autz por super_admin é naturalmente da camada de
  app. Mantido guard + USING(true) + teste 403 explícito.

---

## Decision 7 — Sparkline SVG inline (sem dependência nova)

**Decision:** `<LatencySparkline>` implementado como Client Component com SVG gerado em React
puro (polyline sobre 288 pontos normalizados), hover tooltip, `motion-safe`. NÃO adicionar
`@nivo/line`.

**Rationale:** `@nivo/line` adiciona ~200KB ao bundle para um gráfico simples de série única.
288 pontos renderizam trivialmente como `<polyline>`/`<path>` SVG. Menor bundle, controle total
de a11y (motion-safe, aria-label).

**Alternatives considered:**
- `@nivo/line` → peso de bundle desproporcional. Rejeitado.
- `recharts` → mesma objeção de peso. Rejeitado.

---

## Riscos & mitigações

| Risco | Mitigação |
|-------|-----------|
| Probe bate em produção durante teste/CI (host É produção) | NFR-TEST-001: `vi.mock`/nock para HTTP, fake clients Redis/PG, MSW no frontend. Cenário de teste explícito de "nenhuma chamada real". |
| Drift snake_case (worker raw SQL) vs camelCase (Prisma read) | Cenário "Roundtrip E2E" no quickstart valida payload real vs contrato; Convenções de Borda no plan.md fixam fonte da verdade. |
| Notificação duplicada por multi-instância | Redis lock `SET NX EX 270` (Decision 2). |
| Flapping gera ruído | Debounce 2-checks consecutivos (Decision 4). |
| Secret vaza em `message`/log | NFR-SEC-001: sanitização de `message`; `RESEND_API_KEY` nunca logado. |
| Autz de barreira única | Decision 6: teste 403 obrigatório + audit; convertido em AC no execute-task. |
