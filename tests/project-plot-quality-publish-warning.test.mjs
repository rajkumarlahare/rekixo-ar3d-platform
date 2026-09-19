import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("publish review surfaces plot-detail quality without silently blocking legacy-compatible publishing", () => {
  const route = read("app/api/admin/publish/route.ts");
  const panel = read("app/project-publish-panel.tsx");

  assert.match(route, /plotDetailWarnings/);
  assert.match(route, /Front \/ Back \/ Depth A \/ Depth B incomplete/);
  assert.match(route, /Front\/Back\/Depth edge mapping incomplete/);
  assert.match(route, /detailQualityReady: warnings\.length === 0/);
  assert.match(route, /detailQualityWarnings: state\.warnings/);

  assert.match(panel, /Plot detail quality check/);
  assert.match(panel, /Public website par incomplete details dikh sakti hain/);
  assert.match(panel, /Phir bhi publish karein/);
});

test("new projects seed an empty canonical Front Direction registry", () => {
  const provisioning = read("app/project-provisioning.ts");
  assert.match(provisioning, /plotFrontDirections: "\{\}"/);
});

test("production docs lock dynamic dimensions and one canonical plot sheet", () => {
  const workflow = read("REKIXO-NEW-PROJECT-WORKFLOW.md");
  const guided = read("GUIDED-MAPPER-IMPLEMENTATION.md");
  const spec = read("AUTO-CAD-MAPPER-SPEC.md");

  assert.match(workflow, /one canonical Plot CSV\/JSON/i);
  assert.match(workflow, /Front Direction/);
  assert.match(workflow, /do not invent/i);
  assert.match(workflow, /hard-coded 1200×2133/i);

  assert.match(guided, /preserves the project's own aspect ratio\/dimensions/);
  assert.match(guided, /Tiyansh 1200×2133 is legacy-only/);
  assert.match(spec, /one canonical Plot CSV\/JSON/);
  assert.match(spec, /no-write preflight/);
});
