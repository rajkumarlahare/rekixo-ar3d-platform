-- Preserve the historical public-data plot response shape after publish snapshots.
-- 0027 was already applied in production before this compatibility hotfix, so
-- this stays additive and backfills the published rows in place.

ALTER TABLE published_plots ADD COLUMN updated_at TEXT;

UPDATE published_plots
SET updated_at = (
  SELECT p.updated_at
  FROM plots p
  WHERE p.project_id = published_plots.project_id
    AND p.id = published_plots.id
  LIMIT 1
)
WHERE updated_at IS NULL;
