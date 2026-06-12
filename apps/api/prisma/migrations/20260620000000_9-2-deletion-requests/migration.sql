-- Migration: 9-2 Deletion Requests (Story 9-2 / LGPD Art. 18 VI)
-- Creates deletion_requests table with RLS isolation.
-- Adds deleted_at to 14 soft-deletable tables.
-- Adds anonymized_user_ref to audit_events (anonimização irreversível no hard-delete).
-- Worker mode is privileged (bypasses RLS); HTTP polling uses RLS.

-- ---------------------------------------------------------------------------
-- 1. deletion_requests table
-- ---------------------------------------------------------------------------

CREATE TABLE "deletion_requests" (
    "id"               UUID        NOT NULL,
    "tenant_id"        UUID        NOT NULL,
    "user_id"          UUID        NOT NULL,
    "status"           TEXT        NOT NULL DEFAULT 'pending',
    "all_tenant_ids"   UUID[]      NOT NULL DEFAULT '{}',
    "cancellable_until" TIMESTAMPTZ NOT NULL,
    "deletion_deadline" TIMESTAMPTZ NOT NULL,
    "cancelled_at"     TIMESTAMPTZ,
    "confirmed_at"     TIMESTAMPTZ,
    "completed_at"     TIMESTAMPTZ,
    "failure_reason"   TEXT,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "idx_deletion_requests_user_id"
    ON "deletion_requests" ("user_id");

CREATE INDEX "idx_deletion_requests_tenant_user"
    ON "deletion_requests" ("tenant_id", "user_id");

-- Partial index for active requests (pending or soft_deleted) — optimizes worker polling
CREATE INDEX "idx_deletion_requests_active_status"
    ON "deletion_requests" ("status")
    WHERE "status" IN ('pending', 'soft_deleted');

-- Row Level Security — tenants can only see their own requests via HTTP.
-- Worker bypasses RLS by running as superuser (privileged worker pattern).
ALTER TABLE "deletion_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deletion_requests_tenant"
    ON "deletion_requests"
    USING (
        NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID = "tenant_id"
    );

-- ---------------------------------------------------------------------------
-- 2. Add deleted_at to soft-deletable tables
-- ---------------------------------------------------------------------------

ALTER TABLE "user_tenants"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "group_members"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "meeting_attendance"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "meeting_telemetry"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "meeting_participants"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "meeting_events"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "reflections"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "pastoral_alerts"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "pastoral_actions"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "pastoral_notes"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "outreach_intents"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "lesson_progress"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "module_progress"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "trail_progress"
    ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- Partial indexes WHERE deleted_at IS NULL (high-selectivity — most rows are active)
-- Critical tables: user_tenants, group_members, lesson_progress
CREATE INDEX "idx_user_tenants_active"
    ON "user_tenants" ("user_id", "tenant_id")
    WHERE "deleted_at" IS NULL;

CREATE INDEX "idx_group_members_active"
    ON "group_members" ("user_id", "tenant_id")
    WHERE "deleted_at" IS NULL;

CREATE INDEX "idx_lesson_progress_active"
    ON "lesson_progress" ("user_id", "tenant_id")
    WHERE "deleted_at" IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Add anonymized_user_ref to audit_events
-- ---------------------------------------------------------------------------

ALTER TABLE "audit_events"
    ADD COLUMN "anonymized_user_ref" TEXT;
