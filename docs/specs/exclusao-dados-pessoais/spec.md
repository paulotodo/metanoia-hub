# Spec: exclusao-dados-pessoais

**Feature:** Story 9-2 — Exclusão de Dados Pessoais / Eliminação LGPD
**Epic:** 9 (LGPD/Privacidade)
**Status:** draft
**Versão:** 1.0.0
**Data:** 2026-06-12

---

## 1. Objetivo

Permitir que qualquer usuário autenticado solicite a eliminação permanente de seus dados pessoais da plataforma, exercendo o direito de eliminação previsto na LGPD (art. 18, inc. VI). O processo é assíncrono e inclui período de graça de 7 dias (cancelável), soft-delete imediato após o período e hard-delete definitivo em até 30 dias.

Esta story fecha o **Epic 9** (4/4): 9-3 (audit imutável) ✓, 9-4 (consentimento) ✓, 9-1 (export) ✓, **9-2 (exclusão) = última**.

---

## 2. Contexto e Reconciliações Críticas

### 2.1 Tensão arquitetural central — RESOLVIDA

`audit_events` (Story 9-3) é **append-only imutável** por design e por exigência legal. A eliminação LGPD não pode apagar registros de auditoria. Solução adotada (alinhada com epic-09.md AC e RECONCILIACAO-EPIC9):

- `audit_events.user_id` → substituído por `anonymous-<sha256(userId)[:8]>` (hash estável e determinístico, não-reversível sem o userId original).
- O hash preserva rastreabilidade intra-tenant (todas as ações de um mesmo usuário continuam correlacionadas) sem expor PII.
- Registros de auditoria **permanecem íntegros** — apenas o identificador pessoal é anonimizado.

### 2.2 Módulo privacy já existe (Story 9-1)

- Path: `apps/api/src/privacy/` — `PrivacyModule`, `PrivacyController`, `PrivacyService`, `PrivacyExportService`, `PrivacyExportProcessor`
- Story 9-2 **ADICIONA** ao módulo: `PrivacyDeletionService` + `PrivacyDeletionProcessor`
- NÃO recria o módulo nem o controller — apenas estende.

### 2.3 Tabela `deletion_requests` — nova migration

- `User.status` hoje é `String @default("pending_verification")`. Story 9-2 adiciona os estados `deletion_pending` e `deleted` (string livre — sem enum PG, consistente com o padrão do projeto; enum Zod em `packages/types`).
- Nova tabela `deletion_requests`: `(id, userId, tenantId, status, cancellableUntil, deletionDeadline, cancelledAt, confirmedAt, completedAt)`.

### 2.4 Padrão de worker assíncrono (Story 9-1 / 8-7)

- `PrivacyDeletionService`: `createJob()` → `BullMqService.createQueue('queue:privacy-deletion')` → `queue.add()`
- `PrivacyDeletionProcessor`: `OnModuleInit` worker — mesmo skeleton do `PrivacyExportProcessor`
- Job payload: `{ requestId, userId, allTenantIds, requestedAt, softDeleteDeadline, hardDeleteDeadline }`
- Retry backoff: 3 tentativas com intervalos de 1h, 4h, 12h (LGPD deletion — intervalos maiores que export por ser destrutivo)

### 2.5 deleteUserData() por módulo — espelho de exportUserData()

A Story 9-1 criou `exportUserData(userId, tenantId)` em 6 services:
- `UsersService`, `GroupMembersService`, `MeetingsService`, `ProgressService`, `PastoralService`, `AuditService`
- `ConsentService.exportUserData()` foi feito via `PrivacyExportService` (inline)

Story 9-2 cria o método espelho em cada módulo. Ver §3 para semântica por módulo.

### 2.6 `consent` — RETER por base legal (LGPD art. 16)

Registros de `consents` e `consent_records` são **base legal documentada** — não podem ser eliminados por solicitação do titular (LGPD art. 16, inc. I: "cumprimento de obrigação legal"). Eles ficam intactos.

### 2.7 Modo privilegiado no worker

O worker de deleção roda fora de uma request HTTP — não usa `AsyncLocalStorage`. Igual ao worker de export: usa `prisma.client` diretamente com `tenantId` explícito. É a **única exceção documentada** ao padrão `RequestContext`.

### 2.8 Guardrail de liderança — server-side

Usuário com role `Líder` e grupos ativos não pode solicitar exclusão. O endpoint `POST /api/v1/privacy/deletion` verifica server-side se há grupos onde o usuário é líder ativo. Retorna 422 com lista de grupos se bloqueado.

---

## 3. Semântica de deleção por módulo

| Módulo / Tabela | Ação | Justificativa |
|-----------------|------|---------------|
| `users` — perfil | Anonimizar: `name → "Usuário Removido"`, `email → "removed-<hash>@deleted.invalid"`, `status → "deleted"` | Linha mantida para integridade referencial de FKs históricas |
| `user_tenants` | Soft-delete (marcar `deletedAt`) | Vínculo tenant preservado para auditoria |
| `group_members` | Soft-delete (`deletedAt`) | Histórico de grupo preservado, PII removida |
| `lesson_progress`, `module_progress`, `trail_progress` | Soft-delete (`deletedAt`) | Progresso anonimizado; estatísticas agregadas preservadas |
| `meeting_attendance`, `meeting_telemetry`, `meeting_participants`, `meeting_events` | Soft-delete (`deletedAt`) | Registro de reunião preservado para outros participantes |
| `reflections` (`leaderId`) | Soft-delete (`deletedAt`) | Dado pessoal do líder (autoria) |
| `pastoral_notes`, `pastoral_actions`, `pastoral_alerts`, `participant_radar_status`, `participant_status_improved` | Soft-delete (`deletedAt`) | Dado pastoralé registro institucional; PII anonimizada |
| `outreach_intents` (`createdByUserId`) | Anonimizar `createdByUserId → NULL` (se FK nullable) ou hash | Registro de terceiros (grupo/participante alvo) — não apagar |
| `audit_events` (`userId`) | Anonimizar `userId → "anonymous-<sha256(userId)[:8]>"` | RETER — imutabilidade legal; anonimizar PII |
| `consents`, `consent_records` | **RETER intactos** | Base legal documentada (LGPD art. 16) |
| Redis keys `*:{userId}:*` | Varredura SCAN + DEL | Nenhum dado pessoal em cache pós-deleção |
| MinIO `user/` paths | DELETE object | Arquivos pessoais permanentemente removidos |

---

## 4. Requisitos Funcionais

### FR-01: Guardrail de liderança
- Ao solicitar exclusão, se o usuário possui role `Líder` em grupos com `status = "active"`, o endpoint retorna **422** com:
  ```json
  { "error": "LEADER_ACTIVE_GROUPS", "groups": [{ "id", "name" }] }
  ```
- UI exibe: "Você lidera {N} grupo(s) ativo(s). Transfira a liderança antes de solicitar a exclusão."
- Lista de grupos com links para "Transferir Liderança"

### FR-02: Solicitação de exclusão
- `POST /api/v1/privacy/deletion`
- Autenticado (KeycloakAuthGuard)
- Requer confirmação explícita no body: `{ confirm: "EXCLUIR" }` — rejeitar qualquer outro valor
- Retorno 202:
  ```json
  { "data": { "requestId", "status": "pending", "cancellableUntil": "<+7 dias>", "deletionDeadline": "<+30 dias>" } }
  ```
- Idempotente: se já existe `deletion_request` com `status != "cancelled"`, retornar o request existente (sem duplicar)
- `User.status` imediatamente atualizado para `deletion_pending`
- Banner exibido em todas as páginas autenticadas: "Sua conta será excluída em {N} dias. [Cancelar solicitação]"

### FR-03: Cancelamento durante grace period
- `DELETE /api/v1/privacy/deletion/:requestId`
- Só permitido se `now < cancellableUntil` (7 dias após a solicitação)
- `User.status` retorna ao estado anterior (`active`)
- `deletion_request.status → "cancelled"`, `cancelledAt` registrado
- Evento de auditoria registrado

### FR-04: Soft-delete (disparado após grace period)
- BullMQ worker em `queue:privacy-deletion` executa após `cancellableUntil`
- Executa `softDeleteUserData(userId, tenantId)` em cada módulo (ver §3)
- Limpa Redis: `SCAN 0 MATCH *:{userId}:* COUNT 100` iterativo + DEL em batches
- Invalida sessões Keycloak: revoga tokens ativos + limpa Redis session keys
- `deletion_request.status → "soft_deleted"`, `confirmedAt` registrado

### FR-05: Hard-delete (30 dias após solicitação)
- Job separado ou segunda fase do mesmo worker, executado após `deletionDeadline`
- Hard-delete transacional: `BEGIN; DELETE/UPDATE em todas as tabelas; COMMIT`
- Se qualquer DELETE falhar por FK constraint inesperada: `ROLLBACK`, Sentry alert high severity, DPO notificado
- Em sucesso: todos os dados soft-deleted são purged; MinIO files deletados
- `deletion_request.status → "completed"`, `completedAt` registrado
- Evento final em audit: `{ eventType: "privacy.deletion.completed", anonymizedUserId, completedAt }`

### FR-06: Anonimização do audit
- No hard-delete: `UPDATE audit_events SET user_id = 'anonymous-<sha256(userId)[:8]>' WHERE user_id = :userId`
- O hash é determinístico: mesma userId sempre produz o mesmo `anonymous-<hash>` (correlacionável dentro do tenant, não-reversível para terceiros)
- Executado dentro da transação do hard-delete

### FR-07: Completude e resiliência
- Job retries: 3x com backoff 1h/4h/12h (exponencial, via BullMQ)
- Após 3 falhas: Sentry alert high severity + DPO notificado; dados em `deletion_pending` (nunca parcialmente deletados)
- Teste de cascade: criar usuário com dados em **todos** os módulos → executar pipeline completa → verificar: cada tabela limpa, audit anonimizado, Redis limpo, MinIO limpo

### FR-08: Status endpoint
- `GET /api/v1/privacy/deletion/:requestId`
- Retorna: `{ requestId, status, cancellableUntil, deletionDeadline, cancelledAt?, completedAt? }`
- 404 se requestId não encontrado ou não pertence ao usuário autenticado

### FR-09: Banner FE
- Quando `User.status === "deletion_pending"`, exibir banner persistente em toda área autenticada
- Banner inclui: "Sua conta será excluída em {N} dias." + botão "Cancelar solicitação" (chama FR-03)
- Banner desaparece quando status retorna a `active` (cancelamento) ou ao logout definitivo

### FR-10: Idempotência do worker
- Worker verifica `deletion_request.status` antes de cada fase
- Se `status === "cancelled"`: abort job sem deletar nada
- Se job reiniciado após falha parcial: retomar da última fase completada (não reiniciar do zero)

---

## 5. Requisitos Não-Funcionais

- **NFR-L1:** Prazo legal (LGPD): processo completo em ≤ 30 dias após confirmação (grace period de 7 + soft-delete + hard-delete)
- **NFR-L2:** Dados de `consents`/`consent_records` NUNCA deletados (base legal)
- **NFR-L3:** `audit_events` NUNCA deletados — apenas anonimizados
- **NFR-S1:** Hard-delete transacional — ou tudo ou nada (rollback total em falha)
- **NFR-S2:** Redis limpo: nenhum key `*:{userId}:*` remanescente pós-soft-delete
- **NFR-S3:** Sessões Keycloak revogadas antes do hard-delete
- **NFR-P1:** Soft-delete de usuário com dados em até 5 tenants em < 60s (worker)
- **NFR-T1:** RLS isolation tests obrigatórios para migration `deletion_requests`
- **NFR-T2:** Teste de cascade cobre todas as tabelas do §3

---

## 6. Decisões de Infraestrutura

| Tipo | Decisão |
|------|---------|
| **Scheduling** | `FR-INFRA-SCHED`: duas fases distintas no mesmo worker — fase 1 executada no próximo ciclo após `cancellableUntil`; fase 2 após `deletionDeadline`. BullMQ `delay` calculado no enfileiramento (`cancellableUntil - now` em ms). |
| **Idempotência** | `FR-INFRA-IDEMP`: chave de idempotência = `(userId, status != "cancelled")`. Job ID = `deletion-{requestId}`. BullMQ `jobId` previne duplicatas. |
| **Mutex multi-pod** | `FR-INFRA-LOCK`: BullMQ com Redis garante que apenas 1 worker executa por requestId simultaneamente. |
| **Hard-delete atômico** | `FR-INFRA-TX`: transação PostgreSQL única para todas as operações de purge. Rollback total em qualquer falha. |
| **Anonimização hash** | `FR-INFRA-HASH`: `sha256(userId)` truncado para 8 chars hex. Implementação: `crypto.createHash('sha256').update(userId).digest('hex').slice(0, 8)`. Determinístico e estável. |

---

## 7. Escopo

### 7.1 IN SCOPE
- `POST /api/v1/privacy/deletion` (criar solicitação)
- `DELETE /api/v1/privacy/deletion/:requestId` (cancelar)
- `GET /api/v1/privacy/deletion/:requestId` (status)
- Migration: `deletion_requests` + índices
- Migration: `User.status` novos valores `deletion_pending`/`deleted` (Zod enum em `packages/types`)
- BullMQ worker `queue:privacy-deletion` (soft-delete + hard-delete em 2 fases)
- `softDeleteUserData(userId, tenantId)` + `hardDeleteUserData(userId, tenantId)` em: `UsersService`, `GroupMembersService`, `MeetingsService`, `ProgressService`, `PastoralService`, `AuditService`
- Anonimização `audit_events.user_id → anonymous-<hash>`
- Limpeza Redis: SCAN + DEL por `userId`
- Limpeza MinIO: DELETE user path
- Revogação sessões Keycloak
- Banner FE `deletion_pending` em toda área autenticada
- Tela de solicitação em `/app/consumo/perfil/privacidade/page.tsx` (já existe — adicionar seção)
- Zod contracts `PrivacyDeletionRequestSchema`, `PrivacyDeletionStatusSchema` em `packages/types`
- i18n pt-BR: chaves `privacy.deletion.*`
- MSW handlers para deleção
- Testes: unit (por módulo), integration (cascade completo), RLS isolation

### 7.2 OUT OF SCOPE
- Export de dados (Story 9-1 — já entregue)
- Notificação por e-mail (stub via `queue:notifications` apenas)
- Relatório do DPO (dashboard administrativo de deleções — pós-MVP)
- Deleção de dados de outros usuários por Admin (fora do escopo LGPD art. 18)
- Deleção de dados agregados/analytics (dados anonimizados não são PII)

---

## 8. User Stories

### P1 — Solicitar exclusão da conta (fluxo feliz)
**Como** Participante sem grupos de liderança ativa,
**Quero** solicitar a exclusão permanente de todos os meus dados,
**Para** exercer meu direito LGPD e sair da plataforma com a certeza de que meus dados foram removidos.

**Critérios de aceitação:**
- Consigo navegar até minha área de privacidade e encontrar "Solicitar exclusão da conta"
- Vejo um diálogo explicativo listando o que será removido e o que será retido (audit, consentimentos)
- Preciso digitar "EXCLUIR" para confirmar — tentativas com outros textos são bloqueadas
- Após confirmar, recebo a confirmação com prazo de 7 dias para cancelar e 30 dias para conclusão
- Um banner aparece em todas as páginas me informando sobre o prazo e permitindo cancelar

### P2 — Cancelar solicitação dentro do período de graça
**Como** usuário que solicitou a exclusão mas mudou de ideia,
**Quero** cancelar a solicitação dentro dos 7 dias,
**Para** retomar o uso normal da plataforma sem perda de dados.

**Critérios de aceitação:**
- O banner exibido inclui botão "Cancelar solicitação" com contagem de dias restantes
- Ao cancelar, minha conta retorna ao estado normal imediatamente
- O banner desaparece após cancelamento
- Não consigo cancelar após os 7 dias

### P3 — Líder bloqueado até transferir liderança
**Como** Líder com grupos ativos,
**Quero** ser informado claramente do que preciso fazer antes de excluir minha conta,
**Para** não deixar grupos sem liderança.

**Critérios de aceitação:**
- Ao tentar solicitar exclusão, vejo mensagem listando os grupos que lidero ativamente
- Cada grupo tem link para "Transferir Liderança"
- Após transferir todas as lideranças, consigo solicitar normalmente

### P4 — Exclusão completa (visão do sistema)
**Como** sistema,
**Quero** garantir que todos os dados pessoais do usuário são removidos em até 30 dias,
**Para** cumprir a LGPD e proteger o titular dos dados.

**Critérios de aceitação:**
- Após o período de graça, dados são soft-deleted em todos os módulos
- Em 30 dias, hard-delete definitivo em transação única — ou tudo ou nada
- `audit_events` são anonimizados (userId → hash), nunca deletados
- `consents`/`consent_records` são retidos intactos
- Redis limpo: nenhum dado pessoal remanescente
- MinIO limpo: arquivos do usuário deletados
- Sessões Keycloak revogadas

---

## 9. Success Criteria

1. **Completude**: 100% das tabelas do §3 com dado pessoal estão cobertas no teste de cascade — usuário criado com dados em todos os módulos → pipeline completa → verificação por tabela
2. **Prazo legal**: processo completo (da confirmação ao hard-delete) em ≤ 30 dias úteis
3. **Cancelamento**: usuário consegue cancelar e retornar ao uso normal em < 1 minuto
4. **Resiliência**: em caso de falha do worker, dados permanecem íntegros (nunca parcialmente deletados); alerta chega ao DPO em < 30 minutos após 3 tentativas
5. **Audit preservado**: zero registros de `audit_events` deletados; todos com `userId` do titular têm `userId` anonimizado após hard-delete
6. **Guardrail**: 100% das tentativas de exclusão por líderes com grupos ativos são bloqueadas com informação acionável
7. **Idempotência**: múltiplas solicitações do mesmo usuário retornam o request existente sem duplicar jobs

---

## Clarifications

*(Etapa clarify executada em 2026-06-12 via feature-00c pipeline. Q1-Q3 e Q5 resolvidos autonomamente — score ≥ 2. Q4 aguarda decisão humana — ver bloco `[NEEDS CLARIFICATION]` abaixo.)*

### Resolvidos (score ≥ 2)

- **Anonimização de audit** (pré-existente): hash sha256 truncado a 8 chars (determinístico, não-reversível). Confirmado pela tensão LGPD vs imutabilidade.
- **Consent RETER** (pré-existente): base legal LGPD art. 16 — confirmado.
- **Grace period** (pré-existente): 7 dias para cancelamento, 30 dias para hard-delete (NFR-L2 do epic-09).
- **Guardrail de liderança** (pré-existente): verificação server-side no endpoint, não apenas frontend.

- **Q1 — Idempotência soft-delete** (dec-006, score 2): O worker NÃO usa checkpoint de módulo. O soft-delete é idempotente por natureza: aplicar `deletedAt` a um registro já marcado é no-op. Em caso de falha, o job reexecuta do início sem risco de inconsistência. FR-10 "retomar da última fase completada" refere-se às 2 fases do worker (soft-delete vs. hard-delete), não a granularidade de módulo. `softDeleteCheckpoint JSONB` NÃO é adicionado à tabela `deletion_requests`.

- **Q2 — Rollback cross-tenant no hard-delete** (dec-007, score 3): "Rollback total" (NFR-S1) significa rollback **intra-tenant**: cada tenant é processado em transação PostgreSQL separada (consistente com RLS multi-tenant isolado). Se o hard-delete do tenant B falha, apenas o tenant B sofre rollback; o tenant A permanece deletado. Rollback cross-tenant não é viável nativamente. Abortar todos os tenants (opção D) viola NFR-L1 (prazo LGPD ≤ 30 dias). Em falha de qualquer tenant: Sentry alert + DPO notificado; retry BullMQ.

- **Q3 — Re-cadastro com mesmo email durante soft-delete** (dec-008, score 3): Email permanece "ocupado" (não-anonimizado) durante os 30 dias do período de soft-delete. A anonimização `email → removed-<hash>@deleted.invalid` ocorre apenas no **hard-delete** (spec §3). Tentativa de cadastro com o mesmo email durante soft-delete será bloqueada pela unique constraint de `users.email`. Essa é a consequência natural da sequência temporal da spec.

- **Q5 — Grupo com único líder sem transferência possível** (dec-009, score 2): FR-01 retorna 422 para qualquer grupo ativo com o usuário como líder. Para o edge case de grupo com único membro (sem outro usuário para receber a liderança), o 422 inclui a opção **"Dissolver grupo"** como alternativa ao "Transferir Liderança". A UI deve distinguir os dois casos: grupos com outros membros → "Transferir Liderança"; grupos com único membro → "Dissolver grupo" + confirmação. Dissolução remove o grupo (`status → "dissolved"`) e desbloqueia a solicitação de exclusão.

- **Q4 — Concorrência export × deleção** (dec-012, score 2 — decisão humana via block-001): Opção **D (B+C)** adotada:
  - Export EM ANDAMENTO inclui dados soft-deleted durante o grace period (portabilidade LGPD preservada até o hard-delete efetivo).
  - `POST /api/v1/privacy/export` retorna **409 Conflict** quando `User.status === "deletion_pending"` (novo export bloqueado com aviso).
  - Não há race condition nova: export em curso lê snapshot; novo export é barrado pelo 409. O `PrivacyExportProcessor` e `PrivacyDeletionProcessor` operam em fases temporais distintas (export → soft-delete → hard-delete).
  - FR-02 atualizado implicitamente: o endpoint `POST /api/v1/privacy/export` (Story 9-1) deve verificar `User.status !== "deletion_pending"` antes de enfileirar novo export.
