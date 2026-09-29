import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("plot facing is project-scoped, opt-in, and defaults safely OFF", () => {
  const policy = read("app/project-customer-actions.ts");
  const manager = read("app/project-customer-actions-manager.tsx");
  assert.match(policy, /plotFacingEnabled: String\(values\.plotFacingEnabled \?\? "0"\) === "1"/);
  assert.match(policy, /plotNorthDirection/);
  assert.match(policy, /north === "right" \|\| north === "bottom" \|\| north === "left"/);
  assert.match(manager, /Plot Facing \{actions\.plotFacingEnabled \? "Enabled" : "Disabled"\}/);
  assert.match(manager, /Masterplan North direction/);
  assert.match(manager, /Default OFF hai, isliye existing projects unchanged rahenge/);
});

test("published snapshots carry the facing switch and north orientation", () => {
  const snapshot = read("app/public-publish-snapshot.ts");
  const publicData = read("app/api/public-data/route.ts");
  assert.match(snapshot, /"plotFacingEnabled"/);
  assert.match(snapshot, /"plotNorthDirection"/);
  assert.match(publicData, /"plotFacingEnabled"/);
  assert.match(publicData, /"plotNorthDirection"/);
  assert.match(publicData, /const plotFacingEnabled = publicSettings\.plotFacingEnabled === "1"/);
  assert.match(publicData, /plotFacingText/);
  assert.match(publicData, /\.\.\.\(facing \? \{ facing \} : \{\}\)/);
});

test("road-facing metadata is stored by logical role, not fragile raw edge only", () => {
  const semantics = read("app/plot-side-semantics.ts");
  assert.match(semantics, /roadFacingRoles\?: PlotSideRole\[\]/);
  assert.match(semantics, /source\.roadFacingRoles/);
  assert.match(semantics, /serializePlotSideSemantics[\s\S]*roadFacingRoles: PlotSideRole\[\]/);
  assert.match(semantics, /current\?\.roadFacingRoles \|\| \[\]/);
});

test("mapper makes normal Front zero-work and corner road sides one-tap", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /function currentRoadFacingRoles/);
  assert.match(mapper, /Feature-on projects get the zero-work default requested for normal plots/);
  assert.match(mapper, /return \["front"\]/);
  assert.match(mapper, /function toggleRoadFacingRole/);
  assert.match(mapper, />Road \/ Facing</);
  assert.match(mapper, /Front auto default/);
  assert.match(mapper, /Road-touching corner plot me doosri logical side ko Road \/ Facing mark karein/);
});

test("AI plot CSV no longer needs facing while legacy Front Direction remains accepted", () => {
  const mapper = read("app/plot-mapper.tsx");
  const sheet = read("app/plot-sheet.ts");
  const templateStart = mapper.indexOf("function downloadPlotSheetTemplate");
  const templateEnd = mapper.indexOf("function downloadMeasurementTemplate", templateStart);
  const template = mapper.slice(templateStart, templateEnd);
  assert.doesNotMatch(template, /Dimension Unit,Front Direction/);
  assert.match(template, /facing is selected in mapper, not AI CSV/);
  assert.match(sheet, /frontDirection:/);
  assert.match(sheet, /"frontdirection"/);
});

test("customer drawer and diagram show computed one-side or corner facing only when supplied", () => {
  const html = read("public/project/index.html");
  assert.match(html, /id="diagramFacing"/);
  assert.match(html, /class="plotfacing"/);
  assert.match(html, /const facing=String\(p\.facing\|\|''\)\.trim\(\)/);
  assert.match(html, /roadLabel\.textContent=facing\?'FACING':'ROAD ACCESS'/);
  assert.match(html, /facing\.textContent=facingText/);
  assert.match(html, /facing\.hidden=!facingText/);
});

test("measurement evidence follows explicit road-facing logical roles", () => {
  const route = read("app/api/super-mapper/route.ts");
  assert.match(route, /roadFacingRoles\?: PlotSideRole\[\]/);
  assert.match(route, /roadFacing\.has\(role\) \? 1 : 0/);
  assert.match(route, /oldSemantics\?\.roadFacingRoles \|\| \["front"\]/);
  assert.match(route, /road_frontage=\?/);
});
