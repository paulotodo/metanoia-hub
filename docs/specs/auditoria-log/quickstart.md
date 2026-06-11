# Quickstart: Log de Auditoria Imutável (auditoria-log)

Cenários de teste que validam a implementação end-to-end. Cobrem os 4 user
stories + imutabilidade + roundtrip de borda. Backend local: `docker compose up`
+ `pnpm dev`. RLS specs: `apps/api/test/rls/` com `DATABASE_APP_URL`.

## Scenario 1: Captura automática de ação mutativa (US1 — happy path)

1. Autenticar como usuário de um tenant (JWT Keycloak válido).
2. Fazer `POST /api/v1/groups` criando um grupo.
3. Consultar `GET /api/v1/audit/events?action=create&perPage=50`.
4. **Expected**: existe um `AuditEvent` com `action=create`, `resource=group`,
   `userId` e `tenantId` corretos, `previousState=null`, `newState` com o grupo,
   `severity=info`, `timestamp` ISO 8601, `ipAddress`/`userAgent` preenchidos.
   O fluxo do POST original NÃO foi alterado (grupo criado normalmente, 201).

## Scenario 2: Reads não são auditados (US1 AC#2 — FR-011)

1. Autenticar.
2. Fazer `GET /api/v1/groups` (e um `HEAD`, um `OPTIONS`).
3. Consultar a contagem de audit events antes e depois.
4. **Expected**: NENHUM audit event novo. Contagem inalterada.

## Scenario 3: Falha de auditoria é não-bloqueante (US1 AC#3 — FR-010)

1. Simular indisponibilidade da persistência de audit (ex: derrubar conexão do
   `audit.service` ou injetar erro no INSERT).
2. Fazer `POST /api/v1/groups`.
3. **Expected**: o grupo é criado com sucesso (201) — o request NÃO é bloqueado.
   A falha de auditoria é capturada e logada (log em inglês), não propagada.

## Scenario 4: Imutabilidade via RLS append-only (US2 — error case CRÍTICO)

> RLS spec obrigatório: `apps/api/test/rls/audit-events.rls-spec.ts`.

1. Inserir um `audit_event` via app (dentro de `withTenantTx` do tenant A).
2. Conectar como role `metanoia_app` e tentar, via raw SQL:
   - `UPDATE audit_events SET action = 'fake' WHERE id = '<id>'`
   - `DELETE FROM audit_events WHERE id = '<id>'`
3. **Expected**: ambas as operações afetam **0 linhas** (bloqueadas pela ausência
   de policy UPDATE/DELETE). A linha permanece intacta e idêntica. SC-002.
4. Verificar adicionalmente que `audit.service.ts` **não expõe** método `update`
   nem `delete` (assertion de superfície da API do service).

## Scenario 5: Isolamento por tenant (US2 AC#3 — SC-007)

1. Tenant A e Tenant B inserem audit events (UUIDs fixos no RLS spec).
2. Em contexto do Tenant A (`SET LOCAL app.current_tenant_id = '<A>'`), fazer
   `SELECT` em `audit_events`.
3. **Expected**: apenas eventos do Tenant A retornam; nenhum evento do Tenant B
   visível. Repetir invertendo A↔B. Cross-tenant = 0 linhas vazadas.

## Scenario 6: Viewer Super Admin cross-tenant (US3 — happy path)

1. Autenticar como `SUPER_ADMIN`.
2. Navegar para `/app/admin/super/audit`.
3. **Expected**: tabela paginada (50/página, server-side) com colunas timestamp,
   usuário, ação, recurso, tenant, badge de severidade. Linhas de **múltiplos
   tenants** visíveis (cross-tenant via `prisma.client` direto). Expandir uma
   linha mostra `previousState`/`newState` como JSON legível, IP, user agent.
4. Aplicar filtro `severity=critical` → apenas eventos críticos. Filtros
   persistem ao navegar entre páginas (sticky). Aguardar 30s → lista auto-atualiza
   sem perder paginação/filtro (FR-009).

## Scenario 7: Viewer não-super-admin é negado (US3 — error case)

1. Autenticar como usuário comum (não SUPER_ADMIN).
2. Tentar `GET /api/v1/admin/super/audit/events`.
3. **Expected**: 403 FORBIDDEN (RolesGuard). O viewer FE redireciona/bloqueia.

## Scenario 8: Export assíncrono CSV/JSON (US4 — happy path)

1. Como SUPER_ADMIN, com filtro de data aplicado, `POST
   /api/v1/admin/super/audit/export` com `{ format: "csv" }`.
2. **Expected**: 202 com `{ data: { jobId } }`, sem bloquear a UI.
3. Fazer polling `GET /api/v1/admin/super/audit/jobs/:jobId` até
   `status=completed`.
4. **Expected**: resposta com `signedUrl` + `expiresAt` (≥ 24h à frente).
5. Baixar o arquivo. **Expected**: contém TODOS os campos do `AuditEvent`
   (id, tenantId, userId, action, resource, resourceId, previousState, newState,
   ipAddress, userAgent, timestamp, severity), não só os visíveis na tabela.

## Scenario 9: Roundtrip End-to-End (OBRIGATÓRIO — borda backend↔frontend)

> Por que obrigatório: validar que o payload REAL do backend casa com o contrato
> Zod e com o tipo consumido pelo FE, expondo drift snake_case↔camelCase antes
> de acumular retrabalho.

1. Subir o backend localmente (`docker compose up` + `pnpm dev` em `apps/api`).
2. Seed: inserir ≥ 1 audit event real (via um POST mutativo autenticado).
3. Chamada REAL (não mock, não fixture):
   `curl -s -H "Authorization: Bearer <jwt-super-admin>"
   http://localhost:3001/api/v1/admin/super/audit/events?perPage=1`
4. Capturar o payload e comparar o shape contra `contracts/audit-events.md`:
   - **Case style**: campos do envelope e do `AuditEvent` em **camelCase**
     (`tenantId`, `userId`, `previousState`, `ipAddress`, `userAgent`) — NÃO
     snake_case. O DB é snake_case (`tenant_id`); o Prisma `@map`/`@@map` mapeia
     para camelCase no DTO. Confirmar que NÃO vaza `tenant_id` no JSON.
   - **Tipos**: `total`/`page`/`perPage`/`totalPages` são number; `timestamp` é
     string ISO 8601; `resourceId`/`previousState`/`newState` presentes com
     `null` explícito quando não aplicável (nunca `undefined`/omitidos).
   - **Enums**: `action` e `severity` batem com `z.enum().options` de
     `packages/types/src/audit/index.ts`.
5. O FE consome o MESMO payload via `useAuditEvents` e parseia com
   `AuditEventSchema` (Zod) **sem erros**.
6. **Expected**: zero divergência entre payload real, contrato declarado e tipo
   TS no FE. Qualquer drift de case/tipo/enum é detectado AQUI.

## Validação local antes de "done"

```bash
pnpm exec prisma generate
pnpm turbo build
pnpm turbo lint            # --max-warnings 0; jest-axe é gate real do viewer
# após a migration:
pnpm install               # commit pnpm-lock.yaml
```

CI: feature-branch `feat/story-9-3-auditoria-log` → PR → CI verde → squash-merge.
NUNCA push direto em `dev` (ci.yml só roda em `pull_request`).
