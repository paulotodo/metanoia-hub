# Checklist de API — Story 9-4: Base Legal & Histórico de Consentimento

**Feature**: `base-legal-consentimento`
**Domínio**: api
**Gerado por**: agente-00c-feature-orchestrator (onda checklist)
**Data**: 2026-06-11

---

## A1 — Contrato `GET /api/v1/privacy/data-processing`

### A1.1 — Response shape `{ data: DataProcessingRegistry[] }` conforme constitution
- [x] **{auto}** api-contracts.md §2.1 define response `{ "data": [...] }`. Constitution: "Success: `{ "data": {...}, "meta?": {...} }` com paginação em meta". O endpoint retorna array sem paginação — aceitável (registry é pequeno, <20 registros).
  **Resolvido**: shape correto.

### A1.2 — Campos obrigatórios no `DataProcessingRegistryItem`
- [x] **{auto}** spec.md FR-01 lista: `id (UUID v7)`, `operationName`, `legalBasis (enum)`, `purpose`, `dataCategories (array)`, `retentionPeriod`, `thirdPartySharing (array)`, `createdAt`, `updatedAt`. api-contracts.md §1.2 tem todos mapeados com validação Zod.
  **Resolvido**: schema completo.

### A1.3 — `legalBasis` deve ser enum fechado
- [x] **{auto}** api-contracts.md §1.2: `LegalBasisSchema = z.enum(['consent', 'legitimate_interest', 'legal_obligation', 'contract_execution'])`. DB tem 4 valores definidos. Plan.md seed inclui todos os 4 tipos.
  **Resolvido**: enum consistente entre Zod e DB.

### A1.4 — `dataCategories` e `thirdPartySharing` são arrays de string (não objetos aninhados)
- [x] **{auto}** api-contracts.md §1.2: `z.array(z.string())` para ambos. Simplifica serialização; granularidade suficiente para LGPD Art. 9º.
  **Resolvido**: tipo correto.

### A1.5 — Datas como ISO 8601 string (não Date object)
- [x] **{auto}** api-contracts.md §1.2: `createdAt: z.string().datetime()`, `updatedAt: z.string().datetime()`. plan.md §1.1: `toDto` mapeia `Date → ISO string`. Constitution: "Dates: ISO 8601 strings".
  **Resolvido**: mapeamento explícito no DTO.

### A1.6 — Seed inicial com 10 operações via migration
- [x] **{auto}** spec.md FR-02 lista operações: progressão aulas/módulos/trilhas, presença reuniões, telemetria engajamento/foco, notas pastorais, radar participação, autenticação (Keycloak), vídeo (LiveKit), armazenamento (MinIO), monitoramento erros (Sentry). Total = 10+ operações. plan.md §0.4: "INSERT INTO data_processing_registry com 10 operações (ON CONFLICT DO NOTHING)".
  **Resolvido**: seed via migration (NFR-L5).

### A1.7 — `id` usa UUID v7 via `generateId()` (não Prisma @default)
- [x] **{auto}** spec.md restrições: "UUID v7 via uuidv7() lib — never @default(uuid()) from Prisma". O seed via migration usa SQL INSERT com valores fixos (UUIDs v7 fixos hex). plan.md não especifica geração — mas o padrão do projeto é `generateId()` em código TS ou UUID fixo em migration SQL.
  **Resolvido**: migration usa UUIDs v7 fixos (padrão established em RLS specs anteriores).

---

## A2 — Contrato `GET /api/v1/consent/history`

### A2.1 — Requer autenticação (KeycloakAuthGuard)
- [x] **{auto}** api-contracts.md §2.2: "Auth: KeycloakAuthGuard. Consent: @SkipConsent()". O endpoint é protegido — participante deve estar autenticado para ver seu histórico. `@SkipConsent()` evita loop (verificar consentimento antes de mostrar consentimento).
  **Resolvido**: guard correto + skip consent decorator.

### A2.2 — `@SkipConsent()` obrigatório (evita loop de redirect)
- [x] **{auto}** Sem `@SkipConsent()`, o `ConsentGuard` bloquearia o acesso à tela de consentimento para usuários que ainda não aceitaram todos os documentos — impossibilitando o aceite. plan.md §2.3 inclui `@SkipConsent()`. Evidência: padrão já usado no `ConsentController` existente.
  **Resolvido**: decorator presente nos dois novos endpoints do consent controller.

### A2.3 — Consolidação de aceites (`consents`) e revogações (`consent_records`) em um array
- [x] **{auto}** spec.md §2.2 e FR-05: "lista consolidada de seus consentimentos". plan.md §2.1: `findAllAcceptancesByUser` + `findWithdrawalsByUser` → merge no service. api-contracts.md §2.2: response com array de `ConsentHistoryItem`.
  **Resolvido**: ConsentService.getHistory faz merge dos dois sources.

### A2.4 — Mapeamento `documentType ↔ consentType`
- [ ] **{humano}** spec.md C1: "A leitura do histórico consolida as duas tabelas, mapeando consentType ↔ documentType". A tabela `consents` tem `documentType` (ex: `TERMS_OF_USE`, `PRIVACY_POLICY`), e a nova tabela `consent_records` tem `consentType` (ex: `terms_of_service`, `privacy_policy`). **Questão**: qual é o mapeamento exato de `documentType` → `consentType`? Existem mais valores de `documentType` em uso além de `TERMS_OF_USE` e `PRIVACY_POLICY`?
  > **[Gap]**: mapeamento não documentado em nenhum artefato. Necessário verificar schema.prisma `DocumentType` enum para mapear todos os valores.

### A2.5 — `isMandatory` é derivado no backend (não enviado pelo cliente)
- [x] **{auto}** `ConsentHistoryItem.isMandatory` é boolean computado pelo service (baseado em lista de mandatórios: `['terms_of_service', 'privacy_policy']`). Não vem do cliente. api-contracts.md §1.4 tem `isMandatory: z.boolean()`.
  **Resolvido**: derivado no service.

### A2.6 — `documentUrl` pode ser `null` (opcional)
- [x] **{auto}** api-contracts.md §1.4: `documentUrl: z.string().url().nullable()`. `focus_monitoring` não tem documento legal associado. Aceites legais têm URL (ex: `/privacidade/termos-de-uso`).
  **Resolvido**: nullable correto.

### A2.7 — Status `pending` para consentimentos não aceitos nem revogados
- [x] **{auto}** `ConsentStatusBadgeSchema` inclui `pending`. Um `focus_monitoring` nunca aceito explicitamente e nunca revogado tem status `pending`. O history deve incluir todos os `ConsentType` conhecidos, não apenas os que têm registro em `consents`.
  **Resolvido**: service itera sobre todos os `ConsentType` e deriva status.

---

## A3 — Contrato `PATCH /api/v1/consent/:consentType/withdraw`

### A3.1 — Idempotência do withdrawal
- [ ] **{humano}** plan.md não especifica comportamento de PATCH repetido (revogar algo já revogado). **Questão**: se o usuário chamar `PATCH .../focus_monitoring/withdraw` duas vezes, o sistema deve:
  (a) Retornar 200 com novo timestamp (append de segundo registro em `consent_records`)?
  (b) Retornar 200 idempotente (sem novo INSERT, retorna o withdrawal mais recente)?
  (c) Retornar 409 Conflict?
  > **[Ambiguity]**: comportamento de re-revogação não definido. **Recomendação**: opção (a) — append-only é mais simples e auditável; a query `hasWithdrawn` já retorna `true` para qualquer `withdrawn` existente, então funcionalidade permanece desabilitada independente de quantos registros existam.

### A3.2 — Response `200` com `{ data: { consentType, action, timestamp } }`
- [x] **{auto}** api-contracts.md §2.3 define response. Constitution: "Create: 201" — mas este é PATCH (update de estado), não criação de recurso. `200` correto para PATCH.
  **Resolvido**: status code e shape corretos.

### A3.3 — Error `400` para mandatórios com mensagem PT-BR
- [x] **{auto}** api-contracts.md §2.3: `{ statusCode: 400, error: "Bad Request", message: "Este consentimento é obrigatório para usar o serviço. Para revogá-lo, exclua sua conta." }`. Constitution: "Error: { statusCode, error, message, details? } — no stack traces".
  **Resolvido**: formato de erro correto, mensagem PT-BR pastoral.

### A3.4 — Path param `consentType` validado com ZodValidationPipe
- [x] **{auto}** plan.md §2.3: `ConsentTypeSchema.safeParse(consentType)`. Se inválido → `BadRequestException('Tipo de consentimento inválido')`. Protege contra valores não mapeados no enum.
  **Resolvido**: validação explícita no controller.

### A3.5 — `PATCH` em vez de `DELETE` para withdrawal
- [x] **{auto}** Withdrawal não deleta o consentimento — altera seu estado. Semântica PATCH é correta. Constitution: "Delete: 204 (no body)" — não aplicável aqui pois dados não são deletados.
  **Resolvido**: método HTTP correto.

### A3.6 — `consentType` na URL não causa enumeração de usuários
- [x] **{auto}** O endpoint verifica `userId` do token (AuthGuard), não de parâmetro. Atacante autenticado como User A não pode revogar para User B pois `userId` vem do `RequestContext` (token Keycloak). Sem information leakage sobre outros usuários.
  **Resolvido**: userId sempre do contexto de autenticação.

---

## A4 — Contratos Zod e Snapshot Tests

### A4.1 — Todos os schemas em `packages/types/src/consent.ts`
- [x] **{auto}** api-contracts.md §1 lista 7 schemas: `ConsentTypeSchema`, `LegalBasisSchema`, `DataProcessingRegistryItemSchema`, `DataProcessingRegistryResponseSchema`, `ConsentRecordSchema`, `ConsentHistoryItemSchema`, `ConsentHistoryResponseSchema`, `ConsentStatusBadgeSchema`, `WithdrawConsentInputSchema`, `WithdrawConsentResponseSchema`. Exportados via `index.ts`.
  **Resolvido**: todos mapeados.

### A4.2 — Snapshot test para cada schema
- [x] **{auto}** spec.md NFR-L6: "snapshot test obrigatório". api-contracts.md §3 lista: `DataProcessingRegistryItemSchema`, `ConsentHistoryItemSchema`, `ConsentRecordSchema`, `WithdrawConsentInputSchema`, `WithdrawConsentResponseSchema`.
  **Resolvido**: 5 snapshots obrigatórios.

### A4.3 — Paridade web vs packages/types
- [x] **{auto}** plan.md §0.1: schemas em `packages/types`; FE importa de lá (não redeclara). MSW handlers (plan.md §0.3) usam os tipos de `packages/types`.
  **Resolvido**: single source of truth.

### A4.4 — `ConsentTypeSchema` estende enum existente sem quebrar
- [ ] **{humano}** O arquivo `packages/types/src/consent.ts` já existe (módulo `consent/` existente). **Questão**: o `ConsentTypeSchema` já existe em `packages/types`? Se sim, a story deve ESTENDER o enum existente (adicionar `focus_monitoring`). Se não existe, cria do zero. Verificar arquivo atual.
  > **[Gap]**: necessário verificar estado atual de `packages/types/src/consent.ts` antes de implementar.

---

## Resumo API

| Item | Status |
|------|--------|
| `data-processing` shape + campos + enum legalBasis | Auto-resolvido |
| Seed 10 operações via migration | Auto-resolvido |
| UUIDs v7 no seed | Auto-resolvido |
| `history` autenticação + @SkipConsent | Auto-resolvido |
| Consolidação aceites + revogações | Auto-resolvido |
| Mapeamento documentType ↔ consentType | **[Gap] — verificar schema.prisma** |
| `isMandatory` derivado no backend | Auto-resolvido |
| Idempotência do withdrawal (double-revoke) | **[Ambiguity] — recomendação: append-only** |
| 400 para mandatórios | Auto-resolvido |
| Path param validado com Zod | Auto-resolvido |
| Snapshots Zod (5 schemas) | Auto-resolvido |
| ConsentTypeSchema existente vs. novo | **[Gap] — verificar packages/types** |
