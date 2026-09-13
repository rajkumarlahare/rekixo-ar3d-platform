-- REKIXO_PROJECT_PRICING_UPLOAD_V1
-- Additive, project-scoped pricing. Existing plot geometry/status rows are untouched.
CREATE TABLE IF NOT EXISTS plot_pricing (
  project_id TEXT NOT NULL,
  plot_id TEXT NOT NULL,
  pricing_type TEXT NOT NULL DEFAULT 'rate',
  unit TEXT NOT NULL DEFAULT 'sqyd',
  rate REAL,
  fixed_price REAL,
  currency TEXT NOT NULL DEFAULT 'INR',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, plot_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS idx_plot_pricing_project
ON plot_pricing(project_id);
