# Research: Notificações por Email via Resend

**Feature**: `notificacoes-email` | **Date**: 2026-06-21 | **Phase 0**

Resolve as decisões técnicas (unknowns) antes do design. Todos os 4 NEEDS
CLARIFICATION da spec foram fechados na sessão de clarify (2026-06-21);
este documento registra as decisões de implementação remanescentes.

---

## Decision 1 — Provedor de email & SDK (NFR-I3)

**Decision**: Resend via SDK oficial `resend` (npm), encapsulado por uma
abstração `EmailService` (`apps/api/src/notifications/channels/email.service.ts`).
O `EmailChannel` nunca importa o SDK diretamente — depende de `EmailService`.

**Rationale**:
- A spec já fixa Resend como único provedor (Fora de Escopo: múltiplos
  provedores). O SDK oficial expõe `resend.emails.send()` com tipagem TS.
- Encapsular num `EmailService` isola o ponto de troca e facilita o mock nos
  testes de integração (sandbox/mock) — SC-06.
- Timeouts NFR-I3 (connect ≤ 3s, read ≤ 10s): o SDK Resend usa `fetch` por
  baixo. Aplicamos um `AbortController` com timeout de 10s (read) no
  `EmailService.send()`; o connect-timeout de 3s é configurado via opção
  `fetch` customizado (ou wrapper `undici` Agent com `connectTimeout: 3000`,
  `bodyTimeout: 10000`, `headersTimeout: 10000`). Documentado no plano.

**Alternatives considered**:
- Nodemailer + SMTP: rejeitado — sem features de deliverability/tracking,
  mais código de configuração SMTP, fora do alinhamento de stack.
- `@react-email/render` para templates: adotado parcialmente como opção de
  rendering (ver Decision 3), mas não obrigatório.

---

## Decision 2 — Reuso da infra de fila/retry existente (NFR-I1/I2/I4)

**Decision**: NÃO criar nova fila nem nova config de retry. O `EmailChannel`
pluga no fluxo já entregue pela Story 14-1:
- `DigestService.enqueue()` já define `attempts:3`, `backoff:{exponential,30000}`,
  `removeOnFail:false`.
- `NotificationsWorker.process()` já reconstrói `RequestContext` do payload e
  re-lança em `result.success === false` para acionar o backoff do BullMQ.
- O handler `worker.on('failed')` já marca a notificação como `failed` após
  esgotamento dos retries.

**Rationale**:
- Constitution VII (anti-retrabalho / reconciliação) e o contrato da
  `NotificationChannelInterface` (send() NUNCA lança; retorna `{success:false}`).
  Plugar no contrato existente respeita OCP — `ChannelRouter` NÃO é modificado.
- NFR-I4 (jobs falhos retidos) já satisfeito por `removeOnFail:false`.

**Gap identificado (a implementar nesta feature)**: o fallback in-app APÓS as
3 tentativas (FR-06) e a gravação de `metadata.failureReason` (FR-07/FR-18)
NÃO estão no worker hoje — o worker só marca `status=failed`. A criação do
fallback in-app equivalente será disparada do handler `failed` (ou de um
hook pós-esgotamento) via `NotificationsService.dispatch({channels:['in_app']})`.

**Alternatives considered**:
- Fila dedicada `email`: rejeitado — duplica infra, quebra o roteamento por
  canal já existente.

---

## Decision 3 — Templates de email + branding do tenant (FR-01/FR-02)

**Decision**: Templates por tipo em `apps/api/src/notifications/templates/`,
um módulo por tipo (`pastoral-alert.template.ts`, `meeting-reminder.template.ts`,
`export-ready.template.ts`, `content-new.template.ts`) + um `base.layout.ts`
que injeta branding. Branding obtido via `BrandingService.getBranding()`
(Epic 6), que já resolve `logoUrl` (signed URL a partir do object key MinIO)
+ `brandPrimaryColor`/`brandSecondaryColor`, com cache Redis `cache:branding:{tenantId}`.

**Rationale**:
- Reuso de `BrandingService.getBranding()` evita reimplementar resolução de
  signed URL e respeita o cache write-through existente (TTL 1h).
- Fallback sem logo: `getBranding()` retorna `logoUrl: null` quando o tenant
  não configurou — o layout usa identidade visual padrão da plataforma
  (logo default + cores default). SC-06 cobre o caso "tenant sem logo".
- Rendering: HTML strings template-literal com escape de interpolação
  (todo conteúdo dinâmico — nome, motivo, título — passa por escape HTML para
  prevenir injection no corpo do email, OWASP). Acentos PT-BR exigem
  `charset=utf-8` no header do email (garantido pelo Resend) e nos snapshots.

**Alternatives considered**:
- `@react-email`: viável e mais ergonômico, mas adiciona dependência de
  rendering JSX no backend; mantém-se opcional. MVP usa template-literal com
  helper de escape para minimizar superfície.
- Templates configuráveis por admin via UI: explicitamente Fora de Escopo.

---

## Decision 4 — Rate limit atômico via Lua script Redis (FR-09/FR-10/FR-11)

**Decision**: Script Lua `apps/api/src/notifications/scripts/rate-limit.lua`
carregado via `RedisService.defineCommand('emailRateLimit', {numberOfKeys:1, lua})`
(ioredis). Chave `rate:email:{tenantId}:{YYYYMMDD}`. O script recebe via ARGV:
`limit` (EMAIL_DAILY_LIMIT=100), `threshold` (EMAIL_RATE_THRESHOLD=80),
`ttlSeconds` (segundos até a próxima meia-noite UTC, calculado em TS),
`critical` (1|0). Lógica atômica:
1. `current = GET key` (0 se ausente).
2. Se `critical == 1`: `INCR` + set EXPIREAT se primeira escrita; retorna
   `{ decision: "send", count, crossedThreshold }` (críticos sempre enviam).
3. Senão, se `current >= limit`: retorna `{ decision: "defer", count }` sem incrementar.
4. Senão `INCR` (set EXPIREAT na primeira escrita); se novo count atingiu
   `threshold` pela primeira vez no dia, marca `crossedThreshold=true` (uma vez
   por dia via flag `rate:email:{tenantId}:{YYYYMMDD}:alerted` SET NX).
5. Retorna `{ decision, count, crossedThreshold }`.

**Rationale**:
- FR-11 (atomicidade): GET+compare+INCR numa única execução Lua é atômica no
  Redis (single-threaded). Dois jobs concorrentes em 79/100 → só o primeiro
  passa de 79→80; o segundo lê 80 e (para tipo deferível) difere. SC-04.
- `EXPIREAT` com epoch da próxima meia-noite UTC (não TTL fixo 86400) alinha o
  reset à fronteira de dia-calendário implícita na chave `{YYYYMMDD}` (clarify Q4).
- Limite passado como ARGV (não hardcoded no script) permite configurabilidade
  pós-MVP sem reescrever o Lua (clarify Q1).
- `defineCommand` compila o script uma vez e usa `EVALSHA` internamente (perf).

**Decisão de tipos**: tipos críticos (sempre enviam, ignoram contador):
`pastoral_alert`, `export_ready`, `system`. Tipos deferíveis: `content_new`,
`content_update`, `meeting_reminder`, `group_message`. Regra especial:
`meeting_reminder` diferido → cria fallback in-app imediato (SC-02 — participante
nunca perde lembrete). `content_new`/`content_update` diferido → reagendado p/
próximo dia, sem fallback imediato.

**Alternatives considered**:
- `INCR` + `EXPIRE` em comandos separados: rejeitado — janela de corrida entre
  comparação e incremento; não atômico sob concorrência.
- Lock distribuído (Redlock): rejeitado — overkill; o Lua já dá atomicidade
  (FR-INFRA-LOCK da spec confirma).

---

## Decision 5 — Circuit breaker via porta abstraída (FR-12..FR-16, AC#4)

**Decision**: Interface `EmailHealthPort`
(`apps/api/src/notifications/ports/email-health.port.ts`) com método
`isHealthy(): Promise<boolean>`. Implementação default `StubEmailHealthPort`
(sempre `true`) registrada no módulo via token de injeção
(`EMAIL_HEALTH_PORT`). A Story 14-4 substituirá o provider sem tocar o
`EmailChannel` (SC-07). O estado do breaker (`CircuitBreakerState`) é mantido
em Redis (`rate:email:circuit:{tenantId}` ou global — ver data-model) para
sobreviver a restarts de worker.

**Lógica**:
- Falhas consecutivas de envio acumulam; se `firstFailureAt` excede 5 min de
  janela contínua de falha → abre o breaker (`open`), emite evento de domínio
  `notifications.email.circuit-open` ({eventId,eventType,version,tenantId,
  timestamp,data,metadata}), e novas notificações de email vão direto p/
  fallback in-app (FR-12/FR-13).
- Em `open`, consulta `EmailHealthPort.isHealthy()` periodicamente; 3 checks
  saudáveis consecutivos → fecha (`closed`), retoma envio p/ NOVAS notificações
  (FR-14).
- FR-15: notificações diferidas durante a contingência NÃO são reenviadas após
  recovery (evita rajada). O fallback in-app já entregou a informação.

**Rationale**:
- Porta + stub default = SC-07 (trocar stub por real não altera EmailChannel).
- Estado no Redis para consistência cross-worker (BullMQ pode ter N workers).
- O ponto de integração pendente (Story 14-4) é documentado no plano e via
  comentário `// INTEGRATION POINT (Story 14-4)` no código da porta.

**Alternatives considered**:
- Lib `opossum` (circuit breaker): viável, mas acopla estado ao processo (não
  cross-worker) e o requisito de "outage >5min" + "3 health-checks" é específico;
  implementação própria fina sobre Redis é mais alinhada e testável.
- Esperar a Story 14-4 estar done: rejeitado — a spec exige a abstração-stub
  agora (FR-16) para não bloquear esta feature.

---

## Decision 6 — Extensão do enum NotificationType (FR-10, Key Entities)

**Decision**: Adicionar `export_ready` e `content_new` ao enum.
- DB: migration `ALTER TYPE "notification_type" ADD VALUE 'export_ready'` e
  `ADD VALUE 'content_new'` (Postgres permite ADD VALUE; NÃO remove existentes).
- Zod: estender `NotificationTypeSchema` em `packages/types/src/notification.ts`.
- Snapshot test do schema Zod (gate Constitution IV) capturará a mudança —
  atualizar o snapshot de forma intencional.

**Rationale**:
- `content_update` permanece (clarify Q2 — coexistência, não substituição).
- `ALTER TYPE ADD VALUE` é aditivo e não-destrutivo; roda fora de transação no
  Postgres (atenção na migration — ADD VALUE não pode rodar dentro de bloco
  transacional em algumas versões; usar migration separada se necessário).

**Alternatives considered**:
- Reusar `content_update` para conteúdo novo: rejeitado pela clarify Q2.

---

## Decision 7 — Idempotência e admin alert (FR-INFRA-IDEMP, FR-10 admin)

**Decision**:
- Idempotência por `notificationId` (alertas imediatos) e por
  `jobId=digest:userId:type:bucket` (deferíveis) — JÁ implementado no
  `DigestService`. Reuso direto.
- Admin alert de threshold (FR-10, P5): "uma por threshold por dia" garantida
  pela flag Redis `rate:email:{tenantId}:{YYYYMMDD}:alerted` (SET NX dentro do
  Lua quando `crossedThreshold`); só o primeiro a cruzar 80 dispara a
  notificação in-app ao admin.

**Rationale**: evita spam de alerta ao admin (P5 AC: não repetir a cada envio).

---

## Resumo de NEEDS CLARIFICATION

| Unknown | Status |
|---------|--------|
| Limite hardcoded vs configurável (Q1) | Resolvido: constante + ARGV no Lua |
| content_new coexiste/substitui (Q2) | Resolvido: coexiste |
| Remetente padrão (Q3) | Resolvido: env EMAIL_DEFAULT_FROM |
| TTL meia-noite vs 24h (Q4) | Resolvido: EXPIREAT seconds_until_midnight_utc |
| SDK Resend + timeouts | Resolvido (Decision 1) |
| Reuso fila/retry | Resolvido (Decision 2) |
| Branding em template | Resolvido (Decision 3) |
| Circuit breaker abstração | Resolvido (Decision 5) |

**NEEDS CLARIFICATION restantes**: 0
