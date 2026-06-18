-- Migration: add_mv_tenant_report
-- Cria a Materialized View mv_tenant_report (FR65/Story 13.2b)
-- NOTA: Prisma não modela MVs — SQL bruto aqui; aplicado via migrate deploy no CI/prod.

-- 1. MATERIALIZED VIEW
CREATE MATERIALIZED VIEW mv_tenant_report AS
WITH active_members AS (
  SELECT gm.tenant_id, gm.group_id, gm.user_id
  FROM group_members gm
  WHERE gm.deleted_at IS NULL
),
leaders AS (
  SELECT DISTINCT ON (gm.group_id) gm.group_id, gm.tenant_id, u.name AS leader_name
  FROM group_members gm
  JOIN users u ON u.id = gm.user_id
  WHERE gm.role = 'lider' AND gm.deleted_at IS NULL
  ORDER BY gm.group_id, gm.created_at
),
attendance AS (
  -- % presença média das reuniões realizadas no range (por período)
  SELECT m.tenant_id, m.group_id,
    AVG(CASE WHEN ma.presence_type IN ('integral','parcial') THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE m.scheduled_for >= now() - interval '7 days')  AS att_7d,
    AVG(CASE WHEN ma.presence_type IN ('integral','parcial') THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE m.scheduled_for >= now() - interval '30 days') AS att_30d,
    AVG(CASE WHEN ma.presence_type IN ('integral','parcial') THEN 1.0 ELSE 0.0 END)
      FILTER (WHERE m.scheduled_for >= now() - interval '90 days') AS att_90d
  FROM meetings m
  LEFT JOIN meeting_attendance ma ON ma.meeting_id = m.id AND ma.tenant_id = m.tenant_id
  WHERE m.status IN ('ended','realizado')
  GROUP BY m.tenant_id, m.group_id
),
progress AS (
  -- progresso médio de trilha dos membros ativos (snapshot, não janelado)
  SELECT am.tenant_id, am.group_id,
         AVG(tp.progress_percent)::numeric(5,2) AS prog_avg
  FROM active_members am
  LEFT JOIN trail_progress tp ON tp.user_id = am.user_id AND tp.tenant_id = am.tenant_id
  GROUP BY am.tenant_id, am.group_id
),
risk AS (
  -- contagem de participantes em risco (amarelo ou vermelho)
  SELECT prs.tenant_id, prs.group_id,
         COUNT(*) FILTER (WHERE prs.status IN ('amarelo','vermelho')) AS risk_count,
         COUNT(*) AS radar_total
  FROM participant_radar_status prs
  GROUP BY prs.tenant_id, prs.group_id
)
SELECT
  g.tenant_id                                          AS tenant_id,
  g.id                                                 AS group_id,
  g.name                                               AS group_name,
  l.leader_name                                        AS leader_name,
  ROUND(COALESCE(a.att_7d,  0)::numeric * 100, 2)    AS attendance_avg_7d,
  ROUND(COALESCE(a.att_30d, 0)::numeric * 100, 2)    AS attendance_avg_30d,
  ROUND(COALESCE(a.att_90d, 0)::numeric * 100, 2)    AS attendance_avg_90d,
  ROUND(COALESCE(p.prog_avg, 0), 2)                  AS trail_progress_avg_7d,
  ROUND(COALESCE(p.prog_avg, 0), 2)                  AS trail_progress_avg_30d,
  ROUND(COALESCE(p.prog_avg, 0), 2)                  AS trail_progress_avg_90d,
  COALESCE(r.risk_count, 0)::int                      AS risk_count,
  (SELECT COUNT(*)::int FROM active_members am2 WHERE am2.group_id = g.id) AS active_participants,
  now()                                               AS refreshed_at
FROM groups g
LEFT JOIN leaders    l ON l.group_id  = g.id
LEFT JOIN attendance a ON a.group_id  = g.id AND a.tenant_id = g.tenant_id
LEFT JOIN progress   p ON p.group_id  = g.id AND p.tenant_id = g.tenant_id
LEFT JOIN risk       r ON r.group_id  = g.id AND r.tenant_id = g.tenant_id
WHERE g.deleted_at IS NULL;

-- 2. UNIQUE INDEX (obrigatório para REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX mv_tenant_report_pk ON mv_tenant_report (tenant_id, group_id);

-- 3. Índice de leitura por tenant
CREATE INDEX mv_tenant_report_tenant_idx ON mv_tenant_report (tenant_id);

-- 4. Tabela de log de refresh (dec-010)
CREATE TABLE mv_refresh_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID,
  mv_name      VARCHAR(64)  NOT NULL,
  refreshed_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  duration_ms  INT          NOT NULL,
  status       VARCHAR(16)  NOT NULL
);

-- 5. Índice em mv_refresh_log
CREATE INDEX mv_refresh_log_mv_name_idx ON mv_refresh_log (mv_name, refreshed_at);

-- 6. RLS em mv_refresh_log (padrão canônico do projeto: nullif closed-by-default)
ALTER TABLE mv_refresh_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON mv_refresh_log
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
