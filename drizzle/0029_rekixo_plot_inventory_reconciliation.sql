-- Canonical Plot Data inventory reconciliation.
-- Missing rows from a confirmed authoritative sheet become draft-inactive first.
-- They remain available to the currently published customer version until the
-- next Publish Update atomically removes them from live business tables.

ALTER TABLE plots
ADD COLUMN inventory_active INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_plots_project_inventory_active
  ON plots(project_id, inventory_active, id);
