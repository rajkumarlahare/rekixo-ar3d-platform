import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workflow,journey,prepare]=await Promise.all([
  readFile(new URL("../.github/workflows/browser-regression.yml",import.meta.url),"utf8"),
  readFile(new URL("../scripts/verify-admin-customer-e2e.mjs",import.meta.url),"utf8"),
  readFile(new URL("../scripts/prepare-full-admin-e2e.mjs",import.meta.url),"utf8"),
]);

test("browser CI exercises real local D1 Super Admin and customer modes",()=>{
  assert.match(workflow,/wrangler d1 migrations apply tiyansh-production --local --config wrangler\.jsonc/);
  assert.match(workflow,/E2E_STAGE=admin/);
  assert.match(workflow,/PANEL_MODE=client/);
  assert.match(workflow,/E2E_STAGE=customer/);
  assert.match(prepare,/randomBytes/);
  assert.match(prepare,/e2e-phase11/);
  assert.match(workflow,/wrangler dev --local --config wrangler\.jsonc/);
});

test("Phase 11 journey covers login mapping semantics preview publish and customer",()=>{
  assert.match(journey,/Sign In as Super Admin/);
  assert.match(journey,/4-corner plot/);
  assert.match(journey,/frontEdgeIndex/);
  assert.match(journey,/depth2EdgeIndex/);
  assert.match(journey,/Authenticated preview/);
  assert.match(journey,/Publish Website/);
  assert.match(journey,/document\.fullscreenElement/);
  assert.match(journey,/admin-mobile-mapper\.png/);
  assert.ok(journey.includes("customer-${target.name}.png"));
  assert.match(journey,/name: "desktop"/);
  assert.match(journey,/name: "mobile"/);
  assert.match(journey,/\/projects\/\$\{projectSlug\}/);
});


test("mapper mutations refresh publish readiness without changing workspace tabs",async()=>{
  const mapper=await readFile(new URL("../app/plot-mapper.tsx",import.meta.url),"utf8");
  const publishPanel=await readFile(new URL("../app/project-publish-panel.tsx",import.meta.url),"utf8");
  assert.match(mapper,/rekixo:mapper-data-updated/);
  assert.match(mapper,/verifyPlotPersistence\(saved\)[\s\S]{0,260}announceMapperDataUpdated\(\)/);
  assert.match(publishPanel,/rekixo:mapper-data-updated/);
});
