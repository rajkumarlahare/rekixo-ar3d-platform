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

test("placement state exposes a validated same-origin Engine model path", () => {
  const route = read("app/api/admin/3d-geo-placement/route.ts");
  const integration = read("app/engine-integration.ts");

  assert.match(route, /publicGoogleMapsBrowserKey\(\)/);
  assert.match(route, /previewModelUrl:/);
  assert.match(route, /engineSameOriginAdminModelPath\(renderModel\.url\)/);
  assert.match(integration, /export function engineSameOriginAdminModelPath/);
  assert.match(integration, /const safeUrl = enginePublishedModelUrl\(modelUrl\)/);
  assert.match(integration, /return `\$\{url\.pathname\}\$\{url\.search\}`/);
  assert.doesNotMatch(route, /\/api\/geo-3d-model-proxy\?projectId=/);
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


test("Geo derivative SHA stays visible and same-origin model path preserves Engine query identity", () => {
  const route = read("app/api/admin/3d-geo-placement/route.ts");
  const integration = read("app/engine-integration.ts");
  const manager = read("app/geo-3d-placement-manager.tsx");
  const visual = read("app/geo-3d-placement-visual.tsx");

  assert.equal(route.includes("sha256: engine.geoModel.sha256"), true);
  assert.match(route, /engineSameOriginAdminModelPath\(renderModel\.url\)/);
  assert.match(integration, /return `\$\{url\.pathname\}\$\{url\.search\}`/);
  assert.equal(manager.includes("modelFingerprint={state?.engine?.geoModel?.sha256}"), true);
  assert.equal(visual.includes("modelFingerprint,"), true);
  assert.equal(visual.includes("Geo build: {modelFingerprint.slice(0, 12)}"), true);
});


test("all Geo Maps bootstraps preload maps3d before custom-model use", () => {
  const placement = read("app/geo-3d-placement-visual.tsx");
  const calibration = read("app/geo-visual-calibration.tsx");
  const customer = read("app/projects/[slug]/map/geo-public-map.tsx");

  for (const source of [placement, calibration, customer])
    assert.match(source, /libraries=maps3d/);
});

test("Super Admin Geo 3D has an independent Google renderer probe and anchor focus recovery", () => {
  const visual = read("app/geo-3d-placement-visual.tsx");

  assert.match(visual, /maps-docs-team\.web\.app\/assets\/windmill\.glb/);
  assert.match(visual, /Google model test/);
  assert.match(visual, /Renderer probe: exact Google docs sample · Colorado/);
  assert.match(visual, /Marker3DElement/);
  assert.match(visual, /label: "ANCHOR"/);
  assert.match(visual, /Focus building/);
  assert.match(visual, /window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(visual, /focus3DMap\(map, latitude, longitude, altitudeM, headingDeg\)/);
  assert.match(visual, /center: \{ lat: 39\.1178, lng: -106\.4452, altitude: 4395\.4952 \}/);
  assert.match(visual, /position: \{ lat: 39\.1178, lng: -106\.4452, altitude: 4495\.4952 \}/);
  assert.match(visual, /tilt: 270/);
  assert.match(visual, /roll: 90/);
  assert.match(visual, /range: 1500/);
  assert.match(visual, /!rendererProbe && flattenBaseMesh/);
  assert.match(visual, /if \(rendererProbe\) \{/);
  assert.match(visual, /map\.append\(model\);/);
  assert.match(visual, /no flattener, marker, steady wait or camera helper/);
  assert.match(visual, /scale: 0\.15/);
  assert.match(visual, /rendererProbe \? GOOGLE_RENDERER_PROBE_MODEL\.scale : scale/);
  assert.match(visual, /rendererModelUrl = GOOGLE_RENDERER_PROBE_URL/);
  assert.match(visual, /same-origin Google windmill proxy/);
  assert.match(visual, /Maps JS \{rendererRuntime\.mapsVersion\}/);
  assert.match(visual, /maps3dPreloaded/);
  assert.match(visual, /rendererResourceObservation/);
  assert.match(visual, /Probe anchor/);
  assert.match(visual, /!rendererProbe && flattenBaseMesh/);
  assert.doesNotMatch(
    visual,
    /fetch\(\s*GOOGLE_RENDERER_PROBE_URL/,
  );
});


test("isolated Google Model3D probe compares stable/current/beta Maps JS globals", () => {
  const visual = read("app/geo-3d-placement-visual.tsx");
  const route = read("app/api/admin/3d-google-model-probe/route.ts");

  assert.match(visual, /IsolatedProbeVersion = "3\.65" \| "3\.66" \| "beta"/);
  assert.match(visual, /Maps \{version\}/);
  assert.match(visual, /\/api\/admin\/3d-google-model-probe\?v=/);
  assert.match(visual, /Isolated iframe · separate Maps JS global/);

  assert.match(route, /requireSuperAdmin/);
  assert.match(route, /publicGoogleMapsBrowserKey/);
  assert.match(route, /new Set\(\["3\.65", "3\.66", "beta", "weekly"\]\)/);
  assert.match(route, /libraries=maps3d/);
  assert.match(route, /\/api\/3d-google-windmill/);
  assert.match(route, /center: \{ lat: 39\.1178, lng: -106\.4452, altitude: 4395\.4952 \}/);
  assert.match(route, /position: \{ lat: 39\.1178, lng: -106\.4452, altitude: 4495\.4952 \}/);
  assert.match(route, /cache-control": "private,no-store"/);
});


test("Google windmill proxy preserves identity GLB bytes and Engine preview avoids Platform binary hopping", () => {
  const placement = read("app/api/admin/3d-geo-placement/route.ts");
  const integration = read("app/engine-integration.ts");
  const windmill = read("app/api/3d-google-windmill/route.ts");
  const isolated = read("app/api/admin/3d-google-model-probe/route.ts");

  assert.match(placement, /engineSameOriginAdminModelPath\(renderModel\.url\)/);
  assert.match(integration, /\/3Dprojects\/api\/releases\//);
  assert.match(integration, /\/3Dprojects\/api\/models\//);
  assert.match(integration, /return `\$\{url\.pathname\}\$\{url\.search\}`/);

  assert.match(windmill, /maps-docs-team\.web\.app\/assets\/windmill\.glb/);
  assert.match(windmill, /"Accept-Encoding": "identity"/);
  assert.match(windmill, /headers\.set\("Range", range\)/);
  assert.match(windmill, /x-rekixo-model-proxy", "google-windmill"/);
  assert.match(isolated, /src: "\/api\/3d-google-windmill"/);
});
