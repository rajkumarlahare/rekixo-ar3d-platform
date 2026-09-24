-- Preserve exact access state for future project archive/restore cycles.
-- Legacy archives created before this migration intentionally remain fail-closed.

CREATE TABLE IF NOT EXISTS project_archive_access_snapshot (
  project_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project','admin','membership','domain')),
  entity_id TEXT NOT NULL,
  status TEXT,
  public_host TEXT,
  admin_host TEXT,
  public_primary INTEGER,
  admin_primary INTEGER,
  is_primary INTEGER,
  archived_at TEXT NOT NULL,
  PRIMARY KEY (project_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_project_archive_access_snapshot_project
ON project_archive_access_snapshot(project_id, entity_type);
