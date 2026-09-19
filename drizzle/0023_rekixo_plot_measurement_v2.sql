-- REKIXO_PLOT_MEASUREMENT_V2
-- Additive future-proof edge measurements plus project-scoped area policy.
CREATE TABLE IF NOT EXISTS plot_edge_measurements (
  project_id TEXT NOT NULL,
  plot_id TEXT NOT NULL,
  role TEXT NOT NULL,
  segment_index INTEGER NOT NULL DEFAULT 0,
  edge_index INTEGER,
  point_count INTEGER,
  length REAL,
  unit TEXT,
  raw_label TEXT,
  road_frontage INTEGER NOT NULL DEFAULT 0,
  road_access TEXT,
  source_ref TEXT,
  source_raw_text TEXT,
  confidence TEXT NOT NULL DEFAULT 'high',
  verified INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, plot_id, role, segment_index),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_plot_edge_measurements_project_plot
  ON plot_edge_measurements(project_id, plot_id);

-- Mangal Raj Park business display rule: Sq.M -> Sq.Ft uses 10.76.
-- Match both the project master name and an explicit projectName setting so
-- deployment does not depend on a hard-coded tenant UUID.
INSERT OR IGNORE INTO settings (project_id, key, value, updated_at)
SELECT p.id, 'sqmToSqftFactor', '10.76', strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM projects p
WHERE lower(trim(p.name)) = 'mangal raj park'
   OR EXISTS (
     SELECT 1 FROM settings ps
     WHERE ps.project_id = p.id
       AND ps.key = 'projectName'
       AND lower(trim(ps.value)) = 'mangal raj park'
   );

-- Correct only the Sq.Ft presentation value for the Mangal project.
-- Sq.Yd remains untouched because the requested override applies only to Sq.M -> Sq.Ft.
UPDATE plots
SET sqft = ROUND(sqm * 10.76, 3),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE sqm > 0
  AND project_id IN (
    SELECT p.id
    FROM projects p
    WHERE lower(trim(p.name)) = 'mangal raj park'
       OR EXISTS (
         SELECT 1 FROM settings ps
         WHERE ps.project_id = p.id
           AND ps.key = 'projectName'
           AND lower(trim(ps.value)) = 'mangal raj park'
       )
  );
