# Quickstart / Cenários de Teste: Notificações por Email

**Feature**: `notificacoes-email` | **Phase 1**

Cada cenário: passos numerados → **Expected**. Mapeiam para os testes a
implementar (integração, snapshot, retry, atomicidade, deferral, circuit
breaker, RLS).

---

## C1 — Happy path: alerta pastoral por email (P1, SC-01)

1. Disparar `NotificationsService.dispatch({type:'pastoral_alert', channels:['email'], userId, title, body, metadata:{actionUrl}})` num contexto de tenant.
2. `DigestService.enqueue()` enfileira imediato (pastoral_alert) com attempts:3.
3. Worker → `ChannelRouter.route('email')` → `EmailChannel.send()`.
4. EmailChannel (crítico, rate ignora) renderiza template `pastoral-alert` com branding do tenant → `EmailService.send()` → Resend OK.

**Expected**: email entregue em ≤ 1 min; subject identifica grupo + urgência;
corpo tem nome do participante, motivo e link para o Radar; `status=sent`.

---

## C2 — Retry → fallback in-app (P1, FR-05/06/07, NFR-I2)

1. Mock `EmailService.send()` retorna `{success:false, retryable:true, error:'503'}` em todas as 3 tentativas.
2. Worker re-lança em cada `success:false` → BullMQ backoff exponencial 30s.
3. Após 3 tentativas esgotadas, handler `failed` dispara.

**Expected**: `status=failed`; `metadata.failureReason` contém a causa;
notificação in-app equivalente criada (FR-06) com `metadata.fallbackOf` =
notificationId do email; job retido (`removeOnFail:false`).

---

## C3 — Snapshot dos 4 templates com branding (SC-06)

1. Renderizar `pastoral_alert`, `meeting_reminder`, `export_ready` (signed URL 1h), `content_new`.
2. Variações: nome com acentos (`João Conceição`), URL longa (signed URL 800+ chars), tenant SEM logo (`getBranding()` → logoUrl null).

**Expected**: snapshots estáveis; acentos preservados (charset utf-8); URL longa
sem truncamento; tenant sem logo usa identidade padrão; cores do tenant aplicadas
quando presentes.

---

## C4 — Rate-limit atomicidade Lua (P4/P5, FR-09/10/11, SC-04)

1. Setar contador `rate:email:{tenant}:{hoje}` = 79.
2. Disparar 2 jobs `content_new` concorrentes (deferíveis).
3. Ambos executam `emailRateLimit` Lua.

**Expected**: exatamente UM obtém `decision:'send'` (79→80, crossedThreshold=true)
e UM obtém `decision:'defer'`; contador final ≤ 100; admin recebe 1 notificação
in-app de threshold (flag `:alerted` SET NX evita duplicata).

---

## C5 — Deferral de meeting_reminder → fallback in-app imediato (P2, SC-02)

1. Contador em 80 (≥ threshold).
2. Disparar `meeting_reminder` por email.

**Expected**: email diferido; notificação in-app equivalente criada NO MESMO
instante; participante nunca perde o lembrete (`metadata` com data/horário/link).

---

## C6 — content_new diferido sem duplicação (P4)

1. Contador ≥ 80. Disparar `content_new` por email.

**Expected**: email diferido para o próximo dia (`metadata.deferredUntil`); se o
usuário já viu a notificação in-app, não recebe email duplicado no dia seguinte
(idempotência por jobId digest).

---

## C7 — Circuit breaker: down → fallback → recover → close (AC#4, FR-12..16, SC-03/05)

1. Simular falhas contínuas de Resend por > 5 min.
2. Breaker abre (`open`); evento `notifications.email.circuit-open` emitido.
3. Novas notificações de email → fallback in-app imediato (sem tentar Resend).
4. `EmailHealthPort.isHealthy()` retorna true 3× consecutivas.

**Expected**: durante `open`, entrega contínua via in-app por 30 min (SC-03);
breaker fecha após 3 health-checks OK; envio de email retoma para NOVAS
notificações; diferidos do outage NÃO são reenviados (FR-15).

---

## C8 — RLS isolation (Constitution I/VI, roda 2× no CI)

1. Tenant A e Tenant B com notificações de email.
2. Em contexto do Tenant A, listar/atualizar notificações.

**Expected**: Tenant A NUNCA vê notificações do Tenant B (SELECT/UPDATE/DELETE);
contador de rate de A isolado do de B (chaves namespaced por tenantId). Teste
idempotente, roda 2× no CI sem efeito colateral.

---

## C9 — Zod schema snapshot gate (Constitution IV)

1. Estender `NotificationTypeSchema` (+ export_ready, content_new).

**Expected**: snapshot test do schema falha (mudança detectada) → atualizar
snapshot intencionalmente; gate contra breaking change silencioso passa.

---

## C10 — EmailHealthPort stub trocável (SC-07)

1. Registrar `StubEmailHealthPort` (default). Depois registrar uma impl fake real.

**Expected**: substituir o provider `EMAIL_HEALTH_PORT` NÃO requer alteração no
código de `EmailChannel` (apenas no módulo de DI).
