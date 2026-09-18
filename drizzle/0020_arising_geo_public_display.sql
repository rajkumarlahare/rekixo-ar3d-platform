-- Project-scoped public Geo display policy.
-- Backward-compatible defaults stay ON when these rows are absent.
-- Arising Future City alone launches with plot interaction and availability legend hidden.
INSERT INTO settings (project_id, key, value, updated_at)
SELECT id, 'geoPublicPlotClicks', '0', datetime('now')
FROM projects
WHERE status != 'deleted'
  AND lower(trim(name)) = 'arising future city'
ON CONFLICT(project_id, key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

INSERT INTO settings (project_id, key, value, updated_at)
SELECT id, 'geoPublicShowLegend', '0', datetime('now')
FROM projects
WHERE status != 'deleted'
  AND lower(trim(name)) = 'arising future city'
ON CONFLICT(project_id, key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
