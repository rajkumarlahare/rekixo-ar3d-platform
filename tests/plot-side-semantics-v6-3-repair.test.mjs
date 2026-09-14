import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/super-mapper/route.ts", import.meta.url), "utf8");
const mapper = await readFile(new URL("../app/plot-mapper.tsx", import.meta.url), "utf8");
const customer = await readFile(new URL("../public/project/index.html", import.meta.url), "utf8");

test("null and blank semantic indexes never coerce to polygon edge zero", () => {
  assert.match(
    customer,
    /if\(value===null\|\|value===undefined\|\|String\(value\)\.trim\(\)===''\)return null/,
  );
  assert.match(customer, /return front!==null&&back!==null/);
});

test("direct mapper save inserts the complete 27-field four-side schema", () => {
  const fullColumns =
    "project_id,id,sqft,sqm,sqyd,dimensions,road,front,depth,back,depth2,dimension_unit,front_edge_index,depth_edge_index,back_edge_index,depth2_edge_index,front_label,depth_label,back_label,depth2_label,side_dimensions,edge_semantics,polygon,status,notes,featured,updated_at";
  assert.equal(route.split(`INSERT INTO plots (${fullColumns}) VALUES`).length - 1, 2);
  assert.doesNotMatch(
    route,
    /road,front,depth,dimension_unit,front_edge_index,depth_edge_index,front_label,depth_label,side_dimensions,polygon,status/,
  );
});

test("all four edge indexes are polygon-range validated", () => {
  assert.match(route, /backEdgeIndex !== null \|\|/);
  assert.match(route, /depth2EdgeIndex !== null/);
  assert.match(route, /backEdgeIndex >= polygonPoints\.length/);
  assert.match(route, /depth2EdgeIndex >= polygonPoints\.length/);
});

test("fully mapped projects reopen a real saved polygon instead of a phantom id", () => {
  assert.match(mapper, /const orderedPlots = \[\.\.\.nextPlots\]\.sort\(plotSort\)/);
  assert.match(
    mapper,
    /loadPlotDetails\(orderedPlots\[0\], Boolean\(orderedPlots\[0\]\.polygon\)\)/,
  );
  assert.doesNotMatch(
    mapper,
    /else if \(nextPlots\.length\) setPlotId\(nextPlotId/,
  );
});

test("Super Admin edits all four measurements, exact labels and actual edges", () => {
  for (const marker of [
    "Back value",
    "Back exact label",
    "Depth A value",
    "Depth A exact label",
    "Depth B value",
    "Depth B exact label",
    "Back edge",
    "Depth B edge",
  ]) {
    assert.ok(mapper.includes(marker), `missing mapper field: ${marker}`);
  }
  assert.match(mapper, /back: backValue/);
  assert.match(mapper, /depth2: depth2Value/);
  assert.match(mapper, /frontLabel: frontLabelValue/);
  assert.match(mapper, /backLabel: backLabelValue/);
  assert.match(mapper, /depthLabel: depthLabelValue/);
  assert.match(mapper, /depth2Label: depth2LabelValue/);
});

test("entered dimensions cannot silently float without their selected semantic edge", () => {
  assert.match(mapper, /Front value\/label save karne se pehle actual Front edge/);
  assert.match(mapper, /Back value\/label save karne se pehle actual Back edge/);
  assert.match(mapper, /Depth A value\/label save karne se pehle actual Depth A edge/);
  assert.match(mapper, /Depth B value\/label save karne se pehle actual Depth B edge/);
});

test("after the last mapped plot is updated it remains open for visual verification", () => {
  assert.match(mapper, /const hasUnmappedAfterSave = verified\.plots\.some/);
  assert.match(mapper, /else loadPlotDetails\(verified\.plot, true\)/);
});
