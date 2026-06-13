# RECONCILIAÇÃO EPIC 10 — Onboarding Avançado

> Pré-flight executado em 2026-06-13 sobre `dev @ f107e44` (merge `c67e1e4` + reconcile Epic 9; working tree limpa).
> Stories: **10-2 → 10-1 → 10-3 → 10-4** (ver §7 — diverge do sprint-roadmap "10-1//10-2 paralelo"; razão no §7). Implementar via cstk `/feature-00c` por story.
> Fonte autoritativa: `_bmad-output/planning-artifacts/epics/epic-10.md`. Sondagens feitas no schema/código reais, não nos artifacts.

## 0. Veredito por story

| Story | Short-name | Classificação | Resumo |
|-------|-----------|--------------|--------|
| **10-1** Wizard de onboarding Admin Tenant | `onboarding-wizard` | **NOVA (FE pesado) + ESTENDE onboarding/users/tenants** | `OnboardingWizard` full-screen 5 steps. Backend leve: tenant ganha `onboardingProgress` JSONB + `onboardingSkippedAt`. **Cria endpoints que NÃO existem**: `PATCH /tenants/current` (§1.2) e `PATCH /users/me` perfil (§1.3). Reusa `POST /groups` (4-1) + invite (4-3) + demo data (10-2). |
| **10-2** Dados de demonstração (seed) | `dados-demonstracao` | **NOVA + CONFLITA com 7-2 (modelo de demo diferente)** | Flag **por-registro** `isDemoData` em 9 tabelas + seed `seedDemoData(tenantId)` injetado em tenant REAL no provisioning + `DELETE /onboarding/demo-data` + `DemoOverlay` + nudge. **NÃO é no-op de 7-2** — 7-2 é demo *tenant* separado; ver §2/§3. |
| **10-3** Importação CSV — upload, preview, validação | `import-csv-preview` | **NOVA (trabalho genuíno)** | Parse client-side (CSV+XLSX, auto-encoding) + `FileUploadZone` + `CSVPreviewTable` + validação inline. Backend novo: `GET /users/check-emails` (batch). **Sem código/deps hoje.** |
| **10-4** Importação CSV — confirmação, processamento | `import-csv-process` | **NOVA (trabalho genuíno)** | `POST /groups/:groupId/members/import` (sync ≤100 / async BullMQ >100) + polling `GET /import/jobs/:jobId` + `ImportResultSummary`. Reusa group-members service + padrão fila 8-7. **Fila `csv-import` SEM `:` (§8.2).** |

**Nenhuma é redundante.** 10-1 é majoritariamente FE novo; 10-2 é arquitetura de demo nova (não substitui 7-2); 10-3/10-4 são CSV import do zero.

---

## 1. ⚠️ DRIFTS / fatos do código real — corrigir nos artifacts

1. **Path do módulo onboarding API: as stories dizem `apps/api/src/modules/onboarding/`; o repo NÃO usa `modules/`.** O módulo real está em `apps/api/src/onboarding/` (plano, flat — igual a todos os bounded contexts: `users/`, `groups/`, `meetings/`, `privacy/`, etc.). **Usar `apps/api/src/onboarding/`** em 10-1/10-2/10-4. Idem rotas web: stories citam `apps/web/src/app/(authenticated)/groups/import/` — o app real é `apps/web/app/(authenticated)/...` (SEM `src/`, rotas em PT-BR: `selecionar-igreja/`, `app/admin/`). Mapear para a convenção real ao planejar.

2. **`PATCH /api/v1/tenants/current` NÃO EXISTE.** `tenants.controller.ts` só tem `GET me`. Story 10-1 (Task 2.5, Step 2/5.3) diz "reuse existing `PATCH /tenants/current`" — **é endpoint NOVO**. Além disso a convenção do repo é **`me`, não `current`** (todos os controllers usam `/me`). → Criar `PATCH /api/v1/tenants/me` (não `/current`) em 10-1. Campos: display name, branding logo, denomination, city/state, metadata, + persistência de `onboardingProgress`/`onboardingSkippedAt`.

3. **`PATCH /api/v1/users/me` (editar perfil) NÃO EXISTE.** `users.controller.ts` tem só `GET me`, `PATCH me/onboarding-complete`, `GET me/onboarding-status`. Step 1 do wizard (display name, foto, role title) precisa de **endpoint de update de perfil NOVO** (`PATCH /users/me`). Não confundir com `me/onboarding-complete`.

4. **Onboarding tracking JÁ EXISTE, mas é USER-scoped — 10-1 quer TENANT-scoped.** Hoje: `User.onboardingCompletedAt` (schema.prisma:167) + 3 endpoints (`GET/PATCH me/onboarding-*`) + FE `apps/web/app/(authenticated)/_components/onboarding-redirect-guard.tsx` + hook `use-onboarding.ts`. Isso é o gate de "primeiro login" por usuário (Story 7-1). 10-1 adiciona `Tenant.onboardingProgress` (JSONB) + `Tenant.onboardingSkippedAt`. **Decisão (§10.1)**: os dois coexistem — o user-flag dispara o redirect; o wizard do admin grava progresso no tenant. **NÃO recriar** o redirect guard nem o user-flag; o wizard 10-1 *engata* no guard existente (admin_tenant sem `onboardingProgress.completed` → renderiza wizard).

5. **`Tenant.isDemo` JÁ EXISTE** (schema.prisma:263, Story 7-2) e marca um **tenant inteiro** como demo. 10-2 introduz `isDemoData` **por-registro** em 9 tabelas — campo diferente, propósito diferente (ver §2/§3). Não reaproveitar `isDemo` para o fim de 10-2.

6. **`turbo.json` já tem pipeline `db:seed`** (linha 38) e `apps/api/package.json` já tem `db:seed` + `db:seed:demo`/`:clean`/`:keycloak`. Task 4 do 10-2 ("add db:seed script + turbo pipeline") está **parcialmente feita** — reconciliar, não duplicar (adicionar suporte a `--tenant-id` ao seed existente, não criar novo script).

7. **Nenhuma dep de CSV/XLSX/upload instalada** (`grep papaparse|xlsx|csv-parse|exceljs|multer` → vazio). 10-3 (parse client-side) e 10-4 (sem upload de arquivo — recebe JSON validado) precisam escolher libs. XLSX deve ser **dynamic `import()`** (AC 10-3) p/ não inflar o bundle. CSV pode ser parser próprio leve ou `papaparse`.

---

## 2. Base JÁ ENTREGUE — NÃO recriar

- **Módulo `onboarding/` (API)** — `onboarding.controller.ts` (só `GET /api/v1/onboarding/demo-radar`, payload determinístico de preview do radar) + `onboarding.module.ts`. 10-1 **estende** (service + status + progress); 10-2 **adiciona** cleanup `DELETE /onboarding/demo-data`; 10-4 **adiciona** endpoints de import. O `demo-radar` já serve o Step 5 do wizard (preview do Radar sem dados reais) — **reusar, não recriar**.
- **Rotas/infra FE onboarding** — route group `apps/web/app/(onboarding)/` (fluxo convite/boas-vindas: `convite/[token]/...`), `apps/web/src/components/onboarding/` (`onboarding-page-layout.tsx`, `token-error-state.tsx`, `index.ts`), hook `use-onboarding.ts`, guard `onboarding-redirect-guard.tsx`. 10-1 adiciona `onboarding-wizard.tsx` + `steps/*` reusando o layout; 10-2 adiciona `demo-overlay.tsx`.
- **`demo-seed.ts` (7-2)** — referência de **distribuição realista do semáforo** (4 verde / 3 amarelo / 2 vermelho / 1 novo) + UUIDs v7 fixos + idempotência por upsert + cleanup por cascade. 10-2 reusa a *lógica de geração* (progresso de trilha/telemetria por estado), mas com **arquitetura diferente** (§3): demo dentro de tenant real, não tenant separado.
- **`group-members` (4-2)** — `group-members.controller.ts` (`@Post()` add member, `@Patch(:userId)`), `group-members.service.ts` (usa `PlanLimitsService`, `getRequestContext`, repository). 10-4 **reusa** o service para criar cada participante por linha (respeitar `PlanLimitsService` — import em massa pode estourar limite de plano → validar no §8).
- **`reports/` (8-7)** — padrão canônico **BullMQ job + polling + status** (`reports.service.ts` createQueue/add, `reports.controller.ts` `GET jobs/:jobId` + 202+jobId, `reports.processor.ts` worker `OnModuleInit`). **Copiar p/ `queue csv-import`** (10-4). Fila existente confirmada: `export-audit-csv` (sem `:`).
- **`storage/` (8-2)** — MinIO `storage.service.ts` (`getSignedUrl`, policies `temporary`/`permanent`). Step 1/2 do wizard (foto perfil / logo igreja) usam upload MinIO com policy `permanent` (10-1).
- **`bullmq.service.ts`** — `new Queue(name, ...)` com prefix `queue` aplicado internamente. Filas novas passam **só o nome, sem `:`** (§8.2).
- **`vocabulary.ts`** — vocabulário pastoral (UX-DR16). Todos os labels do wizard (10-1) e do import (10-3) saem daí + `apps/web/messages/pt-BR.json`.

---

## 3. 🔀 CONFLITO 10-2 × 7-2 — dois modelos de "demo data" (resolver antes de codar)

| | **7-2 (existente)** | **10-2 (a fazer)** |
|---|---|---|
| Granularidade | Tenant inteiro (`Tenant.isDemo`) | Registro a registro (`isDemoData` em 9 tabelas) |
| Onde vive | Tenant DEDICADO de demo (UUIDs fixos) | DENTRO do tenant real do admin, no provisioning |
| Cleanup | `DELETE FROM tenants WHERE is_demo` (cascade) | `DELETE /onboarding/demo-data` (só linhas `isDemoData=true` do tenant) |
| Nomes | maria/joão/... | Ana(verde)/Pedro(amarelo)/Maria(vermelho) + líder Marcos Silva |
| Propósito | Dev/E2E/seed local (`db:seed:demo`) | UX de primeiro valor do admin real |
| Keycloak | tem contas (7-4 keycloak seed) | usuários fictícios SEM Keycloak |

**Não são intercambiáveis** — propósitos distintos. **Recomendação (§10.2)**: manter 7-2 para dev/E2E **e** construir 10-2 para a experiência do admin. Reaproveitar de 7-2 apenas a **lógica de geração por estado de semáforo** (extrair p/ helper compartilhado em `onboarding/seed/` se valer). Riscos a tratar em 10-2:
- **`isDemoData` em 9 tabelas** (`users, groups, group_members, trails, trail_modules, lessons, trail_progress, meeting_telemetry, pastoral_actions`) = migration grande; **confirmar nomes reais de tabela/coluna** no schema antes (ex.: telemetria=`meeting_telemetry`? ações=`pastoral_actions`? progresso=`trail_progress` vs `lesson_progress`/`module_progress` — o Epic 9 §3 mapeou `lesson_progress`/`module_progress`/`trail_progress` separados).
- **Usuários demo sem Keycloak**: criam `users` com `isDemoData=true` mas sem conta Keycloak → garantir que não quebram guards/queries que assumem Keycloak (são só dados de leitura para o radar/listas).
- **Integração no provisioning (Epic 3)**: `seedDemoData(tenantId)` chamado ao fim do provisioning. Confirmar o ponto de hook real no fluxo de provisioning do super-admin (Cenário 09 / `super-admin-tenants`). Falha do seed **não pode** abortar o provisioning (try/catch + log).
- **Nudge "primeiro grupo real"**: dispara quando admin cria 1º grupo NÃO-demo → hook no `groups.service` create (evento/flag), sem acoplar groups a onboarding (usar evento de domínio ou checagem no FE).

---

## 4. Migrations necessárias

- **10-1** `Tenant`: `+ onboardingProgress Jsonb? @map("onboarding_progress")`, `+ onboardingSkippedAt DateTime? @map("onboarding_skipped_at")`. (`onboardingCompletedAt` já existe mas em `User`, não `Tenant` — decidir se o "completed" do tenant vive no JSONB `onboardingProgress.completedAt` ou em coluna própria; recomendo dentro do JSONB p/ minimizar migration.) Zod `OnboardingProgressSchema` em `packages/types/src/onboarding/progress.ts` + snapshot.
- **10-2** `+ isDemoData Boolean @default(false) @map("is_demo_data")` nas 9 tabelas (confirmar nomes §3) + índice `(tenant_id, is_demo_data)` em cada uma p/ cleanup eficiente.
- **10-3** — **sem migration** (parse + validação client-side; `check-emails` é só leitura). Zod `CSVRowSchema`/`CSVValidationResultSchema` em `packages/types/src/onboarding/csv-import.ts` + snapshot.
- **10-4** — **sem migration** (cria `users`/`group_members` existentes; resultado do job em Redis/BullMQ, não em tabela nova — confirmar se quer persistir histórico de imports; AC não exige). Zod `CSVImportResultSchema` em `packages/types/src/onboarding/csv-import-result.ts` + snapshot.

**Padrão RLS spec obrigatório** para qualquer policy nova. 10-2 toca 9 tabelas já com RLS — a migration de coluna **não** altera policy, mas adicionar specs que confirmem que `isDemoData` não vaza entre tenants (cleanup só apaga do tenant corrente). 10-4 cria `group_members`/`users` via service já testado — reusar specs de 4-2.

---

## 5. Endpoints — inventário (novo vs reuso)

| Endpoint | Story | Status | Nota |
|----------|-------|--------|------|
| `GET /api/v1/onboarding/status` | 10-1 | **NOVO** | progresso do wizard (do `Tenant.onboardingProgress`) |
| `PATCH /api/v1/tenants/me` | 10-1 | **NOVO** | (artifact diz `/current` — usar `/me`, §1.2) |
| `PATCH /api/v1/users/me` | 10-1 | **NOVO** | update de perfil (§1.3) |
| `POST /api/v1/groups` | 10-1 | **REUSO** (4-1) | criar 1º grupo + auto-líder |
| invite líder | 10-1 | **REUSO** (4-3) | mesmo mecanismo BullMQ stub |
| `GET /api/v1/onboarding/demo-radar` | 10-1 | **REUSO** (existe) | preview Step 5 |
| `DELETE /api/v1/onboarding/demo-data` | 10-2 | **NOVO** | apaga `isDemoData=true` do tenant, 204 |
| `seedDemoData(tenantId)` no provisioning | 10-2 | **NOVO** | hook Epic 3 |
| `GET /api/v1/users/check-emails?emails=` | 10-3 | **NOVO** | batch ≤500, tenant-scoped |
| `POST /api/v1/groups/:groupId/members/import` | 10-4 | **NOVO** | sync ≤100 (201) / async >100 (202+jobId) |
| `GET /api/v1/import/jobs/:jobId` | 10-4 | **NOVO** | polling status (padrão 8-7) |

---

## 6. Multi-tenant na importação (FR03) — regra crítica do 10-4

AC do 10-4 define 3 caminhos por linha:
- **e-mail novo na plataforma** → cria conta + adiciona ao grupo como `participante`.
- **e-mail já existe em OUTRO tenant** → **NÃO auto-vincula**; envia convite (consentimento). Usuário precisa **ACEITAR** (reusa fluxo de convite 4-3 + consentimento).
- **e-mail já existe NESTE tenant** → marca como "já existente" (ignora).

Isso exige `check-emails` (10-3) cruzar **plataforma toda** (não só tenant) para o preview — porém RLS é tenant-scoped. **Decisão (§10.3)**: `check-emails` retorna apenas existência *no tenant corrente* (RLS); a desambiguação "existe em outro tenant" acontece **no processamento server-side** (10-4), que pode checar `users.email` global via cliente base (e-mail é `@unique` global no schema — `User.email String @unique`). Confirmar se a checagem global de e-mail no preview é necessária ou se só o resultado final reporta isso.

---

## 7. Ordem & estratégia de execução

**10-2 → 10-1 → 10-3 → 10-4** (sequencial).
- **10-2 primeiro**: 10-1 Step 3 ("explorar com dados de demonstração" → pula p/ Step 5) e Step 5 (preview com demo) **referenciam demo data de 10-2**. O artifact de 10-1 diz "if available" (degrada bem), e o sprint-roadmap sugere paralelo — mas para o caminho demo-explore do wizard ser real, 10-2 antes evita stub temporário. (Se preferir paralelismo, 10-1 pode ir primeiro com o caminho demo desabilitado; **recomendo 10-2 antes**.)
- **10-1 segundo**: maior peça de FE; consome groups/invite/demo/demo-radar já prontos.
- **10-3 terceiro**: parse + preview + `check-emails`; independente de 10-1/10-2.
- **10-4 por último**: depende dos dados validados de 10-3; reusa group-members + padrão fila 8-7.

Via cstk `/feature-00c` **por story**, short-names: `dados-demonstracao`, `onboarding-wizard`, `import-csv-preview`, `import-csv-process`. State em `.claude/feature-00c-state/<short>/`. Crash → `/feature-00c-resume <short>` (`.lock` órfão: `rmdir` antes de readquirir; `state-lock.sh check` semântica invertida = exit 0 livre; `current_stage` é top-level no `state.json`).

---

## 8. ⚠️ GUARDRAILS CI (repassar a TODO orquestrador feature-00c)

1. **NUNCA push direto em `dev`** — `ci.yml` só dispara em `pull_request` (branch protection ainda NÃO configurada). Toda story: **feature-branch → PR → CI verde → squash-merge**. Após cada "concluído" do feature-00c, **auditar `git log`**: entrou via PR squash `(#NNN)`? Se commit direto em dev → recuperar (reset `dev→commit~1` + `--force-with-lease`, mover p/ feature-branch, PR, CI, squash). Ver memória `feedback_feature00c_direct_push_dev_bypasses_ci`.
2. **BullMQ: NUNCA `:` em nome de fila** (10-4). `BullMqService` já aplica `prefix:'queue'` → fila = `csv-import` e `notifications`, **não** `queue:csv-import`. `:` quebra o boot **só no E2E** (crash do hotfix `6aa72c3`). Confirmar contra fila existente `export-audit-csv`.
3. **PlanLimitsService no import** (10-4): import em massa cria N `group_members` → pode estourar limite de plano. Decidir: validar limite total ANTES de processar (rejeitar/avisar) ou parar no limite e reportar linhas falhas. **Não ignorar** o `PlanLimitsService` que o `group-members.service` já injeta.
4. **Validar local antes de done**: `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint` (lint `--max-warnings 0`; jest-axe é gate real — wizard 10-1 e tabelas de preview 10-3 têm muito a11y). Após migration/dep: `pnpm install` + commit `pnpm-lock.yaml`. **Nova dep CSV/XLSX (10-3) → lockfile no PR.**
5. **RLS spec local**: re-aplicar grants do role `metanoia_app` após subir `docker-compose.test.yml` (`init-app-role.sql` roda no initdb vazio): `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO metanoia_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO metanoia_app;` como owner `metanoia`. RLS spec Prisma v7: `PrismaPg({connectionString: DATABASE_APP_URL})`, UUIDs fixos hex, users globais, cleanup só mutável.
6. **useMutation FE** (skip/complete wizard 10-1, confirmar import 10-4, limpar demo 10-2): `useMutation<undefined, Error, T>`, mutationFn async com `await` + `return undefined`.
7. **Flakes conhecidos**: `reflections.rls-spec.ts` (FK P2003), E2E `registry-1.docker.io deadline`, cache-miss turbo/prisma → `gh run rerun --failed`; `gh pr merge` 401 → retry 3-4x.
8. **Contratos**: `tenant_id` em toda tabela (nunca parâmetro — `AsyncLocalStorage`/`withTenantTx`); UUID v7 `generateId()`/`uuidv7()` (nunca `@default(uuid())`); ISO 8601; nulls explícitos; Create 201 / Delete 204 / **Async 202**; `{data,meta?}` sucesso, `{statusCode,error,message,details?}` erro; código+log inglês, user-facing PT-BR + vocabulário pastoral; conventional commits PT-BR; `ZodValidationPipe` custom; Zod em `packages/types` + snapshot.

---

## 9. Fechamento

Ao mergear as 4: marcar `10-1/10-2/10-3/10-4: done` + `epic-10: done` em `sprint-status.yaml` (commit `docs(planning)` direto em dev OK — convenção do repo p/ planning-artifacts). Rodar `epic-10-retrospective` (optional). Atualizar memória. **Epic 10 fecha 10/16 épicos.**

---

## 10. Decisões (resolvidas 2026-06-13)

1. **✅ RESOLVIDO** — §1.4/§3: **mantemos os dois** modelos de demo (7-2 tenant dedicado + 10-2 por-registro no tenant real). 10-2 extrai só a lógica de geração de semáforo de 7-2.
2. **✅ CONFIRMADO** — §1.2/§1.3: criar `PATCH /tenants/me` e `PATCH /users/me` (perfil) como endpoints NOVOS, nomenclatura `/me` (não `/current`).
3. **✅ RESOLVIDO** — §6: `check-emails` (10-3) reporta existência **apenas no tenant corrente** (RLS-scoped). A desambiguação "existe em outro tenant" (FR03) acontece **só no processamento server-side do 10-4** (checagem global de `users.email @unique`). Preview não faz checagem global.
4. **✅ RESOLVIDO** — §8.3: import em massa **valida o total contra o limite de plano ANTES de processar**; se exceder, **rejeita o import inteiro** com mensagem acionável (ex.: "Importar 200 participantes excederia o limite do seu plano (100). Faça upgrade ou reduza a lista."). Sem import parcial. Alinha com Story 7-3 (erros acionáveis).
5. **⏳ IMPL-TIME** — §3: confirmar nomes reais das 9 tabelas/colunas de progresso/telemetria/ações no schema antes da migration `isDemoData` (checar no arranque de 10-2).
6. **✅ CONFIRMADO** — §7: ordem **10-2 → 10-1 → 10-3 → 10-4**.
