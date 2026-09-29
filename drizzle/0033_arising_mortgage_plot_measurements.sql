-- ARISING_FUTURE_CITY_MORTGAGE_PLOT_MEASUREMENTS_V1
-- Source: user-supplied Arising Future City project export plus sanctioned
-- Peddapur technical layout, reviewed 2026-09-29.
--
-- Scope: plots 1-12 and 123-128 only, exact Arising tenant only.
-- Printed straight-edge dimensions are transcribed directly. Sloped frontage
-- values that are not printed as standalone labels are resolved from the
-- sanctioned dimension chain to the nearest inch:
--   Plot 1 Front 34'4", Plot 1 Depth B 84'7",
--   Plots 2-5 Front 33'7", Plot 6 Front 48'6",
--   Plot 124 Depth B 61'1", Plots 125-128 Back 33'7".
--
-- Safety: project UUID/name/slug/publish-version guards + exact 18-row pre-state
-- guards. No area, road, polygon, status, featured, pricing, gallery, branding,
-- regular-plot, or other-project mutation.

DROP TABLE IF EXISTS _arising_mortgage_target;
CREATE TABLE _arising_mortgage_target (project_id TEXT PRIMARY KEY);
INSERT INTO _arising_mortgage_target(project_id)
SELECT id
FROM projects
WHERE id='74f50880-8adf-4158-bd8c-f65f2b1c718b'
  AND name='Arising Future City'
  AND slug='arising-future-city-74f508'
  AND status='active';

DROP TABLE IF EXISTS _arising_mortgage_target_guard;
CREATE TABLE _arising_mortgage_target_guard (
  present INTEGER NOT NULL CHECK (present IN (0,1)),
  valid INTEGER NOT NULL CHECK (valid=present)
);
INSERT INTO _arising_mortgage_target_guard(present,valid)
SELECT
  (SELECT COUNT(*) FROM projects WHERE id='74f50880-8adf-4158-bd8c-f65f2b1c718b'),
  (SELECT COUNT(*) FROM _arising_mortgage_target);

DROP TABLE IF EXISTS _arising_mortgage_snapshot_guard;
CREATE TABLE _arising_mortgage_snapshot_guard (
  target_count INTEGER NOT NULL CHECK (target_count IN (0,1)),
  n INTEGER NOT NULL CHECK (n=target_count)
);
INSERT INTO _arising_mortgage_snapshot_guard(target_count,n)
SELECT
  (SELECT COUNT(*) FROM _arising_mortgage_target),
  COUNT(*)
FROM projects p
JOIN project_public_snapshots s ON s.project_id=p.id
JOIN _arising_mortgage_target t ON t.project_id=p.id
WHERE p.public_status='published'
  AND p.publish_version=9
  AND s.publish_version=p.publish_version;

DROP TABLE IF EXISTS _arising_mortgage_source;
CREATE TABLE _arising_mortgage_source (
  plot_id TEXT PRIMARY KEY,
  front REAL NOT NULL,
  depth_a REAL NOT NULL,
  back REAL NOT NULL,
  depth_b REAL NOT NULL,
  front_label TEXT NOT NULL,
  depth_a_label TEXT NOT NULL,
  back_label TEXT NOT NULL,
  depth_b_label TEXT NOT NULL,
  side_dimensions TEXT NOT NULL,
  front_edge INTEGER NOT NULL,
  depth_a_edge INTEGER NOT NULL,
  back_edge INTEGER NOT NULL,
  depth_b_edge INTEGER NOT NULL,
  point_count INTEGER NOT NULL
);

INSERT INTO _arising_mortgage_source(
  plot_id,front,depth_a,back,depth_b,
  front_label,depth_a_label,back_label,depth_b_label,side_dimensions,
  front_edge,depth_a_edge,back_edge,depth_b_edge,point_count
) VALUES
  ('1',34.333333,78.166667,33.750000,84.583333,'34''4"','78''2"','33''9"','84''7"','Front 34''4" · Back 33''9" · Depth A 78''2" · Depth B 84''7"',1,2,3,0,4),
  ('2',33.583333,72.000000,33.000000,78.166667,'33''7"','72''','33''','78''2"','Front 33''7" · Back 33'' · Depth A 72'' · Depth B 78''2"',1,2,3,0,4),
  ('3',33.583333,72.000000,33.000000,65.750000,'33''7"','72''','33''','65''9"','Front 33''7" · Back 33'' · Depth A 72'' · Depth B 65''9"',1,0,3,2,4),
  ('4',33.583333,65.750000,33.000000,59.500000,'33''7"','65''9"','33''','59''6"','Front 33''7" · Back 33'' · Depth A 65''9" · Depth B 59''6"',1,0,3,2,4),
  ('5',33.583333,59.500000,33.000000,53.166667,'33''7"','59''6"','33''','53''2"','Front 33''7" · Back 33'' · Depth A 59''6" · Depth B 53''2"',1,0,3,2,4),
  ('6',48.500000,53.166667,47.666667,44.166667,'48''6"','53''2"','47''8"','44''2"','Front 48''6" · Back 47''8" · Depth A 53''2" · Depth B 44''2"',1,0,3,2,4),
  ('7',47.666667,40.000000,47.666667,40.000000,'47''8"','40''','47''8"','40''','Front 47''8" · Back 47''8" · Depth A 40'' · Depth B 40''',1,4,5,0,6),
  ('8',33.000000,40.000000,33.000000,40.000000,'33''','40''','33''','40''','Front 33'' · Back 33'' · Depth A 40'' · Depth B 40''',1,0,3,2,4),
  ('9',33.000000,40.000000,33.000000,40.000000,'33''','40''','33''','40''','Front 33'' · Back 33'' · Depth A 40'' · Depth B 40''',2,1,0,3,4),
  ('10',33.000000,40.000000,33.000000,40.000000,'33''','40''','33''','40''','Front 33'' · Back 33'' · Depth A 40'' · Depth B 40''',2,1,0,3,4),
  ('11',33.000000,40.000000,33.000000,40.000000,'33''','40''','33''','40''','Front 33'' · Back 33'' · Depth A 40'' · Depth B 40''',2,1,0,3,4),
  ('12',33.916667,40.000000,33.750000,40.000000,'33''11"','40''','33''9"','40''','Front 33''11" · Back 33''9" · Depth A 40'' · Depth B 40''',3,2,1,0,4),
  ('123',60.000000,33.000000,60.000000,33.000000,'60''','33''','60''','33''','Front 60'' · Back 60'' · Depth A 33'' · Depth B 33''',1,0,3,2,4),
  ('124',43.583333,60.000000,32.250000,61.083333,'43''7"','60''','32''3"','61''1"','Front 43''7" · Back 32''3" · Depth A 60'' · Depth B 61''1"',2,1,0,3,4),
  ('125',33.000000,59.000000,33.583333,65.250000,'33''','59''','33''7"','65''3"','Front 33'' · Back 33''7" · Depth A 59'' · Depth B 65''3"',2,1,0,3,4),
  ('126',33.000000,52.666667,33.583333,59.000000,'33''','52''8"','33''7"','59''','Front 33'' · Back 33''7" · Depth A 52''8" · Depth B 59''',2,1,0,3,4),
  ('127',33.000000,52.666667,33.583333,46.416667,'33''','52''8"','33''7"','46''5"','Front 33'' · Back 33''7" · Depth A 52''8" · Depth B 46''5"',2,3,0,1,4),
  ('128',33.000000,46.416667,33.583333,40.333333,'33''','46''5"','33''7"','40''4"','Front 33'' · Back 33''7" · Depth A 46''5" · Depth B 40''4"',2,3,0,1,4);

DROP TABLE IF EXISTS _arising_mortgage_source_guard;
CREATE TABLE _arising_mortgage_source_guard (
  target_count INTEGER NOT NULL CHECK (target_count IN (0,1)),
  source_rows INTEGER NOT NULL CHECK (source_rows=18),
  target_rows INTEGER NOT NULL CHECK (target_rows=target_count*18),
  blank_rows INTEGER NOT NULL CHECK (blank_rows=target_count*18),
  polygon_rows INTEGER NOT NULL CHECK (polygon_rows=target_count*18),
  edge_rows INTEGER NOT NULL CHECK (edge_rows=0),
  published_edge_rows INTEGER NOT NULL CHECK (published_edge_rows=0)
);
INSERT INTO _arising_mortgage_source_guard(
  target_count,source_rows,target_rows,blank_rows,polygon_rows,edge_rows,published_edge_rows
)
SELECT
  (SELECT COUNT(*) FROM _arising_mortgage_target),
  (SELECT COUNT(*) FROM _arising_mortgage_source),
  (
    SELECT COUNT(*)
    FROM plots p
    JOIN _arising_mortgage_target t ON t.project_id=p.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=p.id
    WHERE p.inventory_active=1 AND p.dimensions='Irregular'
  ),
  (
    SELECT COUNT(*)
    FROM plots p
    JOIN _arising_mortgage_target t ON t.project_id=p.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=p.id
    WHERE p.front IS NULL AND p.depth IS NULL AND p.back IS NULL AND p.depth2 IS NULL
      AND COALESCE(p.dimension_unit,'')=''
      AND COALESCE(p.front_label,'')='' AND COALESCE(p.depth_label,'')=''
      AND COALESCE(p.back_label,'')='' AND COALESCE(p.depth2_label,'')=''
      AND COALESCE(p.side_dimensions,'')=''
  ),
  (
    SELECT COUNT(*)
    FROM plots p
    JOIN _arising_mortgage_target t ON t.project_id=p.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=p.id
    WHERE json_valid(p.polygon)
      AND json_array_length(p.polygon)=s.point_count
  ),
  (
    SELECT COUNT(*)
    FROM plot_edge_measurements m
    JOIN _arising_mortgage_target t ON t.project_id=m.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=m.plot_id
  ),
  (
    SELECT COUNT(*)
    FROM published_plot_edge_measurements m
    JOIN _arising_mortgage_target t ON t.project_id=m.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=m.plot_id
  );

-- Preserve the user's existing side selections and only complete roles that were
-- missing in the supplied mapper state (11 Back, 12 Depth B, 123 Depth A, 124 Back).
DROP TABLE IF EXISTS _arising_mortgage_edge_guard;
CREATE TABLE _arising_mortgage_edge_guard (
  target_count INTEGER NOT NULL CHECK (target_count IN (0,1)),
  matching_rows INTEGER NOT NULL CHECK (matching_rows=target_count*18)
);
INSERT INTO _arising_mortgage_edge_guard(target_count,matching_rows)
SELECT
  (SELECT COUNT(*) FROM _arising_mortgage_target),
  COUNT(*)
FROM plots p
JOIN _arising_mortgage_target t ON t.project_id=p.project_id
JOIN _arising_mortgage_source s ON s.plot_id=p.id
WHERE p.front_edge_index=s.front_edge
  AND (p.depth_edge_index=s.depth_a_edge OR p.depth_edge_index IS NULL)
  AND (p.back_edge_index=s.back_edge OR p.back_edge_index IS NULL)
  AND (p.depth2_edge_index=s.depth_b_edge OR p.depth2_edge_index IS NULL);

UPDATE plots
SET
  front=(SELECT s.front FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  depth=(SELECT s.depth_a FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  back=(SELECT s.back FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  depth2=(SELECT s.depth_b FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  dimension_unit='ft',
  front_edge_index=(SELECT s.front_edge FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  depth_edge_index=(SELECT s.depth_a_edge FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  back_edge_index=(SELECT s.back_edge FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  depth2_edge_index=(SELECT s.depth_b_edge FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  front_label=(SELECT s.front_label FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  depth_label=(SELECT s.depth_a_label FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  back_label=(SELECT s.back_label FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  depth2_label=(SELECT s.depth_b_label FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  side_dimensions=(SELECT s.side_dimensions FROM _arising_mortgage_source s WHERE s.plot_id=plots.id),
  edge_semantics=(
    SELECT printf(
      '{"version":1,"pointCount":%d,"layout":"four","roles":{"front":[%d],"back":[%d],"depthA":[%d],"depthB":[%d]}}',
      s.point_count,s.front_edge,s.back_edge,s.depth_a_edge,s.depth_b_edge
    )
    FROM _arising_mortgage_source s
    WHERE s.plot_id=plots.id
  ),
  updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _arising_mortgage_target)
  AND id IN (SELECT plot_id FROM _arising_mortgage_source);

INSERT INTO plot_edge_measurements(
  project_id,plot_id,role,segment_index,edge_index,point_count,
  length,unit,raw_label,road_frontage,road_access,
  source_ref,source_raw_text,confidence,verified,updated_at
)
SELECT
  p.project_id,p.id,r.role,0,
  CASE r.role
    WHEN 'front' THEN s.front_edge
    WHEN 'depthA' THEN s.depth_a_edge
    WHEN 'back' THEN s.back_edge
    WHEN 'depthB' THEN s.depth_b_edge
  END,
  s.point_count,
  CASE r.role
    WHEN 'front' THEN s.front
    WHEN 'depthA' THEN s.depth_a
    WHEN 'back' THEN s.back
    WHEN 'depthB' THEN s.depth_b
  END,
  'ft',
  CASE r.role
    WHEN 'front' THEN s.front_label
    WHEN 'depthA' THEN s.depth_a_label
    WHEN 'back' THEN s.back_label
    WHEN 'depthB' THEN s.depth_b_label
  END,
  CASE
    WHEN (p.id IN ('1','2','3','4','5','6') AND r.role='front')
      OR (p.id='124' AND r.role='depthB')
      OR (p.id IN ('125','126','127','128') AND r.role='back')
    THEN 1
    WHEN r.role='front' AND instr(lower(p.road),'road')>0 THEN 1
    ELSE 0
  END,
  p.road,
  'Arising Future City sanctioned Peddapur layout · 2026-09-29',
  CASE
    WHEN (p.id='1' AND r.role IN ('front','depthB'))
      OR (p.id IN ('2','3','4','5','6') AND r.role='front')
      OR (p.id='124' AND r.role='depthB')
      OR (p.id IN ('125','126','127','128') AND r.role='back')
    THEN 'Calculated from adjacent printed sanctioned dimensions and straight sloped boundary; rounded to nearest inch.'
    ELSE 'Printed sanctioned side dimension or exact shared boundary dimension.'
  END,
  CASE
    WHEN (p.id='1' AND r.role IN ('front','depthB'))
      OR (p.id IN ('2','3','4','5','6') AND r.role='front')
      OR (p.id='124' AND r.role='depthB')
      OR (p.id IN ('125','126','127','128') AND r.role='back')
    THEN 'medium' ELSE 'high'
  END,
  CASE
    WHEN (p.id='1' AND r.role IN ('front','depthB'))
      OR (p.id IN ('2','3','4','5','6') AND r.role='front')
      OR (p.id='124' AND r.role='depthB')
      OR (p.id IN ('125','126','127','128') AND r.role='back')
    THEN 0 ELSE 1
  END,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM plots p
JOIN _arising_mortgage_target t ON t.project_id=p.project_id
JOIN _arising_mortgage_source s ON s.plot_id=p.id
CROSS JOIN (
  SELECT 'front' AS role
  UNION ALL SELECT 'depthA'
  UNION ALL SELECT 'back'
  UNION ALL SELECT 'depthB'
) r;

-- Repair the exact currently-published snapshot too, so the customer website
-- receives the measurements immediately without mutating the publish version.
UPDATE published_plots
SET
  front=(SELECT s.front FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  depth=(SELECT s.depth_a FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  back=(SELECT s.back FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  depth2=(SELECT s.depth_b FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  dimension_unit='ft',
  front_edge_index=(SELECT s.front_edge FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  depth_edge_index=(SELECT s.depth_a_edge FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  back_edge_index=(SELECT s.back_edge FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  depth2_edge_index=(SELECT s.depth_b_edge FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  front_label=(SELECT s.front_label FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  depth_label=(SELECT s.depth_a_label FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  back_label=(SELECT s.back_label FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  depth2_label=(SELECT s.depth_b_label FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  side_dimensions=(SELECT s.side_dimensions FROM _arising_mortgage_source s WHERE s.plot_id=published_plots.id),
  edge_semantics=(
    SELECT printf(
      '{"version":1,"pointCount":%d,"layout":"four","roles":{"front":[%d],"back":[%d],"depthA":[%d],"depthB":[%d]}}',
      s.point_count,s.front_edge,s.back_edge,s.depth_a_edge,s.depth_b_edge
    )
    FROM _arising_mortgage_source s
    WHERE s.plot_id=published_plots.id
  )
WHERE project_id IN (SELECT project_id FROM _arising_mortgage_target)
  AND id IN (SELECT plot_id FROM _arising_mortgage_source);

INSERT INTO published_plot_edge_measurements(
  project_id,plot_id,role,segment_index,edge_index,point_count,length,unit,
  raw_label,road_frontage,road_access
)
SELECT
  p.project_id,p.id,r.role,0,
  CASE r.role
    WHEN 'front' THEN s.front_edge
    WHEN 'depthA' THEN s.depth_a_edge
    WHEN 'back' THEN s.back_edge
    WHEN 'depthB' THEN s.depth_b_edge
  END,
  s.point_count,
  CASE r.role
    WHEN 'front' THEN s.front
    WHEN 'depthA' THEN s.depth_a
    WHEN 'back' THEN s.back
    WHEN 'depthB' THEN s.depth_b
  END,
  'ft',
  CASE r.role
    WHEN 'front' THEN s.front_label
    WHEN 'depthA' THEN s.depth_a_label
    WHEN 'back' THEN s.back_label
    WHEN 'depthB' THEN s.depth_b_label
  END,
  CASE
    WHEN (p.id IN ('1','2','3','4','5','6') AND r.role='front')
      OR (p.id='124' AND r.role='depthB')
      OR (p.id IN ('125','126','127','128') AND r.role='back')
    THEN 1
    WHEN r.role='front' AND instr(lower(p.road),'road')>0 THEN 1
    ELSE 0
  END,
  p.road
FROM published_plots p
JOIN _arising_mortgage_target t ON t.project_id=p.project_id
JOIN _arising_mortgage_source s ON s.plot_id=p.id
CROSS JOIN (
  SELECT 'front' AS role
  UNION ALL SELECT 'depthA'
  UNION ALL SELECT 'back'
  UNION ALL SELECT 'depthB'
) r;

DROP TABLE IF EXISTS _arising_mortgage_post_guard;
CREATE TABLE _arising_mortgage_post_guard (
  target_count INTEGER NOT NULL CHECK (target_count IN (0,1)),
  draft_plots INTEGER NOT NULL CHECK (draft_plots=target_count*18),
  published_plots INTEGER NOT NULL CHECK (published_plots=target_count*18),
  draft_edges INTEGER NOT NULL CHECK (draft_edges=target_count*72),
  published_edges INTEGER NOT NULL CHECK (published_edges=target_count*72),
  plot1 INTEGER NOT NULL CHECK (plot1=target_count),
  plot124 INTEGER NOT NULL CHECK (plot124=target_count)
);
INSERT INTO _arising_mortgage_post_guard(
  target_count,draft_plots,published_plots,draft_edges,published_edges,plot1,plot124
)
SELECT
  (SELECT COUNT(*) FROM _arising_mortgage_target),
  (
    SELECT COUNT(*)
    FROM plots p
    JOIN _arising_mortgage_target t ON t.project_id=p.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=p.id
    WHERE p.front=s.front AND p.depth=s.depth_a AND p.back=s.back AND p.depth2=s.depth_b
      AND p.dimension_unit='ft'
      AND p.front_label=s.front_label AND p.depth_label=s.depth_a_label
      AND p.back_label=s.back_label AND p.depth2_label=s.depth_b_label
      AND p.front_edge_index=s.front_edge AND p.depth_edge_index=s.depth_a_edge
      AND p.back_edge_index=s.back_edge AND p.depth2_edge_index=s.depth_b_edge
  ),
  (
    SELECT COUNT(*)
    FROM published_plots p
    JOIN _arising_mortgage_target t ON t.project_id=p.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=p.id
    WHERE p.front=s.front AND p.depth=s.depth_a AND p.back=s.back AND p.depth2=s.depth_b
      AND p.dimension_unit='ft'
      AND p.front_label=s.front_label AND p.depth_label=s.depth_a_label
      AND p.back_label=s.back_label AND p.depth2_label=s.depth_b_label
      AND p.front_edge_index=s.front_edge AND p.depth_edge_index=s.depth_a_edge
      AND p.back_edge_index=s.back_edge AND p.depth2_edge_index=s.depth_b_edge
  ),
  (
    SELECT COUNT(*) FROM plot_edge_measurements m
    JOIN _arising_mortgage_target t ON t.project_id=m.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=m.plot_id
  ),
  (
    SELECT COUNT(*) FROM published_plot_edge_measurements m
    JOIN _arising_mortgage_target t ON t.project_id=m.project_id
    JOIN _arising_mortgage_source s ON s.plot_id=m.plot_id
  ),
  (
    SELECT COUNT(*) FROM plots p
    JOIN _arising_mortgage_target t ON t.project_id=p.project_id
    WHERE p.id='1'
      AND p.front_label='34''4"' AND p.back_label='33''9"'
      AND p.depth_label='78''2"' AND p.depth2_label='84''7"'
  ),
  (
    SELECT COUNT(*) FROM plots p
    JOIN _arising_mortgage_target t ON t.project_id=p.project_id
    WHERE p.id='124'
      AND p.front_label='43''7"' AND p.back_label='32''3"'
      AND p.depth_label='60''' AND p.depth2_label='61''1"'
  );

DROP TABLE IF EXISTS _arising_mortgage_post_guard;
DROP TABLE IF EXISTS _arising_mortgage_edge_guard;
DROP TABLE IF EXISTS _arising_mortgage_source_guard;
DROP TABLE IF EXISTS _arising_mortgage_source;
DROP TABLE IF EXISTS _arising_mortgage_snapshot_guard;
DROP TABLE IF EXISTS _arising_mortgage_target_guard;
DROP TABLE IF EXISTS _arising_mortgage_target;
