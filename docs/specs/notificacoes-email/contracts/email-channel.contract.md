# Contract: EmailChannel & EmailService

**Feature**: `notificacoes-email` | **Phase 1**

Esta feature é puramente backend (NestJS). Não há novos endpoints REST públicos
— a entrega de email é acionada por eventos de domínio internos via o fluxo de
fila já existente. Os "contratos" aqui são as interfaces TypeScript internas
(ports/adapters) que definem as fronteiras de integração.

---

## NotificationChannelInterface (existente — NÃO modificar)

`apps/api/src/notifications/channels/notification-channel.interface.ts`

```ts
interface NotificationChannelInterface {
  readonly channel: 'in_app' | 'email';
  // send() MUST NOT throw — retorna { success:false, error } e o worker re-lança.
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
```

`EmailChannel` (substituindo o stub) implementa esta interface. Contrato de
comportamento:
- Sucesso de envio → `{ success: true }`.
- Erro transiente (Resend 5xx, timeout) → `{ success: false, error }` (worker
  re-lança → BullMQ backoff → retry).
- Circuit aberto → NÃO tenta email; aciona fallback in-app imediato e retorna
  `{ success: true }` (a informação foi entregue por outro canal — não conta
  como falha de retry).
- Rate-limited deferível → NÃO envia; reagenda/fallback conforme tipo; retorna
  `{ success: true }`.

---

## EmailService (novo — abstração do Resend SDK)

`apps/api/src/notifications/channels/email.service.ts`

```ts
interface SendEmailInput {
  to: string;
  from: string;        // resolvido: tenant sender || EMAIL_DEFAULT_FROM
  subject: string;
  html: string;        // template renderizado com branding
}

interface SendEmailResult {
  success: boolean;
  providerId?: string; // id do email no Resend (auditoria)
  error?: string;      // mensagem (vai p/ metadata.failureReason)
  retryable?: boolean; // true p/ 5xx/timeout; false p/ 4xx (não re-tentar)
}

class EmailService {
  // Aplica timeouts NFR-I3: connect ≤ 3s, read ≤ 10s (AbortController/undici).
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
```

---

## EmailHealthPort (novo — ponto de integração Story 14-4)

`apps/api/src/notifications/ports/email-health.port.ts`

```ts
// INTEGRATION POINT (Story 14-4): a implementação real substitui o stub.
interface EmailHealthPort {
  isHealthy(): Promise<boolean>;
}
```

Token de injeção: `EMAIL_HEALTH_PORT`. Provider default no módulo:
`StubEmailHealthPort` (`isHealthy()` → `true` sempre). SC-07: trocar o provider
NÃO altera `EmailChannel`.

---

## Rate-limit Lua command (RedisService.defineCommand)

Registrado como `emailRateLimit` (numberOfKeys: 1).

**Input** (KEYS[1] = `rate:email:{tenantId}:{YYYYMMDD}`):
- `ARGV[1]` = limit (100)
- `ARGV[2]` = threshold (80)
- `ARGV[3]` = ttlSeconds (segundos até meia-noite UTC)
- `ARGV[4]` = critical (1|0)
- `ARGV[5]` = alertedKey (`rate:email:{tenantId}:{YYYYMMDD}:alerted`)

**Output** (array Redis → mapeado em TS):
```ts
interface RateLimitResult {
  decision: 'send' | 'defer';
  count: number;            // contador após a operação
  crossedThreshold: boolean; // true só na 1ª vez que cruza 80 no dia
}
```

Garantia: execução atômica (Redis single-threaded). Dois jobs concorrentes em
79/100 deferíveis → só um obtém `decision:'send', count:80`; o outro obtém
`decision:'defer'` (ou `send` se houver capacidade). Críticos sempre
`decision:'send'`.

---

## Domain event emitido

`notifications.email.circuit-open` — formato canônico Constitution IV (ver
data-model.md §Domain Event).

---

## Convenções (Constitution IV)

- Todos os schemas de payload tipados em `packages/types` (Zod) com snapshot
  test. `NotificationTypeSchema` estendido (+ `export_ready`, `content_new`).
- Sem endpoint REST novo → sem `{data,meta}` / status codes novos nesta feature.
