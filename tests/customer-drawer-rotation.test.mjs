import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/project/index.html", import.meta.url), "utf8");

test("customer drawer rotates a render-only polygon copy with public presentation rotation", () => {
  assert.match(html, /function diagramPresentationPoints\(points\)/);
  assert.match(html, /const raw=typeof publicRotation==='number'\?publicRotation:0/);
  assert.match(html, /return \(Array\.isArray\(points\)\?points:\[\]\)\.map/);
  assert.match(html, /const diagramPoints=diagramPresentationPoints\(p\.points\)/);
  assert.match(html, /const scaledPoints=diagramPoints\.map/);
});

test("drawer rotation preserves canonical edge semantics", () => {
  const helperStart = html.indexOf("function diagramPresentationPoints(points)");
  const helperEnd = html.indexOf("function plotLengthText", helperStart);
  const helper = html.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /p\.points\s*=/);
  assert.doesNotMatch(helper, /\.reverse\(/);
  assert.doesNotMatch(helper, /\.sort\(/);

  const diagramStart = html.indexOf("function diagram(p)");
  const diagramEnd = html.indexOf("// REKIXO_PROJECT_PRICING_UPLOAD_V1", diagramStart);
  const diagram = html.slice(diagramStart, diagramEnd);
  assert.match(diagram, /renderSemanticDiagramEdges\(p,scaledPoints,cx,cy\)/);
  assert.doesNotMatch(diagram, /frontEdgeIndex\s*=/);
  assert.doesNotMatch(diagram, /backEdgeIndex\s*=/);
  assert.doesNotMatch(diagram, /depthEdgeIndex\s*=/);
});

test("main customer map keeps canonical points and rotates the shared world", () => {
  assert.match(html, /Saved polygons stay canonical\. Only the shared presentation world rotates\./);
  assert.match(html, /world\.style\.transform = `translate3d\([\s\S]*rotate\(\$\{publicRotation\*90\}deg\)`/);
});
