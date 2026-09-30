-- TJ_LANDS_16_PLOT_REVISION_V1
-- Customer-approved revision, 2026-09-30:
--   * same 2048x1152 masterplan coordinate system
--   * old Plot 1 split into new Plot 1 + Plot 2
--   * new Plot 1 = 20 ft x 20 ft = 400 sq.ft
--   * new Plot 2 = 20 ft x 20 ft = 400 sq.ft
--   * old Plots 2..15 become new Plots 3..16 with geometry/status preserved
--
-- Safety:
--   * exact TJ Lands UUID/name/slug + published-v10 snapshot guard
--   * exact 15-row draft inventory guard from the 2026-09-30 Super Admin export
--   * exact old Plot 1 geometry guard
--   * old Plot 1 must have no pricing/measurement/Geo linkage because splitting
--     those business records would be ambiguous
--   * published_* tables are intentionally NOT touched: live customer v10 stays
--     intact until Super Admin reviews 16/16 draft plots and clicks Publish Update
--   * all statements are project-scoped; other customer projects are untouched

DROP TABLE IF EXISTS _tj16_target;
CREATE TABLE _tj16_target (project_id TEXT PRIMARY KEY);
INSERT INTO _tj16_target(project_id)
SELECT id
FROM projects
WHERE id='43f33923-aa5d-4631-82ba-00cb8cfe4004'
  AND name='TJ Lands'
  AND slug='tj-lands-43f339'
  AND kind='customer'
  AND status='active'
  AND public_status='published'
  AND publish_version=10;

DROP TABLE IF EXISTS _tj16_target_guard;
CREATE TABLE _tj16_target_guard (
  present INTEGER NOT NULL CHECK (present IN (0,1)),
  valid INTEGER NOT NULL CHECK (valid=present)
);
INSERT INTO _tj16_target_guard(present,valid)
SELECT
  (SELECT COUNT(*) FROM projects WHERE id='43f33923-aa5d-4631-82ba-00cb8cfe4004'),
  (SELECT COUNT(*) FROM _tj16_target);

DROP TABLE IF EXISTS _tj16_snapshot_guard;
CREATE TABLE _tj16_snapshot_guard (
  target_count INTEGER NOT NULL CHECK (target_count IN (0,1)),
  snapshot_ok INTEGER NOT NULL CHECK (snapshot_ok=target_count),
  published_rows INTEGER NOT NULL CHECK (published_rows=target_count*15)
);
INSERT INTO _tj16_snapshot_guard(target_count,snapshot_ok,published_rows)
SELECT
  (SELECT COUNT(*) FROM _tj16_target),
  (
    SELECT COUNT(*)
    FROM project_public_snapshots s
    JOIN _tj16_target t ON t.project_id=s.project_id
    WHERE s.publish_version=10
      AND s.project_name='TJ Lands'
  ),
  (
    SELECT COUNT(*)
    FROM published_plots p
    JOIN _tj16_target t ON t.project_id=p.project_id
  );

DROP TABLE IF EXISTS _tj16_settings_guard;
CREATE TABLE _tj16_settings_guard (
  target_count INTEGER NOT NULL CHECK (target_count IN (0,1)),
  map_width INTEGER NOT NULL CHECK (map_width=target_count),
  map_height INTEGER NOT NULL CHECK (map_height=target_count),
  sheet_count INTEGER NOT NULL CHECK (sheet_count=target_count),
  directions INTEGER NOT NULL CHECK (directions=target_count)
);
INSERT INTO _tj16_settings_guard(target_count,map_width,map_height,sheet_count,directions)
SELECT
  (SELECT COUNT(*) FROM _tj16_target),
  (
    SELECT COUNT(*) FROM settings s JOIN _tj16_target t ON t.project_id=s.project_id
    WHERE s.key='mapWidth' AND s.value='2048'
  ),
  (
    SELECT COUNT(*) FROM settings s JOIN _tj16_target t ON t.project_id=s.project_id
    WHERE s.key='mapHeight' AND s.value='1152'
  ),
  (
    SELECT COUNT(*) FROM settings s JOIN _tj16_target t ON t.project_id=s.project_id
    WHERE s.key='plotSheetCount' AND s.value='15'
  ),
  (
    SELECT COUNT(*) FROM settings s JOIN _tj16_target t ON t.project_id=s.project_id
    WHERE s.key='plotFrontDirections'
      AND s.value='{"1":"left","2":"right","3":"right","4":"left","5":"left","6":"left","7":"right","8":"right","9":"right","10":"right","11":"left","12":"left","13":"left","14":"left","15":"left"}'
  );

DROP TABLE IF EXISTS _tj16_inventory_guard;
CREATE TABLE _tj16_inventory_guard (
  target_count INTEGER NOT NULL CHECK (target_count IN (0,1)),
  total_rows INTEGER NOT NULL CHECK (total_rows=target_count*15),
  active_rows INTEGER NOT NULL CHECK (active_rows=target_count*15),
  canonical_ids INTEGER NOT NULL CHECK (canonical_ids=target_count*15),
  plot1_exact INTEGER NOT NULL CHECK (plot1_exact=target_count),
  plot1_ambiguous_refs INTEGER NOT NULL CHECK (plot1_ambiguous_refs=0),
  temp_refs INTEGER NOT NULL CHECK (temp_refs=0)
);
INSERT INTO _tj16_inventory_guard(
  target_count,total_rows,active_rows,canonical_ids,plot1_exact,
  plot1_ambiguous_refs,temp_refs
)
SELECT
  (SELECT COUNT(*) FROM _tj16_target),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
  ),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.inventory_active=1
  ),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.inventory_active=1
      AND p.id IN ('1','2','3','4','5','6','7','8','9','10','11','12','13','14','15')
  ),
  (
    SELECT COUNT(*)
    FROM plots p
    JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.id='1'
      AND p.inventory_active=1
      AND p.status='available'
      AND p.sqft=2600
      AND p.dimensions='40 ft x 65 ft'
      AND json_valid(p.polygon)
      AND json_array_length(p.polygon)=4
      AND abs(CAST(json_extract(p.polygon,'$[0][0]') AS REAL)-0.23564687498348394)<0.00000001
      AND abs(CAST(json_extract(p.polygon,'$[0][1]') AS REAL)-0.5250539476527681)<0.00000001
      AND abs(CAST(json_extract(p.polygon,'$[1][0]') AS REAL)-0.1603300747495283)<0.00000001
      AND abs(CAST(json_extract(p.polygon,'$[1][1]') AS REAL)-0.4803549113504609)<0.00000001
      AND abs(CAST(json_extract(p.polygon,'$[2][0]') AS REAL)-0.15942807714193602)<0.00000001
      AND abs(CAST(json_extract(p.polygon,'$[2][1]') AS REAL)-0.30376365134000016)<0.00000001
      AND abs(CAST(json_extract(p.polygon,'$[3][0]') AS REAL)-0.23463212767494263)<0.00000001
      AND abs(CAST(json_extract(p.polygon,'$[3][1]') AS REAL)-0.30256098668612647)<0.00000001
  ),
  (
    SELECT
      (SELECT COUNT(*) FROM plot_pricing pr JOIN _tj16_target t ON t.project_id=pr.project_id WHERE pr.plot_id='1')
      +
      (SELECT COUNT(*) FROM plot_edge_measurements m JOIN _tj16_target t ON t.project_id=m.project_id WHERE m.plot_id='1')
      +
      (SELECT COUNT(*) FROM geo_features g JOIN _tj16_target t ON t.project_id=g.project_id WHERE g.linked_plot_id='1')
  ),
  (
    SELECT
      (SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id WHERE p.id LIKE '__tj16_%')
      +
      (SELECT COUNT(*) FROM plot_pricing pr JOIN _tj16_target t ON t.project_id=pr.project_id WHERE pr.plot_id LIKE '__tj16_%')
      +
      (SELECT COUNT(*) FROM plot_edge_measurements m JOIN _tj16_target t ON t.project_id=m.project_id WHERE m.plot_id LIKE '__tj16_%')
      +
      (SELECT COUNT(*) FROM geo_features g JOIN _tj16_target t ON t.project_id=g.project_id WHERE g.linked_plot_id LIKE '__tj16_%')
  );

-- Preserve any future pricing/measurement/Geo references on old Plots 2..15
-- by moving them together with the physical plot. Plot 1 is guarded to have
-- no such ambiguous linked business rows before its split.
UPDATE plot_pricing
SET plot_id='__tj16_'||plot_id
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND CAST(plot_id AS INTEGER) BETWEEN 2 AND 15
  AND plot_id=CAST(CAST(plot_id AS INTEGER) AS TEXT);

UPDATE plot_edge_measurements
SET plot_id='__tj16_'||plot_id
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND CAST(plot_id AS INTEGER) BETWEEN 2 AND 15
  AND plot_id=CAST(CAST(plot_id AS INTEGER) AS TEXT);

UPDATE geo_features
SET linked_plot_id='__tj16_'||linked_plot_id,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND linked_plot_id IS NOT NULL
  AND CAST(linked_plot_id AS INTEGER) BETWEEN 2 AND 15
  AND linked_plot_id=CAST(CAST(linked_plot_id AS INTEGER) AS TEXT);

UPDATE plots
SET id='__tj16_'||id,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND CAST(id AS INTEGER) BETWEEN 2 AND 15
  AND id=CAST(CAST(id AS INTEGER) AS TEXT);

UPDATE plots
SET id=CAST(CAST(substr(id,8) AS INTEGER)+1 AS TEXT),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND id LIKE '__tj16_%';

UPDATE plot_pricing
SET plot_id=CAST(CAST(substr(plot_id,8) AS INTEGER)+1 AS TEXT),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND plot_id LIKE '__tj16_%';

UPDATE plot_edge_measurements
SET plot_id=CAST(CAST(substr(plot_id,8) AS INTEGER)+1 AS TEXT),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND plot_id LIKE '__tj16_%';

UPDATE geo_features
SET linked_plot_id=CAST(CAST(substr(linked_plot_id,8) AS INTEGER)+1 AS TEXT),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND linked_plot_id LIKE '__tj16_%';

-- Split the exact old Plot 1 outer polygon at the new sanctioned/masterplan
-- divider visible at y ~= 475.5 px on the unchanged 2048x1152 coordinate system.
-- Intersection points are on the original left/right boundaries, so there are
-- no overlaps or gaps between the two new polygons.
UPDATE plots
SET
  sqft=400,
  sqm=37.16125196257862,
  sqyd=44.444487455290364,
  dimensions='20 ft x 20 ft',
  road='Internal Road',
  front=20,
  depth=20,
  back=20,
  depth2=20,
  dimension_unit='ft',
  front_edge_index=1,
  depth_edge_index=2,
  back_edge_index=3,
  depth2_edge_index=0,
  front_label='20 ft',
  depth_label='20 ft',
  back_label='20 ft',
  depth2_label='20 ft',
  side_dimensions='Front 20 ft · Back 20 ft · Depth A 20 ft · Depth B 20 ft',
  edge_semantics='{"version":1,"pointCount":4,"layout":"four","roles":{"front":[1],"back":[3],"depthA":[2],"depthB":[0]}}',
  polygon='[[0.23513472593463455,0.4127604166666667],[0.15998481376386242,0.4127604166666667],[0.15942807714193602,0.30376365134000016],[0.23463212767494263,0.30256098668612647]]',
  status='available',
  notes='20 x 20 ft',
  featured=0,
  inventory_active=1,
  updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND id='1';

INSERT INTO plots (
  project_id,id,sqft,sqm,sqyd,dimensions,road,
  front,depth,back,depth2,dimension_unit,
  front_edge_index,depth_edge_index,back_edge_index,depth2_edge_index,
  front_label,depth_label,back_label,depth2_label,side_dimensions,edge_semantics,
  polygon,status,notes,featured,inventory_active,updated_at
)
SELECT
  t.project_id,
  '2',
  400,
  37.16125196257862,
  44.444487455290364,
  '20 ft x 20 ft',
  'Internal Road',
  20,20,20,20,'ft',
  1,2,3,0,
  '20 ft','20 ft','20 ft','20 ft',
  'Front 20 ft · Back 20 ft · Depth A 20 ft · Depth B 20 ft',
  '{"version":1,"pointCount":4,"layout":"four","roles":{"front":[1],"back":[3],"depthA":[2],"depthB":[0]}}',
  '[[0.23564687498348394,0.5250539476527681],[0.1603300747495283,0.4803549113504609],[0.15998481376386242,0.4127604166666667],[0.23513472593463455,0.4127604166666667]]',
  'available',
  '20 x 20 ft',
  0,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _tj16_target t;

-- Mapper helper metadata follows the new physical numbering.
UPDATE settings
SET value='{"1":"left","2":"left","3":"right","4":"right","5":"left","6":"left","7":"left","8":"right","9":"right","10":"right","11":"right","12":"left","13":"left","14":"left","15":"left","16":"left"}',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND key='plotFrontDirections';

UPDATE settings
SET value='16',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _tj16_target)
  AND key='plotSheetCount';

DROP TABLE IF EXISTS _tj16_post_guard;
CREATE TABLE _tj16_post_guard (
  target_count INTEGER NOT NULL CHECK (target_count IN (0,1)),
  total_rows INTEGER NOT NULL CHECK (total_rows=target_count*16),
  active_rows INTEGER NOT NULL CHECK (active_rows=target_count*16),
  canonical_ids INTEGER NOT NULL CHECK (canonical_ids=target_count*16),
  plot1 INTEGER NOT NULL CHECK (plot1=target_count),
  plot2 INTEGER NOT NULL CHECK (plot2=target_count),
  plot3_shifted INTEGER NOT NULL CHECK (plot3_shifted=target_count),
  plot16_shifted INTEGER NOT NULL CHECK (plot16_shifted=target_count),
  settings_ok INTEGER NOT NULL CHECK (settings_ok=target_count*2),
  live_snapshot_untouched INTEGER NOT NULL CHECK (live_snapshot_untouched=target_count*15)
);
INSERT INTO _tj16_post_guard(
  target_count,total_rows,active_rows,canonical_ids,plot1,plot2,
  plot3_shifted,plot16_shifted,settings_ok,live_snapshot_untouched
)
SELECT
  (SELECT COUNT(*) FROM _tj16_target),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
  ),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.inventory_active=1
  ),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.inventory_active=1
      AND CAST(p.id AS INTEGER) BETWEEN 1 AND 16
      AND p.id=CAST(CAST(p.id AS INTEGER) AS TEXT)
  ),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.id='1'
      AND p.sqft=400
      AND p.dimensions='20 ft x 20 ft'
      AND p.front=20 AND p.back=20 AND p.depth=20 AND p.depth2=20
      AND p.front_edge_index=1 AND p.depth_edge_index=2
      AND p.back_edge_index=3 AND p.depth2_edge_index=0
      AND json_array_length(p.polygon)=4
  ),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.id='2'
      AND p.sqft=400
      AND p.dimensions='20 ft x 20 ft'
      AND p.front=20 AND p.back=20 AND p.depth=20 AND p.depth2=20
      AND p.front_edge_index=1 AND p.depth_edge_index=2
      AND p.back_edge_index=3 AND p.depth2_edge_index=0
      AND json_array_length(p.polygon)=4
  ),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.id='3'
      AND p.sqft=900
      AND p.dimensions='30 ft x 30 ft'
      AND p.polygon='[[0.2954042164864727,0.41320613484251045],[0.2958552152902688,0.5220472860180838],[0.23993136361954728,0.5204437331462521],[0.23948036481575113,0.41480968771434207]]'
  ),
  (
    SELECT COUNT(*) FROM plots p JOIN _tj16_target t ON t.project_id=p.project_id
    WHERE p.id='16'
      AND p.sqft=1800
      AND p.dimensions='30 ft x 60 ft'
      AND p.polygon='[[0.6467322846436669,0.29654766341675776],[0.647070533746514,0.4037852617204995],[0.765006720939205,0.4017808206307099],[0.7643302227335108,0.29514455465390504]]'
  ),
  (
    SELECT COUNT(*) FROM settings s JOIN _tj16_target t ON t.project_id=s.project_id
    WHERE (s.key='plotSheetCount' AND s.value='16')
       OR (
         s.key='plotFrontDirections'
         AND s.value='{"1":"left","2":"left","3":"right","4":"right","5":"left","6":"left","7":"left","8":"right","9":"right","10":"right","11":"right","12":"left","13":"left","14":"left","15":"left","16":"left"}'
       )
  ),
  (
    SELECT COUNT(*) FROM published_plots p JOIN _tj16_target t ON t.project_id=p.project_id
  );

DROP TABLE IF EXISTS _tj16_post_guard;
DROP TABLE IF EXISTS _tj16_inventory_guard;
DROP TABLE IF EXISTS _tj16_settings_guard;
DROP TABLE IF EXISTS _tj16_snapshot_guard;
DROP TABLE IF EXISTS _tj16_target_guard;
DROP TABLE IF EXISTS _tj16_target;
