# API Contracts — Templates de Conteúdo (FR42 / Story 13.5)

Prefixo: `/api/v1`. Guards: `KeycloakAuthGuard + RolesGuard`, `@Roles(admin_tenant)` em
toda a superfície de templates. Envelope de sucesso `{ data, meta? }`; erro
`{ statusCode, error, message, details? }`. Datas ISO 8601; nulls explícitos.

## POST /api/v1/templates — criar template a partir de trilha

- **Roles:** admin_tenant · **201 Created**
- **Body** (`CreateTemplateRequestSchema`):
```json
{ "sourceTrailId": "uuid", "name": "string(1..255)", "description": "string(0..1000)|null" }
```
- **Comportamento:** snapshot da estrutura da trilha-fonte (same-tenant via RLS);
  `version = MAX(version)+1` por `source_trail_id`; `scope=tenant`; conteúdo NÃO capturado.
- **RLS write (dec-015):** o INSERT grava SEMPRE `tenant_id = tenant corrente` (nunca NULL).
  A policy `content_templates_insert` (`WITH CHECK`) impede forjar linha platform.
- **Resposta:** `{ "data": ContentTemplate }`
- **Erros:** 404 (trilha-fonte inexistente/outro tenant), 422 (validação), 403 (não admin_tenant).

## GET /api/v1/templates — listar

- **Roles:** admin_tenant · **200**
- **Query** (`TemplateListQuerySchema`):
  - `scope`: `all` (default) | `platform` | `tenant`
  - `search?`: substring em `name`
  - `sort?`: `name` | `-name` | `createdAt` | `-createdAt` (default `-createdAt`)
  - `page` (default 1), `pageSize` (default 20, max 100) — `z.coerce.number()`
- **Default:** mostra a versão **mais recente** por `source_trail_id` (FR-09); platform sempre incluído quando `scope=all`.
- **Resposta:** `{ "data": ContentTemplate[], "meta": { total, page, pageSize } }`

## GET /api/v1/templates/:id — detalhe

- **Roles:** admin_tenant · **200**
- `:id` via `ParseUUIDPipe`.
- **Resposta:** `{ "data": ContentTemplate }` (com `structure` completa).
- **Erros:** 404 (não existe OU fora do escopo visível).

## GET /api/v1/templates/:id/versions — histórico de versões

- **Roles:** admin_tenant · **200**
- Lista todas as versões que compartilham o `source_trail_id` do template `:id`.
- **Resposta:** `{ "data": TemplateVersionItem[], "meta": { total } }`
- `TemplateVersionItem`: `{ id, version, name, createdAt, createdBy }`.

## PATCH /api/v1/templates/:id — editar metadados

- **Roles:** admin_tenant · **200**
- **Body** (`UpdateTemplateRequestSchema`): `{ "name?": "string", "description?": "string|null" }`
- **Bloqueio:** template `scope=platform` → **403** (`message` PT-BR: template da plataforma é somente leitura).
- **Erros:** 404, 403 (platform), 422.

## DELETE /api/v1/templates/:id — soft delete

- **Roles:** admin_tenant · **204 No Content**
- Soft delete (`deleted_at = now()`); **sem cascade**.
- **Bloqueio:** `scope=platform` → **403**. Só o tenant dono pode deletar o próprio.
- Trilhas materializadas a partir do template **não** são afetadas (FR-15).

## POST /api/v1/trails — (ESTENDIDO) instanciar a partir de template

- **Roles:** admin_tenant · **201 Created**
- **Body** (`CreateTrailRequestSchema` estendido): campos existentes +
  `"templateId?": "uuid"`, `"groupId?": "uuid"`.
- **Comportamento com `templateId`:** materializa Trail + Modules + Lessons da `structure`
  do template, com conteúdo vazio; cópia independente. Com `groupId`, cria `GroupTrail`.
- **Sem `templateId`:** comportamento atual inalterado (retrocompatível).
- **Erros:** 404 (template inexistente/invisível), 422.

## Matriz de status

| Endpoint | Sucesso | Erros principais |
|----------|---------|------------------|
| POST /templates | 201 | 404, 422, 403 |
| GET /templates | 200 | 422 (query) |
| GET /templates/:id | 200 | 404 |
| GET /templates/:id/versions | 200 | 404 |
| PATCH /templates/:id | 200 | 404, 403(platform), 422 |
| DELETE /templates/:id | 204 | 404, 403(platform) |
| POST /trails (templateId) | 201 | 404, 422 |
