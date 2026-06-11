-- Migration: 8-8 lessons full-text search vector
-- Story 8-8: Busca Full-Text de Trilhas e Aulas
--
-- Rollback order (do NOT drop unaccent extension — shared):
--   DROP INDEX IF EXISTS "lessons_search_vector_idx";
--   DROP TRIGGER IF EXISTS "trg_lessons_search_vector" ON "lessons";
--   DROP FUNCTION IF EXISTS "lessons_search_vector_update"();
--   ALTER TABLE "lessons" DROP COLUMN IF EXISTS "search_vector";

-- 1. Enable unaccent extension (idempotent)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Add search_vector column (idempotent)
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- 3. Create trigger function (soft-delete aware)
--    - When deleted_at IS NULL: populate from name + coalesce(tags, '') using Portuguese dictionary + unaccent
--    - When soft-deleted: set NULL (excluded from search index)
CREATE OR REPLACE FUNCTION lessons_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN
    NEW.search_vector := to_tsvector(
      'pg_catalog.portuguese',
      unaccent(NEW.name) || ' ' || unaccent(array_to_string(NEW.tags, ' '))
    );
  ELSE
    NEW.search_vector := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create trigger BEFORE INSERT OR UPDATE on lessons
DROP TRIGGER IF EXISTS trg_lessons_search_vector ON "lessons";
CREATE TRIGGER trg_lessons_search_vector
  BEFORE INSERT OR UPDATE ON "lessons"
  FOR EACH ROW
  EXECUTE FUNCTION lessons_search_vector_update();

-- 5. Backfill existing rows where deleted_at IS NULL
UPDATE "lessons"
SET "search_vector" = to_tsvector(
  'pg_catalog.portuguese',
  unaccent("name") || ' ' || unaccent(array_to_string("tags", ' '))
)
WHERE "deleted_at" IS NULL;

-- 6. Set NULL for soft-deleted rows (explicit, idempotent)
UPDATE "lessons"
SET "search_vector" = NULL
WHERE "deleted_at" IS NOT NULL;

-- 7. Create GIN index for full-text search performance
CREATE INDEX IF NOT EXISTS "lessons_search_vector_idx"
  ON "lessons" USING GIN ("search_vector");
