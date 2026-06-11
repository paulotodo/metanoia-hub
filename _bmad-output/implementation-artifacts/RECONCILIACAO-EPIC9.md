# RECONCILIAÇÃO EPIC 9 — Privacidade, LGPD & Compliance

> Pré-flight (KICKOFF-EPIC9-LGPD.md §24) executado em 2026-06-11 sobre `dev @ bdae561` (HEAD `6cde903`, working tree limpa).
> Stories: **9-3 → 9-4 → 9-1 → 9-2** (ordem do KICKOFF, confirmada — ver §4). Implementar via cstk `/feature-00c` por story.
> Fonte autoritativa: `_bmad-output/planning-artifacts/epics/epic-09.md`. Sondagens feitas no schema/código reais, não nos artifacts.

## 0. Veredito por story

| Story | Short-name | Classificação | Resumo |
|-------|-----------|--------------|--------|
| **9-3** Log de auditoria imutável | `auditoria-log` | **NOVA** (módulo `audit/`) | Tabela `audit_events` + RLS **append-only** (só INSERT+SELECT, SEM UPDATE/DELETE policy) + índice `(tenant_id, timestamp DESC)`. `AuditInterceptor` global (só métodos mutativos). `audit.service.ts` Prisma direto (supporting subdomain). FE viewer super-admin `/app/admin/super/audit`. Export async reusa padrão 8-7. |
| **9-4** Base legal & histórico consentimento | `base-legal-consentimento` | **NOVA + ESTENDE consent** | Tabela `DataProcessingRegistry` (seeded via migration) + tabela `ConsentRecord` (withdrawal — **NÃO existe**, ver §1). Endpoint público `GET /privacy/data-processing`. Toggle withdrawal FE. Grava evento de auditoria (depende 9-3). |
| **9-1** Exportação de dados pessoais | `dados-exportacao` | **NOVA + FASE 0 cross-módulo** | Módulo `privacy/` (export). Fila `queue:privacy-export` + polling `GET /privacy/export/:jobId` (reusa 8-7). MinIO signed URL (reusa 8-2). **FASE 0 obrigatória: criar `exportUserData()` em 6 módulos (§3).** Modo privilegiado cross-tenant (§5 — RISCO). Stub e-mail `queue:notifications`. |
| **9-2** Exclusão de dados pessoais | `dados-exclusao` | **NOVA + FASE 0 + mais destrutiva** | Tabela `deletion_requests` + `User.status` `deletion_pending`/`deleted`. Fila `queue:privacy-deletion`. Soft→hard delete transacional. Anonimização de `audit_events` (`anonymous-<hash>`). Limpeza Redis `*:{userId}:*`. **FASE 0: `softDeleteUserData()`/`hardDeleteUserData()` nos mesmos 6 módulos.** Guardrail líder server-side. |

**Todas as 4 são NOVAS** — nenhum módulo `audit`/`privacy` existe hoje. `consent` existe e é **estendido** (não recriado).

---

## 1. ⚠️ DRIFTS / fatos do schema real — corrigir nos artifacts

1. **`User.status` default é `"pending_verification"`** (schema.prisma:13), NÃO `"ok"` como o KICKOFF §31 supôs. Valores atuais observados: `pending_verification`. 9-2 adiciona `deletion_pending` e `deleted` ao conjunto de estados válidos (string livre hoje — sem enum/CHECK). **Decidir em 9-2**: adicionar CHECK constraint ou manter string. Recomendo string + Zod enum em `packages/types` (consistente com o resto do schema).
2. **`Consent` é log de ACEITE, não de withdrawal.** Colunas reais (schema.prisma:195): `id, userId, tenantId?, documentType, version, ipAddress, userAgent, acceptedAt`. **NÃO tem** `action`/`withdrawn`/`consentType`. → A Story 9.4 cita `ConsentRecord { userId, tenantId, consentType, action: "withdrawn", timestamp }` — **é tabela NOVA**, separada de `consents`. Mapear `consentType` ↔ `documentType` na leitura do histórico; o registro de aceite vem de `consents`, o de withdrawal de `ConsentRecord`.
3. **`Reflection` usa `leaderId`, não `userId`** (schema.prisma:145). É dado pessoal do líder → entra no inventário export/delete sob o módulo meetings, chaveado por `leaderId`.
4. **`OutreachIntent` usa `createdByUserId`** (schema.prisma:377), não `userId`. Dado pessoal do autor (admin/líder) → anonimizar no delete, não soft-delete (registro pastoral de terceiros).
5. **`audit_events`, `DataProcessingRegistry`, `deletion_requests` não existem** (confirmado: grep no schema só achou o comentário "audit" em `meeting_events`). Todas criadas por migration nas respectivas stories.

---

## 2. Base JÁ ENTREGUE — NÃO recriar

- **Módulo `consent/`** (`consent.service.ts`, `.repository.ts`, `.guard.ts`, `.controller.ts`, `consent.versions.ts`, `__tests__/`) — repository pattern. 9-4 **estende** (adiciona histórico + withdrawal), não recria.
- **Módulo `super-admin/`** (`super-admin-tenants.*`) — demonstra o padrão de query cross-tenant via `PrismaService.client` (cliente não-extendido). 9-1/9-2 reusam o conceito, **mas ver §5 (RISCO de bypass)**.
- **Módulo `reports/`** (8-7) — referência canônica de **BullMQ job + polling + signed URL**: `reports.service.ts` (`bullMqService.createQueue`, `queue.add`, status), `reports.controller.ts` (`GET jobs/:jobId`, 202+jobId, `res.status(ACCEPTED)`), `reports.processor.ts` (`OnModuleInit` worker). **Copiar essa estrutura** para `queue:privacy-export` e export de audit (9-3).
- **Módulo `storage/`** (8-2) — `storage.service.ts` (`getSignedUrl`, policy `temporary`). Reusar para `exports/global/{userId}/...`.
- **`bullmq.service.ts`** — `createQueue(name)` / `createWorker(name, processor)`, prefix `queue`. Filas novas só passam o nome.
- **`prisma/with-tenant-tx.ts`** — `withTenantTx(tenantId, fn)` emite `SET LOCAL app.current_tenant_id`. Padrão obrigatório para queries tenant-scoped. RLS specs Prisma v7 usam `PrismaPg({connectionString: DATABASE_APP_URL})`.
- **Stub de e-mail**: o KICKOFF §34 aponta `invites/` como referência, mas **`invites.service.ts` NÃO tem stub console.log de e-mail** (cria conta Keycloak + autentica; não envia e-mail). → **Não existe padrão de stub de notificação por e-mail no repo.** 9-1 cria o padrão do zero: BullMQ `queue:notifications` + processor que faz `logger.log(...)` em dev (documentar como stub). Filas `queue:notifications` **não existem ainda**.

### Rotas/infra FE já existentes
- Área super-admin já montada (`/app/admin/super/...` — Cenário 09). 9-3 adiciona `/app/admin/super/audit`.
- Perfil/settings do participante: confirmar rota existente para "Privacidade & Consentimento" (9-4) e "Exportar/Excluir meus dados" (9-1/9-2) ao planejar cada story (não inventariado a fundo aqui — escopo FE de cada feature-00c).

---

## 3. 🚨 FASE 0 — Inventário de dado pessoal (`exportUserData`/`deleteUserData`)

**Confirmado: NENHUM módulo expõe `exportUserData`/`deleteUserData` hoje** (`grep -rl exportUserData apps/api/src` → vazio). É o gap do retro Epic 8 §6. Tratar como **sub-tarefa obrigatória dentro de 9-1 (export) e 9-2 (delete)**, com **teste de completude** que falha se uma tabela com `userId`/identificador pessoal não tiver método correspondente.

### Tabelas com dado pessoal → módulo dono → método a criar

| Tabela | Chave pessoal | Módulo / service | export | delete |
|--------|---------------|------------------|--------|--------|
| `users` | `id` | **users** `users.service` | perfil (name, email, status, datas) | flag status → anonimizar/purge |
| `user_tenants` | `userId` | **users**/tenants | vínculos+role por tenant | delete |
| `consents` | `userId` | **consent** `consent.service` | histórico de aceites | **RETER** (base legal) — não deletar |
| `consent_records` (9-4 nova) | `userId` | **consent** | histórico withdrawal | RETER |
| `group_members` | `userId` | **group-members** `group-members.service` | participações em grupos | soft-delete |
| `lesson_progress` | `userId` | **content** `content.service` | progresso de aulas | soft-delete |
| `module_progress` | `userId` | **content** | progresso de módulos | soft-delete |
| `trail_progress` | `userId` | **content** | progresso de trilhas | soft-delete |
| `meeting_attendance` | `userId` | **meetings** `meetings.service` | presença | soft-delete |
| `meeting_telemetry` | `userId` | **meetings** | engajamento/foco | soft-delete |
| `meeting_participants` (MeetingParticipantRecord) | `userId?` | **meetings** | participação | soft-delete |
| `meeting_events` | `userId?` | **meetings** | eventos pipeline | soft-delete |
| `reflections` | `leaderId` | **meetings** `reflections.service` | reflexões (como líder) | soft-delete |
| `pastoral_notes` | `userId` (rel. "notes") | **pastoral** `pastoral.service` | notas sobre mim | soft-delete/anonimizar |
| `pastoral_actions` | `userId` (rel. "actions") | **pastoral** | ações sobre mim | soft-delete |
| `pastoral_alerts` | `userId` (rel. "alerts") | **pastoral** | alertas sobre mim | soft-delete |
| `participant_radar_status` | `userId` | **pastoral**/radar | status radar | soft-delete |
| `participant_status_improved` | `userId` | **pastoral**/radar | melhorias status | soft-delete |
| `outreach_intents` | `createdByUserId` | **admin-pastoral** | criados por mim | **anonimizar** (registro de terceiros) |
| `audit_events` (9-3 nova) | `userId` | **audit** | eventos por mim | **RETER + anonimizar** `userId`→`anonymous-<hash>` |

### Módulos que ganham `exportUserData(userId, tenantId)` + `deleteUserData(userId, tenantId)` (FASE 0)
**6 módulos**: `users`, `consent`, `group-members`, `content`, `meetings`, `pastoral` (+ `admin-pastoral` para outreach). O **orquestrador `privacy.service`** chama cada um por módulo (respeita fronteiras — NÃO query direta às tabelas). O teste de completude itera o conjunto de tabelas com dado pessoal e exige o método correspondente.

> **Sequenciamento da FASE 0**: 9-1 cria `exportUserData()` nos 6 módulos + teste de completude de export. 9-2 cria `softDeleteUserData()`/`hardDeleteUserData()` nos mesmos 6 + teste de cascade. Não duplicar: 9-2 reusa a lista canônica de tabelas montada em 9-1 (extrair p/ uma const/registry compartilhado em `privacy/`).

---

## 4. Migrations necessárias (Content não precisou; Epic 9 precisa)

- **9-3** `audit_events`: `id` UUID v7, `tenant_id`, `user_id`, `action` (enum: create/update/delete/login/export/config_change), `resource`, `resource_id`, `ip_address`, `user_agent`, `previous_state` JSONB, `new_state` JSONB, `timestamp` timestamptz, `severity` (info/warning/critical). **RLS append-only**: `ENABLE`+`FORCE ROW LEVEL SECURITY`, policy `FOR INSERT` + policy `FOR SELECT` (`tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`), **SEM** policy UPDATE/DELETE. Índice `(tenant_id, timestamp DESC)`.
- **9-4** `data_processing_registry` (seeded via migration, NFR-L5) + `consent_records` (withdrawal). `DataProcessingRegistry`: `id, operationName, legalBasis (enum), purpose (PT-BR), dataCategories String[], retentionPeriod, thirdPartySharing String[], timestamps`. RLS: registry é **público/global** (endpoint sem auth) → avaliar se tenant-scoped ou global (recomendo global read, sem `tenant_id` na policy de SELECT pública).
- **9-2** `deletion_requests`: `id (requestId)`, `user_id`, `tenant_id`, `status` (pending/cancelled/completed), `cancellable_until`, `deletion_deadline`, timestamps. + `User.status` aceita `deletion_pending`/`deleted` (sem migration de schema se string livre; só Zod enum). Soft-delete: confirmar se as tabelas de progresso/meetings têm `deleted_at` (content tem `softDelete*`; meetings/pastoral **podem não ter** — verificar e adicionar `deleted_at` onde faltar = migration extra em 9-2).

**Padrão RLS spec obrigatório** (toda policy nova, ESP. 9-3 append-only + 9-2): adapter `PrismaPg({connectionString: DATABASE_APP_URL})`, UUIDs fixos hex, users globais, cadeia FK em `beforeAll`/`afterAll`, `beforeEach` limpa só mutável, invariante `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`. **9-3 exige teste de imutabilidade**: UPDATE e DELETE diretos em `audit_events` via raw SQL → confirmar que RLS bloqueia ambos; `audit.service.ts` NÃO expõe update/delete.

---

## 5. 🔴 RISCO ARQUITETURAL Nº1 — modo privilegiado cross-tenant (export/deletion)

LGPD = TODOS os tenants do usuário (FR03). 9-1/9-2 precisam ler/escrever cross-tenant sobrepondo RLS. O KICKOFF assume "padrão do super-admin bypass RLS". **Investigação revelou que o mecanismo é NÃO-ÓBVIO e precisa de spike empírico antes de 9-1:**

- Role da app `metanoia_app` é **`NOSUPERUSER` e SEM `BYPASSRLS`** (`docker/postgres/init-app-role.sql`). Não há bypass por privilégio de role.
- `super-admin` usa `PrismaService.client` (cliente base, sem `SET LOCAL`). A policy de `tenants` é a **antiga** `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)` — **sem `NULLIF` e sem `, true`** (`20260413131927_add_pastoral_rls`:8-9). Com a GUC não setada, `current_setting(...)` **erraria** (missing_ok=false) — então o super-admin só funciona se houver um **default de `app.current_tenant_id`** setado em nível de DB/role/sessão, OU outra mecânica não mapeada.
- **Ação obrigatória no arranque de 9-1**: spike de 15 min — `SELECT current_setting('app.current_tenant_id', true)` na conexão da app + reproduzir um `super-admin list tenants` e observar como retorna cross-tenant. **NÃO assumir que `prisma.client` retorna linhas de todos os tenants.** O caminho seguro/explícito p/ Epic 9: o worker **itera `allTenantIds`** (de `user_tenants`) e roda cada coleta dentro de `withTenantTx(tenantId, ...)` — coletando por-tenant com RLS ATIVA, evitando depender de bypass. Isso casa com o AC ("cada tenant em seção separada, claramente rotulada") e é mais auditável. **Recomendo este caminho (iterar+withTenantTx) como default**, e bypass só onde iterar não cobre (ex.: descobrir os tenants do user — leitura de `user_tenants` que é tenant-scoped... → ler via cliente base ou via cada tenant). Resolver no spike.
- **`audit_events` na deleção**: anonimização (`userId`→`anonymous-<hash>`) é um UPDATE — mas a tabela é **append-only sem policy UPDATE**. → A anonimização **não pode** ser UPDATE via app role. Opções: (a) gravar um novo evento `privacy.deletion.completed` e deixar o `userId` antigo (mas AC exige substituir); (b) a anonimização roda como operação privilegiada fora da policy app (migration/admin role). **Conflito real entre 9-2 (anonimizar audit) e 9-3 (audit imutável) — resolver explicitamente em 9-2**: provavelmente a policy de `audit_events` precisa permitir UPDATE **apenas** da coluna `user_id` para `anonymous-*` via função `SECURITY DEFINER`, OU a "anonimização" é lógica (view/coluna `is_anonymized`) sem tocar a imutabilidade. Documentar a decisão na story 9-2.

---

## 6. AuditInterceptor (9-3) — ordem cross-cutting

`AuditInterceptor` global, só em métodos mutativos (POST/PUT/PATCH/DELETE — nunca GET/HEAD/OPTIONS). Captura `previousState`/`newState`, `ipAddress`, `userAgent`. **Ordem vs guards**: roda APÓS `KeycloakAuthGuard`/`RolesGuard`/`ConsentGuard` (precisa do `RequestContext`/tenantId já resolvido em `AsyncLocalStorage`). Interceptor ≠ guard na pipeline Nest (guards rodam antes de interceptors no fluxo de request) — confirmar que `tenantId`/`userId` já estão no contexto quando o interceptor persiste. Persistência via `audit.service.ts` (Prisma direto, supporting subdomain).

---

## 7. Ordem & estratégia de execução (CONFIRMADA)

**9-3 → 9-4 → 9-1 → 9-2** (sequencial, do KICKOFF). Razão validada:
- **9-3 primeiro**: 9-4 (withdrawal), 9-1 (export) e 9-2 (deletion) **todas gravam evento de auditoria** → `audit.service` precisa existir. 9-3 é também o menos acoplado (interceptor + tabela + viewer).
- **9-4 segundo**: cria `ConsentRecord` + registry; depende só de 9-3 (grava audit no withdrawal). Independente da infra de export/delete.
- **9-1 terceiro**: traz a FASE 0 (`exportUserData` nos 6 módulos) + infra de fila/MinIO/e-mail — base p/ 9-2.
- **9-2 por último**: mais destrutiva; reusa FASE 0 e infra de 9-1; resolve o conflito audit-anonimização (§5).

Via cstk `/feature-00c` **por story**, short-names: `auditoria-log`, `base-legal-consentimento`, `dados-exportacao`, `dados-exclusao`. State em `.claude/feature-00c-state/<short>/`. Crash → `/feature-00c-resume <short>` (`.lock` órfão: `rmdir` antes de readquirir; `state-lock.sh check` semântica invertida = exit 0 livre).

---

## 8. ⚠️ GUARDRAILS CI (repassar a TODO orquestrador feature-00c)

1. **NUNCA push direto em `dev`** — `ci.yml` só dispara em `pull_request`. Toda story: **feature-branch → PR → CI verde → squash-merge** (como #124–#134). **Após cada "concluido" do feature-00c, auditar `git log`**: entrou via PR squash `(#NNN)`? Se commit direto em dev → recuperar (reset `dev→commit~1` + `--force-with-lease`, mover p/ feature-branch, PR, CI, squash). Ver memória `feedback_feature00c_direct_push_dev_bypasses_ci`.
2. **Validar local antes de done**: `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint` (lint `--max-warnings 0`; jest-axe é gate real). Após migration/dep: `pnpm install` + commit `pnpm-lock.yaml`.
3. **RLS spec Prisma v7** obrigatório p/ cada policy nova (§4). 9-3 = teste de imutabilidade append-only.
4. **useMutation FE** (toggle consentimento 9-4, cancelar deletion 9-2): `useMutation<undefined, Error, T>`, mutationFn async com `await` + `return undefined` (ver `use-pastoral-admin.ts`).
5. **Flakes conhecidos**: `reflections.rls-spec.ts` (FK P2003), E2E `registry-1.docker.io deadline`, cache-miss turbo/prisma → `gh run rerun --failed`; `gh pr merge` 401 → retry 3-4x.
6. **Contratos**: `tenantId` em toda tabela (nunca parâmetro — `AsyncLocalStorage`/`withTenantTx`); UUID v7 `generateId()`; ISO 8601; nulls explícitos; Create 201 / Delete 204 / **Async 202**; `{data,meta?}` sucesso, `{statusCode,error,message,details?}` erro; código+log inglês, user-facing PT-BR + vocabulário pastoral; conventional commits PT-BR; `ZodValidationPipe` custom; Zod em `packages/types` + snapshot.

---

## 9. Fechamento

Ao mergear as 4: marcar `9-1/9-2/9-3/9-4: done` + `epic-9: done` em `sprint-status.yaml` (commit `docs(planning)` direto em dev OK — convenção do repo p/ planning-artifacts, não toca build/lint/test). Rodar `epic-9-retrospective` (optional). Atualizar memória.

## 10. Itens que exigem decisão antes de codar (revisão humana)

1. **§5 RISCO**: confirmar caminho cross-tenant (recomendo **iterar `allTenantIds` + `withTenantTx`**, não bypass) — spike no arranque de 9-1.
2. **§5 conflito**: anonimização de `audit_events` (9-2) vs imutabilidade append-only (9-3) — escolher mecanismo (SECURITY DEFINER restrito a `user_id`, ou anonimização lógica `is_anonymized`).
3. **§1.1**: `User.status` deletion states via Zod enum (sem CHECK) — confirmar.
4. **§4 9-2**: verificar `deleted_at` em meetings/pastoral; adicionar onde faltar (migration extra).
