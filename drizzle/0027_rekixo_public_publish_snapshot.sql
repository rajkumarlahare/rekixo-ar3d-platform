-- Rekixo public publish snapshot isolation.
-- Existing published projects are backfilled from their current live state so
-- structural Super Admin edits stop leaking to customer sites after deploy.

CREATE TABLE IF NOT EXISTS project_public_snapshots (
  project_id TEXT PRIMARY KEY NOT NULL,
  publish_version INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  engine_project_id TEXT,
  engine_slug TEXT,
  engine_link_status TEXT,
  engine_public_enabled INTEGER NOT NULL DEFAULT 0,
  engine_public_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS published_plots (
  project_id TEXT NOT NULL,
  id TEXT NOT NULL,
  sqft REAL NOT NULL,
  sqm REAL NOT NULL,
  sqyd REAL NOT NULL,
  dimensions TEXT NOT NULL,
  road TEXT NOT NULL,
  front REAL,
  depth REAL,
  back REAL,
  depth2 REAL,
  dimension_unit TEXT,
  front_edge_index INTEGER,
  depth_edge_index INTEGER,
  back_edge_index INTEGER,
  depth2_edge_index INTEGER,
  front_label TEXT,
  depth_label TEXT,
  back_label TEXT,
  depth2_label TEXT,
  side_dimensions TEXT,
  edge_semantics TEXT,
  polygon TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available',
  featured INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id,id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS published_plot_edge_measurements (
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
  PRIMARY KEY (project_id,plot_id,role,segment_index),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_published_edge_measurements_project_plot
  ON published_plot_edge_measurements(project_id,plot_id);

CREATE TABLE IF NOT EXISTS published_settings (
  project_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (project_id,key),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO project_public_snapshots (
  project_id,publish_version,project_name,engine_project_id,engine_slug,
  engine_link_status,engine_public_enabled,engine_public_url,created_at
)
SELECT
  p.id,p.publish_version,p.name,l.engine_project_id,l.engine_slug,l.status,
  COALESCE(l.public_enabled,0),l.public_url,
  COALESCE(p.published_at,p.updated_at)
FROM projects p
LEFT JOIN project_3d_links l ON l.platform_project_id=p.id
WHERE p.status='active' AND p.public_status='published';

INSERT OR REPLACE INTO published_plots (
  project_id,id,sqft,sqm,sqyd,dimensions,road,front,depth,back,depth2,
  dimension_unit,front_edge_index,depth_edge_index,back_edge_index,
  depth2_edge_index,front_label,depth_label,back_label,depth2_label,
  side_dimensions,edge_semantics,polygon,status,featured
)
SELECT
  x.project_id,x.id,x.sqft,x.sqm,x.sqyd,x.dimensions,x.road,x.front,x.depth,
  x.back,x.depth2,x.dimension_unit,x.front_edge_index,x.depth_edge_index,
  x.back_edge_index,x.depth2_edge_index,x.front_label,x.depth_label,
  x.back_label,x.depth2_label,x.side_dimensions,x.edge_semantics,x.polygon,
  x.status,x.featured
FROM plots x
JOIN projects p ON p.id=x.project_id
WHERE p.status='active' AND p.public_status='published';

INSERT OR REPLACE INTO published_plot_edge_measurements (
  project_id,plot_id,role,segment_index,edge_index,point_count,length,unit,
  raw_label,road_frontage,road_access
)
SELECT
  m.project_id,m.plot_id,m.role,m.segment_index,m.edge_index,m.point_count,
  m.length,m.unit,m.raw_label,m.road_frontage,m.road_access
FROM plot_edge_measurements m
JOIN projects p ON p.id=m.project_id
WHERE p.status='active' AND p.public_status='published';

INSERT OR REPLACE INTO published_settings (project_id,key,value)
SELECT s.project_id,s.key,s.value
FROM settings s
JOIN projects p ON p.id=s.project_id
WHERE p.status='active'
  AND p.public_status='published'
  AND s.key IN (
    'projectName','brandName','brandShort','template','accentColor',
    'plotStatusAvailableColor','plotStatusBookedColor','plotStatusSoldColor',
    'pricingEnabled','customerCallEnabled','publicInitialViewMode',
    'publicInitialFocusX','publicInitialFocusY','location','address','phone1',
    'phone2','whatsapp','mapUrl','brochureUrl','masterplanName','mapWidth',
    'mapHeight','publicRotation','logoName','logoVersion','shareTitle',
    'shareDescription','shareImage','shareVersion','shareTemplate'
  );
