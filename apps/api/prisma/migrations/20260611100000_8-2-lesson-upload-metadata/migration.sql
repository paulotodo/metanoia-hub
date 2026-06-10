-- Story 8-2: Add upload metadata and content body fields to lessons
-- Additive migration — no existing columns modified.

ALTER TABLE "lessons"
  ADD COLUMN "content_body"    TEXT,
  ADD COLUMN "tags"            TEXT[]        NOT NULL DEFAULT '{}',
  ADD COLUMN "original_name"   VARCHAR(512),
  ADD COLUMN "mime_type"       VARCHAR(255),
  ADD COLUMN "size_bytes"      BIGINT,
  ADD COLUMN "uploaded_by"     UUID,
  ADD COLUMN "uploaded_at"     TIMESTAMPTZ;
