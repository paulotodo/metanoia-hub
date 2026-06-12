# Spec: Base Legal & Histórico de Consentimento

**Feature**: `base-legal-consentimento`
**Epic**: 9 — LGPD & Privacidade
**Story**: 9.4
**Status**: draft
**Data**: 2026-06-11
**Autor**: agente-00c-feature-orchestrator

---

## 1. Problema & Contexto

A LGPD (Lei 13.709/2018) exige que o controlador de dados:

1. Documente a base legal de cada operação de tratamento de dados pessoais (Art. 7º + Art. 9º).
2. Assegure ao titular o direito de consultar seu histórico de consentimentos e revogar consentimentos opcionais (Art. 18º, incisos III e IX).

O metanoia-hub já registra o **ato de aceite** de documentos legais na tabela `consents` (log imutável: `userId, tenantId, documentType, version, ipAddress, userAgent, acceptedAt`). O que falta é:

- Um **inventário público de bases legais** (`DataProcessingRegistry`) que liste, para cada operação de tratamento, a base jurídica, finalidade, categorias de dados e terceiros receptores — requisito de transparência ativa (Art. 9º).
- A capacidade de o participante **visualizar seu histórico** de aceites e **revogar consentimentos opcionais** com efeito imediato sobre a funcionalidade correspondente.
- Um **log de revogação** (`ConsentRecord`) separado do log de aceite — a tabela `consents` registra apenas aceites, não revogações.

A story 9-3 (auditoria log) está mergeada e fornece `audit.service.createEvent()` — disponível para registrar o evento de revogação.

---

## 2. Objetivos (O QUÊ e POR QUÊ)

### 2.1 Inventário de Bases Legais (DataProcessingRegistry)

Criar uma tabela global `data_processing_registry` seeded via migration com todas as operações de tratamento de dados atualmente realizadas pelo sistema. Expor via endpoint público (sem autenticação) para satisfazer o requisito de transparência ativa da LGPD Art. 9º — qualquer pessoa, mesmo sem conta, pode consultar como seus dados são tratados antes de se cadastrar.

O registry é **global** (não tenant-scoped): as operações de tratamento são definidas pela plataforma, não pelo tenant. Cada tenant hospeda os mesmos processos (progressão de aulas, reuniões, radar pastoral); a transparência se aplica a todos os tenants igualmente.

### 2.2 Histórico de Consentimento no Perfil

Permitir que o participante autenticado consulte, na tela de perfil ("Privacidade & Consentimento"), a lista consolidada de seus consentimentos: documentos legais obrigatórios aceitos (Termos de Uso, Política de Privacidade) e consentimentos de funcionalidades específicas opcionais (ex.: monitoramento de foco em reuniões). Cada item exibe status (Aceito com data / Pendente) e link ao texto completo.

A consolidação une dois registros distintos:
- Aceites: tabela `consents` (documentos legais, `documentType` ↔ `consentType`)
- Revogações: tabela `consent_records` (nova, `action: "withdrawn"`)

### 2.3 Revogação de Consentimentos Opcionais (Withdrawal)

Permitir ao participante revogar consentimentos opcionais via toggle. Consentimentos **mandatórios** (Termos de Uso, Política de Privacidade) não podem ser revogados sem exclusão de conta — o toggle é desabilitado e explica o motivo.

Ao revogar um consentimento opcional:
1. Registro persiste em `consent_records` com `action: "withdrawn"`.
2. A funcionalidade correspondente é desabilitada **imediatamente** para aquele usuário (ex.: coleta de foco em reuniões para o usuário revogante).
3. O evento é registrado via `audit.service.createEvent()` (módulo audit da 9-3, já mergeado).
4. Dados históricos coletados sob o consentimento anterior **não são retroativamente deletados** — apenas param de ser usados em novos cálculos.

### 2.4 Teste de Integração de Revogação

Validar o efeito cascata: revogar o consentimento de monitoramento de foco → simular reunião (Epic 5) → confirmar que foco **não é coletado** para o usuário revogante enquanto outros participantes continuam tendo foco coletado normalmente.

---

## 3. Escopo

### Incluído

- Tabela `data_processing_registry` + seed via migration (NFR-L5)
- Endpoint público `GET /api/v1/privacy/data-processing`
- Tabela `consent_records` (log de revogações — separada de `consents`)
- Extensão do módulo `consent/` (histórico consolidado + withdrawal)
- Tela "Privacidade & Consentimento" no perfil do participante (nova rota no app autenticado)
- Toggle de revogação para consentimentos opcionais com efeito imediato
- Gravação de evento de auditoria no withdrawal (via `audit.service`)
- Contrato Zod em `packages/types` + snapshot test
- Teste de integração: withdrawal de focus-monitoring → reunião → sem coleta

### Excluído

- Exportação de dados pessoais (story 9-1)
- Exclusão de conta / direito ao esquecimento (story 9-2)
- Gerenciamento de documentos legais (criar/versionar Termos de Uso — fora do scope MVP)
- Notificações por e-mail de confirmação de revogação (infra de `queue:notifications` pertence à story 9-1)
- Painel super-admin de consentimentos (fora do scope desta story)

---

## 4. Personas Envolvidas

| Persona | Necessidade |
|---------|-------------|
| **Participante** (membro da igreja) | Consultar histórico de consentimentos e revogar opcionais |
| **Visitante / pré-cadastro** | Consultar o registry público de bases legais antes de se registrar |
| **Admin do Tenant** | Não interage diretamente nesta story |
| **Super-Admin** | Não interage diretamente nesta story |

---

## 5. Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| FR-01 | O sistema SHALL manter uma tabela `data_processing_registry` com: `id` (UUID v7), `operationName`, `legalBasis` (enum: `consent` / `legitimate_interest` / `legal_obligation` / `contract_execution`), `purpose` (PT-BR), `dataCategories` (array), `retentionPeriod`, `thirdPartySharing` (array), `createdAt`, `updatedAt`. |
| FR-02 | A migration SHALL fazer o seed inicial com todas as operações de tratamento em vigor na data da feature: progressão de aulas/módulos/trilhas, presença em reuniões, telemetria de engajamento/foco, notas pastorais, radar de participação, autenticação (Keycloak), vídeo (LiveKit), armazenamento (MinIO), monitoramento de erros (Sentry). |
| FR-03 | O endpoint `GET /api/v1/privacy/data-processing` SHALL ser público (sem autenticação) e retornar `{ data: DataProcessingRegistry[] }`. |
| FR-04 | O sistema SHALL manter uma tabela `consent_records` com: `id` (UUID v7), `userId`, `tenantId`, `consentType`, `action` (enum: `withdrawn`), `timestamp`. |
| FR-05 | A tela "Privacidade & Consentimento" SHALL listar todos os consentimentos do participante autenticado, agrupando aceites (de `consents`) e revogações (de `consent_records`), exibindo status badge por item. |
| FR-06 | Consentimentos opcionais SHALL exibir um toggle ativo; consentimentos mandatórios SHALL exibir o toggle desabilitado com tooltip explicando que requer exclusão de conta. |
| FR-07 | Ao revogar um consentimento opcional, o sistema SHALL persistir em `consent_records` (`action: "withdrawn"`) dentro da mesma transação tenant-scoped. |
| FR-08 | Após a revogação, a funcionalidade correspondente SHALL ser desabilitada imediatamente para o usuário revogante (verificada via campo em `consent_records` ou flag derivada consultada no runtime da funcionalidade afetada). |
| FR-09 | A revogação SHALL registrar evento via `audit.service.createEvent()` com `action: "update"`, `resource: "consent"`, `resource_id: <consentType>`. |
| FR-10 | O histórico de dados coletados sob consentimento anterior SHALL ser preservado (não deletado retroativamente); novos cálculos não SHALL usar dados de usuários que revogaram o consentimento específico. |
| FR-11 | O teste de integração SHALL verificar: withdraw de `focus_monitoring` → `meeting.telemetry` não registra foco para o usuário revogante → registra para demais participantes da mesma reunião. |

---

## 6. Requisitos Não-Funcionais

| ID | Requisito |
|----|-----------|
| NFR-L1 | `DataProcessingRegistry` é global (sem `tenant_id`); endpoint público não requer `SET LOCAL` / `withTenantTx`. |
| NFR-L2 | `consent_records` é tenant-scoped (`tenantId` obrigatório); toda escrita via `withTenantTx`. |
| NFR-L3 | Toda migration que adicione policy RLS acompanha teste de isolamento em `apps/api/test/rls/`. |
| NFR-L4 | O módulo `consent/` é **estendido** (não recriado); o padrão repository existente é mantido. |
| NFR-L5 | O registry é seeded via migration (não via seed manual) — dados de base legal devem estar presentes em qualquer ambiente a partir do momento da migration. |
| NFR-L6 | Contratos Zod em `packages/types`; snapshot test obrigatório (gate contra breaking changes). |
| NFR-L7 | Endpoint público segue o padrão do módulo marketing (Prisma sem extensão RLS — cliente base). |
| NFR-L8 | Não há scheduling periódico, refresh de tokens externos, nem filas assíncronas nesta feature (N/A para infra async). |

---

## 7. Fluxos Principais

### 7.1 Consulta pública do registry
```
GET /api/v1/privacy/data-processing (sem auth)
  → PrivacyController.getDataProcessingRegistry()
  → PrivacyService.listDataProcessingRegistry()   [Prisma base client, sem RLS]
  → { data: DataProcessingRegistry[] }
```

### 7.2 Visualização do histórico de consentimentos
```
Participante navega a /app/perfil/privacidade (rota NOVA, autenticada)
  → Server Component busca via API autenticada GET /api/v1/consent/history
  → ConsentController.getHistory(userId)
  → ConsentService.getConsentHistory(userId, tenantId)
       ← consents (aceites) JOIN por userId+tenantId
       ← consent_records (revogações) JOIN por userId+tenantId
  → Renderiza lista com status badge por consentType
```

### 7.3 Revogação de consentimento opcional
```
Participante clica toggle OFF em consentimento opcional
  → PATCH /api/v1/consent/:consentType/withdraw
  → ConsentController.withdrawConsent(userId, tenantId, consentType)
  → withTenantTx(tenantId, fn):
       consent_records.create({ userId, tenantId, consentType, action:"withdrawn", timestamp })
       audit.service.createEvent({ action:"update", resource:"consent", ... })
  → 200 { data: { consentType, action: "withdrawn", timestamp } }
  → FE: toggle reflete estado revogado; funcionalidade desabilitada imediatamente
```

---

## 8. Restrições Técnicas

- `consent/` JÁ EXISTE: estender `ConsentService`, `ConsentRepository`, `ConsentController` — não criar módulo novo.
- Módulo `audit/` JÁ EXISTE: usar `AuditService.createEvent()` injetado via DI.
- Endpoint público `GET /api/v1/privacy/data-processing`: segue padrão marketing (sem guards de auth/tenant); usar `PrismaService.client` (não-extendido), sem `withTenantTx`.
- `consent_records.tenantId` pode ser `null` para consentimentos globais (ex.: Termos de Uso aceitos antes de selecionar tenant) — manter consistência com o padrão `consents.tenantId?` (nullable).
- Vocabulário pastoral em PT-BR: "Consentimento de monitoramento" não "Focus tracking consent"; "Termos de Uso" não "Terms of Service".

---

## 9. Dependências

| Dependência | Status | Notas |
|------------|--------|-------|
| Story 9-3 (audit log) | **Mergeado** | `audit.service.createEvent()` disponível |
| Módulo `consent/` | **Existe** | Estender, não recriar |
| `withTenantTx` | **Existe** | `prisma/with-tenant-tx.ts` |
| `generateId()` | **Existe** | UUID v7 — obrigatório em todos os IDs |
| Epic 5 (meetings/telemetria de foco) | **Mergeado** | Necessário para o teste de integração FR-11 |

---

## Clarifications

> Ambiguidades resolvidas com base em `RECONCILIACAO-EPIC9.md` (pré-flight do epic),
> sem necessidade de consulta humana adicional.

**C1 — `ConsentRecord` é tabela nova, separada de `consents`** (RECONCILIACAO §1.2):
A tabela `consents` (schema.prisma:195) registra apenas **aceites** com colunas `documentType, version, ipAddress, userAgent, acceptedAt` — sem `action` ou suporte a withdrawal. `ConsentRecord` (`consent_records`) é criada nesta feature exclusivamente para registros de revogação. A leitura do histórico consolida as duas tabelas, mapeando `consentType ↔ documentType`.

**C2 — `data_processing_registry` é global (sem `tenant_id`)** (RECONCILIACAO §4):
O registro de bases legais é definido pela plataforma, não pelos tenants. O endpoint público não pode exigir autenticação (transparência LGPD Art. 9º) e portanto não pode ter `SET LOCAL app.current_tenant_id`. O `PrismaService.client` (sem extensão RLS) é o acesso correto — padrão do módulo marketing (Cenário 04).

**C3 — Efeito imediato do withdrawal via consulta em `consent_records`** (RECONCILIACAO §8.6):
O "efeito imediato" não requer invalidação de cache nem event-sourcing complexo. O runtime de coleta de foco (Epic 5, `use-focus-heartbeat`) já respeita flags de consentimento; a query existente ou nova no arranque da reunião deve checar `consent_records` para o userId+consentType. A granularidade exata de onde inserir essa verificação (guard NestJS vs. query no service) é decisão de plan, não de spec.

**C4 — Consentimentos mandatórios não revogáveis** (epic-09.md AC):
Termos de Uso e Política de Privacidade são base legal para o contrato de serviço (`contract_execution` / `legal_obligation`). A LGPD Art. 8º §5 exige que o withdrawal seja possível, mas o AC da story decide que para esses documentos o withdrawal equivale a exclusão de conta — conforme arquitetura de produto (decisão do PM). O toggle FE é desabilitado e exibe tooltip explicativo.
