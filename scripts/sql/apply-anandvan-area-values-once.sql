-- One-time production data correction based on user-approved workbook.
-- Applied only from the production deploy workflow (not as a schema migration).
-- The workbook supplies Sq.Ft and Sq.M; Sq.Yd is computed from Sq.Ft / 9.
-- Only area fields are changed for the 47 source IDs. Shop IDs and all non-area fields stay unchanged.

DROP TABLE IF EXISTS _anandvan_area_migration_guard;
CREATE TABLE _anandvan_area_migration_guard (
  ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO _anandvan_area_migration_guard(ok)
SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM settings s
    WHERE s.project_id=(SELECT id FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active' LIMIT 1)
      AND s.key='anandvanAreaWorkbookCorrectionV1' AND s.value='ANANDVAN CITY SOUTH BLOCK.xlsx:v1'
  ) THEN 1
  WHEN (SELECT COUNT(*) FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active') = 1
   AND (SELECT COUNT(*) FROM plots
        WHERE project_id=(SELECT id FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active' LIMIT 1)
          AND inventory_active=1 AND id IN ('1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','E-20','E-21','E-22','E-23','24','L-25','L-26','L-27','L-28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47')) = 47
   AND (SELECT COUNT(*) FROM published_plots
        WHERE project_id=(SELECT id FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active' LIMIT 1)
          AND id IN ('1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','E-20','E-21','E-22','E-23','24','L-25','L-26','L-27','L-28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47')) = 47
  THEN 1
  ELSE 0
END;
DROP TABLE _anandvan_area_migration_guard;

-- Set the project-specific conversion policy. Skip after the one-time marker is present.
INSERT INTO settings (project_id,key,value,updated_at)
SELECT id,'sqmToSqftFactor','10.76',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active'
  AND NOT EXISTS (
    SELECT 1 FROM settings s WHERE s.project_id=projects.id AND s.key='anandvanAreaWorkbookCorrectionV1' AND s.value='ANANDVAN CITY SOUTH BLOCK.xlsx:v1'
  )
ON CONFLICT(project_id,key) DO UPDATE SET
  value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO published_settings (project_id,key,value)
SELECT id,'sqmToSqftFactor','10.76'
FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active'
  AND NOT EXISTS (
    SELECT 1 FROM settings s WHERE s.project_id=projects.id AND s.key='anandvanAreaWorkbookCorrectionV1' AND s.value='ANANDVAN CITY SOUTH BLOCK.xlsx:v1'
  )
ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value;

WITH correction(id,sqft,sqm,sqyd) AS (VALUES
    ('1', 997.42, 92.69, 110.824),
    ('2', 1347.60, 125.22, 149.733),
    ('3', 1234.29, 114.71, 137.143),
    ('4', 1168.59, 108.60, 129.843),
    ('5', 1115.38, 103.66, 123.931),
    ('6', 1066.32, 99.10, 118.480),
    ('7', 1382.17, 128.45, 153.574),
    ('8', 1092.34, 101.51, 121.371),
    ('9', 900, 83.64, 100.000),
    ('10', 900, 83.64, 100.000),
    ('11', 900, 83.64, 100.000),
    ('12', 900, 83.64, 100.000),
    ('13', 900, 83.64, 100.000),
    ('14', 1350, 125.46, 150.000),
    ('15', 900, 83.64, 100.000),
    ('16', 1350, 125.46, 150.000),
    ('17', 700, 65.06, 77.778),
    ('18', 700, 65.06, 77.778),
    ('19', 700, 65.06, 77.778),
    ('E-20', 525, 48.79, 58.333),
    ('E-21', 525, 48.79, 58.333),
    ('E-22', 525, 48.79, 58.333),
    ('E-23', 520.99, 48.41, 57.888),
    ('24', 1086.62, 100.98, 120.736),
    ('L-25', 800, 74.35, 88.889),
    ('L-26', 800, 74.35, 88.889),
    ('L-27', 800, 74.35, 88.889),
    ('L-28', 1000, 92.94, 111.111),
    ('29', 1350, 125.46, 150.000),
    ('30', 900, 83.64, 100.000),
    ('31', 1350, 125.46, 150.000),
    ('32', 1000, 92.94, 111.111),
    ('33', 800, 74.35, 88.889),
    ('34', 800, 74.35, 88.889),
    ('35', 800, 74.35, 88.889),
    ('36', 886, 82.34, 98.444),
    ('37', 1500, 139.41, 166.667),
    ('38', 1500, 139.41, 166.667),
    ('39', 1500, 139.41, 166.667),
    ('40', 1500, 139.41, 166.667),
    ('41', 1500, 139.41, 166.667),
    ('42', 1500, 139.41, 166.667),
    ('43', 1500, 139.41, 166.667),
    ('44', 1500, 139.41, 166.667),
    ('45', 1500, 139.41, 166.667),
    ('46', 1500, 139.41, 166.667),
    ('47', 1500, 139.41, 166.667)
)
UPDATE plots
SET sqft=(SELECT sqft FROM correction WHERE correction.id=plots.id),
    sqm=(SELECT sqm FROM correction WHERE correction.id=plots.id),
    sqyd=(SELECT sqyd FROM correction WHERE correction.id=plots.id),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id=(SELECT id FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active' LIMIT 1)
  AND inventory_active=1
  AND id IN (SELECT id FROM correction)
  AND NOT EXISTS (
    SELECT 1 FROM settings s WHERE s.project_id=plots.project_id AND s.key='anandvanAreaWorkbookCorrectionV1' AND s.value='ANANDVAN CITY SOUTH BLOCK.xlsx:v1'
  );

WITH correction(id,sqft,sqm,sqyd) AS (VALUES
    ('1', 997.42, 92.69, 110.824),
    ('2', 1347.60, 125.22, 149.733),
    ('3', 1234.29, 114.71, 137.143),
    ('4', 1168.59, 108.60, 129.843),
    ('5', 1115.38, 103.66, 123.931),
    ('6', 1066.32, 99.10, 118.480),
    ('7', 1382.17, 128.45, 153.574),
    ('8', 1092.34, 101.51, 121.371),
    ('9', 900, 83.64, 100.000),
    ('10', 900, 83.64, 100.000),
    ('11', 900, 83.64, 100.000),
    ('12', 900, 83.64, 100.000),
    ('13', 900, 83.64, 100.000),
    ('14', 1350, 125.46, 150.000),
    ('15', 900, 83.64, 100.000),
    ('16', 1350, 125.46, 150.000),
    ('17', 700, 65.06, 77.778),
    ('18', 700, 65.06, 77.778),
    ('19', 700, 65.06, 77.778),
    ('E-20', 525, 48.79, 58.333),
    ('E-21', 525, 48.79, 58.333),
    ('E-22', 525, 48.79, 58.333),
    ('E-23', 520.99, 48.41, 57.888),
    ('24', 1086.62, 100.98, 120.736),
    ('L-25', 800, 74.35, 88.889),
    ('L-26', 800, 74.35, 88.889),
    ('L-27', 800, 74.35, 88.889),
    ('L-28', 1000, 92.94, 111.111),
    ('29', 1350, 125.46, 150.000),
    ('30', 900, 83.64, 100.000),
    ('31', 1350, 125.46, 150.000),
    ('32', 1000, 92.94, 111.111),
    ('33', 800, 74.35, 88.889),
    ('34', 800, 74.35, 88.889),
    ('35', 800, 74.35, 88.889),
    ('36', 886, 82.34, 98.444),
    ('37', 1500, 139.41, 166.667),
    ('38', 1500, 139.41, 166.667),
    ('39', 1500, 139.41, 166.667),
    ('40', 1500, 139.41, 166.667),
    ('41', 1500, 139.41, 166.667),
    ('42', 1500, 139.41, 166.667),
    ('43', 1500, 139.41, 166.667),
    ('44', 1500, 139.41, 166.667),
    ('45', 1500, 139.41, 166.667),
    ('46', 1500, 139.41, 166.667),
    ('47', 1500, 139.41, 166.667)
)
UPDATE published_plots
SET sqft=(SELECT sqft FROM correction WHERE correction.id=published_plots.id),
    sqm=(SELECT sqm FROM correction WHERE correction.id=published_plots.id),
    sqyd=(SELECT sqyd FROM correction WHERE correction.id=published_plots.id),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id=(SELECT id FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active' LIMIT 1)
  AND id IN (SELECT id FROM correction)
  AND NOT EXISTS (
    SELECT 1 FROM settings s WHERE s.project_id=published_plots.project_id AND s.key='anandvanAreaWorkbookCorrectionV1' AND s.value='ANANDVAN CITY SOUTH BLOCK.xlsx:v1'
  );

-- Mark only after every area update is complete; rerunning later is a no-op.
INSERT INTO settings (project_id,key,value,updated_at)
SELECT id,'anandvanAreaWorkbookCorrectionV1','ANANDVAN CITY SOUTH BLOCK.xlsx:v1',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM projects WHERE slug='anandvan-city-south-block-2ee1a1' AND lower(trim(name))='anandvan city south block' AND status='active'
  AND NOT EXISTS (
    SELECT 1 FROM settings s WHERE s.project_id=projects.id AND s.key='anandvanAreaWorkbookCorrectionV1' AND s.value='ANANDVAN CITY SOUTH BLOCK.xlsx:v1'
  )
ON CONFLICT(project_id,key) DO NOTHING;
