import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync("public/project/index.html", "utf8");
const geometryStart = html.indexOf("function semanticRoleDiagramGeometry");
const rendererStart = html.indexOf("function renderSemanticDiagramEdges", geometryStart);
const diagramStart = html.indexOf("function diagram(p)", rendererStart);

assert.ok(geometryStart >= 0 && rendererStart > geometryStart, "logical-side geometry helper missing");
assert.ok(diagramStart > rendererStart, "semantic diagram renderer missing");

const geometrySource = html.slice(geometryStart, rendererStart);
const rendererSource = html.slice(rendererStart, diagramStart);
const ctx = vm.createContext({});
vm.runInContext(geometrySource, ctx);

test("curved logical side keeps every real segment but has one weighted label anchor", () => {
  const points = [
    [0, 0],
    [40, 0],
    [46, 3],
    [50, 8],
    [52, 14],
    [52, 22],
    [40, 30],
    [0, 30],
  ];
  const geometry = ctx.semanticRoleDiagramGeometry(points, [1, 2, 3, 4], 26, 15);
  assert.ok(geometry);
  assert.equal(geometry.segments.length, 4);
  assert.equal(geometry.chainStarts.length, 1);
  assert.equal(geometry.chainEnds.length, 1);
  assert.ok(Number.isFinite(geometry.label.x));
  assert.ok(Number.isFinite(geometry.label.y));
  assert.ok(Number.isFinite(geometry.label.angle));
});

test("wrapped mapper chain remains one logical side across polygon edge zero", () => {
  const points = [
    [0, 0],
    [20, 0],
    [25, 10],
    [15, 20],
    [0, 15],
  ];
  const geometry = ctx.semanticRoleDiagramGeometry(points, [4, 0, 1], 12, 10);
  assert.ok(geometry);
  assert.deepEqual(
    Array.from(geometry.segments, (segment) => segment.edge),
    [4, 0, 1],
  );
  assert.equal(geometry.chainStarts.length, 1);
  assert.equal(geometry.chainEnds.length, 1);
});

test("future disjoint evidence can draw multiple chains without duplicating the role label", () => {
  const points = [
    [0, 0],
    [20, 0],
    [25, 10],
    [15, 20],
    [0, 15],
  ];
  const geometry = ctx.semanticRoleDiagramGeometry(points, [0, 2], 12, 10);
  assert.ok(geometry);
  assert.equal(geometry.segments.length, 2);
  assert.equal(geometry.chainStarts.length, 2);
  assert.equal(geometry.chainEnds.length, 2);
});

test("public renderer creates one text annotation per logical role, never one per segment", () => {
  assert.match(rendererSource, /for\(const \[role,title,value,color,dash\] of diagramSideSpecs\(p\)\)/);
  assert.match(rendererSource, /for\(const segment of geometry\.segments\)/);
  assert.match(rendererSource, /text\.textContent=title\+\(value\?' · '\+value:''\)/);
  assert.equal(
    (rendererSource.match(/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','text'\)/g) || []).length,
    1,
  );
  assert.doesNotMatch(rendererSource, /edgeValue/);
  assert.doesNotMatch(rendererSource, /plotEdgeMeasurementValue\(p,role,edge\)/);
});

test("fix is presentation-only and does not mutate mapper semantics or plot persistence", () => {
  const mapper = fs.readFileSync("app/plot-mapper.tsx", "utf8");
  const route = fs.readFileSync("app/api/super-mapper/route.ts", "utf8");
  assert.match(mapper, /roles\[role\] = clean/);
  assert.match(mapper, /polygon: JSON\.stringify\(points\)/);
  assert.match(route, /edge_semantics/);
  assert.doesNotMatch(rendererSource, /fetch\(|UPDATE |INSERT |DELETE |localStorage|sessionStorage/);
});
