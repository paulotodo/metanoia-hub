# Validation Checklist — Story 9-4 (Base Legal & Histórico de Consentimento)

**Feature**: `base-legal-consentimento` · **Epic**: 9 — LGPD & Privacidade
**Branch**: `feat/story-9-4-base-legal-consentimento`
**Validado em**: 2026-06-11 (sessão de retomada pós-crash)

> Esta story foi recuperada de um crash que interrompeu a onda-005 antes de
> persistir wave/state/commit. As FASEs 3–5 estavam no working tree; a FASE 4.2
> (integration-spec FR-11) estava faltando e foi criada na retomada. Bugs
> latentes na migration (FASE 1) e no lint (FASEs 0/5) foram corrigidos.

---

## 1. Contratos & Tipos (FASE 0)

- [x] `ConsentTypeSchema` / `LegalBasisSchema` / `DataProcessingRegistry*` / `ConsentRecordSchema` / `ConsentHistory*` / `WithdrawConsent*` exportados de `packages/types`
- [x] Snapshots novos verdes; snapshots story 2-8 intactos — **types: 357 testes verdes**

## 2. Banco de Dados (FASE 1)

- [x] Migration `20260618000000_9-4-base-legal-consentimento` aplica sem erro
- [x] `data_processing_registry` global (sem RLS) com **10 operações** seedadas (LGPD Art. 9º)
- [x] `consent_records` tenant-scoped, append-only
- [x] **FIX**: colunas `id`/`user_id`/`tenant_id` corrigidas de `TEXT` → `UUID`
      (a FK `consent_records_user_id_fkey → users(id)` exige UUID; estava quebrada)
- [x] **FIX**: `FORCE ROW LEVEL SECURITY` adicionado (impede bypass do owner)
- [x] **FIX**: cast `::uuid` nas policies NULLIF (SELECT/INSERT)
- [x] RLS isolation `consent-records.rls-spec.ts` — **6/6 verde** (tenant A↔B, null-tenant global, UPDATE/DELETE 0-rows append-only)

## 3. Backend `privacy/` (FASE 2)

- [x] `GET /api/v1/privacy/data-processing` público (`@Public`) + `PrivacyRateLimitGuard` 30 req/min
- [x] `PrivacyService.listDataProcessingRegistry()` mapeia Date→ISO
- [x] Unit `privacy.service.spec` verde (import `beforeEach` não usado removido)

## 4. Backend `consent/` estendido (FASE 3)

- [x] `getHistory` (merge aceites + withdrawals, status derivado por ConsentType)
- [x] `withdrawConsent` (bloqueia mandatórios com `BadRequestException` PT-BR; append-only GAP-06)
- [x] Endpoints `@Get('history')` + `@Patch(':consentType/withdraw')` (`@SkipConsent`, userId/tenantId via AsyncLocalStorage)
- [x] Audit do withdrawal via `AuditInterceptor` global (dec-017/GAP-05) — `AuditModule` não necessário; `ConsentModule` **exporta** `ConsentRepository`
- [x] Unit `consent.service.spec` verde

## 5. Gate FR-11 no TelemetryService (FASE 4)

- [x] `ConsentModule` importado no `MeetingsModule`; `ConsentRepository` injetado em `TelemetryService`
- [x] `recordFocusHeartbeat` chama `hasWithdrawn(userId,'focus_monitoring')` → retorna silenciosamente se revogado
- [x] **Integration-spec criado na retomada** `focus-heartbeat-consent.integration-spec.ts` — User A (revogado) não grava; User B grava — **3/3 verde**

## 6. Frontend (FASE 5)

- [x] i18n `privacy.*` em `messages/pt-BR.json`
- [x] Hooks `use-consent-history` / `use-withdraw-consent`
- [x] Página CSR `/app/consumo/perfil/privacidade` (badges, toggle obrigatório desabilitado, estados loading/erro, a11y)
- [x] Página SSR pública `/privacidade/bases-legais` (fetch nativo, tabela com `<caption>`+`scope`, prerenderizada estática no build)
- [x] Testes FE (hooks MSW + page RTL/MSW + jest-axe) — **web: 10/10 verde**

## 7. Qualidade / CI (FASE 6)

- [x] `pnpm turbo build` (api+web+types) verde
- [x] `pnpm turbo lint` (api+web+types) verde
      **FIX**: `no-surveillance-terms` disparava em literais `focus_monitoring` (enum canônico)
      e no rótulo LGPD "Monitoramento de Foco". Aplicado `eslint-disable` de arquivo
      com justificativa nos test/mock specs e na página (rótulo já canônico em pt-BR.json).
- [x] Testes verdes: types 357 · api unit 35 · web 10 · RLS consent 6 · integration FR-11 3
- [ ] Validação runtime via servidor levantado (curl/auth) — **pendente** (servidor não levantado nesta sessão; coberto por unit + MSW; recomendado smoke manual pós-deploy)

## Itens conhecidos / fora de escopo

- RLS full-suite: 30/31 files verdes; o file que oscila (`health-rls`/`reflections`) é flake
  pré-existente de paralelismo (connection-pool), **alheio a esta story** (ver memória).
- Validação runtime (6.1.3–6.1.6) depende de `pnpm dev` + Keycloak; adiada para smoke manual.
