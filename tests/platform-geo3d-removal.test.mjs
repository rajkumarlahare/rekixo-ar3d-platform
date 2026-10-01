import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Super Admin keeps the original masterplan Geo workflow and no Platform 3D mapper UI", () => {
  const dashboard = read("app/super-admin-dashboard.tsx");
  const geoMapper = read("app/geo-mapper.tsx");

  assert.match(dashboard, /<Globe2 \/> Geo Mapper/);
  assert.match(dashboard, /<GeoMapper key=\{projectId\}/);
  assert.doesNotMatch(dashboard, /Geo3DPlacementManager/);
  assert.doesNotMatch(dashboard, /Project3DLinkManager/);
  assert.doesNotMatch(dashboard, /> 3D Engine</);
  assert.doesNotMatch(dashboard, /"three-d"/);

  assert.match(geoMapper, /Masterplan → WGS84 calibration/);
  assert.match(geoMapper, /Save Calibration/);
  assert.match(geoMapper, /Generate Geo Plots/);
  assert.match(geoMapper, /Publish Geo Snapshot/);
  assert.match(geoMapper, /Promote Published Geo/);
});

test("Platform public Geo runtime is satellite/masterplan only again", () => {
  const handler = read("app/api/public-geo/handler.ts");
  const viewer = read("app/projects/[slug]/map/geo-public-map.tsx");
  const css = read("app/projects/[slug]/map/geo-public-map.module.css");

  assert.doesNotMatch(handler, /resolvePublicGeo3DPlacement|building3d|geo3DRenderPolicy/);
  assert.doesNotMatch(viewer, /building3d|3D Site|maps3d|Map3DElement|createGeo3DThreeOverlay/);
  assert.doesNotMatch(css, /map3d|viewModes|threeDNotice/);
  assert.match(viewer, /LIVE SATELLITE MASTERPLAN/);
  assert.match(viewer, /addMasterplanOverlay/);
});

test("historical Geo 3D migration remains additive but dormant for deployed database safety", () => {
  const migration = read("drizzle/0034_rekixo_geo_3d_placement_v1.sql");
  const geoExports = read("modules/geo/index.ts");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS geo_3d_placements/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\s+projects\b/i);
  assert.doesNotMatch(geoExports, /geo-3d-placement/);
});

test("Platform-owned Geo 3D implementation files are removed", () => {
  const removed = [
    "app/geo-3d-placement-manager.tsx",
    "app/geo-3d-placement-visual.tsx",
    "app/geo-3d-placement-visual.module.css",
    "app/geo-3d-placement.ts",
    "app/geo-3d-render-policy.ts",
    "app/geo-3d-three-overlay.ts",
    "app/api/admin/3d-geo-placement/route.ts",
    "app/api/admin/3d-geo-model/route.ts",
    "app/api/admin/3d-google-model-probe/route.ts",
    "app/api/3d-google-windmill/route.ts",
    "app/api/public-geo-3d-model/route.ts",
    "app/project-3d-link-manager.tsx",
  ];
  for (const path of removed) assert.equal(fs.existsSync(path), false, path);
});
