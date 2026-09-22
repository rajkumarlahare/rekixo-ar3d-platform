import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapper = await readFile(new URL("../app/plot-mapper.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("side assignment is docked inside the sticky bottom bar beside confirm/update", () => {
  const bottom = mapper.indexOf("mapper-v4-bottom-bar");
  const confirm = mapper.indexOf('className="primary mapper-confirm-button"', bottom);
  const dock = mapper.indexOf('className="plot-side-assigner mapper-side-dock"', bottom);
  assert.ok(bottom >= 0, "bottom bar missing");
  assert.ok(confirm > bottom, "confirm/update button must live in bottom bar");
  assert.ok(dock > confirm, "side assigner must live after confirm/update in the same dock");
  assert.equal(mapper.indexOf('className="plot-side-assigner"', bottom), -1, "old floating side assigner must not remain");

  assert.match(css, /\.mapper-v4-bottom-bar\.has-side-dock\{grid-template-areas:"tools tools" "confirm sides"\}/);
  assert.match(css, /\.mapper-confirm-button\{grid-area:confirm/);
  assert.match(css, /\.mapper-side-dock\{grid-area:sides/);
  assert.match(css, /\.mapper-v4-canvas:fullscreen \.mapper-side-dock/);
});

test("bottom tools remain separate so the update row has a full-width side dock", () => {
  assert.match(mapper, /className="mapper-v4-bottom-tools"/);
  assert.match(css, /\.mapper-v4-bottom-tools\{grid-area:tools;grid-column:1\/-1;grid-row:1/);
  assert.match(css, /\.mapper-confirm-button\{grid-area:confirm;grid-column:1;grid-row:2/);
  assert.match(css, /\.mapper-side-dock\{grid-area:sides;grid-column:2;grid-row:2;position:static!important/);
  assert.match(css, /grid-template-columns:minmax\(112px,auto\) minmax\(0,1fr\)/);
  assert.match(css, /\.mapper-v4-canvas:fullscreen \.mapper-confirm-button\{grid-column:1;grid-row:2\}/);
  assert.match(css, /\.mapper-v4-canvas:fullscreen \.mapper-side-dock\{grid-column:2;grid-row:2;position:static!important/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*grid-template-areas:"tools tools" "confirm confirm" "sides sides"/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.mapper-confirm-button\{grid-column:1\/-1;grid-row:2\}/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.mapper-side-dock\{grid-column:1\/-1;grid-row:3/);
});

test("current side measurements render inside the plot from live values and exact saved labels", () => {
  assert.match(mapper, /function semanticRoleMeasureGuide/);
  assert.match(mapper, /const measurementOverlayPoints =\s*points\.length >= 3 \? points : savedCurrentPolygon/);
  assert.match(mapper, /const currentRoleMeasurementText = \(role: PlotSideRole\)/);
  assert.match(mapper, /currentPlot\?\.frontLabel/);
  assert.match(mapper, /currentPlot\?\.backLabel/);
  assert.match(mapper, /currentPlot\?\.depthLabel/);
  assert.match(mapper, /currentPlot\?\.depth2Label/);
  assert.match(mapper, /dimensionUnit/);
  assert.match(mapper, /className="semantic-side-measurement"/);
  assert.match(mapper, /vectorEffect="non-scaling-stroke"/);
  assert.match(mapper, /fontSize=\{12 \/ Math\.max\(1, zoom\)\}/);
});

test("measurement overlays are visual-only and saved geometry/read-back contracts stay untouched", () => {
  assert.match(mapper, /style=\{\{ pointerEvents: "none" \}\}/);
  assert.match(css, /\.semantic-side-measurement\{pointer-events:none\}/);
  assert.match(mapper, /polygon: JSON\.stringify\(points\)/);
  assert.match(mapper, /verifyPlotPersistence\(saved\)/);
  assert.match(mapper, /String\(saved\.edgeSemantics \|\| ""\) === String\(persisted\.edgeSemantics \|\| ""\)/);
});
