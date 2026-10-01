import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Geo 3D placement migration is additive and opt-in", () => {
  const sql = read("drizzle/0034_rekixo_geo_3d_placement_v1.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS geo_3d_placements/);
  assert.match(sql, /public_enabled INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /FOREIGN KEY \(platform_project_id\) REFERENCES projects\(id\) ON DELETE CASCADE/);
  assert.doesNotMatch(sql, /\bUPDATE\s+projects\b/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\s+projects\b/i);
  assert.doesNotMatch(sql, /\bALTER\s+TABLE\s+projects\b/i);
});

test("public Geo 3D stays fail-closed and pins Engine release/model", () => {
  const resolver = read("app/geo-3d-placement.ts");
  assert.match(resolver, /if \(!placement\?\.publicEnabled\) return null/);
  assert.match(resolver, /engine\.release\.id !== placement\.engineReleaseId/);
  assert.match(resolver, /engine\.model\.id !== placement\.engineModelId/);
  assert.match(resolver, /engine\.model\.mimeType !== "model\/gltf-binary"/);
  assert.match(resolver, /preferredEngineGeoRenderModel\(engine\)/);
  assert.match(resolver, /engine\.geoModel && renderModel === engine\.geoModel/);
  assert.match(resolver, /enginePublishedModelUrl\(renderModel\.url\)/);
  assert.match(resolver, /link\.publicEnabled/);
});

test("Super Admin placement API cannot silently enable incompatible models", () => {
  const route = read("app/api/admin/3d-geo-placement/route.ts");
  assert.match(route, /sameOrigin\(request\)/);
  assert.match(route, /Published Engine release\/model available nahi hai/);
  assert.match(route, /Customer Geo 3D ke liye published Engine model GLB hona chahiye/);
  assert.match(route, /publicEnabled && !link\.publicEnabled/);
  assert.match(route, /geo\.3d_placement_saved/);
});

test("customer model redirect stays project-scoped instead of becoming an open redirect", () => {
  const route = read("app/api/public-geo-3d-model/route.ts");
  assert.match(route, /projectBySlug\(slug\)/);
  assert.match(route, /publicSiteEnabled\(project\.id\)/);
  assert.match(route, /resolvePublicGeo3DPlacement\(project\.id\)/);
  assert.match(route, /resolved\.sourceModelUrl/);
  assert.match(route, /status: 307/);
  assert.match(route, /location: sourceModelUrl/);
  assert.doesNotMatch(route, /fetchEnginePublishedModel/);
  assert.doesNotMatch(route, /url\.searchParams\.get\("url"\)/);
});

test("existing public Geo remains Satellite by default and 3D failure falls back safely", () => {
  const viewer = read("app/projects/[slug]/map/geo-public-map.tsx");
  assert.match(viewer, /useState<"satellite" \| "three-d">\("satellite"\)/);
  assert.match(viewer, /data\?\.building3d \?/);
  assert.match(viewer, /setMode\("satellite"\)/);
  assert.match(viewer, /3D Site unavailable tha, isliye safe Satellite view/);
  assert.match(viewer, /createGeo3DThreeOverlay/);
  assert.match(viewer, /fetch\(building\.modelUrl/);
  assert.match(viewer, /new Uint8Array\(modelBytes, 0, 4\)/);
  assert.match(viewer, /magic !== "glTF"/);
  assert.match(viewer, /FlattenerElement/);
  assert.match(viewer, /building\.flattenBaseMesh/);
  assert.match(viewer, /map\.append\(flattener\)/);
  assert.match(viewer, /overlay\.focusView\(building\.headingDeg, 68, 190\)/);
  assert.doesNotMatch(viewer, /new library\.Model3DElement/);
});

test("public Geo payload only exposes 3D placement when resolver succeeds", () => {
  const handler = read("app/api/public-geo/handler.ts");
  assert.match(handler, /resolvePublicGeo3DPlacement\(source\.id\)/);
  assert.match(handler, /\.\.\.\(geo3d/);
  assert.match(handler, /building3d:/);
  assert.match(handler, /geo3DRenderPolicy\(geo3d\.engine\.project\)/);
  assert.match(handler, /public-geo-3d-model/);
});


test("public Geo 3D model URL is content-fingerprinted for immutable derivative rebuilds", () => {
  const handler = read("app/api/public-geo/handler.ts");
  const viewer = read("app/projects/[slug]/map/geo-public-map.tsx");

  assert.equal(handler.includes("modelFingerprint:"), true);
  assert.equal(handler.includes("&geo=${encodeURIComponent(geo3d.engine.geoModel.sha256)}"), true);
  assert.equal(viewer.includes("modelFingerprint?: string"), true);
});

test("public Geo 3D demo reuses the stable Rekixo orbit renderer", () => {
  const viewer = read("app/projects/[slug]/map/geo-public-map.tsx");
  const css = read("app/projects/[slug]/map/geo-public-map.module.css");

  assert.match(viewer, /map3dOverlayRef/);
  assert.match(viewer, /public3DOverlayRef/);
  assert.match(viewer, /rotateViewBy\(-45\)/);
  assert.match(viewer, /rotateViewBy\(45\)/);
  assert.match(viewer, /Reset view/);
  assert.match(css, /\.map3dOverlay/);
  assert.match(css, /pointer-events:\s*auto/);
  assert.match(css, /touch-action:\s*none/);
});
