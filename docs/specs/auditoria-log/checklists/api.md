# Checklist: API — auditoria-log (9-3)

**Domínio**: Contratos de API, Paginação, Export Assíncrono, Envelopes, Validação
**Gerado em**: 2026-06-11 | **Wave**: onda-003 (fase checklist)
**Fonte da verdade**: spec.md, contracts/audit-events.md, data-model.md, plan.md

---

## API-001 — GET /api/v1/audit/events: envelope de resposta correto {auto}

**Requisito**: FR-005, FR-006, contracts/audit-events.md §GET /api/v1/audit/events
**Item**: Endpoint retorna envelope `{ data: AuditEvent[], meta: { page, perPage, total, totalPages } }`.

**Evidência** (contracts/audit-events.md):
```json
{
  "data": [ /* array de AuditEvent */ ],
  "meta": { "page": 1, "perPage": 50, "total": 1234, "totalPages": 25 }
}
```

- [x] Envelope `{ data, meta }` documentado (constitution §IV)
- [x] `meta` inclui `page`, `perPage`, `total`, `totalPages`
- [x] Status 200 para sucesso

**Status**: PASS {auto}

---

## API-002 — GET /api/v1/audit/events: paginação server-side de 50/página {auto}

**Requisito**: FR-005, AUDIT_EVENTS_PAGE_SIZE = 50
**Item**: Default `perPage = 50`, máximo `perPage = 50` (conforme FR-005 "50 itens/página"). Paginação server-side via query SQL com LIMIT/OFFSET ou cursor.

**Evidência** (contracts/audit-events.md §Query params): `perPage: int 1..50, default 50 (FR-005: 50/página)`
**Evidência** (contracts/audit-events.md §Constantes): `AUDIT_EVENTS_PAGE_SIZE = 50`

- [x] Default 50 documentado
- [x] Máximo 50 documentado (validação Zod: `int 1..50`)
- [x] Constante `AUDIT_EVENTS_PAGE_SIZE` definida para reusar em FE e BE

**Status**: PASS {auto}

---

## API-003 — GET /api/v1/audit/events: filtros server-side completos {auto}

**Requisito**: FR-006, spec US1 AC#1 / US3 AC#3
**Item**: Todos os filtros são aplicados server-side (não client-side). Filtros: `action`, `userId`, `dateFrom`, `dateTo`, `severity`, `q` (texto livre).

**Evidência** (contracts/audit-events.md): "Todos os filtros aplicados **server-side** (FR-006)."
Query params documentados com tipos e validações.

- [x] `action`: enum `create|update|delete|login|export|config_change`
- [x] `userId`: string, filtra por usuário
- [x] `dateFrom`/`dateTo`: ISO 8601 datetime com offset
- [x] `severity`: enum `info|warning|critical`
- [x] `q`: texto livre (busca em `resource`/descrição)
- [x] `page`/`perPage`: paginação

**[Ambiguity]**: O campo `q` busca em `resource` e "descrição". O data-model não define um campo `description` na tabela `audit_events`. A busca full-text em `resource` (tipo da entidade) tem valor limitado — seria mais útil buscar em `resource_id` ou no conteúdo de `previous_state`/`new_state`. A spec menciona "resource/descrição" mas o data-model não tem `description`. O create-tasks deve definir: busca ILIKE em `resource` apenas, ou iLIKE em `resource || resource_id`, ou busca via `to_tsvector` em campos JSONB. Sem índice full-text definido (FR-012 cobre apenas `tenant_id + timestamp DESC`), busca em `q` pode ser lenta com muitos eventos.

**Status**: PASS com Ambiguidade {auto} — escopo do campo `q` indefinido

---

## API-004 — GET /api/v1/audit/events: query params em camelCase {auto}

**Requisito**: plan.md §Convenções de Borda, contracts/audit-events.md
**Item**: Query params em camelCase (`perPage`, `dateFrom`, `dateTo`, `userId`) — alinha 1:1 com o Zod de `packages/types`, evitando mapper kebab→camel.

**Evidência** (plan.md §Convenções de Borda): "**Decisão de query params**: **camelCase** (`perPage`, `dateFrom`, `dateTo`, `userId`) — alinha 1:1 com o Zod de `packages/types`, evitando uma camada de mapper kebab→camel."
**Evidência** (contracts/audit-events.md §cabeçalho): "Query params em **camelCase**"

- [x] Todos os query params definidos em camelCase
- [x] Decisão documentada com justificativa
- [x] Espelha padrão de `reports/` (`perPage`, `lastActivityAfter`)

**Status**: PASS {auto}

---

## API-005 — GET /api/v1/audit/events: campos nullable com null explícito {auto}

**Requisito**: constitution §II (nunca undefined), contracts/audit-events.md §Contrato de null
**Item**: `resourceId`, `previousState`, `newState` SEMPRE presentes no payload JSON com `null` quando não aplicável. Nunca omitidos ou `undefined`.

**Evidência** (contracts/audit-events.md): "> **Contrato de null**: `resourceId`, `previousState`, `newState` SEMPRE presentes no payload, com valor `null` quando não aplicável (constitution §II: nunca `undefined`, null explícito)."

- [x] Contrato de null explicitamente documentado no contrato
- [x] Zod schema deve refletir `.nullable()` (não `.optional()`) nesses campos

**Status**: PASS {auto}

---

## API-006 — GET /api/v1/admin/super/audit/events: rota cross-tenant com tenantId opcional {auto}

**Requisito**: FR-005, spec US3 AC#1, contracts/audit-events.md §GET /admin/super/audit/events
**Item**: Rota exclusiva Super Admin com query params iguais ao endpoint tenant-scoped + `tenantId` adicional (filtro opcional por tenant específico).

**Evidência** (contracts/audit-events.md §GET /admin/super): "Mesmos do `GET /api/v1/audit/events` + `tenantId` opcional (filtrar por um tenant específico no cross-tenant)."

- [x] Rota separada `/admin/super/audit/events` documentada
- [x] `tenantId` opcional como filtro adicional
- [x] `tenantId` presente em cada item do response (para coluna "tenant" no viewer)
- [x] Auth: `@Roles(Role.SUPER_ADMIN)` obrigatório

**Status**: PASS {auto}

---

## API-007 — POST /api/v1/admin/super/audit/export: retorna 202 com jobId {auto}

**Requisito**: FR-007, spec US4 AC#1, contracts/audit-events.md §POST /admin/super/audit/export
**Item**: Endpoint de export retorna HTTP 202 Accepted com `{ data: { jobId, message } }` imediatamente (sem bloquear).

**Evidência** (contracts/audit-events.md):
```json
{ "data": { "jobId": "0191...", "message": "Exportação em processamento. Consulte o status pelo jobId." } }
```
"Padrão `reports/` (8-7): 202 + jobId."

- [x] Status 202 Accepted documentado
- [x] Response tem `{ data: { jobId, message } }` (envelope padrão)
- [x] jobId é UUID v7 (`generateId()`)
- [x] Request aceita `format` (csv|json) obrigatório e `filters` opcional

**Status**: PASS {auto}

---

## API-008 — GET /api/v1/admin/super/audit/jobs/:jobId: polling com signedUrl {auto}

**Requisito**: FR-007, spec US4 AC#2, contracts/audit-events.md §GET /jobs/:jobId
**Item**: Endpoint de polling retorna status (`processing|completed|failed`), `signedUrl` (quando completed), `expiresAt` (validade ≥ 24h), e `failureReason` (quando failed).

**Evidência** (contracts/audit-events.md):
```json
{
  "data": {
    "jobId": "0191...",
    "status": "processing | completed | failed",
    "signedUrl": "https://... | null",
    "expiresAt": "2026-06-12T19:00:00Z | null",
    "failureReason": "string | null"
  }
}
```
"Validade da URL ≥ 24h (`AUDIT_EXPORT_TTL_SECONDS = 86400`, SC-006)."

- [x] Status enum `processing|completed|failed`
- [x] `signedUrl` nullable (null enquanto processing)
- [x] `expiresAt` nullable, ≥ 24h quando completed
- [x] `failureReason` nullable
- [x] 404 quando jobId inexistente/expirado

**Status**: PASS {auto}

---

## API-009 — Export: arquivo contém TODOS os campos do AuditEvent {auto}

**Requisito**: FR-007, spec US4 AC#3
**Item**: O arquivo CSV/JSON gerado pelo export inclui todos os 12 campos do `AuditEvent` — não apenas os visíveis na tabela do viewer.

**Evidência** (contracts/audit-events.md): "Arquivo exportado contém **TODOS** os campos do `AuditEvent` (não só os visíveis na tabela — FR-007 AC#3)."

Campos obrigatórios no export: `id`, `tenantId`, `userId`, `action`, `resource`, `resourceId`, `previousState`, `newState`, `ipAddress`, `userAgent`, `timestamp`, `severity`.

- [x] Lista completa dos 12 campos documentada
- [x] Constraint explícita: "não apenas os visíveis na tabela"

**[Ambiguity]**: Para CSV, os campos `previousState` e `newState` são objetos JSONB. O formato de serialização no CSV não está especificado. Opções: (a) JSON stringificado na célula CSV, (b) omitir do CSV e incluir apenas no JSON, (c) achatar os campos do JSON como colunas adicionais. O create-tasks deve definir a estratégia de serialização JSONB no CSV.

**Status**: PASS com Ambiguidade {auto}

---

## API-010 — Erros de API: envelope padrão sem stack trace {auto}

**Requisito**: constitution §IV, plan.md §Constitution Check (Princípio IV)
**Item**: Erros usam envelope `{ statusCode, error, message, details? }`. Nenhum stack trace é exposto ao frontend.

**Evidência** (plan.md §Constitution Check IV): "Envelope `{data,meta?}` (paginação em meta); erro `{statusCode,error,message,details?}`. [...] sem stack trace exposto."
**Evidência** (contracts/audit-events.md §Error Responses): Documentados com `statusCode` e `Code`.

- [x] 400 VALIDATION_ERROR para query params inválidos (Zod)
- [x] 401 UNAUTHORIZED para sem JWT
- [x] 403 FORBIDDEN para role insuficiente
- [x] 404 NOT_FOUND para jobId inexistente
- [x] Sem stack trace no response

**Status**: PASS {auto}

---

## API-011 — Zod schema compartilhado com snapshot test {auto}

**Requisito**: plan.md §Testing, constitution §IV e §VI
**Item**: Contratos Zod em `packages/types/src/audit/index.ts` + `packages/types/src/__tests__/audit.snapshot.spec.ts`. Snapshot test congela o contrato contra breaking changes silenciosos.

**Evidência** (plan.md §Project Structure): 
```
packages/types/
├── src/audit/index.ts                   # NOVO Zod schemas + constantes
└── src/__tests__/audit.snapshot.spec.ts # NOVO snapshot test
```
"Snapshot tests required for Zod schemas (gate against silent breaking changes)" (CLAUDE.md).

- [x] Schema compartilhado FE+BE em `packages/types`
- [x] Snapshot test obrigatório documentado
- [x] ZodValidationPipe próprio (sem `nestjs-zod` ou similar — constitution §IV)

**Status**: PASS {auto}

---

## API-012 — Auto-refresh do viewer a cada 30 segundos {auto}

**Requisito**: FR-009, spec US3 AC#4
**Item**: O viewer Client Component deve refetchar os dados a cada 30s usando TanStack Query `refetchInterval`, sem perder filtros/paginação.

**Evidência** (spec FR-009): "O viewer de auditoria DEVE se auto-atualizar a cada 30 segundos para refletir eventos recentes."
**Evidência** (spec US3 AC#4): "a lista é automaticamente atualizada a cada 30 segundos sem perder a posição de paginação/filtro atual."

- [x] Auto-refresh especificado (30s)
- [x] TanStack Query `refetchInterval` é o mecanismo correto para Client Component
- [x] "Sticky filters" — filtros persistem durante auto-refresh (responsabilidade do viewer)

**[Ambiguity]**: A spec diz "sem perder a posição de paginação/filtro". Mas se novos eventos chegarem no meio de uma paginação (eventos inseridos entre páginas), o offset-based pagination pode exibir duplicatas ou pular eventos. O create-tasks deve considerar cursor-based pagination ou timestamp-anchored pagination para o viewer. Sem isso, o auto-refresh pode causar pulos na paginação em produção com alto throughput.

**Status**: PASS com Ambiguidade {auto} — estratégia de paginação em auto-refresh

---

## API-013 — Prefixo /api/v1/ em todos os endpoints {auto}

**Requisito**: CLAUDE.md "API versioned: /api/v1/ prefix from MVP", constitution §IV
**Item**: Todos os 4 endpoints definidos usam o prefixo `/api/v1/`.

**Evidência** (contracts/audit-events.md): 
- `GET /api/v1/audit/events`
- `GET /api/v1/admin/super/audit/events`
- `POST /api/v1/admin/super/audit/export`
- `GET /api/v1/admin/super/audit/jobs/:jobId`

- [x] 4 endpoints com prefixo `/api/v1/`
- [x] Rota tenant-scoped: `/audit/events`
- [x] Rotas super-admin: `/admin/super/audit/*`

**Status**: PASS {auto}

---

## API-014 — Export job: BullMQ com até 3 tentativas {auto}

**Requisito**: FR-INFRA-03, data-model.md §AuditExportJob, plan.md §Reuso
**Item**: O BullMQ worker do export usa `attempts: 3` (conforme FR-INFRA-03). Reusar padrão do módulo `reports/`.

**Evidência** (FR-INFRA-03): "O export é sob demanda, via job queue assíncrono com até 3 tentativas em caso de falha."
**Evidência** (data-model.md): "Até 3 tentativas em falha (FR-INFRA-03; BullMQ `attempts: 3`)."
**Evidência** (plan.md §Reuso): "BullMQ job + polling + signed URL | `reports/{controller,service,processor}.ts`"

- [x] `attempts: 3` documentado
- [x] Padrão `reports/` reutilizado
- [x] Queue name `audit-export` (namespace `queue:*`)
- [x] TTL Redis ≥ `AUDIT_EXPORT_TTL_SECONDS + 300` (espelha reports/)

**Status**: PASS {auto}

---

## Resumo API

| Item | Status |
|------|--------|
| API-001 Envelope GET /audit/events | PASS |
| API-002 Paginação 50/página server-side | PASS |
| API-003 Filtros server-side completos | PASS + [Ambiguity] escopo do campo `q` |
| API-004 Query params camelCase | PASS |
| API-005 Campos nullable com null explícito | PASS |
| API-006 Cross-tenant com tenantId opcional | PASS |
| API-007 POST export retorna 202 | PASS |
| API-008 Polling com signedUrl 24h | PASS |
| API-009 Export com todos os 12 campos | PASS + [Ambiguity] JSONB em CSV |
| API-010 Erros sem stack trace | PASS |
| API-011 Zod snapshot test | PASS |
| API-012 Auto-refresh 30s sem perder filtros | PASS + [Ambiguity] paginação offset |
| API-013 Prefixo /api/v1/ | PASS |
| API-014 BullMQ 3 tentativas | PASS |

**Gaps**: 0
**Ambiguidades**: 4 (API-003, API-009, API-012 — resolver no create-tasks)
