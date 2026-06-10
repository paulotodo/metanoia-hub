-- Story 6-2: Add participant_radar_status table for async radar engine
-- Follows RLS contract: tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
-- Additive migration — no existing tables modified.

-- Enums for radar status and trend
CREATE TYPE "RadarStatus" AS ENUM ('verde', 'amarelo', 'vermelho');
CREATE TYPE "RadarTrend" AS ENUM ('melhorando', 'estavel', 'declinio');

-- ParticipantRadarStatus — materialized async-calculated pastoral radar status
CREATE TABLE "participant_radar_status" (
  "id"                   UUID          NOT NULL,
  "tenant_id"            UUID          NOT NULL,
  "group_id"             UUID          NOT NULL,
  "participant_id"       UUID          NOT NULL,
  "status"               "RadarStatus" NOT NULL,
  "trend"                "RadarTrend"  NOT NULL DEFAULT 'estavel',
  "presence_percentage"  DECIMAL(5,4)  NOT NULL,
  "last_active_at"       TIMESTAMPTZ,
  "calculated_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT "participant_radar_status_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "participant_radar_status_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "participant_radar_status_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "participant_radar_status_participant_id_fkey"
    FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "participant_radar_status_unique"
    UNIQUE ("tenant_id", "group_id", "participant_id")
);

-- Indexes for efficient queries
CREATE INDEX "participant_radar_status_tenant_group_idx"
  ON "participant_radar_status" ("tenant_id", "group_id");

CREATE INDEX "participant_radar_status_participant_idx"
  ON "participant_radar_status" ("participant_id");

-- RLS: Enable and enforce tenant isolation
ALTER TABLE "participant_radar_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "participant_radar_status" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "participant_radar_status"
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
