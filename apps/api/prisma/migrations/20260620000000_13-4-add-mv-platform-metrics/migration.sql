-- ============================================================
-- 13-4: Métricas de Plataforma (FR67)
-- Prisma não modela MVs — SQL bruto; aplicado via migrate deploy.
-- NUNCA aplicar automaticamente — usar --create-only.
-- MIG-02: usa t.id (PK UUID de tenants), NUNCA t.tenant_id
-- ============================================================

-- 1. Tabela de uso de storage por tenant (dec-007)
CREATE TABLE IF NOT EXISTS tenant_storage_usage (
  tenant_id  UUID        NOT NULL PRIMARY KEY,
  bytes_used BIGINT      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: habilitar mas política permissiva (super-admin cross-tenant)
ALTER TABLE tenant_storage_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_storage_usage_nullif ON tenant_storage_usage
  USING (nullif(current_setting('app.current_tenant_id', true), '') IS NULL
         OR tenant_id::text = current_setting('app.current_tenant_id', true));

GRANT SELECT, INSERT, UPDATE ON tenant_storage_usage TO metanoia_app;

-- 2. Materialized view cross-tenant (sem RLS — exceção arquitetural para super-admin)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_metrics AS
WITH tenant_users AS (
  SELECT
    u.tenant_id,
    COUNT(*)                                                          AS total_users,
    COUNT(*) FILTER (
      WHERE u.last_seen_at >= date_trunc('month', now())
    )                                                                 AS active_users_current_month,
    COUNT(*) FILTER (
      WHERE u.last_seen_at >= date_trunc('month', now()) - INTERVAL '1 month'
        AND u.last_seen_at <  date_trunc('month', now())
    )                                                                 AS active_users_prev_month
  FROM users u
  GROUP BY u.tenant_id
),
tenant_groups AS (
  SELECT g.tenant_id, COUNT(*) AS total_groups
  FROM groups g
  GROUP BY g.tenant_id
),
tenant_meetings AS (
  SELECT
    m.tenant_id,
    COUNT(*) FILTER (WHERE m.status IN ('ended', 'realizado'))       AS meetings_held
  FROM meetings m
  GROUP BY m.tenant_id
)
SELECT
  t.id                                                                AS tenant_id,
  t.name                                                              AS tenant_name,
  t.plan                                                              AS tenant_plan,
  t.status                                                            AS tenant_status,
  t.created_at                                                        AS tenant_created_at,
  COALESCE(tu.total_users, 0)                                         AS total_users,
  COALESCE(tu.active_users_current_month, 0)                         AS active_users,
  COALESCE(tu.active_users_current_month, 0) > 0                     AS active_current_month,
  COALESCE(tu.active_users_prev_month, 0) > 0                        AS active_prev_month,
  COALESCE(tg.total_groups, 0)                                        AS total_groups,
  COALESCE(tm.meetings_held, 0)                                       AS meetings_held,
  COALESCE(tsu.bytes_used, 0)                                         AS storage_bytes_used,
  now()                                                               AS refreshed_at
FROM tenants t
LEFT JOIN tenant_users         tu  ON tu.tenant_id = t.id
LEFT JOIN tenant_groups        tg  ON tg.tenant_id = t.id
LEFT JOIN tenant_meetings      tm  ON tm.tenant_id = t.id
LEFT JOIN tenant_storage_usage tsu ON tsu.tenant_id = t.id;

-- 3. UNIQUE INDEX obrigatório para REFRESH CONCURRENTLY (INF-01)
CREATE UNIQUE INDEX IF NOT EXISTS mv_platform_metrics_pk ON mv_platform_metrics (tenant_id);

-- 4. GRANTs (MIG-04)
GRANT SELECT ON mv_platform_metrics TO metanoia_app;
