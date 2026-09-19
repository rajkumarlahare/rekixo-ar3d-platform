-- MANGAL_RAJ_PARK_MEASUREMENT_BACKFILL_V1
-- Source: user-supplied sanctioned Mangal Raj Park layout, 2026-09-19.
-- Safety: project-scoped, 84-row guarded, geometry/status/pricing untouched.

DROP TABLE IF EXISTS _mangal_target;
CREATE TABLE _mangal_target (project_id TEXT PRIMARY KEY);
INSERT INTO _mangal_target(project_id)
SELECT DISTINCT p.id FROM projects p
WHERE p.status='active' AND (
  lower(trim(p.name))='mangal raj park'
  OR EXISTS (
    SELECT 1 FROM settings s
    WHERE s.project_id=p.id AND s.key='projectName'
      AND lower(trim(s.value))='mangal raj park'
  )
);

DROP TABLE IF EXISTS _mangal_target_guard;
CREATE TABLE _mangal_target_guard (n INTEGER NOT NULL CHECK (n=1));
INSERT INTO _mangal_target_guard(n) SELECT COUNT(*) FROM _mangal_target;

DROP TABLE IF EXISTS _mangal_measurement_source;
CREATE TABLE _mangal_measurement_source (
  plot_id INTEGER PRIMARY KEY, sqm REAL NOT NULL,
  front REAL, back REAL, depth_a REAL, depth_b REAL,
  front_label TEXT NOT NULL, back_label TEXT NOT NULL,
  depth_a_label TEXT NOT NULL, depth_b_label TEXT NOT NULL,
  side_dimensions TEXT NOT NULL, road_access TEXT NOT NULL,
  confidence TEXT NOT NULL, verified INTEGER NOT NULL,
  source_note TEXT NOT NULL
);
INSERT INTO _mangal_measurement_source(
  plot_id,sqm,front,back,depth_a,depth_b,
  front_label,back_label,depth_a_label,depth_b_label,
  side_dimensions,road_access,confidence,verified,source_note
) VALUES
  (1,125.351,10.99,12.25,18.9,17.733,'10.990 m','9.000 + 3.250 m','18.900 m','17.733 m','Front 10.990 m · Back 9.000 + 3.250 m · Depth A 18.900 m · Depth B 17.733 m','12.000 M WIDE EXISTING ROAD','high',1,'Road-facing front is the 10.990 m edge; opposite boundary is shown as 9.000 + 3.250 m.'),
  (2,161.367,9,9,17.733,18.082,'9.000 m','9.000 m','17.733 m','18.082 m','Front 9.000 m · Back 9.000 m · Depth A 17.733 m · Depth B 18.082 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (3,162.756,9,9,18.082,18.085,'9.000 m','9.000 m','18.082 m','18.085 m','Front 9.000 m · Back 9.000 m · Depth A 18.082 m · Depth B 18.085 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (4,162.778,9,9,18.085,18.061,'9.000 m','9.000 m','18.085 m','18.061 m','Front 9.000 m · Back 9.000 m · Depth A 18.085 m · Depth B 18.061 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (5,162.658,9,9,18.061,18.055,'9.000 m','9.000 m','18.061 m','18.055 m','Front 9.000 m · Back 9.000 m · Depth A 18.061 m · Depth B 18.055 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (6,162.363,9,9,18.055,18.023,'9.000 m','9.000 m','18.055 m','18.023 m','Front 9.000 m · Back 9.000 m · Depth A 18.055 m · Depth B 18.023 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (7,162.264,9,9,18.023,18.046,'9.000 m','9.000 m','18.023 m','18.046 m','Front 9.000 m · Back 9.000 m · Depth A 18.023 m · Depth B 18.046 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (8,162.591,9,9,18.046,18.004,'9.000 m','9.000 m','18.046 m','18.004 m','Front 9.000 m · Back 9.000 m · Depth A 18.046 m · Depth B 18.004 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (9,162.954,9,9,18.004,18.157,'9.000 m','9.000 m','18.004 m','18.157 m','Front 9.000 m · Back 9.000 m · Depth A 18.004 m · Depth B 18.157 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (10,164.242,9,9,18.157,18.294,'9.000 m','9.000 m','18.157 m','18.294 m','Front 9.000 m · Back 9.000 m · Depth A 18.157 m · Depth B 18.294 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (11,164.752,9,9,18.294,18.326,'9.000 m','9.000 m','18.294 m','18.326 m','Front 9.000 m · Back 9.000 m · Depth A 18.294 m · Depth B 18.326 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (12,165.130,9,9,18.326,18.3,'9.000 m','9.000 m','18.326 m','18.300 m','Front 9.000 m · Back 9.000 m · Depth A 18.326 m · Depth B 18.300 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (13,187.081,10.5,10.5,18.3,18.417,'10.500 m','10.500 m','18.300 m','18.417 m','Front 10.500 m · Back 10.500 m · Depth A 18.300 m · Depth B 18.417 m','12.000 M WIDE EXISTING ROAD / 12.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (14,193.806,10.5,10.5,18.85,19.235,'10.500 m','10.500 m','18.850 m','19.235 m','Front 10.500 m · Back 10.500 m · Depth A 18.850 m · Depth B 19.235 m','12.000 M WIDE EXISTING ROAD / 12.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (15,175.279,9.009,9,19.235,19.695,'9.009 m','9.000 m','19.235 m','19.695 m','Front 9.009 m · Back 9.000 m · Depth A 19.235 m · Depth B 19.695 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (16,179.054,9.009,9,19.695,20.164,'9.009 m','9.000 m','19.695 m','20.164 m','Front 9.009 m · Back 9.000 m · Depth A 19.695 m · Depth B 20.164 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (17,182.830,9.009,9,20.164,20.521,'9.009 m','9.000 m','20.164 m','20.521 m','Front 9.009 m · Back 9.000 m · Depth A 20.164 m · Depth B 20.521 m','12.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (18,195.942,11.427,10.094,20.521,19.998,'11.427 m','10.094 m','20.521 m','19.998 m','Front 11.427 m · Back 10.094 m · Depth A 20.521 m · Depth B 19.998 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (19,174.783,9.05,9,19.998,19.993,'9.050 m','9.000 m','19.998 m','19.993 m','Front 9.050 m · Back 9.000 m · Depth A 19.998 m · Depth B 19.993 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (20,180.870,9,9,19.993,20.09,'9.000 m','9.000 m','19.993 m','20.090 m','Front 9.000 m · Back 9.000 m · Depth A 19.993 m · Depth B 20.090 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (21,180.363,9,9,20.09,19.99,'9.000 m','9.000 m','20.090 m','19.990 m','Front 9.000 m · Back 9.000 m · Depth A 20.090 m · Depth B 19.990 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (22,179.466,9,9,19.99,19.898,'9.000 m','9.000 m','19.990 m','19.898 m','Front 9.000 m · Back 9.000 m · Depth A 19.990 m · Depth B 19.898 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (23,178.569,9,9,19.898,19.791,'9.000 m','9.000 m','19.898 m','19.791 m','Front 9.000 m · Back 9.000 m · Depth A 19.898 m · Depth B 19.791 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (24,177.671,9,9,19.791,19.691,'9.000 m','9.000 m','19.791 m','19.691 m','Front 9.000 m · Back 9.000 m · Depth A 19.791 m · Depth B 19.691 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (25,176.961,9,9,19.691,19.639,'9.000 m','9.000 m','19.691 m','19.639 m','Front 9.000 m · Back 9.000 m · Depth A 19.691 m · Depth B 19.639 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (26,176.486,9,9,19.639,19.579,'9.000 m','9.000 m','19.639 m','19.579 m','Front 9.000 m · Back 9.000 m · Depth A 19.639 m · Depth B 19.579 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (27,175.953,9,9,19.579,19.52,'9.000 m','9.000 m','19.579 m','19.520 m','Front 9.000 m · Back 9.000 m · Depth A 19.579 m · Depth B 19.520 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (28,175.388,9,9,19.52,19.451,'9.000 m','9.000 m','19.520 m','19.451 m','Front 9.000 m · Back 9.000 m · Depth A 19.520 m · Depth B 19.451 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (29,174.538,9,8.251,19.451,18.84,'9.000 m','8.251 m','19.451 m','18.840 m','Front 9.000 m · Back 8.251 m · Depth A 19.451 m · Depth B 18.840 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (30,252.582,27.15,0.916,18.84,33,'27.150 m','0.916 m','18.840 m','33.000 m','Front 27.150 m · Back 0.916 m · Depth A 18.840 m · Depth B 33.000 m','11.000 M WIDE EXISTING ROAD','high',1,'Sanctioned tapered corner plot; all four printed principal boundary lengths retained.'),
  (31,230.936,4.071,26.251,26.8,15,'4.071 m','26.251 m','26.800 m','15.000 m','Front 4.071 m · Back 26.251 m · Depth A 26.800 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned irregular boundary; printed principal lengths retained without geometry changes.'),
  (32,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (33,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (34,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (35,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (36,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (37,134.923,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (38,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (39,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (40,143.377,9,10.094,12.123,15,'9.000 m','10.094 m','12.123 m','15.000 m','Front 9.000 m · Back 10.094 m · Depth A 12.123 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned irregular plot; printed principal lengths retained.'),
  (41,108.107,9,9,12,12.123,'9.000 m','9.000 m','12.000 m','12.123 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.123 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (42,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (43,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (44,119.950,10.5,10.5,12,12,'10.500 m','10.500 m','12.000 m','12.000 m','Front 10.500 m · Back 10.500 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD / 12.000 M WIDE ROAD','high',1,'Corner plot beside 9.000 M and 12.000 M roads; principal printed dimensions retained.'),
  (45,119.950,10.5,10.5,12,12,'10.500 m','10.500 m','12.000 m','12.000 m','Front 10.500 m · Back 10.500 m · Depth A 12.000 m · Depth B 12.000 m','12.000 M WIDE ROAD / 9.000 M WIDE ROAD','high',1,'Corner plot beside 12.000 M and 9.000 M roads; principal printed dimensions retained.'),
  (46,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (47,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (48,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (49,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (50,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (51,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (52,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (53,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (54,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (55,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (56,114.564,6.856,12.25,13.15,12,'6.856 m','12.250 m','13.150 m','12.000 m','Front 6.856 m · Back 12.250 m · Depth A 13.150 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned corner/irregular plot; principal printed boundary lengths retained.'),
  (57,132.532,13.3,12.867,8.691,16.32,'13.300 m','12.867 m','8.691 m','16.320 m','Front 13.300 m · Back 12.867 m · Depth A 8.691 m · Depth B 16.320 m','9.000 M WIDE ROAD','high',1,'Sanctioned irregular outer-boundary plot; principal printed lengths retained.'),
  (58,181.666,9,11.85,16.32,24.05,'9.000 m','11.850 m','16.320 m','24.050 m','Front 9.000 m · Back 11.850 m · Depth A 16.320 m · Depth B 24.050 m','9.000 M WIDE ROAD','high',1,'Sanctioned irregular outer-boundary plot; principal printed lengths retained.'),
  (59,137.950,12,12,12,12,'12.000 m','12.000 m','12.000 m','12.000 m','Front 12.000 m · Back 12.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (60,181.784,12.417,12.05,12,9.273,'12.417 m','12.050 m','12.000 m','9.273 m','Front 12.417 m · Back 12.050 m · Depth A 12.000 m · Depth B 9.273 m','9.000 M WIDE ROAD','high',1,'Sanctioned irregular outer-boundary plot; principal printed lengths retained.'),
  (61,224.723,12.5,24.97,17.329,12,'12.500 m','24.970 m','17.329 m','12.000 m','Front 12.500 m · Back 24.970 m · Depth A 17.329 m · Depth B 12.000 m','9.000 M WIDE ROAD','medium',0,'Irregular multi-segment boundary: principal printed lengths retained; source row stays reviewable.'),
  (62,137.950,12,12,12,12,'12.000 m','12.000 m','12.000 m','12.000 m','Front 12.000 m · Back 12.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (63,137.950,12,12,12,12,'12.000 m','12.000 m','12.000 m','12.000 m','Front 12.000 m · Back 12.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (64,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (65,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (66,158.568,19.457,6.97,12,17.329,'19.457 m','6.970 m','12.000 m','17.329 m','Front 19.457 m · Back 6.970 m · Depth A 12.000 m · Depth B 17.329 m','9.000 M WIDE ROAD','high',1,'Sanctioned irregular outer-boundary plot; principal printed lengths retained.'),
  (67,143.506,12.7,11.215,12,12.093,'12.700 m','11.215 m','12.000 m','12.093 m','Front 12.700 m · Back 11.215 m · Depth A 12.000 m · Depth B 12.093 m','9.000 M WIDE ROAD','high',1,'Sanctioned irregular outer-boundary plot; principal printed lengths retained.'),
  (68,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (69,108.000,9,9,12,12,'9.000 m','9.000 m','12.000 m','12.000 m','Front 9.000 m · Back 9.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (70,120.000,10,10,12,12,'10.000 m','10.000 m','12.000 m','12.000 m','Front 10.000 m · Back 10.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (71,137.950,12,12,12,12,'12.000 m','12.000 m','12.000 m','12.000 m','Front 12.000 m · Back 12.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (72,173.950,15,15,12,12,'15.000 m','15.000 m','12.000 m','12.000 m','Front 15.000 m · Back 15.000 m · Depth A 12.000 m · Depth B 12.000 m','9.000 M WIDE ROAD / 12.000 M WIDE ROAD','high',1,'Corner plot; principal printed dimensions retained.'),
  (73,150.000,10,10,15,15,'10.000 m','10.000 m','15.000 m','15.000 m','Front 10.000 m · Back 10.000 m · Depth A 15.000 m · Depth B 15.000 m','12.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (74,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','12.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (75,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','12.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (76,152.389,8.851,11.215,15,15.194,'8.851 m','11.215 m','15.000 m','7.654 + 7.540 m','Front 8.851 m · Back 11.215 m · Depth A 15.000 m · Depth B 7.654 + 7.540 m','12.000 M WIDE ROAD','high',1,'Irregular outer-boundary plot; bottom boundary is shown as 7.654 + 7.540 m.'),
  (77,152.389,13.771,8.57,13.5,14.5,'13.771 m','8.570 m','13.500 m','13.450 + 1.050 m','Front 13.771 m · Back 8.570 m · Depth A 13.500 m · Depth B 13.450 + 1.050 m','12.000 M WIDE ROAD','high',1,'Irregular outer-boundary plot; one boundary is shown as 13.450 + 1.050 m.'),
  (78,121.500,9,9,13.5,13.5,'9.000 m','9.000 m','13.500 m','13.500 m','Front 9.000 m · Back 9.000 m · Depth A 13.500 m · Depth B 13.500 m','12.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (79,121.500,9,9,13.5,13.5,'9.000 m','9.000 m','13.500 m','13.500 m','Front 9.000 m · Back 9.000 m · Depth A 13.500 m · Depth B 13.500 m','12.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (80,134.200,9.35,9.35,NULL,15,'9.350 m','9.350 m','Curved road corner','15.000 m','Front 9.350 m · Back 9.350 m · Depth A Curved road corner · Depth B 15.000 m','9.000 M WIDE ROAD / 12.000 M WIDE ROAD','medium',0,'Curved road corner has no printed arc length; that side is intentionally label-only and remains reviewable.'),
  (81,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (82,135.000,9,9,15,15,'9.000 m','9.000 m','15.000 m','15.000 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 15.000 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (83,134.938,9,9,15,14.385,'9.000 m','9.000 m','15.000 m','14.385 m','Front 9.000 m · Back 9.000 m · Depth A 15.000 m · Depth B 14.385 m','9.000 M WIDE ROAD','high',1,'Sanctioned side labels transcribed from uploaded Mangal Raj Park layout.'),
  (84,131.223,9.022,9,14.385,14.255,'9.022 m','9.000 m','14.385 m','14.255 m','Front 9.022 m · Back 9.000 m · Depth A 14.385 m · Depth B 14.255 m','9.000 M WIDE ROAD','high',1,'Sanctioned irregular plot beside open space; printed principal lengths retained.');

DROP TABLE IF EXISTS _mangal_source_guard;
CREATE TABLE _mangal_source_guard (n INTEGER NOT NULL CHECK (n=84));
INSERT INTO _mangal_source_guard(n) SELECT COUNT(*) FROM _mangal_measurement_source;

DROP TABLE IF EXISTS _mangal_plot_guard;
CREATE TABLE _mangal_plot_guard (n INTEGER NOT NULL CHECK (n=84));
INSERT INTO _mangal_plot_guard(n)
SELECT COUNT(*)
FROM plots p
JOIN _mangal_target t ON t.project_id=p.project_id
JOIN _mangal_measurement_source s ON CAST(p.id AS INTEGER)=s.plot_id;

INSERT INTO settings(project_id,key,value,updated_at)
SELECT project_id,'sqmToSqftFactor','10.76',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _mangal_target
WHERE 1
ON CONFLICT(project_id,key) DO UPDATE SET
  value=excluded.value, updated_at=excluded.updated_at;

-- Geometry, sales status, featured state, edge semantics and pricing are not mutated.
UPDATE plots
SET
  sqm=(SELECT s.sqm FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  sqft=ROUND((SELECT s.sqm FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER))*10.76,3),
  front=(SELECT s.front FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  back=(SELECT s.back FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  depth=(SELECT s.depth_a FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  depth2=(SELECT s.depth_b FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  dimension_unit='m',
  front_label=(SELECT s.front_label FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  back_label=(SELECT s.back_label FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  depth_label=(SELECT s.depth_a_label FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  depth2_label=(SELECT s.depth_b_label FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  side_dimensions=(SELECT s.side_dimensions FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  road=(SELECT s.road_access FROM _mangal_measurement_source s WHERE s.plot_id=CAST(plots.id AS INTEGER)),
  updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE project_id IN (SELECT project_id FROM _mangal_target)
  AND CAST(id AS INTEGER) IN (SELECT plot_id FROM _mangal_measurement_source);

INSERT INTO plot_edge_measurements(
  project_id,plot_id,role,segment_index,edge_index,point_count,
  length,unit,raw_label,road_frontage,road_access,
  source_ref,source_raw_text,confidence,verified,updated_at
)
SELECT
  p.project_id,p.id,r.role,0,
  CASE r.role
    WHEN 'front' THEN p.front_edge_index
    WHEN 'back' THEN p.back_edge_index
    WHEN 'depthA' THEN p.depth_edge_index
    WHEN 'depthB' THEN p.depth2_edge_index
  END,
  CASE WHEN p.polygon IS NOT NULL AND json_valid(p.polygon)
       THEN json_array_length(p.polygon) ELSE NULL END,
  CASE r.role
    WHEN 'front' THEN s.front
    WHEN 'back' THEN s.back
    WHEN 'depthA' THEN s.depth_a
    WHEN 'depthB' THEN s.depth_b
  END,
  'm',
  CASE r.role
    WHEN 'front' THEN s.front_label
    WHEN 'back' THEN s.back_label
    WHEN 'depthA' THEN s.depth_a_label
    WHEN 'depthB' THEN s.depth_b_label
  END,
  CASE WHEN r.role='front' THEN 1 ELSE 0 END,
  s.road_access,
  'Mangal Raj Park sanctioned layout · 2026-09-19',
  s.source_note,s.confidence,s.verified,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM plots p
JOIN _mangal_target t ON t.project_id=p.project_id
JOIN _mangal_measurement_source s ON s.plot_id=CAST(p.id AS INTEGER)
CROSS JOIN (
  SELECT 'front' AS role
  UNION ALL SELECT 'back'
  UNION ALL SELECT 'depthA'
  UNION ALL SELECT 'depthB'
) r
WHERE 1
ON CONFLICT(project_id,plot_id,role,segment_index) DO UPDATE SET
  edge_index=excluded.edge_index,
  point_count=excluded.point_count,
  length=excluded.length,
  unit=excluded.unit,
  raw_label=excluded.raw_label,
  road_frontage=excluded.road_frontage,
  road_access=excluded.road_access,
  source_ref=excluded.source_ref,
  source_raw_text=excluded.source_raw_text,
  confidence=excluded.confidence,
  verified=excluded.verified,
  updated_at=excluded.updated_at;

INSERT INTO settings(project_id,key,value,updated_at)
SELECT project_id,'measurementSheetName','Mangal Raj Park sanctioned layout backfill',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _mangal_target
WHERE 1
ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

INSERT INTO settings(project_id,key,value,updated_at)
SELECT project_id,'measurementSheetCount','84',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _mangal_target
WHERE 1
ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

INSERT INTO settings(project_id,key,value,updated_at)
SELECT project_id,'measurementSheetFullSidesCount','84',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _mangal_target
WHERE 1
ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

INSERT INTO settings(project_id,key,value,updated_at)
SELECT project_id,'measurementSheetVerifiedCount','82',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _mangal_target
WHERE 1
ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

INSERT INTO settings(project_id,key,value,updated_at)
SELECT project_id,'measurementSheetReviewCount','2',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _mangal_target
WHERE 1
ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;


-- D1 does not permit TEMP tables in remote migrations. These ordinary staging
-- tables are migration-local by name and are removed after the guarded backfill.
DROP TABLE IF EXISTS _mangal_plot_guard;
DROP TABLE IF EXISTS _mangal_source_guard;
DROP TABLE IF EXISTS _mangal_measurement_source;
DROP TABLE IF EXISTS _mangal_target_guard;
DROP TABLE IF EXISTS _mangal_target;
