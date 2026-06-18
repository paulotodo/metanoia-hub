# Quickstart — Relatório por Tenant com Materialized Views (FR65)

Validação manual fim-a-fim após implementação.

## Pré-requisitos
```bash
docker compose up -d            # postgres + redis
pnpm --filter @metanoia/api exec prisma migrate dev   # aplica migration da MV + mv_refresh_log
pnpm dev
```

## 1. MV existe e tem UNIQUE INDEX
```sql
\d+ mv_tenant_report
SELECT indexname FROM pg_indexes WHERE tablename='mv_tenant_report';  -- deve listar mv_tenant_report_pk (UNIQUE)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_report;              -- não deve erro (prova UNIQUE INDEX)
```

## 2. Endpoint summary (admin_tenant)
```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/v1/reports/tenant-summary?period=30d" | jq
# Espera: { data:{groups,summary}, meta:{lastRefreshAt, stale:false, fromMaterializedView:true} }
# Confirma: tenant_id NÃO aparece em nenhum objeto.
```

## 3. Refresh on-demand + rate-limit
```bash
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/api/v1/reports/tenant-summary/refresh -i   # 1ª: 202 accepted
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/api/v1/reports/tenant-summary/refresh -i   # 2ª: 429 + Retry-After
```

## 4. Stale banner
```sql
-- envelhecer o último log > 20min e recarregar a UI → banner "Dados podem estar desatualizados"
UPDATE mv_refresh_log SET refreshed_at = now() - interval '25 minutes'
WHERE mv_name='mv_tenant_report';
```

## 5. RLS isolation (gate de segurança)
```bash
pnpm --filter @metanoia/api test apps/api/test/rls/mv-tenant-report.rls-spec.ts
# Prova: admin do tenant A não vê linhas da MV do tenant B.
```

## 6. UI autenticada
Abrir `/app/admin/reports/tenant-summary`: rótulo "Dados atualizados em",
botão "Atualizar agora" (spinner/disabled/toast rate-limit), filtros período/grupo/
semáforo, badges semáforo com ícone+texto (a11y), banner stale com `aria-live`.

## 7. Performance
```bash
# seed 500 tenants x 10 grupos x 50 participantes; medir GET tenant-summary < 2s.
```
