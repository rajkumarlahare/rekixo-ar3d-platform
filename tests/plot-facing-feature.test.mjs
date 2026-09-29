import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("plot facing remains project-scoped, opt-in, and defaults safely OFF", () => {
  const policy = read("app/project-customer-actions.ts");
  const manager = read("app/project-customer-actions-manager.tsx");
  assert.match(policy, /plotFacingEnabled: String\(values\.plotFacingEnabled \?\? "0"\) === "1"/);
  assert.match(policy, /plotNorthDirection/);
  assert.match(manager, /Plot Facing \{actions\.plotFacingEnabled \? "Enabled" : "Disabled"\}/);
  assert.match(manager, /Masterplan North direction/);
  assert.match(manager, /Default OFF hai, isliye existing projects unchanged rahenge/);
});

test("published snapshots carry the facing switch and north orientation", () => {
  const snapshot = read("app/public-publish-snapshot.ts");
  const publicData = read("app/api/public-data/route.ts");
  assert.match(snapshot, /"plotFacingEnabled"/);
  assert.match(snapshot, /"plotNorthDirection"/);
  assert.match(publicData, /const plotFacingEnabled = publicSettings\.plotFacingEnabled === "1"/);
  assert.match(publicData, /plotFacingText/);
  assert.match(publicData, /\.\.\.\(facing \? \{ facing \} : \{\}\)/);
});

test("semantic facing model preserves logical road roles plus optional compass override", () => {
  const semantics = read("app/plot-side-semantics.ts");
  assert.match(semantics, /roadFacingRoles\?: PlotSideRole\[\]/);
  assert.match(semantics, /facingDirectionOverrides\?: Partial</);
  assert.match(semantics, /PlotFacingCardinalDirection/);
  assert.match(semantics, /source\.facingDirectionOverrides/);
  assert.match(semantics, /cleanFacingDirectionOverrides/);
  assert.match(semantics, /current\?\.facingDirectionOverrides \|\| \{\}/);
});

test("Front remains automatic while compass toggles only additional facing", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /Facing-enabled projects always keep Front as the canonical primary/);
  assert.match(mapper, /new Set<PlotSideRole>\(\["front", \.\.\.explicit\]\)/);
  assert.match(mapper, /function toggleCompassFacing/);
  assert.match(mapper, /Front se automatic facing hai/);
  assert.match(mapper, /second facing added/);
  assert.match(mapper, /extra facing removed/);
  assert.doesNotMatch(mapper, /function toggleRoadFacingRole/);
  assert.doesNotMatch(mapper, /plot-facing-role-toggle/);
});

test("compass is outside toolbar, inside mapper map flow, and has four cardinal arrows", () => {
  const mapper = read("app/plot-mapper.tsx");
  const toolbar = mapper.indexOf("mapper-zoombar mapper-v4-toolbar");
  const compass = mapper.indexOf("mapper-facing-compass-layer");
  const map = mapper.indexOf("mapper-image-wrap mapper-image-v2");
  assert.ok(toolbar >= 0 && compass > toolbar && map > compass);
  for (const direction of ["north", "east", "south", "west"]) {
    assert.match(mapper, new RegExp(`direction: "${direction}"`));
  }
  assert.match(mapper, /className="mapper-facing-compass"/);
  assert.match(mapper, /primary-facing/);
  assert.match(mapper, /Front auto/);
});

test("compass maps a cardinal click to the nearest non-Front logical side", () => {
  const facing = read("app/plot-facing.ts");
  const mapper = read("app/plot-mapper.tsx");
  assert.match(facing, /export function plotSideDirectionResults/);
  assert.match(facing, /export function cardinalDirectionDistance/);
  assert.match(mapper, /plotSideDirectionResults/);
  assert.match(mapper, /cardinalDirectionDistance\(candidate\.direction, direction\) > 1/);
  assert.match(mapper, /item\.role !== "front"/);
  assert.match(mapper, /\[candidate\.role\]: direction/);
});

test("public facing honors operator compass override but preserves geometric fallback", () => {
  const facing = read("app/plot-facing.ts");
  assert.match(facing, /semantics\.facingDirectionOverrides\?\.\[role\]/);
  assert.match(facing, /override[\s\S]*facingMetadata\(override\)/);
  assert.match(facing, /geometric\.get\(role\)/);
});

test("side remapping and legacy CSV correction preserve compass choices", () => {
  const route = read("app/api/super-mapper/route.ts");
  const matches = route.match(/oldSemantics\?\.facingDirectionOverrides \|\| \{\}/g) || [];
  assert.ok(matches.length >= 2);
  assert.match(route, /roadFacingRoles: oldSemantics\?\.roadFacingRoles \|\| \["front"\]/);
});

test("AI plot CSV still does not own facing while legacy Front Direction remains accepted", () => {
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

test("customer drawer and diagram continue to show computed one-side or corner facing", () => {
  const html = read("public/project/index.html");
  assert.match(html, /id="diagramFacing"/);
  assert.match(html, /class="plotfacing"/);
  assert.match(html, /const facing=String\(p\.facing\|\|''\)\.trim\(\)/);
  assert.match(html, /roadLabel\.textContent=facing\?'FACING':'ROAD ACCESS'/);
  assert.match(html, /facing\.textContent=facingText/);
});

test("floating compass styling is map-overlay, touch-safe and not toolbar content", () => {
  const css = read("app/mapper-side-controls.css");
  assert.match(css, /REKIXO_PLOT_FACING_COMPASS_V1/);
  assert.match(css, /\.mapper-v4-canvas \.mapper-facing-compass-layer\{/);
  assert.match(css, /position:sticky/);
  assert.match(css, /top:112px/);
  assert.match(css, /justify-content:flex-end/);
  assert.match(css, /pointer-events:none/);
  assert.match(css, /\.mapper-facing-compass button\.primary-facing/);
  assert.match(css, /@media\(max-width:620px\)/);
});
