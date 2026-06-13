# Research: exportacao-dados-pessoais

**Feature:** Story 9-1 — Exportação de Dados Pessoais / Portabilidade LGPD
**Phase:** Plan — Phase 0 Research
**Data:** 2026-06-12

---

## Decision 1: Geração de PDF — pdfkit vs JSON-only

**Decision:** Instalar `pdfkit@0.15.x` + `@types/pdfkit` em `apps/api` como devDependency.

**Rationale:** spec §5.1 lista "PDF via pdfkit" como IN SCOPE explicitamente. A spec §10 Riscos antecipou a ausência e prescreveu instalar. O codebase atual usa somente CSV/JSON via `StorageService`, mas `pdfkit` é uma lib de geração de arquivo (não lib de validação NestJS), portanto não viola constitution §IV. A CL-03 (clarify score 2) já tomou esta decisão.

**Alternatives considered:**
- `jsPDF`: não encontrado no monorepo; browser-first, inadequado para Node worker.
- `puppeteer`/`playwright` headless render: overkill para tabelas simples de dados pessoais; adiciona dep pesada.
- JSON-only: descarta requisito explícito da spec — fora de escopo pular.

**Impact:** `pdfkit` vai em `apps/api/package.json`. Worker decide entre JSON/PDF pelo campo `format` do job payload.

---

## Decision 2: Padrão de processor BullMQ — sem `@Processor` decorator

**Decision:** Usar `OnModuleInit` + `bullMqService.createWorker()` — NÃO usar `@Processor`/`@Process` de `@nestjs/bullmq`.

**Rationale:** Todo o codebase (reports.processor.ts, audit-export.processor.ts, progress.processor.ts) usa o padrão manual `createWorker`. Introduzir `@nestjs/bullmq` quebraria consistência sem ganho. A wiring manual é direta e já testada.

**Alternatives considered:**
- `@nestjs/bullmq` decoradores: consistentes com docs oficiais, mas o projeto deliberadamente evita (sem `@nestjs/bullmq` em package.json).

---

## Decision 3: Fonte de `allTenantIds` — query DB no controller

**Decision:** Controller usa `this.prisma.client.userTenant.findMany({ where: { userId } })` diretamente (sem `withTenantTx`) para obter `allTenantIds` no momento do POST.

**Rationale:** CL-01 (clarify score 2). Padrão super-admin já documentado em spec §2.6. Claims JWT requereria mapper Keycloak não especificado. `UserTenant` não tem RLS conflitante para leitura multi-tenant.

**Alternatives considered:**
- Claims JWT: não mapeado no Keycloak atual.
- Worker descobre tenants: duplicação de lógica; controller precisa validar 409 antes.

---

## Decision 4: Redis como fonte primária de polling (sem fallback ao DB)

**Decision:** `GET /api/v1/privacy/export/:jobId` lê somente do Redis (`cache:privacy:export-job:<jobId>`) com TTL 172800s (48h). O DB armazena como auditoria, não como fallback de polling.

**Rationale:** CL-05 (clarify score 2). Espelha exatamente o padrão do `reports.service.ts` (`cache:reports:export-job:{jobId}`). TTL 48h = validade da signed URL — garante que o Redis não expire antes do link.

**Alternatives considered:**
- Fallback ao DB: extra read; desnecessário enquanto TTL > validade URL.

---

## Decision 5: Worker usa `prisma.client` direto (sem RLS) para iterar tenants

**Decision:** O worker de export é um job privilegiado de sistema. Para cada `tenantId` em `allTenantIds`, chama `prisma.client.<model>.findMany({ where: { tenantId, userId } })` diretamente — sem `withTenantTx`. Esta é a ÚNICA exceção documentada ao padrão AsyncLocalStorage (contexto de worker, não HTTP request).

**Rationale:** Spec §2.6 prescreveu explicitamente este padrão para o worker. O super-admin segue o mesmo padrão (bypass RLS com filtro explícito). Cada query filtra `userId` E `tenantId`, eliminando risco de vazamento cross-user.

**Alternatives considered:**
- `withTenantTx` com tenantId injetado: tentou-se em super-admin mas criou acoplamento; o padrão direto com filtro explícito é mais simples e auditável.

---

## Decision 6: `all_tenant_ids` na tabela — coluna write-once, nunca exposta na API

**Decision:** CL-06 (clarify score 2). A coluna `all_tenant_ids UUID[]` fica na tabela `privacy_export_jobs` como auditoria write-once. Worker lê do payload BullMQ (Redis), não do DB. DTOs de resposta não expõem o campo.

**Rationale:** Remoção exigiria mudança arquitetural. A RLS policy (filtra por `tenant_id`) isola os jobs por tenant de origem. Coluna nunca retornada pela API pública.

---

## Decision 7: Campos de `UserProfileExport` — campos reais do schema (block-001 respondido)

**Decision:** `id, email, name, status, onboardingCompletedAt, createdAt, updatedAt`.
EXCLUÍDO: `tenantId` (metadado interno). NÃO EXISTEM: `phone, avatarUrl, locale, timezone`.

**Rationale:** Verificado empiricamente em `apps/api/prisma/schema.prisma`. Resposta humana ao block-001. `UserProfileExport` definido como Zod schema explícito em `packages/types/src/privacy/export.ts`.

---

## Decision 8: PastoralAction excluída do export

**Decision:** CL-04 (clarify score 2). Export Pastoral = `pastoral_alerts` + `pastoral_notes` apenas. `PastoralAction` não entra.

**Rationale:** Spec §2.5 e §6.4 não citam `pastoral_actions`. Inclusão seria escopo não especificado.

---

## Decision 9: Namespace Redis para job status

**Decision:** `cache:privacy:export-job:<jobId>` (TTL 172800s = 48h).

**Rationale:** Segue convenção `cache:*` do projeto (CLAUDE.md). Distinguível de `cache:reports:export-job:*`.

---

## NEEDS CLARIFICATION — todos resolvidos

Todas as perguntas do clarify (CL-01 a CL-06) foram resolvidas antes do plan. Nenhum NEEDS CLARIFICATION pendente para o Phase 1.
