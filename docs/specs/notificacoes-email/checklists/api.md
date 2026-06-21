# API Checklist: Notificações por Email via Resend

**Purpose**: Valida qualidade, completude e consistência dos requisitos de contrato, integração de canal, error handling, idempotência e rastreabilidade da feature `notificacoes-email`.
**Created**: 2026-06-21
**Feature**: [spec.md](../spec.md) | [contracts/email-channel.contract.md](../contracts/email-channel.contract.md)

---

## Contratos e Interfaces

- [x] CHK001 - O contrato da interface `NotificationChannelInterface` (método `send()`) é definido e proíbe lançamento de exceções (retorno `{success,error}`)? [Completude, contract.md §NotificationChannelInterface] {auto}
  > Evidência: contract.md §NotificationChannelInterface: "send() MUST NOT throw — retorna `{success:false, error}` e o worker re-lança."

- [x] CHK002 - A interface `EmailService` (abstração do SDK Resend) define tipos de entrada/saída com todos os campos necessários (`to`, `from`, `subject`, `html`, `providerId`, `retryable`)? [Completude, contract.md §EmailService] {auto}
  > Evidência: contract.md §EmailService: define `SendEmailInput` (to/from/subject/html) e `SendEmailResult` (success/providerId/error/retryable).

- [x] CHK003 - A porta `EmailHealthPort` define a interface de health-check como abstraída, com token de injeção `EMAIL_HEALTH_PORT` e stub default documentado? [Completude, contract.md §EmailHealthPort, spec.md §FR-16] {auto}
  > Evidência: contract.md §EmailHealthPort; spec.md §FR-16 e plan.md §Ponto de Integração Pendente confirmam stub + token.

- [x] CHK004 - O output do Lua script de rate-limit (`RateLimitResult`) tem todos os campos tipados (`decision`, `count`, `crossedThreshold`) e mapeamento Redis→TS definido? [Completude, contract.md §Rate-limit Lua command] {auto}
  > Evidência: contract.md §Rate-limit Lua command define o array Redis de saída e o mapeamento TS.

- [x] CHK005 - São definidos os comportamentos de retorno de `EmailChannel.send()` para TODOS os casos: sucesso, erro transiente, circuit aberto, rate-limited deferível? [Cobertura, contract.md §NotificationChannelInterface] {auto}
  > Evidência: contract.md descreve 4 casos de retorno; especificamente: circuit aberto → `{success:true}` (não conta como falha), rate-limited → `{success:true}`.

- [x] CHK006 - O campo `retryable` em `SendEmailResult` é usado para distinguir erros 5xx (retentáveis) de 4xx (não-retentáveis), evitando retries desnecessários? [Clareza, contract.md §EmailService, research.md Decision 1] {auto}
  > Evidência: contract.md §EmailService: `retryable?: boolean; // true p/ 5xx/timeout; false p/ 4xx`.

---

## Extensão de Enum e Schemas Zod

- [x] CHK007 - O enum `NotificationType` é estendido de forma aditiva (`ALTER TYPE ADD VALUE`) sem remover valores existentes? Os tipos novos (`export_ready`, `content_new`) são definidos com semântica distinta do `content_update`? [Completude, spec.md §Key Entities, research.md Decision 6] {auto}
  > Evidência: data-model.md §Enum notification_type confirma transição; research.md Decision 6 confirma ADD VALUE não-destrutivo.

- [x] CHK008 - O schema Zod `NotificationTypeSchema` em `packages/types` é o único ponto de verdade do enum no TypeScript, com snapshot test para gate de breaking change? [Consistência, research.md Decision 6, plan.md §Constitution Check IV] {auto}
  > Evidência: plan.md §Constitution Check IV: "schemas Zod em `packages/types` com snapshot gate"; research.md Decision 6 confirma snapshot update intencional.

- [x] CHK009 - O schema do payload de job (`NotificationJobPayloadSchema`) define validação Zod na borda de entrada do worker, garantindo que campos obrigatórios (`tenantId`, `userId`, `type`, `channel`) existam antes do processamento? [Completude, plan.md §Convenções de Borda] {auto}
  > Evidência: plan.md §Convenções de Borda: "Validação Zod na borda do payload de job `NotificationJobPayloadSchema`."

---

## Error Handling e Rastreabilidade

- [x] CHK010 - Toda tentativa de envio tem rastreabilidade de status (`pending` → `sent` | `failed`) definida com a transição de estado completa? [Completude, spec.md §FR-17, data-model.md §State transitions] {auto}
  > Evidência: data-model.md §State transitions define o grafo completo: pending→sent, pending→failed→fallback in_app.

- [x] CHK011 - O `metadata.failureReason` armazena apenas código/mensagem sanitizada do provedor (sem PII do destinatário)? O requisito é explícito sobre o que pode constar neste campo? [Clareza, spec.md §FR-07/FR-18, OWASP L2] {auto}
  > Evidência: data-model.md §Metadata chave `failureReason`: exemplo `"Resend 503 Service Unavailable"` ou `"timeout after 10s"` — sem PII; alinhado com OWASP L2.

- [x] CHK012 - Jobs com falha permanente (após 3 retries) são retidos para inspeção (`removeOnFail:false`)? Este requisito está explícito e rastreável ao mecanismo de fila (BullMQ `DigestService`)? [Completude, spec.md §FR-08, research.md Decision 2] {auto}
  > Evidência: research.md Decision 2: "`removeOnFail:false` já satisfeito pela DigestService"; spec.md §FR-08 confirma retenção.

- [x] CHK013 - O fallback in-app criado após 3 tentativas falhas (FR-06) tem todos os campos necessários definidos: `channel=in_app`, `fallbackOf=<notificationId original>`, mesmo `type` e `actionUrl`? [Completude, spec.md §FR-06, data-model.md §Metadata] {auto}
  > Evidência: data-model.md §Metadata: `fallbackOf` — `notificationId do email original`; spec.md §FR-06 define fallback equivalente.

---

## Idempotência

- [x] CHK014 - A estratégia de idempotência é definida para todos os tipos de job: `notificationId` para alertas imediatos e `digest:userId:type:bucket` para deferíveis? [Completude, spec.md §FR-INFRA-IDEMP, research.md Decision 7] {auto}
  > Evidência: spec.md §FR-INFRA-IDEMP e research.md Decision 7 cobrem ambos os padrões.

- [x] CHK015 - É especificado que re-enqueue do mesmo job não cria nova notificação (idempotência de criação), evitando duplicatas no banco? [Clareza, spec.md §FR-INFRA-IDEMP] {auto}
  > Evidência: spec.md §FR-INFRA-IDEMP: "Re-enqueue do mesmo job não cria nova notificação (jobId baseado em digest:userId:type:bucket)."

---

## Multi-tenancy e Isolamento

- [x] CHK016 - O requisito de isolamento multi-tenant cobre TODAS as camadas: banco (`tenant_id` + RLS via `withTenantTx`), Redis (chaves namespaced por `tenantId`), e reconstituição de `RequestContext` no worker? [Completude, spec.md §FR-04, data-model.md §RLS] {auto}
  > Evidência: data-model.md §RLS / Multi-tenancy cobre DB (withTenantTx), Redis (namespaced), e worker (reconstrói RequestContext).

- [x] CHK017 - O remetente por tenant e o remetente default (`EMAIL_DEFAULT_FROM`) são definidos com requisito explícito de verificação de domínio no Resend antes do deploy? [Completude, spec.md §FR-04] {auto}
  > Evidência: spec.md §FR-04: "domínio deve estar verificado no Resend antes do deploy."

---

## Admin Alert e Notificações de Sistema

- [x] CHK018 - O requisito de admin alert de threshold (FR-10/P5) especifica "uma notificação por threshold por dia" com mecanismo de deduplicação definido (flag Redis SET NX)? [Clareza, spec.md §FR-10, research.md Decision 7] {auto}
  > Evidência: research.md Decision 7: "`rate:email:{tenantId}:{YYYYMMDD}:alerted` SET NX dentro do Lua"; spec.md §FR-10 e P5 confirmam "uma por threshold por dia".

---

## Variáveis de Ambiente e Configuração

- [x] CHK019 - Todas as variáveis de ambiente requeridas estão listadas (`RESEND_API_KEY`, `EMAIL_DEFAULT_FROM`, `EMAIL_DAILY_LIMIT`, `EMAIL_RATE_THRESHOLD`) com plano de extensão de `env.validation.ts`? [Completude, plan.md §Project Structure] {auto}
  > Evidência: plan.md §Project Structure: `apps/api/src/config/env.validation.ts` — ESTENDER com as 4 variáveis.

---

## Observabilidade e Diagnóstico

- [ ] CHK020 - São definidos requisitos de logging estruturado para o `EmailChannel`: quais eventos gerar log (tentativa, sucesso, falha, fallback, rate-limit, circuit-open)? [Completude, Gap] {humano}
  > Gap: spec.md e plan.md definem rastreabilidade via `status`/`failureReason` no DB, mas NÃO especificam explicitamente formato/nível de logging estruturado (INFO/WARN/ERROR) por evento. Definir antes de implementar.

- [x] CHK021 - O evento de domínio `notifications.email.circuit-open` está definido com todos os campos canônicos (`eventId`, `eventType`, `version`, `tenantId`, `timestamp`, `data`, `metadata`)? [Completude, data-model.md §Domain Event] {auto}
  > Evidência: data-model.md §Domain Event define o JSON canônico completo conforme Constitution IV.

---

## Notes

- Items `{auto}` foram resolvidos pelo agente com citação da evidência nos artefatos spec/plan/research/contracts.
- Items `{humano}` aguardam decisão do dono do produto/tech lead.
- CHK020 `[Gap]` → vira tarefa em `/create-tasks`: "definir requisito de logging estruturado para EmailChannel (eventos e níveis)".
