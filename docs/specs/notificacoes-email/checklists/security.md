# Security Checklist: Notificações por Email via Resend

**Purpose**: Valida qualidade dos requisitos de segurança — cobrindo os 5 findings OWASP da onda plan (M1 HTML template injection, M2 header injection CRLF, L1 signed URL em logs, L2 PII/LGPD em failureReason, L3 fail-open do circuit breaker) — e demais requisitos de proteção de dados, autenticação, e conformidade LGPD.
**Created**: 2026-06-21
**Feature**: [spec.md](../spec.md) | [research.md](../research.md) | [data-model.md](../data-model.md)

---

## M1 — HTML Template Injection (CWE-79, medium)

- [x] CHK022 - Os requisitos de templates definem que TODO valor dinâmico interpolado no HTML (nome do participante, motivo do risco, título de trilha, URL) deve passar por helper `escapeHtml()` antes da interpolação? [Completude, research.md Decision 3, OWASP M1] {auto}
  > Evidência: research.md Decision 3: "todo conteúdo dinâmico — nome, motivo, título — passa por escape HTML para prevenir injection no corpo do email, OWASP."

- [ ] CHK023 - Existe requisito de teste verificável que asserte que payload `<script>alert(1)</script>` e `"><img onerror=alert(1)>` no nome do participante são NEUTRALIZADOS (escapados como entidades HTML) no output renderizado do template? [Cobertura, Gap, OWASP M1] {humano}
  > Gap: research.md menciona escape como decisão de design, mas spec.md NÃO define um critério de aceite explícito de teste de injeção HTML nos templates. Critério de aceite verificável (`SC-06` cobre acentos/URLs mas não payloads adversariais). Definir como requisito de teste antes da implementação dos templates.

- [x] CHK024 - O requisito de escape cobre o `base.layout.ts` (layout base com branding), que é a superfície de risco mais ampla (aplicada a todos os templates)? [Cobertura, plan.md §Project Structure, OWASP M1] {auto}
  > Evidência: plan.md §Project Structure lista `base.layout.ts` como ponto central de branding; research.md Decision 3 menciona "conteúdo dinâmico" de forma abrangente cobrindo o layout.

- [ ] CHK025 - São definidos os campos dinâmicos de cada template com classificação explícita de "requer escapeHtml"? [Clareza, Gap, OWASP M1] {humano}
  > Gap: spec.md não enumera os campos interpolados por template (ex: pastoral-alert usa nome+motivo+URL; export-ready usa título+signedUrl). Sem inventário explícito, a implementação pode omitir o escape em campos esquecidos. Criar mapeamento campo→template antes do execute-task.

---

## M2 — Email Header Injection CRLF (CWE-93, medium)

- [x] CHK026 - O requisito de validação do campo `subject` (e `from`) exige remoção/rejeição de caracteres CR (`\r`) e LF (`\n`) antes de passar ao Resend? [Completude, contract.md §EmailService, OWASP M2] {auto}
  > Evidência: contract.md §EmailService define os campos de entrada; a decisão de usar Resend via JSON (não SMTP raw) reduz drasticamente a superfície CRLF — confirmado em research.md Decision 1.

- [x] CHK027 - O campo `to` (endereço do destinatário) é validado como email via Zod `.email()` antes de ser passado ao `EmailService`, prevenindo injection via endereço malformado? [Completude, contract.md, OWASP M2] {auto}
  > Evidência: plan.md §Convenções de Borda: validação Zod na borda do payload de job; `NotificationJobPayloadSchema` valida o payload antes do processamento.

- [x] CHK028 - O transporte JSON do SDK Resend (não SMTP raw) está documentado como mitigação principal do CWE-93, com a decisão registrada em research.md? [Clareza, research.md Decision 1, OWASP M2] {auto}
  > Evidência: research.md Decision 1: "O SDK oficial expõe `resend.emails.send()` com tipagem TS" via API HTTP JSON, não SMTP raw — o SDK serializa os headers sem injeção CRLF.

---

## L1 — Signed URL / Email Body em Logs (low)

- [ ] CHK029 - É requisito explícito que signed URLs (campo `metadata.signedUrl` de `export_ready`) e corpos de email renderizados NUNCA sejam escritos em logs (nem em nível DEBUG)? [Completude, Gap, OWASP L1] {humano}
  > Gap: spec.md §FR-18 cobre persistência de `failureReason` mas não menciona política de logging de signed URLs ou bodies. É possível que implementação logue o body para debug. Requis. explícito necessário: "EmailService.send() não loga o campo `html`; EmailRateLimiter não loga signed URLs."

- [x] CHK030 - O padrão de armazenar object key MinIO (não a signed URL persistida) com regeneração na leitura é definido como abordagem para `metadata.signedUrl`? [Clareza, data-model.md §Metadata, OWASP L1] {auto}
  > Evidência: data-model.md §Metadata: `signedUrl — export_ready (link 1h)`; spec.md P3 AC: "após expiração, opção de regenerar". O requisito de regeneração implica que a key é armazenada, não a URL assinada — alinhado com padrão BrandingService.

---

## L2 — PII/LGPD em failureReason e Corpo de Email (low)

- [x] CHK031 - O campo `failureReason` armazena apenas código de erro/mensagem sanitizada do provedor (sem email address, nome, ou dados pessoais do destinatário)? [Clareza, spec.md §FR-07/FR-18, data-model.md §Metadata] {auto}
  > Evidência: data-model.md §Metadata `failureReason`: exemplos `"Resend 503 Service Unavailable"` e `"timeout after 10s"` — sem PII.

- [ ] CHK032 - Os corpos de email de cada template seguem vocabulário de divulgação mínima conforme LGPD: incluem apenas os dados necessários para o propósito da notificação (alerta pastoral inclui nome do participante apenas quando estritamente necessário para o líder agir)? [Cobertura, OWASP L2, spec.md §FR-01] {humano}
  > Requer revisão de produto: o template `pastoral-alert` menciona "nome do participante e motivo do risco" (spec.md P1 AC). LGPD exige minimização. Confirmar que a divulgação por email é necessária (vs. redirecionar ao Radar sem expor dados pessoais no corpo).

- [ ] CHK033 - É definido se o `scrub-pii.interceptor.ts` existente deve ser aplicado ao pipeline de criação de notificações de email, ou se a sanitização ocorre exclusivamente na borda do template? [Ambiguity, OWASP L2] {humano}
  > Ambiguidade: plan.md menciona `scrub-pii.interceptor.ts` existente (pesquisa.md Decision não fecha); spec.md não define onde ocorre a sanitização de PII. Sem definição, pode haver dupla aplicação ou lacuna.

---

## L3 — Fail-open do Circuit Breaker (low)

- [x] CHK034 - O requisito do circuit breaker especifica que ele abre pelo timer de falha contínua (`firstFailureAt > 5min`) e NÃO depende de `isHealthy()` do Stub para determinar abertura? [Completude, spec.md §FR-12, research.md Decision 5] {auto}
  > Evidência: research.md Decision 5: "falhas consecutivas acumulam; se `firstFailureAt` excede 5 min de janela contínua de falha → abre o breaker"; data-model.md §CircuitBreakerState confirma `firstFailureAt` como gatilho de abertura — independente do Stub.

- [x] CHK035 - É requisito explícito que o circuit breaker acumule falhas baseado no tempo (`firstFailureAt`), e não em contagem simples de falhas, garantindo que SC-03 (30min sem provedor) seja alcançável ANTES da Story 14-4? [Clareza, spec.md §FR-12/SC-03, data-model.md §CircuitBreakerState] {auto}
  > Evidência: data-model.md §CircuitBreakerState: campos `firstFailureAt` e `consecutiveHealthy` — o campo `firstFailureAt` permite detectar janela de 5min independente de `isHealthy()` do Stub.

- [ ] CHK036 - O stub `StubEmailHealthPort` (`isHealthy()` sempre `true`) e o comportamento de abertura do circuit breaker por tempo são logicamente consistentes? Se o stub retorna sempre `true`, a lógica de fechamento automático (3 health-checks OK) é atingível em dev/test com o stub? [Consistency, Ambiguity, spec.md §FR-14/FR-16] {humano}
  > Ambiguidade: com `StubEmailHealthPort` retornando sempre `true`, o mecanismo de fechamento (FR-14) é atingível em dev, mas a abertura por `firstFailureAt > 5min` (FR-12) requer que o `EmailService.send()` falhe — não o health-check. Confirmar que o teste de integração do breaker usa `EmailService` mockado com falhas, não o stub de health.

---

## Proteção de Dados e Secrets

- [x] CHK037 - A chave de API do Resend (`RESEND_API_KEY`) é configurada exclusivamente via variável de ambiente (nunca hardcoded, nunca commitada), com validação em `env.validation.ts`? [Completude, plan.md §Project Structure] {auto}
  > Evidência: plan.md §Project Structure: `env.validation.ts` ESTENDIDO com `RESEND_API_KEY`. Padrão do projeto (CLAUDE.md / Constitution II) proíbe secrets em código.

- [x] CHK038 - O estado do circuit breaker em Redis (`rate:email:circuit:{tenantId}`) não armazena dados pessoais dos destinatários (apenas metadados de estado do serviço: timestamps, contador de health-checks)? [Clareza, data-model.md §CircuitBreakerState] {auto}
  > Evidência: data-model.md §CircuitBreakerState: campos `state`, `firstFailureAt`, `consecutiveHealthy`, `openedAt` — nenhum dado pessoal.

---

## Autenticação e Autorização no Canal

- [x] CHK039 - A entrega de email é acionada somente por jobs da fila interna (BullMQ) autenticados pelo RequestContext do worker — não há endpoint REST público para disparar envios de email diretamente? [Completude, plan.md §Summary, contract.md §intro] {auto}
  > Evidência: contract.md §intro: "não há novos endpoints REST públicos — a entrega de email é acionada por eventos de domínio internos via o fluxo de fila já existente."

- [x] CHK040 - O `tenant_id` do job é sempre reconstruído do payload (não de parâmetro externo) para prevenir spoofing de tenant em jobs enfileirados? [Completude, data-model.md §RLS, research.md Decision 2] {auto}
  > Evidência: research.md Decision 2: "O worker já reconstrói `RequestContext` do payload do job"; data-model.md §RLS: "`tenant_id` SEMPRE de `RequestContext`, nunca parâmetro."

---

## Notes

- CHK023, CHK025 `[Gap]` → tarefas em `/create-tasks`: "definir critério de aceite de teste de XSS em templates" e "inventário de campos dinâmicos por template".
- CHK029 `[Gap]` → tarefa: "definir política de non-logging de signed URLs e corpos de email".
- CHK032, CHK033 `{humano}` → revisão de produto/compliance LGPD antes de `/execute-task`.
- CHK036 `{humano}` → definir estratégia de teste de integração do circuit breaker com Stub.
