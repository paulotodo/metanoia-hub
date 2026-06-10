-- Story 8-6: Publishing, Versioning & Tenant Catalog
-- Adds publishing fields to trails, creates trail_versions and group_trails tables.

-- ---------------------------------------------------------------------------
-- 1. Add publishing columns to trails
-- ---------------------------------------------------------------------------

ALTER TABLE trails
  ADD COLUMN IF NOT EXISTS version         INTEGER,
  ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by    UUID,
  ADD COLUMN IF NOT EXISTS catalog_visible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS trails_tenant_catalog_visible_idx
  ON trails (tenant_id, catalog_visible);

-- ---------------------------------------------------------------------------
-- 2. Create trail_versions table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trail_versions (
  id            UUID        NOT NULL PRIMARY KEY,
  tenant_id     UUID        NOT NULL,
  trail_id      UUID        NOT NULL REFERENCES trails(id) ON DELETE CASCADE ON UPDATE CASCADE,
  version       INTEGER     NOT NULL,
  snapshot_data JSONB       NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL,
  published_by  UUID        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT trail_versions_trail_version_unique UNIQUE (trail_id, version)
);

CREATE INDEX IF NOT EXISTS trail_versions_tenant_id_idx ON trail_versions (tenant_id);

-- Enable RLS
ALTER TABLE trail_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY trail_versions_tenant_isolation ON trail_versions
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- 3. Create group_trails table (owned by 8-6; endpoints added in Story 4-4)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS group_trails (
  id          UUID        NOT NULL PRIMARY KEY,
  tenant_id   UUID        NOT NULL,
  group_id    UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE ON UPDATE CASCADE,
  trail_id    UUID        NOT NULL REFERENCES trails(id) ON DELETE CASCADE ON UPDATE CASCADE,
  assigned_by UUID        NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT group_trails_group_trail_unique UNIQUE (group_id, trail_id)
);

CREATE INDEX IF NOT EXISTS group_trails_tenant_id_idx ON group_trails (tenant_id);

-- Enable RLS
ALTER TABLE group_trails ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_trails_tenant_isolation ON group_trails
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
