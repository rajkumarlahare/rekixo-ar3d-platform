import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");

test("Stage 5 adds one-way link metadata without importing Engine storage", () => {
  const migration = read("drizzle/0026_rekixo_ar3d_engine_links.sql");
  const schema = read("db/schema.ts");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS project_3d_links/);
  assert.match(migration, /platform_project_id TEXT PRIMARY KEY/);
  assert.match(migration, /engine_project_id TEXT NOT NULL/);
  assert.match(migration, /engine_slug TEXT NOT NULL/);
  assert.match(schema, /project3dLinks = sqliteTable\("project_3d_links"/);
  assert.doesNotMatch(schema, /projects_3d|models_3d|scenes_3d/);
});

test("3D link mutation is Super Admin and same-origin protected", () => {
  const route = read("app/api/admin/3d-link/route.ts");
  assert.match(route, /requireSuperAdmin/);
  assert.match(route, /sameOrigin\(request\)/);
  assert.match(route, /engineProjectStatus/);
  assert.match(route, /project\.3d_link_updated/);
  assert.match(route, /project\.3d_link_removed/);
});

test("Platform consumes a versioned Engine HTTP contract instead of Engine D1", () => {
  const integration = read("app/engine-integration.ts");
  assert.match(integration, /AR3D_INTEGRATION_CONTRACT_VERSION = 1/);
  assert.match(integration, /\/3Dprojects\/api\/integration\/projects\//);
  assert.match(integration, /payload\.contractVersion !== AR3D_INTEGRATION_CONTRACT_VERSION/);
  assert.doesNotMatch(integration, /rekixo-3d-production|MODEL_ASSETS|projects_3d|models_3d|scenes_3d/);
});

test("public 3D link data stays fail-closed without adding a customer header shortcut", () => {
  const integration = read("app/engine-integration.ts");
  const publicData = read("app/api/public-data/route.ts");
  const shell = read("public/project/index.html");
  assert.match(integration, /link\.status !== "active" \|\| !link\.publicEnabled/);
  assert.match(integration, /publishedEngineProject/);
  assert.match(integration, /engine\.project\.status !== "published"/);
  assert.match(publicData, /engine3d/);
  assert.doesNotMatch(shell, /engine3dTop|Open project 3D experience|title="3D Experience"/);
  assert.match(shell, /id="callTop"/);
  assert.match(shell, /id="outlineTop"/);
});

test("admin handoff transfers context only and exposes no Platform session", () => {
  const handoff = read("app/api/admin/3d-handoff/route.ts");
  assert.match(handoff, /requireSuperAdmin/);
  assert.match(handoff, /Response\.redirect/);
  assert.match(handoff, /transfers project context only/);
  assert.doesNotMatch(handoff, /SESSION_SECRET|password|cookie|Authorization/);
});
