-- Project-scoped public Geo polygon visibility.
-- Backward-compatible default remains ON when the setting row is absent.
-- Arising Future City launches with generated Geo plot outlines hidden because
-- its promoted masterplan artwork already contains the full plot drawing.
INSERT INTO settings (project_id, key, value, updated_at)
SELECT id, 'geoPublicShowPolygons', '0', datetime('now')
FROM projects
WHERE status != 'deleted'
  AND lower(trim(name)) = 'arising future city'
ON CONFLICT(project_id, key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;

-- Safety: hidden public polygons must not leave plot detail interaction enabled.
INSERT INTO settings (project_id, key, value, updated_at)
SELECT id, 'geoPublicPlotClicks', '0', datetime('now')
FROM projects
WHERE status != 'deleted'
  AND lower(trim(name)) = 'arising future city'
ON CONFLICT(project_id, key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
