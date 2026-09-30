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

test("customer model proxy is project-scoped instead of an open URL proxy", () => {
  const route = read("app/api/public-geo-3d-model/route.ts");
  assert.match(route, /projectBySlug\(slug\)/);
  assert.match(route, /publicSiteEnabled\(project\.id\)/);
  assert.match(route, /resolvePublicGeo3DPlacement\(project\.id\)/);
  assert.match(route, /resolved\.sourceModelUrl/);
  assert.doesNotMatch(route, /url\.searchParams\.get\("url"\)/);
});

test("existing public Geo remains Satellite by default and 3D failure falls back safely", () => {
  const viewer = read("app/projects/[slug]/map/geo-public-map.tsx");
  assert.match(viewer, /useState<"satellite" \| "three-d">\("satellite"\)/);
  assert.match(viewer, /data\?\.building3d \?/);
  assert.match(viewer, /setMode\("satellite"\)/);
  assert.match(viewer, /3D Site unavailable tha, isliye safe Satellite view/);
  assert.match(viewer, /Model3DElement/);
  assert.match(viewer, /altitudeMode: "RELATIVE_TO_GROUND"/);
});

test("public Geo payload only exposes 3D placement when resolver succeeds", () => {
  const handler = read("app/api/public-geo/handler.ts");
  assert.match(handler, /resolvePublicGeo3DPlacement\(source\.id\)/);
  assert.match(handler, /\.\.\.\(geo3d/);
  assert.match(handler, /building3d:/);
  assert.match(handler, /public-geo-3d-model/);
});
