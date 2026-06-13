# API Contracts — onboarding-wizard (Story 10-1)

> Todos os endpoints sob prefixo `/api/v1` (Constitution IV). Payloads
> request/response em **camelCase**, validados por Zod (`packages/types`) em
> ambos os lados. Sucesso `{ data, meta? }`; erro
> `{ statusCode, error, message, details? }` sem stack trace. Nulls explícitos,
> nunca `undefined`. Datas ISO 8601. Multi-tenant via `AsyncLocalStorage` +
> RLS (nunca `tenant_id` como parâmetro).

---

## NOVO — `PATCH /api/v1/tenants/me`

Atualiza dados da comunidade/tenant do admin autenticado e persiste o progresso
do wizard. Convenção `/me` (RECONCILIACAO §1.2; o artifact dizia `/current` —
não usar). Endpoint NOVO (hoje só existe `GET /api/v1/tenants/me`).

- **Auth**: Keycloak; role `admin_tenant`. RLS-scoped (só o próprio tenant).
- **Guard**: role + tenant.

**Request body** (`UpdateTenantProfileSchema`):
```json
{
  "name": "Igreja Batista Central",
  "denomination": "Batista",
  "city": "Curitiba",
  "state": "PR",
  "logoUrl": "https://minio.../tenants/<id>/logo.png",
  "onboardingProgress": {
    "currentStep": 3,
    "completedSteps": [1, 2],
    "stepData": { "mode": "real-group" },
    "completed": false,
    "completedAt": null,
    "skippedAt": null
  }
}
```
- `name`: obrigatório (FR-04, Etapa 2 só avança com nome da comunidade).
- `denomination`/`city`/`state`: opcionais → gravados em `Tenant.metadata`.
- `logoUrl`: opcional → coluna tipada `Tenant.logoUrl`.
- `onboardingProgress`: opcional; quando presente, substitui/merge o JSONB
  (validado por `OnboardingProgressSchema`). Conclusão (`completedAt`) e skip
  (`skippedAt`) chegam por aqui (FR-02/FR-08).

**Response 200** `{ data: { id, name, denomination, city, state, logoUrl, onboardingProgress } }`
(nulls explícitos para campos não preenchidos).

**Errors**: 400 (Zod — ex.: `name` vazio, `onboardingProgress` shape inválido),
401, 403 (não `admin_tenant`), 404 (tenant inexistente — não deve ocorrer com
RLS). Mensagens user-facing em PT-BR via pt-BR.json.

**Invariante FR-08**: o backend rejeita payload que defina `completedAt` E
`skippedAt` simultaneamente (mutuamente exclusivos).

**Hardening de segurança (MUST — owasp-security gate)**:
- **Anti mass-assignment (A03/API3-BOPLA)**: o Zod request schema é `.strict()`
  com allowlist explícita de campos. NUNCA spread-merge do body cru no registro
  (`{...tenant, ...body}` proibido). `metadata` aceita só `{denomination, city,
  state}`; chaves extras são rejeitadas (400).
- **logoUrl (A04/A08 stored XSS + API7 SSRF)**: Zod `.url()` + scheme allowlist
  `https:` apenas (rejeitar `javascript:`/`data:`/`file:`) + host/bucket
  allowlist (origem MinIO do projeto). O valor DEVE ser a URL canônica
  retornada pelo endpoint de upload server-side (backend faz o upload e cunha a
  URL); o cliente não envia URL arbitrária de origem externa. Render só via
  `<img src>` (nunca `dangerouslySetInnerHTML`).

---

## NOVO — `PATCH /api/v1/users/me`

Atualiza o perfil do usuário autenticado (Etapa 1 do wizard). Endpoint NOVO
(hoje `users.controller` só tem `GET me`, `PATCH me/onboarding-complete`,
`GET me/onboarding-status`). NÃO confundir com `me/onboarding-complete`.

- **Auth**: Keycloak; usuário autenticado. RLS-scoped.

**Request body** (`UpdateUserProfileSchema`):
```json
{
  "name": "Pastor João",
  "profilePhotoUrl": "https://minio.../users/<id>/avatar.png",
  "roleTitle": "Pastor"
}
```
- `name`: display name (Etapa 1 obrigatório para avançar — FR-03); reusa coluna
  `User.name`.
- `profilePhotoUrl`: opcional → coluna `User.profilePhotoUrl`.
- `roleTitle`: opcional → coluna `User.roleTitle`.

**Response 200** `{ data: { id, name, profilePhotoUrl, roleTitle } }` (nulls
explícitos).

**Errors**: 400 (Zod), 401. PT-BR.

**Hardening de segurança (MUST — owasp-security gate)**:
- **Role/BFLA (API5)**: usuário autenticado atualiza SÓ o próprio perfil
  (`/me` resolvido do token via `AsyncLocalStorage`, nunca id no body).
- **profilePhotoUrl**: mesmas regras de `logoUrl` (Zod `.url()` + `https:` +
  host/bucket allowlist + URL cunhada pelo upload server-side; render via
  `<img>`).
- **Anti mass-assignment**: Zod `.strict()`, sem spread-merge; campos como
  `status`, `tenantId`, `onboardingCompletedAt`, `email` NÃO são atualizáveis
  por este endpoint.

**Upload de mídia (foto/logo) — MUST**: endpoint de upload (storage.service,
MinIO) valida content-type por allowlist (`image/png`, `image/jpeg`,
`image/webp`), tamanho máximo, e magic-bytes (não só extensão). Fail-closed na
validação (rejeita o arquivo) preservando a degradação graciosa FR-13 (a etapa
avança SEM a mídia).

---

## NOVO — `GET /api/v1/onboarding/status`

Retorna o progresso do wizard (tenant-scoped) + se o tenant já tem grupos
reais. Alimenta a condição TRIPLA de disparo (FR-01, dec-007).

- **Auth**: Keycloak; `admin_tenant`. RLS-scoped.

**Response 200** (`OnboardingStatusResponseSchema`):
```json
{
  "data": {
    "progress": {
      "currentStep": 1,
      "completedSteps": [],
      "stepData": {},
      "completed": false,
      "completedAt": null,
      "skippedAt": null
    },
    "hasRealGroups": false
  }
}
```
- `hasRealGroups`: derivado de `count(groups do tenant) > 0` server-side
  (o count NÃO é feito no FE — Decision 6).
- Se `onboardingProgress` ausente no tenant: retorna progresso default
  (`currentStep:1, completedSteps:[], completed:false`, datas null).

**Coexistência (RECONCILIACAO §10.1)**: este endpoint é **tenant-scoped** e
distinto do já existente `GET /api/v1/users/me/onboarding-status`
(**user-scoped**, lê `User.onboardingCompletedAt`). O user-flag dispara o
redirect de primeiro login (Story 7-1); este endpoint dá o estado do wizard do
admin. Os dois coexistem; nenhum substitui o outro.

**Errors**: 401, 403.

---

## Evento de domínio — `onboarding.wizard.step_completed`

Emitido via **EventEmitter2** in-process (dec-009), a cada etapa concluída.
NÃO BullMQ. Sem consumer no MVP (Epic 13 futuro).

**Payload** (formato de evento de domínio, Constitution IV):
```json
{
  "eventId": "<uuid v7>",
  "eventType": "onboarding.wizard.step_completed",
  "version": 1,
  "tenantId": "<uuid>",
  "timestamp": "2026-06-13T18:00:00.000Z",
  "data": { "step": 2, "stepName": "community" },
  "metadata": {}
}
```

---

## REUSO — endpoints existentes (NÃO recriar)

| Endpoint | Origem | Uso no wizard |
|----------|--------|---------------|
| `POST /api/v1/groups` | Epic 4-1 | Etapa 3 opção (a): cria grupo, admin vira líder |
| Convite admin-side (módulo `invites/` + `admin-invites` types) | Epic 4-3 | Etapa 4: convidar líder |
| `GET /api/v1/onboarding/demo-radar` | Story 10-2 | Etapa 5: preview com dados de demo |
| `GET /api/v1/onboarding/demo-status` | Story 10-2 | Etapas 3/5: decidir se opção demo/preview aparece (degradação graciosa FR-13) |
| `PATCH /api/v1/users/me/onboarding-complete` | Story 7-1 | gate user-scoped existente — NÃO alterado |
| `GET /api/v1/tenants/me` | existente | leitura inicial do tenant |
