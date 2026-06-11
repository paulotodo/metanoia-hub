# Research: Log de Auditoria Imutável (auditoria-log)

Phase 0 do `/plan`. A spec não contém `[NEEDS CLARIFICATION]` pendentes (a
RECONCILIAÇÃO-EPIC9 resolveu as ambiguidades antes da spec). As decisões
abaixo registram **escolhas técnicas verificadas empiricamente** contra o
codebase existente, para que o design (Phase 1) e o backlog (`/create-tasks`)
não re-derivem patterns nem inventem mecanismos.

Fontes verificadas: `super-admin-tenants.repository.ts`, `reports.{controller,service,processor}.ts`,
`with-tenant-tx.ts`, `prisma/migrations/20260510210000_consolidate_rls_nullif/migration.sql`,
`packages/types/src/id.ts`, `apps/api/test/rls/group-members.rls-spec.ts`,
`packages/types/src/reports/index.ts`, `apps/web/app/(authenticated)/app/admin/super/tenants/`.

---

## Decision 1: Captura automática via Interceptor global (não decorator, não guard)

**Decision**: `AuditInterceptor` registrado globalmente (`APP_INTERCEPTOR`), que
atua APENAS sobre métodos mutativos (POST/PUT/PATCH/DELETE) e ignora
GET/HEAD/OPTIONS. Persiste o evento via `audit.service.ts`.

**Rationale**:
- A pipeline NestJS executa **guards ANTES de interceptors**. Logo, quando o
  `AuditInterceptor` roda, `KeycloakAuthGuard`/`RolesGuard`/`ConsentGuard` já
  populáram o `RequestContext` (`AsyncLocalStorage`) com `tenantId`/`userId`.
  Verificado: `with-tenant-tx.ts` lê `requestContext.getStore()?.tenantId` — a
  mesma fonte que o interceptor usará.
- Interceptor global evita anotar cada controller (FR-001: "sem exigir
  anotações explícitas"). É a fronteira cross-cutting correta para captura
  transparente.
- Não há nenhum interceptor global hoje (`find apps/api/src -name '*.interceptor.ts'`
  retornou vazio) — `AuditInterceptor` é o primeiro. Não há conflito de ordem
  com outros interceptors.

**Alternatives considered**:
- **Decorator `@Audit()` por controller**: rejeitado — viola FR-001 (exige
  anotação manual em cada rota; fácil de esquecer; auditoria incompleta).
- **Guard de auditoria**: rejeitado — guards rodam antes do handler, não têm
  acesso ao `newState` (resultado da mutação) nem ao status code da resposta.
  Auditoria precisa do pós-handler (interceptor `tap`/`map` no stream RxJS).

---

## Decision 2: `audit.service.ts` Prisma direto — supporting subdomain, sem update/delete

**Decision**: Audit é **supporting subdomain** → service direto com Prisma (NÃO
repository pattern). `audit.service.ts` expõe apenas `create(...)` e
`listEvents(...)`/`queryEvents(...)`. NUNCA `update` ou `delete`.

**Rationale**:
- Constitution/Architecture Decisions: "Core domains (Pastoral, Meetings,
  Content): repository pattern. Supporting subdomains: service direto com
  Prisma." Audit é supporting (cross-cutting infra, não core domain).
- A ausência física de métodos update/delete no service é a **primeira camada**
  da imutabilidade (US2). A segunda é a policy RLS append-only (Decision 4).
  Defesa em profundidade: mesmo que alguém adicione um método, o banco rejeita.
- O write tenant-scoped usa `withTenantTx` (SET LOCAL app.current_tenant_id) —
  o INSERT casa com a policy `FOR INSERT` e com a coluna `tenant_id`.

**Alternatives considered**:
- **Repository pattern**: rejeitado — overhead sem ganho; audit não tem lógica
  de domínio complexa (é append + query). Diverge da convenção de supporting
  subdomain.

---

## Decision 3: Mecanismo cross-tenant do viewer Super Admin = padrão `super-admin/` (`prisma.client` direto)

**Decision**: O viewer `/app/admin/super/audit` lê cross-tenant seguindo
EXATAMENTE o padrão do módulo `super-admin/`: `this.prisma.client.auditEvent.findMany(...)`
diretamente (cliente NÃO-estendido / não-RLS), guardado por
`@UseGuards(KeycloakAuthGuard, RolesGuard)` + `@Roles(Role.SUPER_ADMIN)`.
SELECT tenant-scoped normal (não super-admin) usa `withTenantTx`.

**Rationale** (verificado empiricamente — RECONCILIAÇÃO §5):
- `super-admin-tenants.repository.ts` usa `this.prisma.client.tenant.findMany()`
  diretamente, sem `withTenantTx`, sem setar GUC. Comentário do arquivo:
  *"The Super Admin role operates cross-tenant by design, so we deliberately
  bypass row-level security here."*
- A RECONCILIAÇÃO §5 marca o mecanismo como **NÃO-ÓBVIO** (a role `metanoia_app`
  é NOSUPERUSER sem BYPASSRLS; com a GUC `app.current_tenant_id` não setada, a
  policy antiga sem `NULLIF`/`, true` erraria). Para a 9-3 (apenas leitura/
  listagem) o padrão super-admin é suficiente, MAS exige um **spike empírico de
  15 min na FASE 0 do `/create-tasks`** para confirmar como `prisma.client`
  retorna linhas cross-tenant antes de codar o repository do viewer.
- **NÃO inventar bypass novo**. A policy append-only de `audit_events` usa a
  forma canônica `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`
  — com a GUC não setada (cliente base), o SELECT super-admin retorna o que a
  policy permitir; o spike confirma o comportamento real.

**Alternatives considered**:
- **Iterar `allTenantIds` + `withTenantTx` por tenant**: é o caminho recomendado
  pela RECONCILIAÇÃO para 9-1/9-2 (export/deletion cross-tenant escrevendo). Para
  9-3 (apenas SELECT de listagem paginada) é mais custoso (N transações por
  página) e o módulo super-admin já provê o padrão direto. Mantido como fallback
  caso o spike revele que `prisma.client` NÃO retorna cross-tenant.
- **Criar role DB com BYPASSRLS**: rejeitado — fora do escopo da 9-3; mudança de
  infra sensível não justificada por uma feature de leitura.

---

## Decision 4: Migration RAW SQL append-only — ENABLE+FORCE RLS, policies só INSERT+SELECT

**Decision**: Migration RAW SQL em `apps/api/prisma/migrations/` cria a tabela
`audit_events`, habilita `ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`, e
cria **somente** duas policies: `FOR INSERT` e `FOR SELECT`. **Nenhuma** policy
`FOR UPDATE` nem `FOR DELETE` (FR-INFRA-02). Índice `(tenant_id, timestamp DESC)`.

Forma canônica das policies (verificada em
`20260510210000_consolidate_rls_nullif/migration.sql`):

```sql
CREATE POLICY audit_events_tenant_select ON audit_events
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY audit_events_tenant_insert ON audit_events
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

**Rationale**:
- Em PostgreSQL, com RLS habilitado e **sem** policy `FOR UPDATE`/`FOR DELETE`,
  toda operação UPDATE/DELETE pelo role da app é negada por padrão (nenhuma linha
  satisfaz a policy inexistente) → imutabilidade na camada de banco (US2, SC-002).
- `FORCE ROW LEVEL SECURITY` garante que o próprio owner da tabela não escape da
  policy (defesa contra `metanoia_app` ser owner em algum ambiente).
- A forma `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` é o
  invariante consolidado do repo (queries pré-tenant retornam vazio em vez de
  erro). O migration de consolidação alinhou TODAS as USING clauses a esta forma.
- Migration RAW SQL (não `prisma migrate dev` de schema): RLS/policies não são
  expressáveis no schema Prisma; o repo já usa migrations SQL para policy.

**Alternatives considered**:
- **Trigger `BEFORE UPDATE/DELETE` que dá RAISE**: rejeitado — redundante com a
  ausência de policy; adiciona superfície de manutenção. A ausência de policy já
  bloqueia. (Nota: a 9-2 pode precisar de mecanismo privilegiado para anonimizar
  `user_id` — ver Decision 8.)
- **Tabela em schema separado read-only**: rejeitado — overkill para o MVP;
  multi-tenancy do repo é via RLS, não schema separation (Architecture Decision).

---

## Decision 5: Export assíncrono reusa o padrão `reports/` (8-7) — BullMQ + polling + signed URL

**Decision**: Export CSV/JSON do log reusa a estrutura canônica do módulo
`reports/`: fila BullMQ dedicada `AUDIT_EXPORT_QUEUE_NAME`, controller com
`POST .../export` → 202+jobId e `GET .../jobs/:jobId` para polling, processor
`OnModuleInit` worker, `storage.getSignedUrl(key, ttlSeconds)` para download.

Shape do job status (espelhado de reports, verificado): `{ jobId, status:
'processing'|'completed'|'failed', signedUrl: string|null, expiresAt: string|null,
failureReason: string|null }`. Status persistido em Redis com TTL.

**Rationale**:
- RECONCILIAÇÃO §4 + FR-007/FR-INFRA-03: "Copiar essa estrutura". Reuso reduz
  risco e mantém consistência operacional (mesma observabilidade de jobs).
- `reports.service.ts` usa `bullMqService.createQueue(QUEUE_NAME)` e `queue.add`;
  `reports.processor.ts` registra worker via `createWorker` no `onModuleInit`.
  TTL de download verificado: `REPORTS_JOB_TTL_SECONDS = 3600` (1h). Para audit,
  a spec exige **validade mínima 24h** (SC-006) → `AUDIT_EXPORT_TTL_SECONDS = 86400`.
- Export inclui TODOS os campos do evento (não só os visíveis na tabela) — FR-007
  AC#3. Até 3 tentativas em falha (FR-INFRA-03) — config padrão BullMQ `attempts: 3`.

**Alternatives considered**:
- **Export síncrono inline**: rejeitado — até 100k eventos (SC-006) bloquearia o
  request e estouraria timeouts. Async 202 é o padrão de constitution (§IV).
- **Nova abstração de fila**: rejeitada — `bullMqService` já encapsula o Redis/
  BullMQ; reusar é mais barato e testado.

---

## Decision 6: Contratos Zod compartilhados em `packages/types/src/audit/` + snapshot

**Decision**: Schemas Zod em `packages/types/src/audit/index.ts` (entidade
`AuditEvent`, query params, export request, job status) + constants
(`AUDIT_EXPORT_QUEUE_NAME`, `AUDIT_EXPORT_TTL_SECONDS`, page size, severities,
actions). Snapshot test em `packages/types/src/__tests__/audit.snapshot.spec.ts`
no padrão `toMatchInlineSnapshot`.

**Rationale**:
- Constitution §IV (NON-NEGOTIABLE): contratos FE+BE como Zod em `packages/types`
  com snapshot test (gate contra breaking changes silenciosos). Verificado o
  pattern em `packages/types/src/reports/index.ts` + `__tests__/reports.snapshot.spec.ts`.
- `z.enum` para `action` e `severity` torna os valores literais a fonte da verdade
  compartilhada FE/BE — o viewer e o backend consomem o mesmo enum.
- `ZodValidationPipe` custom (constitution §IV: proibido lib de validação NestJS
  de terceiros) valida query params do `GET /api/v1/audit/events`.

**Alternatives considered**:
- **DTOs class-validator**: rejeitado — proibido por constitution (§IV: sem libs
  de validação de terceiros; usar `ZodValidationPipe` próprio).

---

## Decision 7: Viewer FE — Client Component + TanStack Query + a11y gate

**Decision**: `/app/admin/super/audit` é Client Component (`'use client'`),
consome a API via hook TanStack Query `useAuditEvents` (`useQuery`), com
paginação server-side 50/página, sticky filters, `refetchInterval: 30_000`
(auto-refresh 30s), linhas expansíveis (JSON `previousState`/`newState`), e
teste `jest-axe` (gate real de CI). i18n em `apps/web/messages/pt-BR.json`
namespace `superAdmin.audit.*`, vocabulário pastoral, desktop-optimized.

**Rationale**:
- Constitution §V (NON-NEGOTIABLE): TanStack Query apenas em Client Components;
  área autenticada é CSR. Verificado o pattern idêntico em
  `apps/web/.../app/admin/super/tenants/page.tsx` + `use-super-admin-tenants.ts`
  (`useQuery`, `staleTime`, `envelopeClient.get(url, ZodSchema)`).
- Constitution §VI: WCAG AA obrigatório; jest-axe já é gate (verificado
  `super-admin-pages.a11y.spec.tsx`). 30s auto-refresh = FR-009; sticky filters
  = FR-006/US3 AC#3.

**Alternatives considered**:
- **Server Component + fetch nativo**: rejeitado — auto-refresh 30s + sticky
  filters + paginação interativa são server state que pertence a TanStack Query
  em Client Component (constitution §V). Misturar seria violação.

---

## Decision 8 (NOTA — fora de escopo): conflito 9-2 anonimização vs imutabilidade

**Decision (registro, não implementação)**: A policy append-only de
`audit_events` (Decision 4) deliberadamente **não cria** policy UPDATE. A Story
9-2 (anonimização LGPD: `user_id` → `anonymous-<hash>`) precisará de uma operação
privilegiada para substituir `user_id` sem violar a imutabilidade geral.

**Rationale**: A 9-3 define imutabilidade **absoluta no contexto do role da app**.
A 9-2 resolverá explicitamente o conflito — caminhos possíveis (a decidir na 9-2,
NÃO aqui): função `SECURITY DEFINER` restrita à coluna `user_id`, OU anonimização
lógica via flag `is_anonymized` sem tocar a linha. O design da 9-3 não deve
impedir uma futura operação privilegiada de anonimização — por isso a migration
**não** usa trigger BEFORE UPDATE (que bloquearia até o caminho privilegiado).

**Alternatives considered**: N/A — apenas nota de contrato cross-story. Fora do
escopo da 9-3.
