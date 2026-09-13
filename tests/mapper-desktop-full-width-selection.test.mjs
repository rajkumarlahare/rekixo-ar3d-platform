import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const mapper = await readFile(new URL("../app/plot-mapper.tsx", import.meta.url), "utf8");

test("desktop precision mapper gives the masterplan the full row width", () => {
  assert.match(css, /REKIXO_MAPPER_DESKTOP_FULL_WIDTH_SELECTION_V1/);
  assert.match(css, /\.mapper-v4-work\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.doesNotMatch(
    css,
    /\.mapper-v4-work\{grid-template-columns:minmax\(0,1fr\) 300px\}/,
  );
  assert.match(
    css,
    /\.mapper-v4-work>\.mapper-v4-canvas\{grid-column:1;min-width:0\}/,
  );
});

test("Project plots becomes a bounded tray below the canvas instead of a side rail", () => {
  assert.match(
    css,
    /\.mapper-v4-work>\.mapper-review-list\{grid-column:1;min-width:0;max-height:min\(38vh,360px\);overflow:auto\}/,
  );
  assert.match(
    css,
    /@media\(min-width:981px\)\{\.mapper-v4-work>\.mapper-review-list \.review-summary\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}\}/,
  );

  const work = mapper.indexOf('<div className="mapper-work mapper-v4-work">');
  const canvas = mapper.indexOf("mapper-precision-canvas mapper-v4-canvas", work);
  const review = mapper.indexOf('<aside className="card mapper-list mapper-review-list">', work);
  assert.ok(work >= 0 && canvas > work && review > canvas, "canvas must remain before Project plots in DOM order");
});

test("touch/mobile behavior remains isolated", () => {
  assert.match(css, /@media\(max-width:620px\)\{[\s\S]*\.mapper-review-list\{display:none!important\}/);
  assert.match(css, /@media \(any-pointer: coarse\), \(hover: none\) \{[\s\S]*\.mapper-v4-work > \.mapper-review-list \{[\s\S]*display: none !important/);
});

test("layout-only patch does not alter mapper persistence or geometry code", () => {
  assert.match(mapper, /function parsePolygon\(plot: Plot\)/);
  assert.match(mapper, /validNormalizedPolygon/);
  assert.match(mapper, /snapPoint/);
  assert.match(mapper, /persistMapperSettings/);
  assert.match(mapper, /\/api\/super-mapper/);
});
