# Checklist de Segurança — Story 9-4: Base Legal & Histórico de Consentimento

**Feature**: `base-legal-consentimento`
**Domínio**: security
**Gerado por**: agente-00c-feature-orchestrator (onda checklist)
**Data**: 2026-06-11

---

## S1 — RLS em `consent_records`

### S1.1 — Tabela `consent_records` deve ter RLS habilitado e policy NULLIF
- [x] **{auto}** spec.md NFR-L2 exige `tenantId` obrigatório + escrita via `withTenantTx`.
  plan.md §0.4 especifica `RLS em consent_records` (NULLIF pattern — 2 policies: SELECT + INSERT).
  Evidência: spec.md L119: "consent_records é tenant-scoped (tenantId obrigatório); toda escrita via withTenantTx" e plan.md L63-64.
  **Resolvido**: policy NULLIF deve ser idêntica ao padrão dos demais modelos tenant-scoped (ex: `group_members`).

### S1.2 — Registros com `tenantId = null` visíveis para todos os tenants
- [x] **{auto}** plan.md §0.6 explicita: "Registros com tenantId = null são visíveis para ambos os tenants (comportamento esperado)". Padrão NULLIF de RLS já implementado no projeto: `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` retorna NULL se não setado, o que faz o WHERE falhar silenciosamente sem erro. O policy SELECT precisa cobrir a cláusula `OR tenant_id IS NULL`.
  **Resolvido**: incluir `OR "tenantId" IS NULL` na policy SELECT.

### S1.3 — UPDATE e DELETE em `consent_records` devem ser proibidos
- [x] **{auto}** Revogação é append-only (INSERT action='withdrawn'). plan.md §0.6: "UPDATE (proibido), DELETE (proibido)". Padrão do projeto: ausência de policy RLS para UPDATE/DELETE = operação negada. Confirmar que schema.prisma não expõe `update` ou `delete` no `ConsentRecord`.
  **Resolvido**: sem policy UPDATE/DELETE = proteção por omissão (RLS rejeita implicitamente).

### S1.4 — Teste de isolamento RLS obrigatório
- [x] **{auto}** spec.md NFR-L3: "Toda migration que adicione policy RLS acompanha teste de isolamento em apps/api/test/rls/". plan.md §0.6: `consent-records.rls-spec.ts` com 2 tenants A e B. Evidência: padrão estabelecido em stories anteriores (ex: pastoral-notes.rls-spec.ts).
  **Resolvido**: arquivo `apps/api/test/rls/consent-records.rls-spec.ts` obrigatório.

---

## S2 — Endpoint público sem autenticação

### S2.1 — `GET /api/v1/privacy/data-processing` deve ser acessível sem token
- [x] **{auto}** spec.md FR-03: "SHALL ser público (sem autenticação)". plan.md §1.2: `@Public()` no controller + `PrivacyController` sem `@UseGuards`. spec.md C2 confirma: "endpoint público não pode exigir autenticação (transparência LGPD Art. 9º)".
  **Resolvido**: usar `@Public()` decorator compatível com `KeycloakAuthGuard` global.

### S2.2 — Endpoint público não deve vazar dados de outros endpoints via injeção de path
- [x] **{auto}** O endpoint retorna apenas dados globais de `data_processing_registry` (sem tenant_id). O `PrismaService.client` (sem extensão RLS) é usado. Sem parâmetros de rota ou query params que possam ser injetados. Risco: baixo.
  **Resolvido**: `findMany()` sem WHERE em dados globais é safe.

### S2.3 — Endpoint público não deve expor `tenantId` ou dados PII
- [x] **{auto}** `data_processing_registry` não tem `tenant_id` (spec.md NFR-L1: "sem tenant_id"). Os campos são: `operationName`, `legalBasis`, `purpose`, `dataCategories`, `retentionPeriod`, `thirdPartySharing`, `createdAt`, `updatedAt`. Nenhum PII.
  **Resolvido**: schema está correto por design.

### S2.4 — Rate limiting no endpoint público
- [ ] **{humano}** O plan.md não menciona rate limiting para `GET /api/v1/privacy/data-processing`. O módulo marketing (padrão referenciado) tem rate limit customizado (PR #65). **Questão**: aplicar rate limit ThrottlerGuard ao endpoint público de data-processing?
  **Recomendação**: adicionar `@Throttle({ default: { ttl: 60000, limit: 30 } })` como precaução (endpoint público sem auth é alvo natural de scraping). Se não aplicar, documentar decisão.
  > **[Ambiguity]**: plan.md silente sobre throttling no endpoint público.

---

## S3 — Revogação de mandatórios bloqueada

### S3.1 — Withdrawal de `terms_of_service` deve retornar 400
- [x] **{auto}** plan.md §2.2: `withdrawConsent` passo 1: "Validar que consentType não é mandatório (terms_of_service, privacy_policy) → lança BadRequestException". spec.md FR-06: "consentimentos mandatórios SHALL exibir o toggle desabilitado". api-contracts.md §2.3: Error 400 definido.
  **Resolvido**: lógica de guarda no service + teste unitário obrigatório (plan.md §2.4).

### S3.2 — Withdrawal de `privacy_policy` deve retornar 400
- [x] **{auto}** Mesmo critério de S3.1. `privacy_policy` é mandatório junto com `terms_of_service`. Evidência: spec.md C4: "Termos de Uso e Política de Privacidade são base legal para o contrato de serviço".
  **Resolvido**: lista de mandatórios inclui `['terms_of_service', 'privacy_policy']`.

### S3.3 — Tentativa de withdrawal mandatório não deve persistir em `consent_records`
- [x] **{auto}** A BadRequestException é lançada ANTES do `this.repo.createWithdrawal()` (plano §2.2 ordena: validar → criar). Portanto nenhum registro é persistido.
  **Resolvido**: ordem de operações no service garante isso.

### S3.4 — Toggle FE desabilitado para mandatórios
- [x] **{auto}** plan.md §4.3: `disabled={item.isMandatory}`. `isMandatory: true` vem do `ConsentHistoryItemSchema` (api-contracts.md §1.4). A API determina o valor — FE não decide quem é mandatório.
  **Resolvido**: contrato Zod inclui `isMandatory: z.boolean()`.

---

## S4 — Audit log no withdrawal

### S4.1 — Evento de auditoria deve ser registrado no withdrawal
- [x] **{auto}** spec.md FR-09: "SHALL registrar evento via audit.service.createEvent()". plan.md §2.2 passo 3: "this.auditService.createEvent({ action: 'update', resource: 'consent', resourceId: consentType })". Story 9-3 já mergeada — `AuditService` disponível.
  **Resolvido**: ConsentModule importa AuditModule.

### S4.2 — Evento de auditoria deve ser na mesma transação do withdrawal
- [ ] **{humano}** plan.md §2.2 descreve `withTenantTx` para o `createWithdrawal`, mas o `auditService.createEvent()` é chamado após (passo 3, separado). **Questão**: `auditService.createEvent()` é chamado dentro ou fora da transação `withTenantTx`?
  **Risco**: se fora, falha no audit não reverte o withdrawal; se dentro, precisa passar o `tx` para o AuditService.
  > **[Ambiguity]**: plan.md silente sobre se o audit event está dentro da transação.
  **Recomendação**: chamar o audit FORA da transação (fire-and-forget auditável) — padrão já adotado em stories anteriores. Se o audit falhar, o withdrawal persiste (comportamento correto: não reverter ação do usuário por falha de log).

### S4.3 — `resourceId` no audit event deve ser o `consentType`, não o `id` de `consent_records`
- [x] **{auto}** plan.md §2.2 explicita: `resource_id: consentType`. Evidência: spec.md FR-09 define `resourceId: <consentType>`.
  **Resolvido**: campo correto mapeado.

---

## S5 — Isolamento entre tenants no histórico

### S5.1 — `GET /api/v1/consent/history` não deve vazar dados entre tenants
- [x] **{auto}** plan.md §2.1: `findAllAcceptancesByUser(userId)` + `findWithdrawalsByUser(userId, tenantId)`. O `tenantId` vem do `RequestContext` (AsyncLocalStorage) — não como parâmetro de função. `consent_records` tem RLS. `consents` existente já tem RLS.
  **Resolvido**: padrão de contexto preserva isolamento.

### S5.2 — `hasWithdrawn` usa `prisma.client` sem RLS — intencional e documentado
- [x] **{auto}** plan.md §3.1: "Usa `this.prisma.client.consentRecord.findFirst` — Sem RLS (leitura via prisma.client não-extendido) — esta consulta é por userId global, não por tenant (evita acoplamento de contexto RLS dentro do TelemetryService)". Risco aceito com justificativa explícita na spec.
  **Resolvido**: decisão de design documentada; `hasWithdrawn` é read-only de flag booleana.

---

## Resumo Segurança

| Item | Status |
|------|--------|
| RLS `consent_records` com NULLIF + null-visible | Auto-resolvido |
| UPDATE/DELETE proibidos por ausência de policy | Auto-resolvido |
| Teste RLS isolation obrigatório | Auto-resolvido |
| Endpoint público @Public() | Auto-resolvido |
| Sem PII no endpoint público | Auto-resolvido |
| Rate limiting endpoint público | **[Ambiguity] — decisão pendente** |
| Withdrawal mandatório → 400 | Auto-resolvido |
| Audit event no withdrawal | Auto-resolvido |
| Audit dentro/fora de tx | **[Ambiguity] — recomendação: fora** |
| Isolamento história por tenant | Auto-resolvido |
| hasWithdrawn sem RLS — intencional | Auto-resolvido |
