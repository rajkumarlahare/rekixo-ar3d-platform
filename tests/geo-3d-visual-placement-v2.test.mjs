import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("visual placement reuses existing Geo data without touching published project state", () => {
  const resolver = read("app/geo-3d-placement.ts");
  const route = read("app/api/admin/3d-geo-placement/route.ts");

  assert.match(resolver, /geo3DVisualFeatures/);
  assert.match(resolver, /FROM geo_features WHERE project_id=\?/);
  assert.match(route, /geo3DVisualFeatures\(scope\.geoProjectId\)/);
  assert.doesNotMatch(route, /UPDATE geo_project_settings/);
  assert.doesNotMatch(route, /UPDATE geo_features/);
  assert.doesNotMatch(route, /UPDATE plots/);
});

test("authenticated preview model proxy is project-scoped and not an arbitrary fetch proxy", () => {
  const route = read("app/api/admin/3d-geo-model/route.ts");

  assert.match(route, /requireSuperAdmin/);
  assert.match(route, /resolveGeo3DPlacementScope\(projectId\)/);
  assert.match(route, /project3DLink\(scope\.platformProject\.id\)/);
  assert.match(route, /publishedEngineProject\(link\.engineSlug\)/);
  assert.match(route, /enginePublishedModelUrl\(engine\.model\.url\)/);
  assert.match(route, /fetchEnginePublishedModel\(preview\.sourceModelUrl/);
  assert.doesNotMatch(route, /searchParams\.get\("url"\)/);
});

test("visual placement supports satellite click positioning and live 3D model alignment", () => {
  const visual = read("app/geo-3d-placement-visual.tsx");

  assert.match(visual, /Satellite/);
  assert.match(visual, /3D Preview/);
  assert.match(visual, /onPositionChange\(event\.latLng\.lng\(\), event\.latLng\.lat\(\)\)/);
  assert.match(visual, /new google\.maps\.Polygon/);
  assert.match(visual, /Model3DElement/);
  assert.match(visual, /altitudeMode: "RELATIVE_TO_GROUND"/);
  assert.match(visual, /credentials: "same-origin"/);
  assert.match(visual, /gmp-steadychange/);
  assert.match(visual, /center:\s*\{\s*lat: latitude,\s*lng: longitude,\s*\}/);
  assert.doesNotMatch(visual, /altitude: Math\.max\(0, altitudeM \+ 35\)/);
  assert.match(visual, /model3DRef\.current\.orientation/);
  assert.match(visual, /model3DRef\.current\.scale = scale/);
});

test("placement manager exposes fine visual controls without auto-enabling customer 3D", () => {
  const manager = read("app/geo-3d-placement-manager.tsx");

  assert.match(manager, /Ground offset visual slider/);
  assert.match(manager, /Heading visual slider/);
  assert.match(manager, /Scale visual slider/);
  assert.match(manager, /Use Geo center/);
  assert.match(manager, /Reset alignment/);
  assert.match(manager, /Customer 3D Site/);
  assert.match(manager, /publicEnabled: false/);
});

test("placement state exposes only browser-safe maps key plus internal preview route", () => {
  const route = read("app/api/admin/3d-geo-placement/route.ts");

  assert.match(route, /publicGoogleMapsBrowserKey\(\)/);
  assert.match(route, /previewModelUrl:/);
  assert.match(route, /\/api\/admin\/3d-geo-model\?projectId=/);
  assert.doesNotMatch(route, /engine\.model\.url\s*[,}]/);
});
