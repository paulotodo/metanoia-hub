# Plano de Implementação: health-check-integracoes

**Feature:** Story 14-4 — Health Check de Integrações & Dashboard Super Admin (NFR-I5)
**Versão:** 1.0.0
**Status:** planned
**Spec:** `docs/specs/health-check-integracoes/spec.md` (clarified)
**Autor:** agente-00c-feature-orchestrator (onda-003)

---

## Summary

Implementar visibilidade operacional sobre as cinco integrações externas da plataforma
(Resend, Keycloak, MinIO, Redis, PostgreSQL) através de: (1) probes paralelas com
classificação de status/latência, expostas em endpoint REST restrito a Super Admin;
(2) job BullMQ repetível (5 min) com single-execution via Redis lock que persiste
histórico em `integration_health_log` e notifica Super Admins com debounce anti-flapping;
(3) dashboard Next.js Client Component com painel, sparkline 24h e auto-refresh; e
(4) `ResendHealthPort` — a implementação real de `EmailHealthPort` que fecha o loop do
circuit breaker de email deixado como stub pela Story 14-3.

**Abordagem técnica:** reuso máximo da infraestrutura existente (NotificationsService,
AuditService, BullMqService, KeycloakAdminService, probes de infra do liveness
`health.controller.ts`), padrão `createPrivilegedClient()` para escrita platform-level
(precedente `evasion_job_log` / `detect-evasion-risk.processor.ts`), e `requestContext.run()`
no worker para o dispatch de notificações scoped por tenant do destinatário.

---

## Constitution Check

*GATE: passou antes do Phase 0. Re-checado após Phase 1 (§Re-check).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto (NON-NEGOTIABLE) | PASS c/ exceção documentada | `integration_health_log` é tabela **platform-level** SEM `tenant_id` — dado pertence ao operador da plataforma, não a um tenant. RLS **permanece habilitada** (`ENABLE ROW LEVEL SECURITY` + `platform_read USING(true)`). Exceção segue precedente ratificado `evasion_job_log` (Story 13-3) e `audit_events`/`consent_records` (tenant_id nullable). Justificativa em §Complexity Tracking. Autz de aplicação via `@Roles('super_admin')`. |
| II. Type-Safety & UUID v7 | PASS | `strict: true` (herdado); `id` via `uuidv7()` (NUNCA `@default(uuid())`); datas ISO 8601; `message` nullable explícito (`null`, nunca omitido). |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs/Swagger em inglês; textos user-facing PT-BR em `pt-BR.json` chave `health.integrations.*`; status traduzidos (Saudável/Degradado/Indisponível). |
| IV. Contratos de API Padronizados | PASS | Schemas Zod em `packages/types/src/integration-health.ts`; envelope `{ data, meta? }`; `/api/v1/` prefix; `ZodValidationPipe`. GET → 200, sem corpo de erro com stack. |
| V. Separação de Estado no Frontend | PASS | Dashboard é Client Component (`'use client'`) — área autenticada usa CSR; TanStack Query para server state (refetchInterval); estado de UI local via `useState` (sem Zustand). Sem mistura TanStack/Zustand. |
| VI. Qualidade Verificável | PASS | unit `*.spec.ts`, integration `*.integration-spec.ts` (RLS spec obrigatória — D-001 toca policy), e2e; WCAG AA (motion-safe, focus-ring, badge texto+cor, aria-live); snapshot Zod. CI verde antes de done; sem stack exposto. |
| VII. Processo de Entrega Auditável | PASS | 1 story = 1 branch = 1 PR; conventional commits PT-BR; auditoria via `AuditService.create` com `correlation_id`. |

Resultado do gate: **PASS** (com 1 exceção MUST documentada e justificada — Princípio I).

---

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem/Runtime | TypeScript 5.x (`strict: true`), Node.js; NestJS 11.1.17 (api), Next.js 16.2 App Router (web) |
| Gerência de pacotes | pnpm 10.33.0 + Turborepo 2.5 |
| Persistência | PostgreSQL + Prisma v7; nova tabela `integration_health_log` (platform-level) |
| Cache/Filas | Redis + BullMQ (`BullMqService`); lock + debounce em Redis (`rt:*`) |
| Auth | Keycloak — `KeycloakAuthGuard` + `RolesGuard` (`@Roles('super_admin')`) |
| Contratos | Zod em `packages/types` (FE+BE compartilhado) |
| Testing | Vitest 4.1.2 (unit/integration), Playwright 1.59.1 (e2e), MSW + nock (HTTP mock) |
| Probes externas | `fetch` + `AbortSignal.timeout` (Resend/Keycloak/MinIO); `redis.ping()`; `prisma.$queryRaw` |
| Constraints | Host É PRODUÇÃO — NFR-TEST-001: probes MOCKADOS em testes/CI, jamais batem em `metanoia-prod-*` |
| Performance | NFR-I5: latência total das probes < 6s (`Promise.all` + timeout 5s HTTP / 3s Redis-PG) |
| NEEDS CLARIFICATION restantes | 0 (3 resolvidos no clarify — ver spec §Clarifications) |

---

## Phase 0 — Research

Ver `research.md`. Unknowns resolvidos: estratégia de probe Resend idempotente,
mecanismo de single-execution multi-instância, semântica do circuit breaker,
resolução de Super Admins via realm role, e padrão de RLS platform-level.
Carry de segurança (OWASP histórico) documentado: **barreira de autz única**
(`@Roles` guard) para leitura cross-platform — ver `research.md` §Decision 6.

---

## Phase 1 — Design

- **Modelo de dados:** `data-model.md` — entidade `IntegrationHealthLog` + enum
  `IntegrationHealthStatus` + estados de debounce em Redis.
- **Contratos:** `contracts/admin-health-api.md` (REST) + `contracts/integration-status-changed-event.md` (evento de domínio).
- **Quickstart/cenários:** `quickstart.md` — happy path, 403, flapping, single-execution, roundtrip E2E.

---

## Project Structure

### Documentação (feature dir)
```
docs/specs/health-check-integracoes/
├── spec.md            (existente, clarified)
├── plan.md            (este arquivo)
├── research.md        (Phase 0)
├── data-model.md      (Phase 1)
├── contracts/
│   ├── admin-health-api.md
│   └── integration-status-changed-event.md
└── quickstart.md      (Phase 1)
```

### Código-fonte (árvore real do projeto)
```
apps/api/src/
├── admin/health/                       # NOVO módulo AdminHealthModule
│   ├── admin-health.module.ts
│   ├── health-check.service.ts         # 5 probes + classificação + Promise.all
│   ├── health-check.controller.ts      # GET /integrations + /integrations/history
│   ├── health-check.processor.ts       # BullMQ repeatable + Redis lock + debounce + notif
│   ├── resend-health.port.ts           # implementação real de EmailHealthPort
│   ├── dto/
│   │   ├── integration-health-response.dto.ts
│   │   └── integration-history-query.dto.ts
│   └── __tests__/
│       ├── health-check.service.spec.ts
│       ├── health-check.controller.spec.ts
│       ├── health-check.processor.spec.ts
│       └── resend-health.port.spec.ts
├── notifications/
│   ├── notifications.module.ts         # ALTERAR: EMAIL_HEALTH_PORT → ResendHealthPort (L49-50)
│   └── ports/email-health.port.ts      # NÃO ALTERAR interface (apenas troca de provider)
├── auth/
│   └── keycloak-admin.service.ts       # ADICIONAR método getUsersByRealmRole()
└── health/                             # NÃO TOCAR (liveness pública; reuso de probes infra)
    └── health.controller.ts

apps/api/prisma/
├── migrations/YYYYMMDD_14-4-integration-health-log/migration.sql   # tabela + index + RLS
└── rls/integration-health-log.rls-spec.ts                          # RLS isolation spec

packages/types/src/
└── integration-health.ts               # schemas Zod + snapshot test

apps/web/app/(authenticated)/admin/health/
├── page.tsx                            # Client Component container
├── _components/
│   ├── integration-health-card.tsx
│   ├── latency-sparkline.tsx           # SVG inline puro React (sem @nivo)
│   ├── health-dashboard.tsx
│   └── integration-history-modal.tsx
└── _hooks/
    └── use-integration-health.ts       # TanStack Query hooks

apps/web/messages/pt-BR.json            # ADICIONAR chave health.integrations.*
apps/web/e2e/admin-health.e2e-spec.ts   # E2E (MSW intercepta API)
```

---

## Convenções de Borda

Feature multi-camada (DB ↔ backend ↔ frontend). Fonte da verdade por convenção:

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | migration + Prisma `@map` | `prisma/migrations/*_14-4-integration-health-log/migration.sql` |
| Prisma model (TS) | camelCase (campos) ↔ snake_case (`@map`) | Prisma schema | `apps/api/prisma/schema.prisma` (`IntegrationHealthLog`) |
| Backend DTO (TS) | camelCase | Zod (`packages/types`) | `apps/api/src/admin/health/dto/*.ts` |
| API payload (request/response) | camelCase | Zod em ambos os lados | `contracts/admin-health-api.md` |
| Frontend DTO (TS) | camelCase | Zod parse no fetch hook | `packages/types/src/integration-health.ts` (re-export) |
| URL query params | camelCase (`integration`, `hours`) | DTO/pipe | `contracts/admin-health-api.md` |
| Evento de domínio | camelCase (`integrationName`, `newStatus`) | Zod | `contracts/integration-status-changed-event.md` |
| Redis keys | kebab/colon (`rt:health-check:lock:integration`) | convenção `rt:*` | `health-check.processor.ts` |

**Mapper layer (DB ↔ DTO):** Prisma faz auto-mapping via `@map`/`@@map` (snake_case
no banco ↔ camelCase no client). O worker escreve via `$executeRawUnsafe` com cliente
privilegiado — colunas snake_case **literais** no SQL (`integration_name`, `latency_ms`,
`checked_at`). O endpoint de leitura usa o Prisma client normal (auto-mapping camelCase).
**ATENÇÃO drift:** a query raw do worker e o read via Prisma model devem referenciar
a MESMA tabela — divergência snake/camel é o risco histórico (40 ondas). O cenário
"Roundtrip E2E" do `quickstart.md` valida o shape real do payload contra o contrato.

**Validação Zod:** response (backend serializa via DTO Zod; frontend re-parseia no
hook TanStack Query). Schema compartilhado em `packages/types/src/integration-health.ts`.

---

## Complexity Tracking

| Violação | Por que necessária | Alternativa rejeitada + razão |
|----------|--------------------|--------------------------------|
| **Princípio I — `integration_health_log` SEM `tenant_id`** | O dado descreve a saúde das integrações **da plataforma**, não de um tenant. Não existe tenant dono; forçar `tenant_id` exigiria valor sentinela artificial e quebraria a semântica de leitura cross-platform pelo operador. RLS permanece habilitada (`platform_read USING(true)`); escrita restrita a cliente privilegiado (BYPASSRLS). | (a) `tenant_id NOT NULL` com tenant sentinela "platform" → introduz tenant fantasma, polui FKs e queries multi-tenant; (b) `tenant_id String?` nullable com policy `NULLIF` (padrão audit_events) → considerado, mas adiciona policy WITH CHECK desnecessária já que NENHUM acesso é tenant-scoped; o padrão `evasion_job_log` (sem coluna) é mais simples e já ratificado. Exceção MUST documentada conforme Governance §"Exceções a um princípio MUST exigem justificativa documentada no PR". |

Nenhuma outra violação. Sem 4º serviço, sem camada extra além das já presentes.

---

## Re-check de Constitution (pós Phase 1)

Re-validado após design de data-model + contratos:

- **Princípio I:** design não introduziu novo acesso tenant-scoped; a exceção documentada
  permanece a única e está confinada a uma tabela platform-level. RLS habilitada. PASS.
- **Princípio II:** `data-model.md` fixa UUID v7 + ISO 8601 + null explícito. PASS.
- **Princípio IV:** contratos seguem envelope `{ data, meta? }` e `/api/v1/`. PASS.
- **Princípio V:** dashboard 100% Client Component, TanStack Query isolado. PASS.
- **Princípio VI:** RLS spec + snapshot Zod + a11y previstos nos cenários de teste. PASS.
- **Complexidade:** design não adicionou serviços/camadas além dos reusos planejados
  (NotificationsService, AuditService, BullMqService, KeycloakAdminService, probes de infra).

Resultado pós-design: **PASS**.
