-- Rekixo AR3D Stage 5 integration link.
-- Platform stores only linkage metadata. Engine models/scenes remain in rekixo-3d-production.

CREATE TABLE IF NOT EXISTS project_3d_links (
  platform_project_id TEXT PRIMARY KEY NOT NULL,
  engine_project_id TEXT NOT NULL,
  engine_slug TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disabled')),
  public_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (public_enabled IN (0,1)),
  public_url TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (platform_project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS project_3d_links_engine_project_unique
  ON project_3d_links(engine_project_id);

CREATE UNIQUE INDEX IF NOT EXISTS project_3d_links_engine_slug_unique
  ON project_3d_links(engine_slug);

CREATE INDEX IF NOT EXISTS project_3d_links_status
  ON project_3d_links(status, public_enabled);
