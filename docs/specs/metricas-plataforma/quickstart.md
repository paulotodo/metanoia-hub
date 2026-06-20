# Quickstart / Cenários de Teste — Métricas de Plataforma (FR67)

## Cenário 1 — Summary (happy path)
1. Aplicar migration; popular `tenant_storage_usage` e `REFRESH MATERIALIZED VIEW mv_platform_metrics`.
2. `GET /api/v1/admin/platform-metrics/summary` autenticado como `super_admin`.
3. **Expected**: 200 `{data:{totalTenants,...,netGrowth,refreshedAt}}`; 2º request (<300s)
   serve do cache Redis (`cache:platform-metrics:summary`).

## Cenário 2 — Tenants paginado + sort whitelist
1. `GET /api/v1/admin/platform-metrics/tenants?page=1&limit=20&sortBy=totalUsers&sortDir=desc` como `super_admin`.
2. **Expected**: 200 `{data:[...], meta:{total,page,limit,totalPages}}`, ordenado desc por users.
3. `GET .../tenants?sortBy=DROP_TABLE` → **Expected**: 400 (Zod rejeita: fora da whitelist).

## Cenário 3 — Autorização (403)
1. `GET .../summary` autenticado como `admin_tenant` (não super_admin).
2. **Expected**: 403 `Insufficient role permissions`. Idem `/tenants`. Sem auth → 401.

## Cenário 4 — RLS isolation de tenant_storage_usage
1. Setar `app.current_tenant_id = TENANT_A`; INSERT/UPSERT bytes para A.
2. Setar `app.current_tenant_id = TENANT_B`; `SELECT * FROM tenant_storage_usage`.
3. **Expected**: B NÃO vê a linha de A (closed-by-default). Sem contexto → 0 linhas.

## Cenário 5 — Hook de upload incrementa storage
1. Em contexto do tenant A, `StorageService.upload(key, buffer(1000 bytes), mime)`.
2. **Expected**: `tenant_storage_usage` do A tem `bytes_used += 1000`; 2º upload soma.
3. Upload SEM contexto de tenant (job): **Expected**: warn logado, upload sucede, sem incremento (não falha).

## Cenário 6 — Refresh child job + isolamento de falha
1. Disparar o flow pai→child; verificar `mv_refresh_log` com `mv_name='mv_platform_metrics'`.
2. Forçar falha no platform-refresh → **Expected**: `failParentOnFailure:false`; o
   tenant-refresh permanece `success`; alerta independente para o platform-refresh.

## Cenário 7 — Roundtrip End-to-End (shape camelCase real)
1. Chamada REAL ao backend `GET .../summary` (não mock), capturar payload.
2. **Expected**: chaves do JSON são **camelCase** (`storageBytesUsed`, `netGrowth`,
   `refreshedAt`) e batem 1:1 com `PlatformMetricsSummarySchema.parse(payload)` sem erro
   (expõe drift snake_case vs camelCase do mapper MV→DTO antes de acumular).

## Validação pré-fechamento (execute-task)
- Rodar o SQL da MV contra Postgres local; confirmar cada coluna referenciada existe.
- `pnpm --filter @metanoia/api exec prisma generate` após editar `schema.prisma`.
- `tsc --noEmit` verde; snapshot Zod gerado; RLS spec verde.
