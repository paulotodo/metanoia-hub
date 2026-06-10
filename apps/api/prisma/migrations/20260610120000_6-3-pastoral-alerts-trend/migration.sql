-- Story 6-3: Extend pastoral_alerts with status-transition and lifecycle fields
-- Additive migration — no existing columns modified, no new FKs.
-- RLS policy for pastoral_alerts already exists (migration 20260413131927 + 20260510210000).

ALTER TABLE "pastoral_alerts"
  ADD COLUMN IF NOT EXISTS "previous_status" "RadarStatus",
  ADD COLUMN IF NOT EXISTS "new_status"      "RadarStatus",
  ADD COLUMN IF NOT EXISTS "trend"           "RadarTrend",
  ADD COLUMN IF NOT EXISTS "read_at"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "dismissed_at"    TIMESTAMPTZ;

-- Index for efficient dedup check and active-alert queries per group
CREATE INDEX IF NOT EXISTS "pastoral_alerts_tenant_group_dismissed_idx"
  ON "pastoral_alerts" ("tenant_id", "group_id", "dismissed_at");
