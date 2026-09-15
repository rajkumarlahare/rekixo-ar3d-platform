import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync("public/project/index.html", "utf8");

test("customer diagram semantic dimensions use one neutral grey", () => {
  assert.match(html, /REKIXO_DIAGRAM_DIMENSION_GREY='#94a3b8'/);

  const start = html.indexOf("function diagramSideSpecs");
  const end = html.indexOf("function renderDiagramLegend", start);
  assert.ok(start >= 0 && end > start, "diagramSideSpecs block missing");

  const block = html.slice(start, end);
  assert.match(block, /\['front','Front',values\.front,REKIXO_DIAGRAM_DIMENSION_GREY/);
  assert.match(block, /\['back','Back',values\.back,REKIXO_DIAGRAM_DIMENSION_GREY/);
  assert.match(block, /\['depthA','Depth A',values\.depth,REKIXO_DIAGRAM_DIMENSION_GREY/);
  assert.match(block, /\['depthB','Depth B',values\.depth2,REKIXO_DIAGRAM_DIMENSION_GREY/);
  assert.doesNotMatch(block, /#22c55e|#60a5fa|#f59e0b|#a78bfa/i);
});
