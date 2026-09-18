-- Project-scoped public Geo camera orientation.
-- Missing rows stay backward compatible: north-up GIS view.
-- Arising Future City uses a website-style masterplan-aligned presentation view.
INSERT INTO settings (project_id, key, value, updated_at)
SELECT id, 'geoPublicViewMode', 'masterplan', datetime('now')
FROM projects
WHERE status != 'deleted'
  AND lower(trim(name)) = 'arising future city'
ON CONFLICT(project_id, key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
