CREATE TABLE evasion_job_log (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NULL,
  job_run_id          UUID         NOT NULL,
  status              VARCHAR(16)  NOT NULL,
  duration_ms         INT          NULL,
  tenants_processed   INT          NOT NULL DEFAULT 0,
  participants_flagged INT         NOT NULL DEFAULT 0,
  error_message       TEXT         NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX evasion_job_log_run_idx ON evasion_job_log (job_run_id, created_at);
CREATE INDEX evasion_job_log_tenant_idx ON evasion_job_log (tenant_id, created_at);

-- RLS canônico do projeto (padrão nullif): tenant_id NULL = visível por todos os tenants (log de job global)
ALTER TABLE evasion_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON evasion_job_log
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
