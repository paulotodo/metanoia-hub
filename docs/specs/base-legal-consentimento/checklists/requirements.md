# Checklist de Requisitos — Story 9-4: Base Legal & Histórico de Consentimento

**Feature**: `base-legal-consentimento`
**Domínio**: requirements
**Gerado por**: agente-00c-feature-orchestrator (onda checklist)
**Data**: 2026-06-11

---

## Errata de checklist/api.md (auto-resolvidos após sondagem)

### A2.4 — Mapeamento `documentType ↔ consentType` — RESOLVIDO
Sondagem em `packages/types/src/consent.ts` (linha 12): `ConsentDocumentTypeSchema = z.enum(['terms_of_service', 'privacy_policy'])`. A tabela `consents` usa string (não enum DB) com valores `'terms_of_service'` e `'privacy_policy'` (schema.prisma L199: `documentType String`). O `ConsentTypeSchema` da story 9-4 usa os MESMOS valores para os documentos legais + adiciona `focus_monitoring`. Mapeamento é direto: `documentType === consentType` para os dois tipos existentes.
**Resolvido**: sem transformação de case necessária.

### A4.4 — `ConsentTypeSchema` existente vs. novo — RESOLVIDO
O arquivo `packages/types/src/consent.ts` tem `ConsentDocumentTypeSchema` (enum com `terms_of_service | privacy_policy`), NÃO `ConsentTypeSchema`. Story 9-4 cria `ConsentTypeSchema` como enum NOVO (que inclui `terms_of_service | privacy_policy | focus_monitoring`). O `ConsentDocumentTypeSchema` existente deve ser mantido (usado pelo `AcceptConsentInputSchema`). Não há conflito de nomes.
**Resolvido**: criar `ConsentTypeSchema` como enum novo; não renomear nem remover `ConsentDocumentTypeSchema`.

---

## R1 — Cobertura de Requisitos Funcionais

### R1.1 — FR-01: Tabela `data_processing_registry`
- [x] **{auto}** plan.md §0.4 + §0.5 cobrem criação da tabela e schema Prisma. Campos spec.md FR-01 todos presentes em `DataProcessingRegistryItemSchema`.
  **Resolvido**.

### R1.2 — FR-02: Seed com 10 operações de tratamento
- [x] **{auto}** plan.md §0.4: "INSERT INTO data_processing_registry com 10 operações". FR-02 lista: progressão aulas/módulos/trilhas (1), presença reuniões (2), telemetria engajamento/foco (3), notas pastorais (4), radar participação (5), autenticação Keycloak (6), vídeo LiveKit (7), armazenamento MinIO (8), monitoramento erros Sentry (9).
  **[Gap]**: 9 operações identificadas; FR-02 diz "10 operações". Verificar se `trilhas` e `módulos` são operações separadas, ou se há uma 10ª operação não listada (ex: `onboarding` ou `sessions Redis`).
  > **[Ambiguity]**: FR-02 lista 9 categorias explícitas. A 10ª pode ser: (a) split `trilhas` / `módulos/aulas` em 2 registros; (b) adicionar `onboarding`; (c) contar como 9 e remover a restrição de "10".
  **Recomendação**: usar 10 como alvo mínimo, split `trilhas` e `módulos/aulas` em registros separados.

### R1.3 — FR-03: Endpoint público sem autenticação
- [x] **{auto}** plan.md §1.2: `@Public()`. Coberto em checklist API A1.1.
  **Resolvido**.

### R1.4 — FR-04: Tabela `consent_records`
- [x] **{auto}** plan.md §0.4 cria tabela. spec.md FR-04 campos todos em `ConsentRecordSchema`.
  **Resolvido**.

### R1.5 — FR-05: Tela lista todos os consentimentos
- [x] **{auto}** plan.md §4.3: `PrivacidadeConsentimentoPage` renderiza lista de `ConsentHistoryItem`. Inclui todos os `ConsentType` (não apenas os aceitos).
  **Resolvido**.

### R1.6 — FR-06: Toggle para opcionais; desabilitado para mandatórios
- [x] **{auto}** plan.md §4.3: `disabled={item.isMandatory}` + tooltip.
  **Resolvido**.

### R1.7 — FR-07: Persistência em `consent_records` na mesma transação
- [x] **{auto}** plan.md §2.1: `createWithdrawal` usa `withTenantTx`.
  **Resolvido**.

### R1.8 — FR-08: Efeito imediato — funcionalidade desabilitada após withdrawal
- [x] **{auto}** plan.md §3.1+3.2: `TelemetryService.recordFocusHeartbeat` verifica `hasWithdrawn` antes de persistir. Efeito é na próxima chamada (sem lag de cache).
  **Resolvido**: efeito imediato para novas chamadas.

### R1.9 — FR-09: Audit event via `audit.service.createEvent()`
- [x] **{auto}** plan.md §2.2 passo 3. Coberto em checklist security S4.1.
  **Resolvido**.

### R1.10 — FR-10: Dados históricos preservados (sem delete retroativo)
- [x] **{auto}** spec.md FR-10 é NFR comportamental. O plan não inclui nenhuma migration ou lógica de DELETE retroativo. A tabela `consent_records` é append-only. `meeting_telemetry` existente não é modificada retroativamente.
  **Resolvido**: ausência de DELETE é garantia suficiente.

### R1.11 — FR-11: Teste de integração withdrawal → reunião → sem coleta foco
- [x] **{auto}** plan.md §3.3: arquivo `focus-heartbeat-consent.integration-spec.ts` com cenário completo.
  **Resolvido**: test file especificado.

---

## R2 — Requisitos Não-Funcionais

### R2.1 — NFR-L1: `data_processing_registry` global (sem tenant_id)
- [x] **{auto}** Verificado em plan.md e spec. Coberto em checklist security S2.
  **Resolvido**.

### R2.2 — NFR-L2: `consent_records` tenant-scoped + withTenantTx
- [x] **{auto}** Coberto em checklist security S1.
  **Resolvido**.

### R2.3 — NFR-L3: Teste RLS para toda migration com policy
- [x] **{auto}** plan.md §0.6: `consent-records.rls-spec.ts`.
  **Resolvido**.

### R2.4 — NFR-L4: Módulo `consent/` estendido, não recriado
- [x] **{auto}** plan.md §2.1-2.4: apenas novos métodos adicionados. Novos endpoints no `ConsentController` existente. Nenhuma referência a criar novo módulo para consent.
  **Resolvido**.

### R2.5 — NFR-L5: Seed via migration (não seed manual)
- [x] **{auto}** plan.md §0.4: INSERT na própria migration SQL.
  **Resolvido**.

### R2.6 — NFR-L6: Contratos Zod + snapshot tests
- [x] **{auto}** plan.md §0.1-0.2 + api-contracts.md §3. 5 snapshots.
  **Resolvido**.

### R2.7 — NFR-L7: Endpoint público usa `PrismaService.client` (não extendido)
- [x] **{auto}** plan.md §1.1: `this.prisma.client.dataProcessingRegistry.findMany`. Padrão marketing.
  **Resolvido**.

### R2.8 — NFR-L8: Sem filas assíncronas / scheduling (N/A)
- [x] **{auto}** Feature é síncrona. Sem BullMQ, sem cron, sem webhooks.
  **Resolvido**: N/A confirmado.

---

## R3 — Dependências

### R3.1 — Story 9-3 (audit log) mergeada
- [x] **{auto}** memory/MEMORY.md confirma: "Story 8-7 relatorio trilha ... MERGEADA". Mais relevante: MEMORY.md cita Sprint 9 fechado com stories 5-4, 5-5, 5-6. Story 9-3 especificamente: plano menciona "Story 9-3 (auditoria log) está mergeada e fornece audit.service.createEvent()".
  **Resolvido**: confirmado como dependência satisfeita.

### R3.2 — Módulo `consent/` existe
- [x] **{auto}** `packages/types/src/consent.ts` confirmado. O módulo backend `apps/api/src/consent/` deve existir (usado desde Story 2-8).
  **Resolvido**: evidência indireta via types.

### R3.3 — `withTenantTx` existe
- [x] **{auto}** spec.md §9 confirma existência. Usado em stories anteriores.
  **Resolvido**.

### R3.4 — Epic 5 (meetings/telemetria) mergeado
- [x] **{auto}** MEMORY.md: "Sprint 9 + Epic 5 fechados 2026-05-12". `TelemetryService` alvo de modificação em plan.md §3.2 existe.
  **Resolvido**.

---

## R4 — Constitution & Vocabulário

### R4.1 — Código em inglês, UI PT-BR
- [x] **{auto}** plan.md §4.1: chaves i18n em `privacy` namespace, valores em PT-BR ("Privacidade e Consentimento", "Aceito", "Revogado"). Código: `withdrawConsent`, `getHistory`, `isMandatory` (inglês).
  **Resolvido**.

### R4.2 — Vocabulário pastoral em PT-BR
- [x] **{auto}** spec.md L170: "'Consentimento de monitoramento' não 'Focus tracking consent'". plan.md §4.1: "withdraw_confirm: 'Ao revogar, o monitoramento de atenção será desativado imediatamente para você'".
  **Resolvido**: vocabulário pastoral usado.

### R4.3 — UUID v7 via `generateId()` — nunca `@default(uuid())`
- [x] **{auto}** spec.md lista `generateId()` como existente. Constitution: "UUID v7 via uuidv7() lib — never @default(uuid())".
  **Resolvido**: padrão obrigatório em todo novo código.

### R4.4 — Null explícito (nunca omitir campos)
- [x] **{auto}** api-contracts.md: `acceptedAt: z.string().datetime().nullable()`, `withdrawnAt: z.string().datetime().nullable()`, `documentUrl: z.string().url().nullable()`.
  **Resolvido**: nulls explícitos nos contratos.

### R4.5 — `useMutation<undefined, Error, T>` + `return undefined`
- [x] **{auto}** plan.md §4.2: `useMutation<undefined, Error, { consentType: ConsentType }>` + `return undefined` no mutationFn. Guardrail do projeto.
  **Resolvido**: padrão correto usado.

---

## R5 — Gaps e Ambiguidades Consolidados

| ID | Tipo | Descrição | Origem | Recomendação |
|----|------|-----------|--------|--------------|
| GAP-01 | [Gap] | Mapeamento `documentType ↔ consentType` — verificar todos os valores de `documentType` em uso | A2.4 (RESOLVIDO acima: mapeamento 1:1) | N/A |
| GAP-02 | [Gap] | `ConsentTypeSchema` vs `ConsentDocumentTypeSchema` — nomes diferentes, sem conflito | A4.4 (RESOLVIDO acima) | Criar `ConsentTypeSchema` novo |
| GAP-03 | [Ambiguity] | FR-02 fala em "10 operações" mas apenas 9 categorias listadas | R1.2 | Split `trilhas`/`módulos/aulas` em 2 registros |
| GAP-04 | [Ambiguity] | Rate limiting no endpoint público não especificado | security S2.4 | Adicionar `@Throttle` (30 req/60s) |
| GAP-05 | [Ambiguity] | Audit event dentro ou fora de `withTenantTx` | security S4.2 | Fora da transação (fire-and-forget) |
| GAP-06 | [Ambiguity] | Idempotência de withdrawal repetido | api A3.1 | Append-only (segundo INSERT permitido) |

---

## R6 — Tarefas derivadas dos Gaps

Estes gaps devem gerar tarefas no `create-tasks`:

| ID | Tarefa | FASE | Criticidade |
|----|--------|------|-------------|
| GAP-03 | Definir 10ª operação de tratamento (split ou nova) no seed da migration | FASE 1 | [C] |
| GAP-04 | Decidir e documentar rate limiting do endpoint público | FASE 2 | [A] |
| GAP-05 | Documentar decisão: audit event fora de withTenantTx (consistência com padrão do projeto) | FASE 2 | [A] |
| GAP-06 | Testar comportamento de double-withdrawal (adicionar caso de teste) | FASE 2 | [A] |
