-- Story 14-3: Extend notification_type enum with email-specific types.
--
-- PostgreSQL does not allow ADD VALUE inside a transaction block.
-- These statements MUST run outside BEGIN/COMMIT (idempotent via IF NOT EXISTS).
--
-- Ref: tasks.md FASE 2.3 / spec.md §Key Entities / data-model.md §Enum notification_type

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'export_ready';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'content_new';
