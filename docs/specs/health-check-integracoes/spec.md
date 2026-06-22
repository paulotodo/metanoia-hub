# Spec: health-check-integracoes

**Feature:** Story 14-4 — Health Check de Integrações & Dashboard Super Admin (NFR-I5)
**Versão:** 1.0.0
**Status:** clarified
**Autor:** agente-00c-feature-orchestrator (onda-001)

---

## Overview

Implementa visibilidade operacional sobre as cinco integrações externas do Metanoia Hub:
Resend (email), Keycloak (auth), MinIO (storage), Redis (cache/jobs) e PostgreSQL (banco).

O sistema consiste em:
1. **Backend** — probes periódicas via BullMQ repeatable job (a cada 5 min), endpoint REST restrito a Super Admin, persistência de histórico para sparkline 24h e notificação com anti-flapping para Super Admins.
2. **Frontend** — dashboard `/app/admin/health` com painel por integração, badge de status, sparkline de latência 24h, auto-refresh 60s e histórico detalhado por clique.
3. **Integração com circuit breaker** — `ResendHealthPort` (implementação real de `EmailHealthPort`) fecha o loop da Story 14-3 que deixou `StubEmailHealthPort` sempre-healthy.

### Contexto: o host de PRODUÇÃO

**CRÍTICO:** o ambiente de desenvolvimento desta feature (`/var/lib/metanoia-hub`) **é** o servidor de produção Traefik/metanoia-prod-* rodando nas portas 8090–8094 / 7880–7882. Probes de health-check em testes e CI **DEVEM ser mocadas** via `jest.mock` / Vitest `vi.mock` / MSW. NUNCA bater contra os serviços `metanoia-prod-*` em qualquer suíte de teste.

---

## Escopo desta feature

### O que existe e NÃO será recriado

- `apps/api/src/health/health.controller.ts` — liveness probe pública (`GET /api/health`) com checkDatabase/checkRedis/checkKeycloak/checkStorage. **NÃO tocar** — escopo distinto (ops infra, sem auth, sem histórico).
- `apps/api/src/health/health.module.ts` — módulo da liveness probe pública.
- `apps/api/src/notifications/` — toda a infraestrutura de notificações da Story 14-1/14-3: `NotificationsService.dispatch()`, `NotificationsModule`, `EmailCircuitBreakerService`, `EmailRateLimiterService`.
- `apps/api/src/notifications/ports/email-health.port.ts` — interface `EmailHealthPort`, token `EMAIL_HEALTH_PORT`, stub `StubEmailHealthPort`. Esta feature **substitui** o stub mas NÃO altera a interface.
- `apps/api/src/bullmq/bullmq.module.ts` + `bullmq.service.ts` — global, já disponível.
- `apps/api/src/audit/audit.service.ts` — `AuditService.create()` — pronto para uso.

### O que será implementado

**Backend `apps/api/src/admin/health/`** (novo módulo `AdminHealthModule`):
1. `ResendHealthPort` — implementação real de `EmailHealthPort` (probe `GET /domains` com timeout 5s).
2. Cinco probes com classificação healthy/degraded/unhealthy e medição de latência.
3. BullMQ repeatable job a cada 5 min com single-execution via Redis lock.
4. Persistência em `integration_health_log` (ver §Decisão D-001 sobre multi-tenancy).
5. Endpoint `GET /api/v1/admin/health/integrations` com guard `@Roles('super_admin')`.
6. Lógica de debounce anti-flapping: notificação apenas se status novo persistir 2 checks consecutivos (10 min).
7. Evento `system.integration.status-changed` e log no audit.

**Backend `apps/api/src/notifications/`** (alteração cirúrgica):
8. Substituir provider `EMAIL_HEALTH_PORT` de `StubEmailHealthPort` para `ResendHealthPort` em `NotificationsModule`.

**Frontend `apps/web/app/(authenticated)/admin/health/`** (novo):
9. Página `page.tsx` (Client Component) com painel por integração.
10. Sparkline de latência 24h (288 pontos @ 5 min).
11. Auto-refresh 60s + indicador stale > 2 min.
12. Histórico detalhado com erros ao clicar.

**Pacote de tipos `packages/types/`**:
13. Schemas Zod para `IntegrationHealthStatus`, `IntegrationHealthResponse`, `IntegrationHealthLog`, `IntegrationStatusChangedEvent`.

**Migração Prisma**:
14. `integration_health_log` + RLS (ver §Decisão D-001).

---

## Decisões arquiteturais

### D-001: Multi-tenancy de `integration_health_log` — tabela platform-level com `tenant_id = NULL` e RLS permissivo para Super Admin

**Contexto:** A regra geral do projeto exige `tenant_id` em toda tabela com RLS. Porém, `integration_health_log` registra a saúde das **integrações da plataforma** (não de um tenant específico). Não existe um tenant dono do dado; o dado pertence ao operador da plataforma.

**Precedentes no projeto:**
- `AuditEvent` usa `tenant_id` obrigatório mas Super Admin lê cross-tenant via `prisma.client` (bypassando RLS, `dec-015`).
- `ConsentRecord` usa `tenant_id String?` (nullable) com a nota "Tenant-scoped (RLS NULLIF — same pattern as audit_events)".
- Story 13-3 (`add_evasion_job_log`) criou `evasion_job_log` sem tenant_id, com acesso plataforma-level.

**Decisão:** `integration_health_log` **NÃO terá `tenant_id`**. É uma tabela de plataforma pura. A política RLS segue o padrão canônico `evasion_job_log` (Story 13-3) — **cliente privilegiado** para escrita, política USING para leitura:

```sql
-- RLS canônico do projeto (padrão privileged client): tabela de plataforma sem tenant_id.
-- Leitura: visibilidade global (sem filtragem por tenant — tabela de plataforma).
ALTER TABLE integration_health_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_read ON integration_health_log
  FOR SELECT USING (true);
-- Escrita: somente via cliente privilegiado (DATABASE_URL — metanoia_admin BYPASSRLS).
-- NÃO usar SET LOCAL app.current_role = 'service' — GUC inexistente no projeto.
```

O worker escreve via `createPrivilegedClient()` (padrão idêntico ao `detect-evasion-risk.processor.ts` L97–101 + `insertJobLog` L269–282): instancia `new PrismaClient` com `DATABASE_URL` (não `DATABASE_APP_URL`) e usa `$executeRawUnsafe` diretamente. O cliente `metanoia_admin` tem BYPASSRLS implícito — nenhum `WITH CHECK` necessário para o INSERT.

O endpoint `GET /api/v1/admin/health/integrations` será protegido por guard `@Roles('super_admin')` na camada de aplicação — a RLS de banco (`platform_read USING (true)`) garante leitura a qualquer usuário autenticado que passe pelo guard.

**Score:** 3 — precedente direto: `evasion_job_log` migration `20260626000004_13-3` + `detect-evasion-risk.processor.ts` `createPrivilegedClient()` + `super-audit.controller` BYPASSRLS via `prisma.client`. Evidência: `createPrivilegedClient()` cria `new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) })` — sem SET LOCAL; `insertJobLog` usa `$executeRawUnsafe` via cliente privilegiado.

### D-002: `ResendHealthPort` usa `GET /domains` com timeout 5s e AbortSignal

**Contexto:** A story sugere `POST /emails` dry-run ou `GET /domains`. `POST /emails` consomeria quota de envio mesmo em dry-run e existe risco de efeito colateral não intencional. `GET /domains` é idempotente, não produz efeitos, e um status 200/401/403/200 já valida a conectividade com o endpoint Resend.

**Decisão:** Usar `GET https://api.resend.com/domains` com `Authorization: Bearer {RESEND_API_KEY}` e `AbortSignal.timeout(5000)`. Status 2xx = healthy. 4xx (401, 403) = API key inválida, mas a conectividade existe; reportar como degraded com `message = "API key invalid — connectivity confirmed"`. 5xx ou timeout = unhealthy.

**Integração com `EmailCircuitBreakerService`:** `ResendHealthPort.isHealthy()` retorna `true` se status 2xx ou 4xx de autenticação (conectividade OK). Retorna `false` apenas em 5xx ou timeout (serviço Resend indisponível). Esta semântica é consistente com o comentário existente em `email-circuit-breaker.service.ts`: "Opens when: Date.now() - firstFailureAt > 5 minutes (300000ms) — Does NOT require isHealthy() == false to open."

### D-003: BullMQ repeatable job com single-execution via Redis lock

**Contexto:** Múltiplas instâncias do NestJS (ex: blue-green deploy) podem ter workers BullMQ rodando. Um job repetível sem lock pode gerar múltiplas execuções simultâneas, gravando dados duplicados em `integration_health_log`.

**Decisão:** Usar Redis `SET NX EX` como mutex de single-execution:
- Chave: `rt:health-check:lock:integration` com TTL de 4 min 30s (270s — margem antes do próximo ciclo de 5 min).
- Se o lock não puder ser adquirido (outra instância já executa), o worker faz `ack` silencioso sem gravar.
- O job é enfileirado como BullMQ repeatable com `every: 300000` (5 min em ms) via `createQueue` + `queue.add('integration-health-check', {}, { repeat: { every: 300000 } })`.

### D-004: Debounce anti-flapping — 2 checks consecutivos (10 min)

**Contexto:** Integrações podem oscilar transientemente (ex: Resend com latência > 5s por 1 check). Notificar a cada oscilação geraria ruído para Super Admins.

**Decisão:** Estado de debounce persiste no Redis (não no banco) para evitar uma query extra a cada job:
- Chave: `rt:health-check:debounce:{integration_name}` → `{ status, consecutiveCount, firstSeenAt }`.
- Ao completar um check, compara o status novo com o status anterior no Redis:
  - Se mudou: `consecutiveCount = 1`, gravar novo status sem notificar.
  - Se igual: `consecutiveCount++`.
  - Se `consecutiveCount >= 2` E status diferente do status "estável" registrado: notificar.
- A chave tem TTL de 30 min para auto-expirar em caso de restart prolongado.

### D-005: Sparkline — 288 pontos via query com bucket de 5 min

**Contexto:** 24h / 5 min = 288 pontos. A query precisa ser eficiente com o index `(integration_name, checked_at DESC)`.

**Decisão:** Endpoint separado `GET /api/v1/admin/health/integrations/history?integration={name}&hours=24` retorna os últimos 288 registros de `integration_health_log` ordenados por `checked_at DESC`. O frontend usa TanStack Query para cache. Latência esperada: < 50ms com index.

### D-006: Tipo de gráfico — SVG inline sem dependência nova

**Contexto:** `@nivo/line` adiciona ~200KB ao bundle e requer `"use client"`. SVG inline pode ser gerado por um pequeno helper React com performance superior para 288 pontos.

**Decisão:** Implementar `<LatencySparkline>` como componente Client Component com SVG gerado em React puro. Não adicionar `@nivo/line` ao bundle. Se a complexidade do SVG se revelar proibitiva durante o plan, reavaliar no clarify de plan.

---

## Requisitos funcionais

### FR-001: Modelo Prisma `IntegrationHealthLog`

```prisma
/// IntegrationHealthLog — plataforma-level (sem tenant_id, ver D-001).
/// Worker escreve via conexão privilegiada. Endpoint lido por Super Admin via guard.
model IntegrationHealthLog {
  id              String   @id @db.Uuid
  integrationName String   @map("integration_name") @db.VarChar(64)
  status          IntegrationHealthStatus
  latencyMs       Int      @map("latency_ms")
  message         String?  @db.Text
  checkedAt       DateTime @default(now()) @map("checked_at") @db.Timestamptz

  @@index([integrationName, checkedAt(sort: Desc)], name: "integration_health_log_name_checked_idx")
  @@map("integration_health_log")
}

enum IntegrationHealthStatus {
  healthy
  degraded
  unhealthy

  @@map("integration_health_status")
}
```

- ID: UUID v7 via `uuidv7()` (NUNCA `@default(uuid())`).
- Migration: `apps/api/prisma/migrations/YYYYMMDD_14-4-integration-health-log/migration.sql`.
- RLS: conforme D-001. RLS spec: `apps/api/prisma/rls/integration-health-log.rls-spec.ts`.

### FR-002: Cinco probes com classificação de status

| Integração | Probe | Endpoint/Comando | Timeout |
|------------|-------|------------------|---------|
| Resend | HTTP GET | `https://api.resend.com/domains` (header Auth) | 5s |
| Keycloak | HTTP GET | `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration` | 5s |
| MinIO | HTTP HEAD | `${MINIO_ENDPOINT}/minio/health/live` | 5s |
| Redis | PING | `redis.ping()` | 3s (via RedisService timeout) |
| PostgreSQL | SELECT | `prisma.$queryRaw\`SELECT 1\`` | 3s |

Classificação de latência (aplicada ao `latencyMs` medido):
- `healthy`: `latencyMs < 1000`
- `degraded`: `1000 <= latencyMs <= 5000`
- `unhealthy`: `latencyMs > 5000` **ou** qualquer erro/timeout

Cada probe: mede com `performance.now()` (início → fim), não inclui tempo de setup de conexão reutilizada. Em erro: `status = 'unhealthy'`, `latencyMs = tempo até o erro`, `message = mensagem sanitizada` (sem stack, sem secrets, sem IPs internos).

### FR-003: Endpoint `GET /api/v1/admin/health/integrations`

**Request:** nenhum parâmetro de body ou query obrigatório.

**Auth:** `KeycloakAuthGuard` + `@Roles('super_admin')` → 403 para qualquer outro role.

**Response (200):**
```json
{
  "data": {
    "integrations": [
      {
        "name": "resend",
        "status": "healthy",
        "latencyMs": 142,
        "lastChecked": "2026-06-22T03:44:08Z",
        "message": null
      }
    ],
    "summary": {
      "total": 5,
      "healthy": 4,
      "degraded": 1,
      "unhealthy": 0
    }
  }
}
```

O endpoint **executa** as probes on-demand (não lê apenas do banco). Isso garante dados frescos ao abrir o dashboard. O banco é fonte do histórico (sparkline), não do status imediato.

**Response (403):**
```json
{ "statusCode": 403, "error": "Forbidden", "message": "Acesso negado" }
```

### FR-004: Endpoint `GET /api/v1/admin/health/integrations/history`

**Query params:**
- `integration` (string, required): nome da integração (`resend`, `keycloak`, `minio`, `redis`, `postgresql`).
- `hours` (integer, optional, default=24, max=72): janela de histórico.

**Auth:** igual ao FR-003.

**Response (200):**
```json
{
  "data": {
    "integration": "resend",
    "points": [
      { "checkedAt": "2026-06-22T03:44:00Z", "status": "healthy", "latencyMs": 142, "message": null }
    ]
  },
  "meta": { "total": 288, "integration": "resend", "hours": 24 }
}
```

Ordenação: `checkedAt DESC`. Máximo: `hours * 12` pontos (12 checks/hora @ 5 min).

### FR-005: BullMQ repeatable job com single-execution

- Queue name: `queue:integration-health-check`.
- Job name: `integration-health-check`.
- Schedule: `{ repeat: { every: 300000 } }` (5 min em ms).
- Worker: `IntegrationHealthProcessor` implementa `Processor` via `BullMqService.createWorker(...)`.
- Redis lock: `SET rt:health-check:lock:integration 1 NX EX 270` antes de executar probes.
- Se lock falhar (outra instância): ack silencioso, sem escrita.
- `onModuleInit` do `AdminHealthModule` registra o job repeatable no NestJS bootstrap.

### FR-006: Debounce de notificação (anti-flapping)

Algoritmo:
1. Após cada check, recuperar estado anterior do Redis: `GET rt:health-check:debounce:{name}`.
2. Comparar status novo com o `baselineStatus` persistido (status antes da mudança atual).
3. Se status mudou em relação ao baseline:
   - Atualizar chave com `{ status: novoStatus, consecutiveCount: 1, firstSeenAt: now }`, TTL 30 min.
   - NÃO notificar ainda.
4. Se status igual ao que está sendo rastreado (não-baseline):
   - Incrementar `consecutiveCount`.
   - Se `consecutiveCount >= 2`: notificar → emitir evento → criar notificação → audit.
   - Atualizar `baselineStatus` para o novoStatus.
5. Se status voltou ao baseline: resetar contador.

### FR-007: Evento de domínio e notificação para Super Admins

Ao acionar a notificação (FR-006):

**Evento de domínio** (via Redis pub/sub, canal `rt:notifications:integration-status-changed`):
```json
{
  "eventId": "<uuidv7>",
  "eventType": "system.integration.status-changed",
  "version": 1,
  "tenantId": null,
  "timestamp": "<ISO 8601>",
  "data": {
    "integrationName": "resend",
    "previousStatus": "healthy",
    "newStatus": "unhealthy",
    "latencyMs": 5432,
    "consecutiveChecks": 2
  },
  "metadata": { "correlationId": "<uuidv7>" }
}
```

**Notificação para Super Admins:**
- Buscar todos os usuários com role `super_admin` via **Keycloak Admin API** (`KeycloakAdminService`): `GET /admin/realms/{realm}/roles/super_admin/users`. `super_admin` é `realm_role` do Keycloak — não está em `user_tenants.role` (que só tem `participante/lider/admin_tenant`). Adicionar método `getUsersByRealmRole(roleName: string)` ao `KeycloakAdminService`. Com os `keycloakId` retornados, buscar `userId` locais via `prisma.client.user.findMany({ where: { id: { in: keycloakIds } } })` (non-RLS, padrão `super-admin-tenants.repository.ts`).
- Para cada super admin: chamar `NotificationsService.dispatch({ userId, type: 'system', channels: ['in_app'], title: '⚠️ {integrationName} está {status}', body: 'Latência: {latencyMs}ms | Verificado: {lastChecked}', metadata: { correlationId } })` dentro de `requestContext.run()` com o `tenantId` do destinatário.
- **`RequestContext` no worker**: inicializar `requestContext.run({ tenantId, userId: 'system', requestId: generateId(), correlationId }, async () => { ... })` — padrão idêntico ao `NotificationsWorker` (`notifications.worker.ts` L112–139) e `DetectEvasionRiskProcessor` (L135–146). Para operações de plataforma sem tenant (ex: INSERT no `integration_health_log`), usar `createPrivilegedClient()` diretamente (sem `requestContext`). Para o `dispatch()` de cada Super Admin, rodar dentro de `requestContext.run({ tenantId: superAdminTenantId, ... })`.

**Audit log:**
```typescript
await auditService.create({
  userId: null, // sistema
  action: 'INTEGRATION_STATUS_CHANGED',
  resource: 'integration_health',
  resourceId: integrationName,
  ipAddress: 'system',
  userAgent: 'health-check-worker',
  newState: { integrationName, previousStatus, newStatus, latencyMs }
});
```

### FR-008: `ResendHealthPort` (implementação real de `EmailHealthPort`)

```typescript
// apps/api/src/admin/health/resend-health.port.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailHealthPort } from '../../notifications/ports/email-health.port';

@Injectable()
export class ResendHealthPort implements EmailHealthPort {
  constructor(private readonly configService: ConfigService) {}

  async isHealthy(): Promise<boolean> {
    try {
      const apiKey = this.configService.get('RESEND_API_KEY');
      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      // 2xx = healthy; 4xx = conectividade OK mas auth issue (still reachable)
      return response.ok || (response.status >= 400 && response.status < 500);
    } catch {
      return false;
    }
  }
}
```

Substituição em `NotificationsModule`:
```typescript
// Antes: { provide: EMAIL_HEALTH_PORT, useClass: StubEmailHealthPort }
// Depois:
{ provide: EMAIL_HEALTH_PORT, useClass: ResendHealthPort }
```

`ResendHealthPort` deve ser importado do `AdminHealthModule` ou fornecido diretamente no `NotificationsModule` importando `AdminHealthModule`.

### FR-009: Schema Zod em `packages/types`

```typescript
// packages/types/src/integration-health.ts
import { z } from 'zod';

export const IntegrationHealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);
export type IntegrationHealthStatus = z.infer<typeof IntegrationHealthStatusSchema>;

export const IntegrationHealthItemSchema = z.object({
  name: z.string(),
  status: IntegrationHealthStatusSchema,
  latencyMs: z.number().int().nonnegative(),
  lastChecked: z.string().datetime(),
  message: z.string().nullable().optional(),
});
export type IntegrationHealthItem = z.infer<typeof IntegrationHealthItemSchema>;

export const IntegrationHealthSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  healthy: z.number().int().nonnegative(),
  degraded: z.number().int().nonnegative(),
  unhealthy: z.number().int().nonnegative(),
});

export const IntegrationHealthResponseSchema = z.object({
  data: z.object({
    integrations: z.array(IntegrationHealthItemSchema),
    summary: IntegrationHealthSummarySchema,
  }),
});
export type IntegrationHealthResponse = z.infer<typeof IntegrationHealthResponseSchema>;

export const IntegrationHealthHistoryPointSchema = z.object({
  checkedAt: z.string().datetime(),
  status: IntegrationHealthStatusSchema,
  latencyMs: z.number().int().nonnegative(),
  message: z.string().nullable().optional(),
});
export type IntegrationHealthHistoryPoint = z.infer<typeof IntegrationHealthHistoryPointSchema>;
```

### FR-010: Dashboard frontend `/app/admin/health`

**Rota:** `apps/web/app/(authenticated)/admin/health/page.tsx` — Client Component (`'use client'`).

**Componentes:**
- `<IntegrationHealthCard>` — painel por integração: nome, badge colorido (verde/amarelo/vermelho), latência em ms, "Verificado há X min".
- `<LatencySparkline data={points}>` — SVG inline 288 pontos, hover tooltip com valor exato e timestamp, `motion-safe` (não anima se `prefers-reduced-motion: reduce`).
- `<HealthDashboard>` — container principal com auto-refresh via `setInterval(60000)` e indicador "Atualizado há X segundos" / alerta visual se stale > 2 min.
- `<IntegrationHistoryModal>` — modal ou drawer com histórico detalhado (tabela de logs com status, latência, mensagem de erro, timestamp).

**Estado e dados:**
- TanStack Query (`useQuery`) para `GET /api/v1/admin/health/integrations` com `staleTime: 55000` (ligeiramente abaixo do refresh de 60s).
- `refetchInterval: 60000` no useQuery (auto-refresh).
- `useQuery` separado para histórico por integração (disparado ao clicar).
- Zustand: não necessário — estado de UI local (modal aberto, integração selecionada) via `useState`.

**UI/UX:**
- Badge: `bg-green-500` (healthy), `bg-yellow-500` (degraded), `bg-red-500` (unhealthy).
- Alerta stale: banner amarelo "Dados podem estar desatualizados" se `Date.now() - lastRefreshed > 120000`.
- i18n: textos em `apps/web/messages/pt-BR.json` sob chave `health.integrations.*`.
- a11y: `aria-live="polite"` no container de status, `role="status"` no indicador de refresh, `focus-ring` visível, contraste WCAG AA.

**Vocabulário pastoral PT-BR:**
```json
{
  "health": {
    "integrations": {
      "title": "Saúde das Integrações",
      "subtitle": "Monitoramento das integrações externas da plataforma",
      "status": {
        "healthy": "Saudável",
        "degraded": "Degradado",
        "unhealthy": "Indisponível"
      },
      "lastUpdated": "Atualizado há {seconds}s",
      "staleWarning": "Dados podem estar desatualizados",
      "integrationNames": {
        "resend": "E-mail (Resend)",
        "keycloak": "Autenticação (Keycloak)",
        "minio": "Armazenamento (MinIO)",
        "redis": "Cache (Redis)",
        "postgresql": "Banco de Dados (PostgreSQL)"
      }
    }
  }
}
```

---

## Requisitos não funcionais

### NFR-I5 (origem da story): Probes em < 6s total

Todas as probes rodam com `Promise.all()` (paralelas). Timeout individual de 5s por probe HTTP + 3s para Redis/PostgreSQL. Caso alguma probe trave, `AbortSignal.timeout()` garante que a execução total não ultrapasse ~6s.

### NFR-SEC-001: Secrets não vazam em logs ou responses

- `RESEND_API_KEY` nunca em logs (mesmo pattern de `EmailService`).
- `message` nas responses não inclui stack traces, URLs internas ou nomes de host de infraestrutura.
- O endpoint retorna apenas: `{ name, status, latencyMs, lastChecked, message? }`.

### NFR-SEC-002: Guard de 403 para não-Super-Admin

`GET /api/v1/admin/health/integrations` e `GET /api/v1/admin/health/integrations/history` têm `KeycloakAuthGuard` + `RolesGuard(@Roles('super_admin'))`. Retorna 403 para outros roles mesmo que autenticados.

### NFR-TEST-001: Probes NUNCA batem em produção durante testes

- Backend: todos os probes HTTP (`fetch`, `redis.ping()`, `prisma.$queryRaw`) devem ser mockados via `vi.mock` ou injeção de dependência no módulo de testes.
- Frontend: MSW intercepta as chamadas à API.
- CI: sem conexão real a serviços externos.

---

## Estrutura de arquivos

```
apps/api/src/admin/health/
├── admin-health.module.ts
├── health-check.service.ts          # probes + classificação
├── health-check.controller.ts       # GET /integrations + /integrations/history
├── health-check.processor.ts        # BullMQ worker (repeatable job)
├── resend-health.port.ts            # implementação real de EmailHealthPort
├── dto/
│   ├── integration-health-response.dto.ts
│   └── integration-history-query.dto.ts
└── __tests__/
    ├── health-check.service.spec.ts
    ├── health-check.controller.spec.ts
    ├── health-check.processor.spec.ts
    └── resend-health.port.spec.ts

apps/api/prisma/
├── migrations/YYYYMMDD_14-4-integration-health-log/migration.sql
└── rls/integration-health-log.rls-spec.ts

packages/types/src/
└── integration-health.ts

apps/web/app/(authenticated)/admin/health/
├── page.tsx                         # Client Component — container
├── _components/
│   ├── integration-health-card.tsx
│   ├── latency-sparkline.tsx        # SVG inline
│   ├── health-dashboard.tsx
│   └── integration-history-modal.tsx
└── _hooks/
    └── use-integration-health.ts    # TanStack Query hooks

apps/web/e2e/
└── admin-health.e2e-spec.ts
```

---

## Testes requeridos

| Tipo | Arquivo | Cobertura |
|------|---------|-----------|
| Unit | `health-check.service.spec.ts` | probe mock healthy/degraded/unhealthy; boundary 999ms/1001ms/5001ms; erro de rede → unhealthy |
| Unit | `health-check.processor.spec.ts` | single-execution com Redis lock (2 instâncias simuladas); flapping: 5 alternâncias → max 2-3 notificações (debounce); job repeatable registrado |
| Unit | `health-check.controller.spec.ts` | 200 com summary correto; 403 para não-super-admin |
| Unit | `resend-health.port.spec.ts` | 200 → true; 401 → true; 500 → false; timeout → false |
| Integration | `integration-health-log.rls-spec.ts` | worker escreve; super_admin lê; tenant normal não lê |
| E2E | `admin-health.e2e-spec.ts` | dashboard com badges; sparkline renderizado (SVG presente); auto-refresh disparado; stale indicator > 2 min; click → modal com histórico |

---

## Dependências

| Dependência | Status | Observação |
|-------------|--------|-----------|
| Story 14-1 (NotificationsService) | concluída | `dispatch()` disponível |
| Story 14-3 (EmailHealthPort interface) | concluída | `StubEmailHealthPort` ativo; esta feature substitui |
| Epic 1 (Redis, PostgreSQL, BullMQ) | concluída | global, injetável |
| `packages/types` (Zod) | ativo | adicionar `integration-health.ts` |

---

## Clarifications

### Session 2026-06-22

- Q: RLS write policy do worker — `SET LOCAL app.current_role = 'service'` ou cliente privilegiado (BYPASSRLS)? → A: Usar **cliente privilegiado** (`createPrivilegedClient()` com `DATABASE_URL`), idêntico ao `evasion_job_log` + `detect-evasion-risk.processor.ts`. O GUC `app.current_role` não existe no projeto. Política RLS da tabela: `USING (true)` para leitura; sem `WITH CHECK` — escrita protegida pelo cliente privilegiado que tem BYPASSRLS implícito.

- Q: Resolução de Super Admins para `dispatch()` — query Prisma em `user_tenants` ou Keycloak Admin API? → A: **Keycloak Admin API** via `KeycloakAdminService.getUsersByRealmRole('super_admin')`. `super_admin` é `realm_role` do Keycloak; não existe em `user_tenants.role`. `KeycloakAdminService` já fornece `getAdminToken()` + `baseUrl`. Adicionar método `getUsersByRealmRole`. Mapear `keycloakId → userId` local via `prisma.client.user.findMany`.

- Q: Como inicializar `RequestContext` (AsyncLocalStorage) no BullMQ worker sem request HTTP? → A: Usar `requestContext.run({ tenantId, userId: 'system', requestId: generateId(), correlationId }, callback)`, padrão direto de `NotificationsWorker` (L112) e `DetectEvasionRiskProcessor` (L135). Para INSERT em `integration_health_log` (plataforma-level), usar `createPrivilegedClient()` sem `requestContext`. Para `dispatch()` a Super Admins, rodar dentro de `requestContext.run` com o `tenantId` do destinatário.

