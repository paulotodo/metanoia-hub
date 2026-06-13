# Quickstart / Cenários de Teste — onboarding-wizard (Story 10-1)

> Cenários de validação dos fluxos críticos (happy path + error cases) e
> guardrails de CI. Formato: passos numerados → **Expected**.

## Pré-requisitos de ambiente

1. `docker compose up` (Postgres+RLS, Redis, MinIO, Keycloak).
2. `pnpm install` (após migration/dep nova, commitar `pnpm-lock.yaml`).
3. `pnpm exec prisma generate` + `pnpm exec prisma migrate dev` (aplica
   `add_onboarding_wizard_tenant_user_fields`).
4. RLS spec local: após subir `docker-compose.test.yml`, re-aplicar grants do
   role `metanoia_app` (initdb roda em banco vazio):
   ```sql
   GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO metanoia_app;
   GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO metanoia_app;
   ```
   como owner `metanoia`.

---

## Cenário 1 — Wizard dispara no primeiro login (P1, FR-01)

1. Login como `admin_tenant` de tenant recém-provisionado (sem grupos, sem
   `onboardingProgress`).
2. Painel principal carrega; `onboarding-redirect-guard.tsx` chama
   `GET /api/v1/onboarding/status`.
3. **Expected**: `progress.completed=false`, `skippedAt=null`,
   `hasRealGroups=false` → guard renderiza o wizard full-screen com 5 etapas e
   indicador de progresso. `super_admin` NÃO vê o wizard.

## Cenário 2 — Etapa 1 perfil (P2, FR-03)

1. Preencher display name (obrigatório), título pastoral (opcional), foto
   (opcional, upload via storage.service).
2. Avançar → FE chama `PATCH /api/v1/users/me` com `{ name, roleTitle,
   profilePhotoUrl }`.
3. **Expected**: 200; `User.name`/`roleTitle`/`profilePhotoUrl` atualizados;
   `onboardingProgress.completedSteps` inclui 1. Sem foto → etapa conclui
   mesmo assim.
4. **Error**: upload de formato inválido → mensagem acionável PT-BR; campo
   permanece opcional, avanço não bloqueado (FR-13).

## Cenário 3 — Etapa 2 comunidade (P3, FR-04)

1. Preencher nome da igreja (obrigatório), denominação/cidade/UF (opcionais),
   logo (opcional).
2. Avançar → `PATCH /api/v1/tenants/me` com `{ name, denomination, city,
   state, logoUrl, onboardingProgress }`.
3. **Expected**: 200; `name`/`logoUrl` em colunas, denominação/cidade/UF em
   `metadata`, `completedSteps` inclui 2. Cidade/UF em branco → salvos como
   `null` explícito.

## Cenário 4 — Etapa 3 grupo real vs modo-demo (P4, FR-05)

1a. Opção (a): criar grupo (nome+descrição) → `POST /api/v1/groups`.
    **Expected**: grupo criado, admin marcado como líder; `stepData.mode=
    'real-group'`; Etapa 4 habilitada.
1b. Opção (b) modo-demo (só se `demo-status.hasDemoData=true`).
    **Expected**: `stepData.mode='demo'`; Etapa 4 pulada; salta para Etapa 5.
2. **Error**: nome de grupo duplicado no tenant → erro acionável, pode tentar
   de novo. Demo data indisponível → opção (b) oculta (degradação graciosa).

## Cenário 5 — Etapa 4 convite de líder (P5, FR-06)

1. Só exibida se Etapa 3 foi opção (a). Inserir nome+e-mail → mecanismo de
   convite existente (Epic 4-3). Ou "Fazer depois" (skip).
2. **Expected**: convite enviado (`completedSteps` inclui 4, `stepData` marca
   "convidou") ou skip ("pulou"); progresso não bloqueado.
3. **Error**: e-mail inválido → validação inline antes de enviar. E-mail já é
   usuário do tenant → mensagem informativa, sem convite duplicado.

## Cenário 6 — Etapa 5 radar + conclusão (P6/P7, FR-07/FR-08)

1. Explicação do semáforo (verde/amarelo/vermelho). Preview: demo
   (`GET /onboarding/demo-radar`, rótulo "Exemplo") se modo-demo, ou dados
   reais/prompt-aguardar se grupo real.
2. "Concluir Setup" → `PATCH /api/v1/tenants/me` com
   `onboardingProgress.completed=true, completedAt=<now>`.
3. **Expected**: wizard marcado concluído; redirect ao painel; não reaparece em
   logins futuros.

## Cenário 7 — Skip explícito (P8, FR-08)

1. Acionar "Pular configuração".
2. **Expected**: `PATCH /tenants/me` grava `onboardingProgress.skippedAt=<now>`
   (distinto de `completedAt`); vai ao painel; não reaparece.
3. **Invariante**: backend rejeita `completedAt` E `skippedAt` simultâneos.

## Cenário 8 — Retomada após interrupção (Edge, FR-02, Success Criteria 3)

1. Fechar navegador na Etapa 3; relogar.
2. `GET /onboarding/status` → `currentStep=3`.
3. **Expected**: wizard retoma da Etapa 3 (estado persistido no tenant).

## Cenário 9 — Replay "Rever tutorial" read-only (FR-09, dec-010)

1. Acessar `/app/admin/configuracoes/rever-tutorial`.
2. Wizard abre com `readOnly=true`; forms `disabled`; nenhum submit ao backend.
3. **Expected**: explicações visíveis; `onboardingProgress` NÃO alterado.

---

## Cenário 10 — Roundtrip End-to-End (OBRIGATÓRIO — anti-drift de borda)

> Razão: histórico de drift snake_case vs camelCase mascarado por testes que
> parseavam mocks. Este cenário faz chamada REAL ao backend.

1. Subir backend real (NÃO MSW). Autenticar `admin_tenant`.
2. `PATCH /api/v1/users/me` com `{ name, profilePhotoUrl, roleTitle }`.
3. Capturar o payload de resposta REAL e o registro no banco.
4. **Expected**:
   - Banco: colunas `name`, `profile_photo_url`, `role_title` (snake_case).
   - Resposta API: `{ data: { name, profilePhotoUrl, roleTitle } }` (camelCase).
   - Zod (`UpdateUserProfileResponseSchema`) faz `parse` no payload real sem
     erro → confirma que o mapper DB↔DTO converte snake_case ↔ camelCase
     corretamente.
5. Repetir para `PATCH /tenants/me` (`onboarding_progress` JSONB ↔
   `onboardingProgress`, `logo_url` ↔ `logoUrl`) e `GET /onboarding/status`.

---

## Guardrails de CI (repassar — RECONCILIACAO §8)

1. **NUNCA push direto em `dev`** — `ci.yml` só dispara em `pull_request`
   (branch protection não configurada). Story: feature-branch → PR → CI verde →
   squash-merge. Após "concluído", auditar `git log`: entrou via PR squash
   `(#NNN)`? Se commit direto em dev → recuperar.
2. **Evento via EventEmitter2, NÃO BullMQ** (dec-009). Sem nome de fila com
   `:`.
3. **useMutation FE** (skip/complete/avançar etapa): `useMutation<undefined,
   Error, T>`, mutationFn async com `await` + `return undefined`.
4. **Validar local antes de done**: `pnpm exec prisma generate &&
   pnpm turbo build && pnpm turbo lint` (lint `--max-warnings 0`; **jest-axe é
   gate real** — wizard tem muito a11y, WCAG AA obrigatório). Após
   migration/dep: `pnpm install` + commit `pnpm-lock.yaml`.
5. **RLS spec Prisma v7**: `PrismaPg({connectionString: DATABASE_APP_URL})`,
   UUIDs fixos hex, users globais, cleanup só de tabelas mutáveis. Re-grants
   `metanoia_app` (acima).
6. **Contratos**: `tenant_id` via `AsyncLocalStorage`/`withTenantTx` (nunca
   parâmetro); UUID v7 `uuidv7()`/`generateId()` (nunca `@default(uuid())`);
   ISO 8601; nulls explícitos; Create 201; `{data,meta?}` / `{statusCode,error,
   message,details?}`; código+log inglês, user-facing PT-BR + vocabulário
   pastoral; conventional commits PT-BR; `ZodValidationPipe` custom; Zod em
   `packages/types` + snapshot.
7. **Flakes conhecidos**: `reflections.rls-spec.ts` (FK P2003), E2E
   `registry-1.docker.io deadline`, cache-miss turbo/prisma → `gh run rerun
   --failed`; `gh pr merge` 401 → retry 3-4x.
