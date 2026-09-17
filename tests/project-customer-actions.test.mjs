import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("customer calling is project-scoped and defaults ON", async () => {
  const policy = await source("../app/project-customer-actions.ts");
  assert.match(policy, /customerCallEnabled: String\(values\.customerCallEnabled \?\? "1"\) !== "0"/);
  assert.match(policy, /PROJECT_CUSTOMER_ACTION_SETTING_KEYS/);
  assert.match(policy, /customerCallEnabled \? "1" : "0"/);
});

test("only Super Admin can change customer calling", async () => {
  const [route, dashboard] = await Promise.all([
    source("../app/api/admin/project-customer-actions/route.ts"),
    source("../app/super-admin-dashboard.tsx"),
  ]);
  assert.match(route, /requireSuperAdmin/);
  assert.match(route, /sameOrigin/);
  assert.match(route, /project\.customer_actions_updated/);
  assert.match(route, /ON CONFLICT\(project_id,key\)/);
  assert.match(dashboard, /ProjectCustomerActionsManager/);
  assert.match(dashboard, /customer-actions:\$\{projectId\}/);
});

test("public project data exposes the calling feature flag", async () => {
  const route = await source("../app/api/public-data/route.ts");
  assert.match(route, /"customerCallEnabled"/);
});

test("public runtime removes both call controls while preserving WhatsApp layout", async () => {
  const worker = await source("../worker/index.ts");
  assert.match(worker, /key='customerCallEnabled'/);
  assert.match(worker, /setting\?\.value !== "0"/);
  assert.match(worker, /#callTop,#callBtn\{display:none!important\}/);
  assert.match(worker, /\.actions\{grid-template-columns:minmax\(0,1fr\)!important\}/);
  assert.match(worker, /applyPublicCustomerActionPolicy/);
});

test("Vatika Vistar alone is seeded with calling disabled", async () => {
  const migration = await source("../drizzle/0019_rekixo_project_customer_actions.sql");
  assert.match(migration, /vatika green city vistar/i);
  assert.match(migration, /vatika-green-city-vistar/i);
  assert.match(migration, /'customerCallEnabled', '0'/);
  assert.match(migration, /ON CONFLICT\(project_id, key\) DO UPDATE/);
  assert.doesNotMatch(migration, /UPDATE settings SET value = '0'/i);
});
