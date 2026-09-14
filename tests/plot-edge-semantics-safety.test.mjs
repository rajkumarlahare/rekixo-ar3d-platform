import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("depth edge migration is additive nullable metadata", () => {
  const sql = read("drizzle/0016_rekixo_plot_edge_semantics.sql");
  assert.match(sql, /ADD COLUMN depth_edge_index INTEGER/);
  assert.doesNotMatch(sql, /DROP|DELETE FROM|UPDATE plots/i);
});

test("customer drawer contract stays Front-left and Depth-bottom", () => {
  const html = read("public/project/index.html");
  assert.match(html, /LEFT side = Front, BOTTOM side = Depth/);
  assert.match(html, /frontEdgeIndex stays mapper metadata only/);
  assert.doesNotMatch(html, /depthEdgeIndex.*diagram/i);
});

test("Super Admin has direct and bulk front-depth edge assignment", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /edgeAssignMode/);
  assert.match(mapper, /bulkSemanticMode/);
  assert.match(mapper, /applyBulkEdgeDirection/);
  assert.match(mapper, />Front side</);
  assert.match(mapper, />Depth side</);
  assert.match(mapper, /F ↑/);
  assert.match(mapper, /D ←/);
});

test("plot sheet supports Depth Edge and approved-plan feet-inch input", () => {
  const sheet = read("app/plot-sheet.ts");
  const mapper = read("app/plot-mapper.tsx");
  assert.match(sheet, /depthEdgeIndex: number \| null/);
  assert.match(sheet, /depthEdge: \["depthedge"/);
  assert.match(sheet, /const feetInches = normalized\.match/);
  assert.match(sheet, /inches < 12/);
  assert.match(sheet, /edgeIndex\(input\.depthEdge, "Depth Edge"\)/);
  assert.match(sheet, /replace\(\/\[′’\]\/g, "'"/);
  assert.match(mapper, /Front Edge,Depth Edge,Front Label,Depth Label,Side Dimensions,Notes/);
});

test("plot-sheet conflict preserves manual semantic edges when import is blank", () => {
  const route = read("app/api/super-mapper/route.ts");
  assert.match(route, /front_edge_index=COALESCE\(excluded\.front_edge_index,front_edge_index\)/);
  assert.match(route, /depth_edge_index=COALESCE\(excluded\.depth_edge_index,depth_edge_index\)/);
  assert.match(route, /depth_edge_index AS depthEdgeIndex/);
});
