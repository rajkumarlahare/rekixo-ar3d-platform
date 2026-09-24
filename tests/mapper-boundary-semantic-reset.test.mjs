import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [route, mapper] = await Promise.all([
  read("../app/api/super-mapper/route.ts"),
  read("../app/plot-mapper.tsx"),
]);

test("single boundary clear uses an explicit server action", () => {
  assert.match(mapper, /action: "clear_plot_boundary"/);
  assert.match(route, /body\.action === "clear_plot_boundary"/);
  assert.match(route, /front_edge_index=NULL/);
  assert.match(route, /back_edge_index=NULL/);
  assert.match(route, /depth_edge_index=NULL/);
  assert.match(route, /depth2_edge_index=NULL/);
  assert.match(route, /edge_semantics=NULL/);
});

test("boundary clear preserves measurements but removes geometry bindings", () => {
  assert.match(
    route,
    /UPDATE plot_edge_measurements[\s\S]*SET edge_index=NULL,point_count=NULL,updated_at=\?/,
  );
  assert.doesNotMatch(
    route,
    /UPDATE plot_edge_measurements[\s\S]*SET[^;]*length=NULL/,
  );
  assert.doesNotMatch(
    route,
    /DELETE FROM plot_edge_measurements[^;]*clear_plot_boundary/,
  );
});

test("clear all resets semantic bindings for every active plot", () => {
  const start = route.indexOf('body.action === "clear_all_polygons"');
  const end = route.indexOf("if (body.settings", start);
  const block = route.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /edge_semantics=NULL/);
  assert.match(block, /front_edge_index=NULL/);
  assert.match(block, /UPDATE plot_edge_measurements/);
  assert.match(block, /edge_index=NULL,point_count=NULL/);
});

test("UI reports semantic reset after verified server mutation", () => {
  assert.match(mapper, /side bindings reset/);
  assert.match(mapper, /verifyPlotPersistence\(saved\)/);
  assert.match(mapper, /verifyAllBoundariesCleared\(\)/);
});

test("redraw and handle edits reset geometry-derived side assignments locally", () => {
  const redrawStart = mapper.indexOf('function beginBoundaryShape');
  const redrawEnd = mapper.indexOf('function beginFourCornerBoundary', redrawStart);
  const redraw = mapper.slice(redrawStart, redrawEnd);
  assert.match(redraw, /setFrontEdgeIndex\(""\)/);
  assert.match(redraw, /setBackEdgeIndex\(""\)/);
  assert.match(redraw, /setDepthEdgeIndex\(""\)/);
  assert.match(redraw, /setDepth2EdgeIndex\(""\)/);
  assert.match(redraw, /setEdgeSemanticsDraft\(""\)/);

  const dragStart = mapper.indexOf('function endHandle');
  const dragEnd = mapper.indexOf('async function verifyPlotPersistence', dragStart);
  const drag = mapper.slice(dragStart, dragEnd);
  assert.match(drag, /resetGeometryDerivedSideAssignments\(\)/);
});

test("clone copies geometry only and never imports source plot side bindings", () => {
  const start = mapper.indexOf('function clonePreviousShape');
  const end = mapper.indexOf('function downloadPlotSheetTemplate', start);
  const block = mapper.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /setPoints\(polygon\.map/);
  assert.match(block, /resetGeometryDerivedSideAssignments\(\)/);
  assert.doesNotMatch(block, /source\.frontEdgeIndex/);
  assert.doesNotMatch(block, /source\.backEdgeIndex/);
  assert.doesNotMatch(block, /source\.depthEdgeIndex/);
  assert.doesNotMatch(block, /source\.depth2EdgeIndex/);
  assert.doesNotMatch(block, /source\.edgeSemantics/);
});

test("confirm does not recreate edge-zero Front after clone or geometry edit", () => {
  const start = mapper.indexOf('async function confirmPlot');
  const end = mapper.indexOf('async function remove', start);
  const block = mapper.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(block, /frontFirstFourSideEdges/);
  assert.match(block, /plotFrontDirections\[id\]/);
  assert.match(block, /Front\/Depth save karne se pehle road-facing Front edge\/chain select karein/);
});

test("CAD auto-matched geometry also drops geometry-derived bindings", () => {
  const start = mapper.indexOf('async function publishAutoMatches');
  const end = mapper.indexOf('const currentPlot', start);
  const block = mapper.slice(start, end);
  assert.match(block, /frontEdgeIndex: null/);
  assert.match(block, /backEdgeIndex: null/);
  assert.match(block, /depthEdgeIndex: null/);
  assert.match(block, /depth2EdgeIndex: null/);
  assert.match(block, /edgeSemantics: null/);
});
