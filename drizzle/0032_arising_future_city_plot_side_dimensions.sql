-- ARISING_FUTURE_CITY_PLOT_SIDE_DIMENSIONS_V1
-- Source: user-supplied Rekixo project asset export + sanctioned Peddapur layout,
-- reviewed 2026-09-29.
--
-- Safety: exact tenant UUID/name/slug + publish-version guards; exact 128/110/18
-- inventory guards; fail-closed pre-state checks; no area, road, polygon, status,
-- featured, pricing, gallery, or other-project mutation.
--
-- Only the 110 regular quadrilateral plots are repaired automatically. Plots
-- 1-12 and 123-128 are irregular and intentionally remain untouched until their
-- four exact side lengths are source-verified; no geometry-derived guesses.

DROP TABLE IF EXISTS _arising_target;
CREATE TABLE _arising_target (project_id TEXT PRIMARY KEY);
INSERT INTO _arising_target(project_id)
SELECT id
FROM projects
WHERE id='74f50880-8adf-4158-bd8c-f65f2b1c718b'
  AND name='Arising Future City'
  AND slug='arising-future-city-74f508'
  AND status='active';

DROP TABLE IF EXISTS _arising_target_guard;
CREATE TABLE _arising_target_guard (n INTEGER NOT NULL CHECK (n=1));
INSERT INTO _arising_target_guard(n) SELECT COUNT(*) FROM _arising_target;

DROP TABLE IF EXISTS _arising_snapshot_guard;
CREATE TABLE _arising_snapshot_guard (n INTEGER NOT NULL CHECK (n=1));
INSERT INTO _arising_snapshot_guard(n)
SELECT COUNT(*)
FROM projects p
JOIN project_public_snapshots s ON s.project_id=p.id
JOIN _arising_target t ON t.project_id=p.id
WHERE p.public_status='published'
  AND p.publish_version=9
  AND s.publish_version=p.publish_version;

DROP TABLE IF EXISTS _arising_inventory_guard;
CREATE TABLE _arising_inventory_guard (
  total INTEGER NOT NULL CHECK (total=128),
  regular INTEGER NOT NULL CHECK (regular=110),
  irregular INTEGER NOT NULL CHECK (irregular=18),
  blank_measurements INTEGER NOT NULL CHECK (blank_measurements=110),
  plot68_expected INTEGER NOT NULL CHECK (plot68_expected=1),
  other_regular_edges_safe INTEGER NOT NULL CHECK (other_regular_edges_safe=109)
);
INSERT INTO _arising_inventory_guard(
  total,regular,irregular,blank_measurements,plot68_expected,other_regular_edges_safe
)
SELECT
  COUNT(*),
  SUM(CASE WHEN dimensions IN (
    '33'' x 40''','33'' x 45''','33'' x 43''6"',
    '47''8" x 40''','47''8" x 45''','47''8" x 43''6"',
    '60'' x 40''','60'' x 45''','60'' x 43''6"'
  ) THEN 1 ELSE 0 END),
  SUM(CASE WHEN dimensions='Irregular' THEN 1 ELSE 0 END),
  SUM(CASE WHEN dimensions IN (
    '33'' x 40''','33'' x 45''','33'' x 43''6"',
    '47''8" x 40''','47''8" x 45''','47''8" x 43''6"',
    '60'' x 40''','60'' x 45''','60'' x 43''6"'
  )
  AND front IS NULL AND depth IS NULL AND back IS NULL AND depth2 IS NULL
  AND COALESCE(dimension_unit,'')=''
  AND COALESCE(front_label,'')='' AND COALESCE(depth_label,'')=''
  AND COALESCE(back_label,'')='' AND COALESCE(depth2_label,'')=''
  AND COALESCE(side_dimensions,'')=''
  THEN 1 ELSE 0 END),
  SUM(CASE WHEN id='68'
    AND dimensions='33'' x 40'''
    AND front_edge_index=2 AND back_edge_index=1
    AND depth_edge_index IS NULL AND depth2_edge_index IS NULL
    THEN 1 ELSE 0 END),
  SUM(CASE WHEN id<>'68' AND dimensions IN (
    '33'' x 40''','33'' x 45''','33'' x 43''6"',
    '47''8" x 40''','47''8" x 45''','47''8" x 43''6"',
    '60'' x 40''','60'' x 45''','60'' x 43''6"'
  )
  AND front_edge_index IS NOT NULL
  AND back_edge_index IS NOT NULL
  AND (CASE WHEN depth_edge_index IS NULL THEN 1 ELSE 0 END
       + CASE WHEN depth2_edge_index IS NULL THEN 1 ELSE 0 END) <= 1
  THEN 1 ELSE 0 END)
FROM plots
WHERE project_id IN (SELECT project_id FROM _arising_target)
  AND inventory_active=1;

DROP TABLE IF EXISTS _arising_regular_source;
CREATE TABLE _arising_regular_source AS
SELECT
  p.id AS plot_id,
  p.dimensions,
  p.front_edge_index AS old_front_edge,
  p.depth_edge_index AS old_depth_edge,
  p.back_edge_index AS old_back_edge,
  p.depth2_edge_index AS old_depth2_edge,
  p.edge_semantics AS old_edge_semantics,
  CASE
    WHEN p.dimensions IN ('33'' x 40''','33'' x 45''','33'' x 43''6"') THEN 33.0
    WHEN p.dimensions IN ('47''8" x 40''','47''8" x 45''','47''8" x 43''6"') THEN 47.666667
    WHEN p.dimensions IN ('60'' x 40''','60'' x 45''','60'' x 43''6"') THEN 60.0
  END AS front,
  CASE
    WHEN p.dimensions IN ('33'' x 40''','47''8" x 40''','60'' x 40''') THEN 40.0
    WHEN p.dimensions IN ('33'' x 45''','47''8" x 45''','60'' x 45''') THEN 45.0
    WHEN p.dimensions IN ('33'' x 43''6"','47''8" x 43''6"','60'' x 43''6"') THEN 43.5
  END AS depth,
  trim(substr(p.dimensions,1,instr(p.dimensions,' x ')-1)) AS front_label,
  trim(substr(p.dimensions,instr(p.dimensions,' x ')+3)) AS depth_label,
  CASE WHEN p.id='68' THEN 3 ELSE p.front_edge_index END AS front_edge,
  CASE
    WHEN p.id='68' THEN 2
    WHEN p.depth_edge_index IS NOT NULL THEN p.depth_edge_index
    ELSE 6-p.front_edge_index-p.back_edge_index-p.depth2_edge_index
  END AS depth_edge,
  p.back_edge_index AS back_edge,
  CASE
    WHEN p.id='68' THEN 0
    WHEN p.depth2_edge_index IS NOT NULL THEN p.depth2_edge_index
    ELSE 6-p.front_edge_index-p.back_edge_index-p.depth_edge_index
  END AS depth2_edge
FROM plots p
JOIN _arising_target t ON t.project_id=p.project_id
WHERE p.inventory_active=1
  AND p.dimensions IN (
    '33'' x 40''','33'' x 45''','33'' x 43''6"',
    '47''8" x 40''','47''8" x 45''','47''8" x 43''6"',
    '60'' x 40''','60'' x 45''','60'' x 43''6"'
  );

ALTER TABLE _arising_regular_source ADD COLUMN side_dimensions TEXT;
ALTER TABLE _arising_regular_source ADD COLUMN edge_semantics TEXT;

UPDATE _arising_regular_source
SET
  side_dimensions='Front '||front_label||' · Back '||front_label||
    ' · Depth A '||depth_label||' · Depth B '||depth_label,
  edge_semantics=printf(
    '{"version":1,"pointCount":4,"layout":"four","roles":{"front":[%d],"back":[%d],"depthA":[%d],"depthB":[%d]}}',
    front_edge,back_edge,depth_edge,depth2_edge
  );

DROP TABLE IF EXISTS _arising_source_guard;
CREATE TABLE _arising_source_guard (
  total INTEGER NOT NULL CHECK (total=110),
  valid_edges INTEGER NOT NULL CHECK (valid_edges=110),
  plot18 INTEGER NOT NULL CHECK (plot18=1)
);
INSERT INTO _arising_source_guard(total,valid_edges,plot18)
SELECT
  COUNT(*),
  SUM(CASE
    WHEN front IS NOT NULL AND depth IS NOT NULL
     AND front_edge BETWEEN 0 AND 3 AND back_edge BETWEEN 0 AND 3
     AND depth_edge BETWEEN 0 AND 3 AND depth2_edge BETWEEN 0 AND 3
     AND front_edge<>back_edge AND front_edge<>depth_edge AND front_edge<>depth2_edge
     AND back_edge<>depth_edge AND back_edge<>depth2_edge AND depth_edge<>depth2_edge
     AND ((front_edge-back_edge+4)%4)=2
     AND ((depth_edge-depth2_edge+4)%4)=2
    THEN 1 ELSE 0 END),
  SUM(CASE WHEN plot_id='18' AND dimensions='47''8" x 45'''
    AND front=47.666667 AND depth=45.0
    AND front_edge=1 AND depth_edge=2 AND back_edge=3 AND depth2_edge=0
    THEN 1 ELSE 0 END)
FROM _arising_regular_source;

-- Fail closed if customer-visible snapshot diverged from the supplied export.
DROP TABLE IF EXISTS _arising_published_guard;
CREATE TABLE _arising_published_guard (
  n INTEGER NOT NULL CHECK (n=110),
  edge_rows INTEGER NOT NULL CHECK (edge_rows=0),
  published_edge_rows INTEGER NOT NULL CHECK (published_edge_rows=0)
);
INSERT INTO _arising_published_guard(n,edge_rows,published_edge_rows)
SELECT
  (
    SELECT COUNT(*)
    FROM published_plots p
    JOIN _arising_target t ON t.project_id=p.project_id
    JOIN _arising_regular_source s ON s.plot_id=p.id
    WHERE p.dimensions=s.dimensions
      AND p.front IS NULL AND p.depth IS NULL AND p.back IS NULL AND p.depth2 IS NULL
      AND COALESCE(p.dimension_unit,'')=''
      AND COALESCE(p.front_label,'')='' AND COALESCE(p.depth_label,'')=''
      AND COALESCE(p.back_label,'')='' AND COALESCE(p.depth2_label,'')=''
      AND COALESCE(p.side_dimensions,'')=''
      AND p.front_edge_index IS s.old_front_edge
      AND p.depth_edge_index IS s.old_depth_edge
      AND p.back_edge_index IS s.old_back_edge
      AND p.depth2_edge_index IS s.old_depth2_edge
      AND p.edge_semantics IS s.old_edge_semantics
      AND json_valid(p.polygon) AND json_array_length(p.polygon)=4
  ),
  (
    SELECT COUNT(*)
    FROM plot_edge_measurements m
    JOIN _arising_target t ON t.project_id=m.project_id
    JOIN _arising_regular_source s ON s.plot_id=m.plot_id
  ),
  (
    SELECT COUNT(*)
    FROM published_plot_edge_measurements m
    JOIN _arising_target t ON t.project_id=m.project_id
    JOIN _arising_regular_source s ON s.plot_id=m.plot_id
  );

UPDATE plots
SET
  front=(SELECT s.front FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  back=(SELECT s.front FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  depth=(SELECT s.depth FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  depth2=(SELECT s.depth FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  dimension_unit='ft',
  front_edge_index=(SELECT s.front_edge FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  depth_edge_index=(SELECT s.depth_edge FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  back_edge_index=(SELECT s.back_edge FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  depth2_edge_index=(SELECT s.depth2_edge FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  front_label=(SELECT s.front_label FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  depth_label=(SELECT s.depth_label FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  back_label=(SELECT s.front_label FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  depth2_label=(SELECT s.depth_label FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  side_dimensions=(SELECT s.side_dimensions FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  edge_semantics=(SELECT s.edge_semantics FROM _arising_regular_source s WHERE s.plot_id=plots.id),
  updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _arising_target)
  AND id IN (SELECT plot_id FROM _arising_regular_source);

INSERT INTO plot_edge_measurements(
  project_id,plot_id,role,segment_index,edge_index,point_count,length,unit,
  raw_label,road_frontage,road_access,source_ref,source_raw_text,
  confidence,verified,updated_at
)
SELECT
  p.project_id,p.id,r.role,0,
  CASE r.role
    WHEN 'front' THEN s.front_edge
    WHEN 'back' THEN s.back_edge
    WHEN 'depthA' THEN s.depth_edge
    WHEN 'depthB' THEN s.depth2_edge
  END,
  4,
  CASE WHEN r.role IN ('front','back') THEN s.front ELSE s.depth END,
  'ft',
  CASE WHEN r.role IN ('front','back') THEN s.front_label ELSE s.depth_label END,
  CASE WHEN r.role='front' THEN 1 ELSE 0 END,
  p.road,
  'Arising Future City sanctioned Peddapur layout · 2026-09-29',
  p.dimensions,'high',1,strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM plots p
JOIN _arising_target t ON t.project_id=p.project_id
JOIN _arising_regular_source s ON s.plot_id=p.id
CROSS JOIN (
  SELECT 'front' AS role
  UNION ALL SELECT 'back'
  UNION ALL SELECT 'depthA'
  UNION ALL SELECT 'depthB'
) r;

-- Same exact tenant only: repair the current immutable customer snapshot in-place
-- so the customer website is corrected immediately after this deployment.
UPDATE published_plots
SET
  front=(SELECT s.front FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  back=(SELECT s.front FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  depth=(SELECT s.depth FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  depth2=(SELECT s.depth FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  dimension_unit='ft',
  front_edge_index=(SELECT s.front_edge FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  depth_edge_index=(SELECT s.depth_edge FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  back_edge_index=(SELECT s.back_edge FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  depth2_edge_index=(SELECT s.depth2_edge FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  front_label=(SELECT s.front_label FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  depth_label=(SELECT s.depth_label FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  back_label=(SELECT s.front_label FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  depth2_label=(SELECT s.depth_label FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  side_dimensions=(SELECT s.side_dimensions FROM _arising_regular_source s WHERE s.plot_id=published_plots.id),
  edge_semantics=(SELECT s.edge_semantics FROM _arising_regular_source s WHERE s.plot_id=published_plots.id)
WHERE project_id IN (SELECT project_id FROM _arising_target)
  AND id IN (SELECT plot_id FROM _arising_regular_source);

INSERT INTO published_plot_edge_measurements(
  project_id,plot_id,role,segment_index,edge_index,point_count,length,unit,
  raw_label,road_frontage,road_access
)
SELECT
  p.project_id,p.id,r.role,0,
  CASE r.role
    WHEN 'front' THEN s.front_edge
    WHEN 'back' THEN s.back_edge
    WHEN 'depthA' THEN s.depth_edge
    WHEN 'depthB' THEN s.depth2_edge
  END,
  4,
  CASE WHEN r.role IN ('front','back') THEN s.front ELSE s.depth END,
  'ft',
  CASE WHEN r.role IN ('front','back') THEN s.front_label ELSE s.depth_label END,
  CASE WHEN r.role='front' THEN 1 ELSE 0 END,
  p.road
FROM published_plots p
JOIN _arising_target t ON t.project_id=p.project_id
JOIN _arising_regular_source s ON s.plot_id=p.id
CROSS JOIN (
  SELECT 'front' AS role
  UNION ALL SELECT 'back'
  UNION ALL SELECT 'depthA'
  UNION ALL SELECT 'depthB'
) r;

DROP TABLE IF EXISTS _arising_post_guard;
CREATE TABLE _arising_post_guard (
  draft_plots INTEGER NOT NULL CHECK (draft_plots=110),
  published_plots INTEGER NOT NULL CHECK (published_plots=110),
  draft_edges INTEGER NOT NULL CHECK (draft_edges=440),
  published_edges INTEGER NOT NULL CHECK (published_edges=440)
);
INSERT INTO _arising_post_guard(draft_plots,published_plots,draft_edges,published_edges)
SELECT
  (
    SELECT COUNT(*) FROM plots p
    JOIN _arising_target t ON t.project_id=p.project_id
    JOIN _arising_regular_source s ON s.plot_id=p.id
    WHERE p.dimension_unit='ft'
      AND p.front=s.front AND p.back=s.front AND p.depth=s.depth AND p.depth2=s.depth
      AND p.front_label=s.front_label AND p.back_label=s.front_label
      AND p.depth_label=s.depth_label AND p.depth2_label=s.depth_label
      AND p.front_edge_index=s.front_edge AND p.depth_edge_index=s.depth_edge
      AND p.back_edge_index=s.back_edge AND p.depth2_edge_index=s.depth2_edge
      AND p.edge_semantics=s.edge_semantics
  ),
  (
    SELECT COUNT(*) FROM published_plots p
    JOIN _arising_target t ON t.project_id=p.project_id
    JOIN _arising_regular_source s ON s.plot_id=p.id
    WHERE p.dimension_unit='ft'
      AND p.front=s.front AND p.back=s.front AND p.depth=s.depth AND p.depth2=s.depth
      AND p.front_label=s.front_label AND p.back_label=s.front_label
      AND p.depth_label=s.depth_label AND p.depth2_label=s.depth_label
      AND p.front_edge_index=s.front_edge AND p.depth_edge_index=s.depth_edge
      AND p.back_edge_index=s.back_edge AND p.depth2_edge_index=s.depth2_edge
      AND p.edge_semantics=s.edge_semantics
  ),
  (
    SELECT COUNT(*) FROM plot_edge_measurements m
    JOIN _arising_target t ON t.project_id=m.project_id
    JOIN _arising_regular_source s ON s.plot_id=m.plot_id
  ),
  (
    SELECT COUNT(*) FROM published_plot_edge_measurements m
    JOIN _arising_target t ON t.project_id=m.project_id
    JOIN _arising_regular_source s ON s.plot_id=m.plot_id
  );

DROP TABLE IF EXISTS _arising_post_guard;
DROP TABLE IF EXISTS _arising_published_guard;
DROP TABLE IF EXISTS _arising_source_guard;
DROP TABLE IF EXISTS _arising_regular_source;
DROP TABLE IF EXISTS _arising_inventory_guard;
DROP TABLE IF EXISTS _arising_snapshot_guard;
DROP TABLE IF EXISTS _arising_target_guard;
DROP TABLE IF EXISTS _arising_target;
