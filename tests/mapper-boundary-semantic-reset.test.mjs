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
