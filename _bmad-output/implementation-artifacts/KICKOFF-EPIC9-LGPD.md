# KICKOFF — Epic 9 (Privacidade, LGPD & Compliance) via cstk

> Prompt de arranque para **sessão limpa**. Copie o bloco "PROMPT PARA COLAR"
> abaixo. Contexto e sondagens estão documentados aqui para auditoria.
> Gerado 2026-06-11 com Epic 8 fechado (dev `bdae561`).

---

## Contexto da onda

- Projeto: `metanoia-hub`, branch `dev` em `bdae561` (limpa). Epic 8 (Content) fechado 10/10 + retro.
- Epic 9 = **4 stories** (Sprint 15), `epic-9: in-progress` no `sprint-status.yaml`, todas `ready-for-dev`:
  - **9-1** Exportação de dados pessoais (portabilidade LGPD) — `dados-exportacao`
  - **9-2** Exclusão de dados pessoais (eliminação LGPD) — `dados-exclusao`
  - **9-3** Log de auditoria imutável (append-only) — `auditoria-log`
  - **9-4** Base legal & histórico de consentimento — `base-legal-consentimento`
- Fonte autoritativa: `_bmad-output/planning-artifacts/epics/epic-09.md` (187 linhas, 4 stories com ACs detalhados).
- Retro Epic 8: `_bmad-output/implementation-artifacts/epic-8-retro-2026-06-11.md` (lê §6 + action items).

## 🚨 Pré-requisito arquitetural que ATRAVESSA 9-1 e 9-2 (do retro Epic 8)

As Stories 9.1 (export) e 9.2 (deletion) assumem que **cada módulo expõe métodos dedicados** — `exportUserData(userId, tenantId)` e `softDeleteUserData(userId)`/`hardDeleteUserData(userId)` — coletando/removendo via service do módulo (NÃO query direta às tabelas, p/ respeitar fronteiras). **Esses métodos NÃO existem ainda** em Content (Epic 8), Meetings (Epic 5), Pastoral (Epic 6), Groups/Progress. Há testes de completude que FALHAM se uma tabela com dado pessoal não tiver o método correspondente. → Tratar como **FASE 0 / sub-tarefa obrigatória** dentro de 9-1 e 9-2 (inventariar módulos com dado pessoal e adicionar os métodos), não como surpresa de execução.

## Sondagens pré-flight (faça você mesmo antes de disparar)

Crie uma **RECONCILIACAO-EPIC9** (mesmo ritual das waves W1b) commitando o resultado, cobrindo:

1. **Inventário de dado pessoal por módulo** — quais services tocam `userId` (content/progress, meetings/attendance, pastoral, groups/group-members, consent, onboarding) → lista de `exportUserData`/`deleteUserData` a criar. Base p/ os testes de completude de 9-1/9-2.
2. **Módulos/models existentes a NÃO recriar:** módulo `consent` já existe (model `Consent` em `schema.prisma:195`, repository pattern) — 9-4 estende para histórico (`ConsentRecord` de withdrawal) + cria `DataProcessingRegistry`. Confirmar se `ConsentRecord` já existe ou precisa ser criado.
3. **Migrations necessárias (Content não precisou; Epic 9 precisa):**
   - 9-2: status de conta `deletion_pending`/`deleted` (User tem `status String @default("ok")` em `schema.prisma:13`) + tabela `deletion_requests` (requestId, userId, status, cancellableUntil, deletionDeadline).
   - 9-3: tabela `audit_events` + **RLS append-only (só INSERT + SELECT; SEM UPDATE/DELETE policy)** + índice `(tenant_id, timestamp DESC)`.
   - 9-4: `DataProcessingRegistry` (seeded via migration) + `ConsentRecord` (se ausente).
4. **Infra a reusar (de Epic 8/4/5):** BullMQ job + polling + status em Redis (8-7 `queue:reports`); signed URL MinIO (8-2 storage.service); contrato 202+jobId; stub de e-mail via `queue:notifications` (**não existe ainda** — checar padrão stub console.log do Epic 4 Story 4.3 convites em `apps/api/src/invites/`). Filas novas: `queue:privacy-export`, `queue:privacy-deletion`.
5. **AuditInterceptor (9-3) é global cross-cutting** — aplica só a métodos mutativos (POST/PUT/PATCH/DELETE), captura previousState/newState. Verificar ordem com guards existentes (KeycloakAuthGuard/RolesGuard/ConsentGuard).

## Ordem & estratégia de execução

- **Sequencial recomendada: 9-3 → 9-4 → 9-1 → 9-2.** Razão: 9-3 (audit log) é dependência de 9-1/9-2/9-4 (todas gravam evento de auditoria: export, deletion, consent withdrawal). 9-2 por último (mais destrutivo + depende de export/audit prontos). Confirme/ajuste na RECONCILIACAO.
- Executar **via cstk `/feature-00c` por story** (padrão provado em W1b.3), short-names: `auditoria-log`, `base-legal-consentimento`, `dados-exportacao`, `dados-exclusao`. State em `.claude/feature-00c-state/<short>/`.
- Se a sessão cair (lock stale após crash, como 8-8/8-9): `/feature-00c-resume <short>`; se `.lock` órfão, `rmdir` antes de readquirir (atenção: `state-lock.sh check` tem semântica invertida — exit 0 = livre).

## ⚠️ GUARDRAILS CI (RECONCILIACAO-EPIC8 §5 + lição da 8-10)

- **NUNCA aceitar push direto em `dev`.** O `ci.yml` só dispara em `pull_request` — push direto = CI nunca roda. Toda story entra por **feature-branch → PR → CI verde → squash-merge** (como #124–#134). **Após cada "concluido" do feature-00c, auditar o git real**: o trabalho entrou via PR squash (`(#NNN)`)? Se foi commit direto em dev, recuperar via PR limpo (reset dev→commit~1 + `--force-with-lease`, mover p/ feature-branch, corrigir, PR, CI, squash). Ver memória `feedback_feature00c_direct_push_dev_bypasses_ci`.
- **Validar localmente o que o CI roda** antes de declarar done: `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint` (lint usa `--max-warnings 0`; jest-axe é gate real de a11y). Após migration/dep: `pnpm install` + commit `pnpm-lock.yaml`.
- **RLS spec Prisma v7** (obrigatório p/ toda policy nova, ESP. 9-3 append-only + 9-2 deletion): adapter `PrismaPg({connectionString: DATABASE_APP_URL})`, UUIDs fixos hex, users globais (sem role, `group_members` sem `updated_at`), cadeia FK em `beforeAll`/`afterAll`, `beforeEach` limpa só mutável. **9-3 exige teste de imutabilidade**: tentar UPDATE/DELETE em `audit_events` via raw SQL → confirmar que RLS bloqueia. Invariante `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.
- **useMutation FE** (toggles de consentimento 9-4, cancelar deletion 9-2): `useMutation<undefined, Error, T>`, mutationFn async com await + `return undefined` (ver `use-pastoral-admin.ts`).
- Flakes conhecidos: `reflections.rls-spec.ts` (FK P2003), E2E `registry-1.docker.io deadline`, cache-miss turbo/prisma → `gh run rerun --failed`; `gh pr merge` 401 → retry 3-4x.
- Multi-tenant: `tenantId` em toda tabela, nunca como parâmetro (AsyncLocalStorage/`withTenantTx`); UUID v7 `generateId()`. **Export/Deletion cruzam tenants** (LGPD = TODOS os tenants do usuário) → usar modo privilegiado que sobrepõe RLS temporariamente (padrão do super-admin `bypass RLS`, ver Epic 9 Story 9.1 e módulo `super-admin`). Datas ISO 8601, nulls explícitos. Create 201/Delete 204/**Async 202**. Código+log inglês, user-facing PT-BR + vocabulário pastoral. Conventional commits PT-BR. `ZodValidationPipe` custom. Zod em `packages/types` + snapshot.

## Fechamento

Ao mergear as 4 stories: marcar 9-1/9-2/9-3/9-4 `done` + `epic-9: done` em `sprint-status.yaml` (commit `docs(planning)` direto em dev é OK — convenção do repo p/ planning-artifacts, não toca build/lint/test). Rodar `epic-9-retrospective` (optional). Atualizar memória.

---

## PROMPT PARA COLAR (sessão limpa)

```
Quero desenvolver o Epic 9 (Privacidade, LGPD & Compliance) do metanoia-hub via pipeline cstk /feature-00c, uma story por vez. Branch dev em bdae561 (limpa); Epic 8 fechado 10/10 + retro.

Antes de disparar, faça a sondagem pré-flight e commite uma RECONCILIACAO-EPIC9 seguindo TODAS as instruções de _bmad-output/implementation-artifacts/KICKOFF-EPIC9-LGPD.md (já contém: inventário de exportUserData/deleteUserData por módulo — pré-req que atravessa 9-1/9-2; migrations necessárias de 9-2/9-3/9-4; módulos a não recriar; infra a reusar; ordem 9-3→9-4→9-1→9-2; e os guardrails CI). Fonte autoritativa das stories: _bmad-output/planning-artifacts/epics/epic-09.md. Lê também §6 do epic-8-retro-2026-06-11.md (gap exportUserData).

REGRA CRÍTICA (lição da 8-10): NUNCA aceitar push direto em dev — ci.yml só roda em pull_request. Toda story entra por feature-branch → PR → CI verde → squash-merge. Após cada "concluido" do feature-00c, audite o git real e, se houve commit direto em dev, recupere via PR limpo. Valide local (prisma generate && turbo build && turbo lint) antes de declarar done.

Execute na ordem 9-3 → 9-4 → 9-1 → 9-2 com short-names auditoria-log, base-legal-consentimento, dados-exportacao, dados-exclusao. Se a sessão cair, retome com /feature-00c-resume <short> (remova .lock órfão com rmdir se stale; state-lock.sh check tem semântica invertida). Ao fechar as 4, marque epic-9: done e rode epic-9-retrospective. Atualize a memória.

Comece pela sondagem pré-flight + RECONCILIACAO-EPIC9. Só dispare /feature-00c auditoria-log depois de eu revisar a reconciliação.
```
