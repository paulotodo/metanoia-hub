# Tasks: Base Legal & Histórico de Consentimento (Story 9-4)

**Feature**: `base-legal-consentimento`
**Epic**: 9 — LGPD & Privacidade
**Branch**: `feat/story-9-4-base-legal-consentimento`
**Gerado por**: agente-00c-feature-orchestrator (SDD create-tasks)
**Data**: 2026-06-11

> **Origem**: spec.md + plan.md + checklists/ (gaps GAP-03 a GAP-06 absorvidos como subtarefas).

---

## Legenda de Status

- `[ ]` — Pendente
- `[x]` — Concluído
- `[-]` — Cancelado / não aplicável

## Legenda de Criticidade

- `[C]` — Crítico: bloqueia demais tarefas ou requisito LGPD obrigatório
- `[A]` — Alta: requisito funcional principal sem bloqueio imediato
- `[M]` — Média: qualidade, cobertura, non-blocking

---

## FASE 0 — Fundação (contratos Zod + i18n + decisões de ambiguidades)

### 0.1 Estender `packages/types/src/consent.ts` com schemas story 9-4 `[C]`

- [x] 0.1.1 Adicionar `ConsentTypeSchema = z.enum(['terms_of_service', 'privacy_policy', 'focus_monitoring'])` e tipo `ConsentType` — NÃO remover `ConsentDocumentTypeSchema` existente `[C]`
- [x] 0.1.2 Adicionar `LegalBasisSchema` e tipo `LegalBasis` `[C]`
- [x] 0.1.3 Adicionar `DataProcessingRegistryItemSchema` + `DataProcessingRegistryResponseSchema` `[C]`
- [x] 0.1.4 Adicionar `ConsentRecordSchema` `[C]`
- [x] 0.1.5 Adicionar `ConsentStatusBadgeSchema`, `ConsentHistoryItemSchema`, `ConsentHistoryResponseSchema` `[C]`
- [x] 0.1.6 Adicionar `WithdrawConsentInputSchema` + `WithdrawConsentResponseSchema` `[C]`
- [x] 0.1.7 Exportar todos os novos schemas via `packages/types/src/index.ts` `[C]`

### 0.2 Snapshot tests para schemas novos `[C]`

- [x] 0.2.1 Criar `packages/types/src/__tests__/consent-9-4.snapshot.spec.ts` com snapshot para `DataProcessingRegistryItemSchema` (input válido → `toMatchSnapshot()`) `[C]`
- [x] 0.2.2 Snapshot para `ConsentHistoryItemSchema` `[C]`
- [x] 0.2.3 Snapshot para `ConsentRecordSchema` `[C]`
- [x] 0.2.4 Snapshot para `WithdrawConsentInputSchema` `[C]`
- [x] 0.2.5 Snapshot para `WithdrawConsentResponseSchema` `[C]`
- [x] 0.2.6 Verificar que os snapshots existentes de `consent.ts` (story 2-8) não foram quebrados `[C]` — evidência: 357 testes passando, regressão não detectada

### 0.3 MSW handlers frontend `[A]`

- [x] 0.3.1 Criar `apps/web/mocks/handlers/consent-privacy.ts` com handler `GET /api/v1/privacy/data-processing` → 200 com array de 10 registros mock `[A]`
- [x] 0.3.2 Handler `GET /api/v1/consent/history` → 200 com 3 itens (2 aceitos, 1 revogado) `[A]`
- [x] 0.3.3 Handler `PATCH /api/v1/consent/:consentType/withdraw` → 200 para `focus_monitoring`; 400 para `terms_of_service` e `privacy_policy` `[A]`
- [x] 0.3.4 Importar `consent-privacy.ts` em `apps/web/mocks/handlers/index.ts` `[A]`

### 0.4 Decidir ambiguidades (GAP-03 a GAP-06) `[A]`

- [x] 0.4.1 [GAP-03] 10ª operação: split em 2 registros distintos `progressão de trilhas` / `progressão de módulos e aulas`; documentado em comentário SQL da migration `[A]`
- [x] 0.4.2 [GAP-04] Rate limiting: `PrivacyRateLimitGuard` in-memory 30 req/min (padrão do projeto — @nestjs/throttler não instalado); dec-016 `[A]`
- [x] 0.4.3 [GAP-05] Withdrawal auditado automaticamente pelo AuditInterceptor global (PATCH ∈ WRITE_METHODS); sem chamada manual — dec-017; evidência: audit.interceptor.ts L33 `[A]`
- [x] 0.4.4 [GAP-06] Double-withdrawal append-only sem 409; caso de teste em 3.5.5 — dec-018 `[A]`

---

## FASE 1 — Migrations e Banco de Dados

### 1.1 Migration SQL `20260618000000_9-4-base-legal-consentimento` `[C]`

- [x] 1.1.1 Criar arquivo `apps/api/prisma/migrations/20260618000000_9-4-base-legal-consentimento/migration.sql` `[C]`
- [x] 1.1.2 `CREATE TABLE "data_processing_registry"` (sem tenant_id, sem RLS) com campos FR-01 completos `[C]`
- [x] 1.1.3 `CREATE TABLE "consent_records"` com `id, user_id, tenant_id (nullable), consent_type CHECK, action CHECK ('withdrawn'), timestamp` `[C]`
- [x] 1.1.4 FK `consent_records_user_id_fkey` → `users(id) ON DELETE CASCADE` `[C]`
- [x] 1.1.5 Índices: `consent_records_user_consent_idx (user_id, consent_type)` e `consent_records_tenant_idx (tenant_id)` `[A]`
- [x] 1.1.6 RLS em `consent_records`: `ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY` `[C]`
- [x] 1.1.7 Policy SELECT NULLIF `[C]`
- [x] 1.1.8 Policy INSERT NULLIF `[C]`
- [x] 1.1.9 [GAP-03] `INSERT INTO "data_processing_registry"` com 10 operações (ON CONFLICT DO NOTHING) — split trilhas/módulos documentado `[C]`
- [x] 1.1.10 UUIDs v7 `0197b600-...` gerados off-line; prefixo `0197` confirmado `[C]`

### 1.2 Prisma schema `[C]`

- [x] 1.2.1 Adicionar `model DataProcessingRegistry` ao `apps/api/prisma/schema.prisma` após `model Consent` `[C]`
- [x] 1.2.2 Adicionar `model ConsentRecord` com `@@map("consent_records")` `[C]`
- [x] 1.2.3 Adicionar relação em `model User`: `consentRecords ConsentRecord[]` `[C]`
- [x] 1.2.4 `prisma generate` OK — evidência: "Generated Prisma Client (v7.7.0) in 318ms" `[C]`

### 1.3 Teste RLS isolation `consent_records` `[C]`

- [x] 1.3.1 Criar `apps/api/test/rls/consent-records.rls-spec.ts` seguindo padrão PrismaPg `[C]`
- [x] 1.3.2 Caso: INSERT tenant A → SELECT tenant B → nenhum resultado `[C]`
- [x] 1.3.3 Caso: INSERT `tenantId = null` → SELECT tenant A → visível; SELECT tenant B → visível `[C]`
- [x] 1.3.4 Caso: UPDATE direto → rejeição (sem policy UPDATE) `[C]`
- [x] 1.3.5 Caso: DELETE direto → rejeição (sem policy DELETE) `[C]`
- [ ] 1.3.6 Executar `pnpm --filter @metanoia/api test:rls` e confirmar verde `[C]` — pendente DB (CI)

---

## FASE 2 — Backend: módulo `privacy/` (endpoint público)

### 2.1 `PrivacyService` `[C]`

- [x] 2.1.1 Criar `apps/api/src/privacy/privacy.service.ts` com `listDataProcessingRegistry()` usando `this.prisma.client.dataProcessingRegistry.findMany({ orderBy: { operationName: 'asc' } })` `[C]`
- [x] 2.1.2 Mapear `Date → ISO string` no `toDto` (sem expor objeto Prisma bruto) `[A]`

### 2.2 `PrivacyController` `[C]`

- [x] 2.2.1 Criar `apps/api/src/privacy/privacy.controller.ts` com `@Controller('api/v1/privacy')` + `@Get('data-processing')` + `@Public()` `[C]`
- [x] 2.2.2 [GAP-04] `PrivacyRateLimitGuard` 30 req/min via `@UseGuards` (dec-016 — @nestjs/throttler não instalado) `[A]`
- [x] 2.2.3 Sem `@UseGuards(KeycloakAuthGuard)` — endpoint público `[C]`

### 2.3 `PrivacyModule` `[C]`

- [x] 2.3.1 Criar `apps/api/src/privacy/privacy.module.ts` importando `PrismaModule`, declarando controller e provider `[C]`
- [x] 2.3.2 Importar `PrivacyModule` em `AppModule` `[C]`

### 2.4 Testes unitários do `PrivacyService` `[A]`

- [x] 2.4.1 Criar `apps/api/src/privacy/__tests__/privacy.service.spec.ts` `[A]`
- [x] 2.4.2 Mock `PrismaService.client.dataProcessingRegistry.findMany` → retorna array vazio → verifica `{ data: [] }` — evidência: ✓ green `[A]`
- [x] 2.4.3 Mock com registros → verifica shape do DTO (campos ISO string) — evidência: ✓ green `[A]`
- [x] 2.4.4 Controller chama service e retorna resposta sem transformação — evidência: ✓ green `[A]`

---

## FASE 3 — Backend: extensão do módulo `consent/` (history + withdrawal)

### 3.1 `ConsentRepository` — novos métodos `[C]`

- [ ] 3.1.1 Adicionar `findAllAcceptancesByUser(userId: string): Promise<Consent[]>` `[C]`
- [ ] 3.1.2 Adicionar `findWithdrawalsByUser(userId: string, tenantId: string | null): Promise<ConsentRecord[]>` `[C]`
- [ ] 3.1.3 Adicionar `createWithdrawal(input: { id: string; userId: string; tenantId: string | null; consentType: ConsentType; action: 'withdrawn' }): Promise<ConsentRecord>` usando `withTenantTx` `[C]`
- [ ] 3.1.4 Adicionar `hasWithdrawn(userId: string, consentType: ConsentType): Promise<boolean>` usando `this.prisma.client` (sem RLS — intencional, documentado) `[C]`

### 3.2 `ConsentService` — novos métodos `[C]`

- [ ] 3.2.1 Adicionar `getHistory(userId: string, tenantId: string | null): Promise<ConsentHistoryResponse>` — merge de aceites + withdrawals, itera sobre todos `ConsentType`, deriva `isMandatory` + `status` `[C]`
- [ ] 3.2.2 Adicionar `withdrawConsent(userId, tenantId, consentType, meta): Promise<WithdrawConsentResponse>` com: (1) validar mandatório → lança `BadRequestException` PT-BR; (2) `createWithdrawal` em `withTenantTx`; (3) `auditService.createEvent` fora da tx ([GAP-05]) `[C]`
- [ ] 3.2.3 [GAP-06] Comportamento de double-withdrawal: sem checagem de withdrawal existente — segundo INSERT é permitido (append-only, idempotente do ponto de vista de funcionalidade) `[A]`

### 3.3 `ConsentController` — novos endpoints `[C]`

- [ ] 3.3.1 Adicionar `@Get('history')` com `@SkipConsent()` ao `ConsentController` existente `[C]`
- [ ] 3.3.2 Adicionar `@Patch(':consentType/withdraw')` com `@SkipConsent()` + validação Zod do param `[C]`
- [ ] 3.3.3 `userId` e `tenantId` sempre do `getRequestContext()` (AsyncLocalStorage) — nunca de parâmetro `[C]`

### 3.4 `ConsentModule` — importar `AuditModule` `[C]`

- [ ] 3.4.1 Adicionar `AuditModule` aos imports de `ConsentModule`; injetar `AuditService` no `ConsentService` via DI `[C]`

### 3.5 Testes unitários do `ConsentService` estendido `[C]`

- [ ] 3.5.1 Estender `apps/api/src/consent/__tests__/consent.service.spec.ts` com: `getHistory` retorna merged de aceites + withdrawals `[C]`
- [ ] 3.5.2 `withdrawConsent` para `focus_monitoring` → persiste em `consent_records` + chama `auditService.createEvent` `[C]`
- [ ] 3.5.3 `withdrawConsent` para `terms_of_service` → lança `BadRequestException` `[C]`
- [ ] 3.5.4 `withdrawConsent` para `privacy_policy` → lança `BadRequestException` `[C]`
- [ ] 3.5.5 [GAP-06] Double-withdrawal de `focus_monitoring` → segundo INSERT bem-sucedido (sem 409) `[A]`
- [ ] 3.5.6 `getHistory` para usuário sem nenhum registro → retorna todos `ConsentType` com `status: 'pending'` `[A]`

---

## FASE 4 — Backend: gate de consentimento no TelemetryService (FR-11)

### 4.1 `ConsentRepository.hasWithdrawn` integrado em `TelemetryService` `[C]`

- [ ] 4.1.1 Importar `ConsentModule` no `MeetingsModule` (ou no módulo de telemetria, conforme localização) `[C]`
- [ ] 4.1.2 Injetar `ConsentRepository` no `TelemetryService` `[C]`
- [ ] 4.1.3 Em `recordFocusHeartbeat`: chamar `hasWithdrawn(userId, 'focus_monitoring')` → se `true`, retornar silenciosamente (sem erro, sem log de warning) `[C]`

### 4.2 Teste de integração FR-11 `[C]`

- [ ] 4.2.1 Criar `apps/api/src/meetings/telemetry/__tests__/focus-heartbeat-consent.integration-spec.ts` `[C]`
- [ ] 4.2.2 Cenário: User A revoga `focus_monitoring` (INSERT direto em `consent_records`) `[C]`
- [ ] 4.2.3 User A e User B enviam heartbeat para o mesmo meeting `[C]`
- [ ] 4.2.4 Verificar: apenas User B tem registro em `meeting_telemetry` (mock Redis ou in-memory) `[C]`
- [ ] 4.2.5 Verificar: User A não tem registro (revogação efetivada) `[C]`

---

## FASE 5 — Frontend: tela Privacidade & Consentimento

### 5.1 i18n PT-BR `[C]`

- [ ] 5.1.1 Adicionar namespace `privacy` em `apps/web/messages/pt-BR.json` com chaves: `title`, `mandatory_tooltip`, `withdraw_confirm`, `status_accepted`, `status_withdrawn`, `status_pending`, `data_processing_title`, `legal_basis_*` (4 variantes) `[C]`

### 5.2 Hooks TanStack Query `[C]`

- [ ] 5.2.1 Criar `apps/web/src/hooks/use-consent-history.ts` com `useQuery<ConsentHistoryResponse>` `[C]`
- [ ] 5.2.2 Criar `apps/web/src/hooks/use-withdraw-consent.ts` com `useMutation<undefined, Error, { consentType: ConsentType }>` + `return undefined` no mutationFn + `invalidateQueries` no `onSuccess` `[C]`

### 5.3 Página CSR `PrivacidadeConsentimentoPage` `[C]`

- [ ] 5.3.1 Criar `apps/web/src/app/(app)/perfil/privacidade/page.tsx` como Client Component `[C]`
- [ ] 5.3.2 Renderizar lista de `ConsentHistoryItem` com badge de status (cores semânticas: verde/aceito, vermelho/revogado, cinza/pendente) `[C]`
- [ ] 5.3.3 Toggle `disabled={item.isMandatory}` com `title={t('privacy.mandatory_tooltip')}` `[C]`
- [ ] 5.3.4 `onClick` → `withdrawConsent.mutate({ consentType: item.consentType })` `[C]`
- [ ] 5.3.5 Estados de loading e erro tratados (skeleton ou spinner + mensagem PT-BR) `[A]`

### 5.4 Página pública SSR `BasesLegaisPage` `[C]`

- [ ] 5.4.1 Criar `apps/web/src/app/(marketing)/privacidade/bases-legais/page.tsx` como Server Component `[C]`
- [ ] 5.4.2 `fetch('/api/v1/privacy/data-processing')` nativo (sem TanStack Query) `[C]`
- [ ] 5.4.3 Renderizar tabela com `operationName`, `legalBasis` (traduzido via i18n), `purpose`, `retentionPeriod`, `thirdPartySharing` `[C]`
- [ ] 5.4.4 `<caption>` na tabela + `scope` nos headers (a11y) `[A]`

### 5.5 Testes frontend `[A]`

- [ ] 5.5.1 Criar `apps/web/src/hooks/__tests__/use-consent-history.spec.tsx` com MSW mock → verifica shape da resposta `[A]`
- [ ] 5.5.2 Criar `apps/web/src/hooks/__tests__/use-withdraw-consent.spec.tsx` com MSW mock → verifica invalidation de query após sucesso `[A]`
- [ ] 5.5.3 Criar `apps/web/src/app/(app)/perfil/privacidade/__tests__/page.spec.tsx` com RTL + MSW: toggle mandatório desabilitado, toggle opcional clicável, badge de status correto `[A]`

### 5.6 A11y `[A]`

- [ ] 5.6.1 Toggles têm `aria-label` descritivo (não apenas ícone) `[A]`
- [ ] 5.6.2 Tooltips de mandatórios têm `aria-describedby` `[A]`
- [ ] 5.6.3 Executar `jest-axe` na `PrivacidadeConsentimentoPage` `[A]`

---

## FASE 6 — Closeout (integração, validação local, PR)

### 6.1 Validação de integração end-to-end local `[C]`

- [ ] 6.1.1 Executar `pnpm --filter @metanoia/api exec prisma migrate dev` e confirmar migration aplicada sem erros `[C]`
- [ ] 6.1.2 Confirmar que `data_processing_registry` tem 10 registros após migration `[C]`
- [ ] 6.1.3 `curl -s http://localhost:3001/api/v1/privacy/data-processing` sem token → 200 com array `[C]`
- [ ] 6.1.4 `GET /api/v1/consent/history` autenticado → 200 `[C]`
- [ ] 6.1.5 `PATCH /api/v1/consent/focus_monitoring/withdraw` → 200 + evento audit gravado `[C]`
- [ ] 6.1.6 `PATCH /api/v1/consent/terms_of_service/withdraw` → 400 `[C]`

### 6.2 Checklist de entrega `[A]`

- [ ] 6.2.1 Criar `docs/specs/base-legal-consentimento/9-4-validation-checklist.md` com todos os itens do plan.md §5.2 + itens de GAPs `[A]`
- [ ] 6.2.2 Marcar todos os itens conforme validação local `[A]`

### 6.3 CI verde `[C]`

- [ ] 6.3.1 `pnpm turbo build` sem erros `[C]`
- [ ] 6.3.2 `pnpm turbo lint` sem erros `[C]`
- [ ] 6.3.3 `pnpm turbo test` — todos os testes passando (unit + snapshot + RLS + integration) `[C]`

### 6.4 PR `[C]`

- [ ] 6.4.1 Push da branch `feat/story-9-4-base-legal-consentimento` `[C]`
- [ ] 6.4.2 Abrir PR para `dev` com título e body descrevendo os 3 fluxos + checklist de teste `[C]`

---

## Matriz de Dependências

```
FASE 0 (contracts + i18n + decisões)
    ↓
FASE 1 (migrations + RLS spec)
    ↓           ↓
FASE 2       FASE 3
(privacy/)   (consent/ estendido)
                 ↓
             FASE 4 (FR-11 gate)
    ↓           ↓
FASE 5 (frontend — pode iniciar após FASE 0 usando MSW)
    ↓
FASE 6 (closeout)
```

FASE 5 pode iniciar em paralelo com FASEs 2, 3 e 4 após FASE 0 (MSW handlers prontos).

---

## Resumo de Esforço

| FASE | Tarefas [C] | Tarefas [A] | Total |
|------|------------|------------|-------|
| 0 — Fundação | 7 | 8 | 15 |
| 1 — Migrations | 10 | 2 | 12 |
| 2 — Backend privacy/ | 5 | 4 | 9 |
| 3 — Backend consent/ | 14 | 4 | 18 |
| 4 — FR-11 gate | 5 | 0 | 5 |
| 5 — Frontend | 12 | 9 | 21 |
| 6 — Closeout | 6 | 3 | 9 |
| **Total** | **59** | **30** | **89** |

---

## Resumo Quantitativo

| FASE | Crítico [C] | Alta [A] | Média [M] | Total |
|------|------------|---------|----------|-------|
| 0 — Fundação | 7 | 8 | 0 | 15 |
| 1 — Migrations + RLS | 10 | 2 | 0 | 12 |
| 2 — Backend privacy/ | 5 | 4 | 0 | 9 |
| 3 — Backend consent/ | 14 | 4 | 0 | 18 |
| 4 — FR-11 gate | 5 | 0 | 0 | 5 |
| 5 — Frontend | 12 | 9 | 0 | 21 |
| 6 — Closeout | 6 | 3 | 0 | 9 |
| **Total** | **59** | **30** | **0** | **89** |

---

## Escopo Coberto

- Tabela global `data_processing_registry` + seed 10 operações (LGPD Art. 9º)
- Tabela tenant-scoped `consent_records` (log de revogações)
- RLS isolation `consent_records` com NULLIF pattern
- Endpoint público `GET /api/v1/privacy/data-processing` (@Public + @Throttle)
- Extensão `consent/`: history consolidado + withdrawal + audit
- Gate FR-11: withdrawal de `focus_monitoring` desabilita coleta de heartbeat
- Tela "Privacidade & Consentimento" (CSR, toggles, badges)
- Página pública bases legais (SSR, sem auth)
- Contratos Zod + snapshots em `packages/types`
- MSW handlers FE
- Testes: unit + RLS isolation + integration FR-11 + FE (RTL/MSW) + a11y (jest-axe)

## Escopo Excluído

- Exportação de dados pessoais (story 9-1)
- Exclusão de conta / direito ao esquecimento (story 9-2)
- Gerenciamento de versões de documentos legais
- Notificações por e-mail de confirmação de revogação
- Painel super-admin de consentimentos
- Revogação retroativa de dados históricos coletados
