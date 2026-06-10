-- Story 6-5: participant_status_improved — positive radar transition events for CelebrationBanner
-- RLS: tenant_id-scoped, follows same policy pattern as participant_radar_status

CREATE TABLE "participant_status_improved" (
    "id"               UUID        NOT NULL,
    "tenant_id"        UUID        NOT NULL,
    "group_id"         UUID        NOT NULL,
    "participant_id"   UUID        NOT NULL,
    "previous_status"  "RadarStatus" NOT NULL,
    "new_status"       "RadarStatus" NOT NULL,
    "trend"            "RadarTrend" NOT NULL DEFAULT 'estavel',
    "seen_at"          TIMESTAMPTZ,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "participant_status_improved_pkey" PRIMARY KEY ("id")
);

-- FK constraints
ALTER TABLE "participant_status_improved"
    ADD CONSTRAINT "participant_status_improved_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "participant_status_improved"
    ADD CONSTRAINT "participant_status_improved_group_id_fkey"
        FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "participant_status_improved"
    ADD CONSTRAINT "participant_status_improved_participant_id_fkey"
        FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "participant_status_improved_tenant_id_group_id_idx"
    ON "participant_status_improved"("tenant_id", "group_id");

CREATE INDEX "participant_status_improved_participant_id_idx"
    ON "participant_status_improved"("participant_id");

CREATE INDEX "participant_status_improved_tenant_id_created_at_idx"
    ON "participant_status_improved"("tenant_id", "created_at");

-- RLS: row-level security — same pattern as participant_radar_status
ALTER TABLE "participant_status_improved" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_participant_status_improved"
    ON "participant_status_improved"
    USING (
        "tenant_id" = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    );
