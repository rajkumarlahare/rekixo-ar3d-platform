-- Rekixo Geo 3D Placement V1
-- ADDITIVE ONLY. Existing Geo Mapper, plots, masterplans and public maps are unchanged
-- unless a project explicitly saves and enables a 3D placement.

PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS geo_3d_placements (
  platform_project_id TEXT PRIMARY KEY NOT NULL,
  geo_project_id TEXT NOT NULL DEFAULT '',
  engine_project_id TEXT NOT NULL,
  engine_slug TEXT NOT NULL COLLATE NOCASE,
  engine_release_id TEXT NOT NULL,
  engine_release_version INTEGER NOT NULL CHECK (engine_release_version >= 1),
  engine_model_id TEXT NOT NULL,
  longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
  latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
  altitude_m REAL NOT NULL DEFAULT 0 CHECK (altitude_m >= -1000 AND altitude_m <= 10000),
  heading_deg REAL NOT NULL DEFAULT 0 CHECK (heading_deg >= -3600 AND heading_deg <= 3600),
  pitch_deg REAL NOT NULL DEFAULT 0 CHECK (pitch_deg >= -360 AND pitch_deg <= 360),
  roll_deg REAL NOT NULL DEFAULT 0 CHECK (roll_deg >= -360 AND roll_deg <= 360),
  scale REAL NOT NULL DEFAULT 1 CHECK (scale >= 0.001 AND scale <= 1000),
  public_enabled INTEGER NOT NULL DEFAULT 0 CHECK (public_enabled IN (0,1)),
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (platform_project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS geo_3d_placements_public
  ON geo_3d_placements(public_enabled, platform_project_id);

CREATE INDEX IF NOT EXISTS geo_3d_placements_engine
  ON geo_3d_placements(engine_project_id, engine_release_id);
