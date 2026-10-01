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

test("authenticated preview model redirect is project-scoped and not an arbitrary redirect", () => {
  const route = read("app/api/admin/3d-geo-model/route.ts");

  assert.match(route, /requireSuperAdmin/);
  assert.match(route, /resolveGeo3DPlacementScope\(projectId\)/);
  assert.match(route, /project3DLink\(scope\.platformProject\.id\)/);
  assert.match(route, /publishedEngineProject\(link\.engineSlug\)/);
  assert.match(route, /preferredEngineGeoRenderModel\(engine\)/);
  assert.match(route, /enginePublishedModelUrl\(renderModel\.url\)/);
  assert.match(route, /engine\.geoModel && renderModel === engine\.geoModel/);
  assert.match(route, /status: 307/);
  assert.match(route, /location: sourceModelUrl/);
  assert.doesNotMatch(route, /fetchEnginePublishedModel/);
  assert.doesNotMatch(route, /searchParams\.get\("url"\)/);
});

test("visual placement supports satellite click positioning and live 3D model alignment", () => {
  const visual = read("app/geo-3d-placement-visual.tsx");

  assert.match(visual, /Satellite/);
  assert.match(visual, /3D Preview/);
  assert.match(visual, /onPositionChange\(event\.latLng\.lng\(\), event\.latLng\.lat\(\)\)/);
  assert.match(visual, /new google\.maps\.Polygon/);
  assert.match(visual, /Model3DElement/);
  assert.match(visual, /FlattenerElement/);
  assert.match(visual, /flatteningSquarePath/);
  assert.match(visual, /map\.append\(flattener\)/);
  assert.match(visual, /Google base mesh: flattened/);
  assert.match(visual, /Model element:/);
  assert.match(visual, /Geo GLB:/);
  assert.match(visual, /altitudeMode: "RELATIVE_TO_GROUND"/);
  assert.match(visual, /credentials: "same-origin"/);
  assert.match(visual, /headers: \{ Range: "bytes=0-3" \}/);
  assert.match(visual, /modelCheck\.status !== 200 && modelCheck\.status !== 206/);
  assert.match(visual, /const finalModelUrl = modelCheck\.url \|\| modelUrl/);
  assert.match(visual, /readResponsePrefix\(modelCheck, 4\)/);
  assert.match(visual, /src: finalModelUrl/);
  assert.match(visual, /magic !== "glTF"/);
  assert.doesNotMatch(visual, /method: "HEAD"/);
  assert.match(visual, /gmp-steadychange/);
  assert.match(visual, /function focus3DMap/);
  assert.match(visual, /flyCameraTo/);
  assert.match(visual, /altitudeMode: "RELATIVE_TO_GROUND" as const/);
  assert.match(visual, /Math\.max\(0, altitudeM \+ 10\)/);
  assert.match(visual, /range: 700/);
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


test("Jyoti mesh flattening policy is exact-project scoped and never global", () => {
  const policy = read("app/geo-3d-render-policy.ts");
  const route = read("app/api/admin/3d-geo-placement/route.ts");
  const manager = read("app/geo-3d-placement-manager.tsx");

  assert.match(policy, /302a8799-24de-4b9f-b217-95fb2c3883c8/);
  assert.match(policy, /jyoti-paradise-local-backup-302a8799/);
  assert.match(policy, /project\?\.id === JYOTI_ENGINE_PROJECT_ID/);
  assert.match(policy, /project\?\.slug === JYOTI_ENGINE_SLUG/);
  assert.match(policy, /flattenBaseMesh: isJyotiParadise/);
  assert.match(policy, /flattenHalfSizeM: isJyotiParadise \? 20 : 0/);
  assert.match(route, /geo3DRenderPolicy\(engine\?\.project\)/);
  assert.match(manager, /flattenBaseMesh=\{state\?\.engine\?\.renderPolicy\?\.flattenBaseMesh === true\}/);
});
