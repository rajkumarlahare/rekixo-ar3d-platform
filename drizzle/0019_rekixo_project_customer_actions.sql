-- Project-scoped public customer actions use the existing settings table.
-- Backward-compatible behavior is ON when a setting row is absent.
-- VATIKA GREEN CITY VISTAR is the one current project that must launch with calling disabled.
INSERT INTO settings (project_id, key, value, updated_at)
SELECT id, 'customerCallEnabled', '0', datetime('now')
FROM projects
WHERE status != 'deleted'
  AND (
    lower(trim(name)) = 'vatika green city vistar'
    OR lower(trim(slug)) = 'vatika-green-city-vistar'
  )
ON CONFLICT(project_id, key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
