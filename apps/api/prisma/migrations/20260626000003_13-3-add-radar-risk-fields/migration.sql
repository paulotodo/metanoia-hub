ALTER TABLE participant_radar_status
  ADD COLUMN risk_reason VARCHAR(500) NULL,
  ADD COLUMN manual_override_at TIMESTAMPTZ NULL;
