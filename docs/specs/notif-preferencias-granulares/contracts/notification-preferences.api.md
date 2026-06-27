# API Contract — Notification Preferences

Base: `/api/v1/users/me/notification-preferences`
Auth: `KeycloakAuthGuard` (Bearer). Tenant via RLS (`app.current_tenant_id`).
userId SEMPRE do token/RequestContext — NUNCA no path/query/body (IDOR-safe).

Tipos (enum REAL): `pastoral_alert | group_message | content_update |
meeting_reminder | system | export_ready | content_new`.
Canais lógicos: `inApp` (⇔ `in_app`), `email`.

---

## GET /api/v1/users/me/notification-preferences

Retorna o objeto completo de preferências do usuário corrente, com defaults
resolvidos (todos true) e enforcement de papel aplicado (Líder →
`pastoral_alert.inApp=true` forçado).

- 200 OK
```json
{
  "data": {
    "pastoral_alert":   { "inApp": true, "email": true },
    "group_message":    { "inApp": true, "email": true },
    "content_update":   { "inApp": true, "email": true },
    "meeting_reminder": { "inApp": true, "email": false },
    "system":           { "inApp": true, "email": true },
    "export_ready":     { "inApp": true, "email": true },
    "content_new":      { "inApp": true, "email": true }
  }
}
```
- 401 se sem token.

---

## PATCH /api/v1/users/me/notification-preferences

Atualização PARCIAL (patch semantics, não replace). Apenas combinações
presentes são gravadas (UPSERT idempotente). Retorna o objeto COMPLETO.

- Body (validado por `UpdateNotificationPreferencesSchema`, `.strict()`):
```json
{ "meeting_reminder": { "email": false }, "system": { "inApp": false } }
```
- 201 Created → mesmo formato do GET (objeto completo pós-update +
  enforcement).
- 422 Unprocessable Entity:
  - Líder tentando `pastoral_alert.inApp=false`:
    ```json
    { "statusCode": 422, "error": "Unprocessable Entity",
      "message": "Alertas pastorais no app não podem ser desativados para Líderes." }
    ```
- 400 Bad Request: `notification_type` ou `channel` fora do enum, rejeitado pelo
  `ZodValidationPipe` ANTES do DB (FR-004). NOTA: o `ZodValidationPipe` do
  projeto lança `BadRequestException` (statusCode 400, error "Bad Request",
  message "Validation failed", `details` = fieldErrors) — NÃO 422. O 422 é
  reservado para a regra de negócio (enforcement do Líder), lançada
  explicitamente via `UnprocessableEntityException` no service:
    ```json
    { "statusCode": 400, "error": "Bad Request", "message": "Validation failed",
      "details": { "...": ["Invalid enum value"] } }
    ```
- Idempotência: PATCH repetido com mesmo body → mesmo estado final.

---

## Efeitos colaterais

- PATCH bem-sucedido invalida `cache:notif-prefs:{userId}` (Redis).
- Nenhum efeito na tabela `notifications`.

## Integração na pipeline (não-HTTP)

No `NotificationsWorker`, antes do `ChannelRouter.route(channel)`:
- resolve `(userId, type, channel)` (cache→DB, default true);
- enforcement Líder (lookup `user_tenants.role='lider'`) força `in_app` de
  `pastoral_alert`;
- se desabilitado: `UPDATE notifications SET status='failed',
  metadata = metadata || {"reason":"user_preference"}` e NÃO envia pelo canal.
