-- Migration: 9-1 Privacy Export Jobs (Story 9-1 / LGPD Art. 20)
-- Creates privacy_export_jobs table with RLS isolation.
-- Worker mode is privileged (bypasses RLS); HTTP polling uses RLS.

CREATE TABLE "privacy_export_jobs" (
    "id"             UUID        NOT NULL,
    "tenant_id"      UUID        NOT NULL,
    "user_id"        UUID        NOT NULL,
    "format"         TEXT        NOT NULL DEFAULT 'json',
    "status"         TEXT        NOT NULL DEFAULT 'accepted',
    "all_tenant_ids" UUID[]      NOT NULL DEFAULT '{}',
    "object_key"     TEXT,
    "signed_url"     TEXT,
    "expires_at"     TIMESTAMPTZ,
    "failure_reason" TEXT,
    "requested_at"   TIMESTAMPTZ NOT NULL,
    "completed_at"   TIMESTAMPTZ,
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "privacy_export_jobs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "idx_privacy_export_jobs_user_id"
    ON "privacy_export_jobs" ("user_id");

CREATE INDEX "idx_privacy_export_jobs_tenant_user"
    ON "privacy_export_jobs" ("tenant_id", "user_id");

CREATE INDEX "idx_privacy_export_jobs_status"
    ON "privacy_export_jobs" ("status")
    WHERE "status" IN ('accepted', 'processing');

-- Row Level Security — tenants can only see their own jobs via HTTP.
-- Worker bypasses RLS by running as superuser (privileged worker pattern).
ALTER TABLE "privacy_export_jobs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "privacy_export_jobs_tenant"
    ON "privacy_export_jobs"
    USING (
        NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID = "tenant_id"
    );
