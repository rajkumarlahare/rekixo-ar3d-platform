import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapper = await readFile(new URL("../app/plot-mapper.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("side assignment and Update share one structural footer action row", () => {
  const bottom = mapper.indexOf("mapper-v4-bottom-bar");
  const actionRow = mapper.indexOf("mapper-v4-bottom-action-row", bottom);
  const confirm = mapper.indexOf('className="primary mapper-confirm-button"', actionRow);
  const dock = mapper.indexOf('className="plot-side-assigner mapper-side-dock"', actionRow);
  assert.ok(bottom >= 0, "bottom bar missing");
  assert.ok(actionRow > bottom, "footer action row missing");
  assert.ok(confirm > actionRow, "confirm/update must live inside footer action row");
  assert.ok(dock > confirm, "side assigner must be the right-hand peer of Update");
  assert.equal(mapper.indexOf('className="plot-side-assigner"', bottom), -1, "old floating side assigner must not remain");

  assert.match(css, /\.mapper-v4-bottom-action-row\{display:grid;grid-template-columns:minmax\(112px,1fr\)/);
  assert.match(css, /\.mapper-v4-bottom-action-row\.has-side-dock\{grid-template-columns:minmax\(112px,150px\) minmax\(0,1fr\)\}/);
  assert.match(css, /\.mapper-v4-canvas:fullscreen \.mapper-v4-bottom-action-row\.has-side-dock/);
  assert.match(css, /\.mapper-v4-canvas:fullscreen \.mapper-side-dock\{position:static!important/);
});

test("bottom tools stay on their own row and mobile stacks only inside the action row", () => {
  assert.match(mapper, /className="mapper-v4-bottom-tools"/);
  assert.match(mapper, /mapper-v4-bottom-action-row/);
  assert.match(css, /\.mapper-v4-bottom-bar\{[^}]*grid-template-rows:auto auto/);
  assert.match(css, /\.mapper-v4-bottom-tools\{display:grid;grid-template-columns:auto auto auto minmax\(150px,1fr\)/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.mapper-v4-bottom-action-row,\.mapper-v4-bottom-action-row\.has-side-dock\{grid-template-columns:1fr\}/);
});

test("current side measurements stay readable at precision zoom and use saved labels when exact", () => {
  assert.match(mapper, /function semanticRoleMeasureGuide/);
  assert.match(mapper, /const measurementOverlayPoints =\s*points\.length >= 3 \? points : savedCurrentPolygon/);
  assert.match(mapper, /const currentRoleMeasurementText = \(role: PlotSideRole\)/);
  assert.match(mapper, /currentPlot\?\.frontLabel/);
  assert.match(mapper, /currentPlot\?\.backLabel/);
  assert.match(mapper, /currentPlot\?\.depthLabel/);
  assert.match(mapper, /currentPlot\?\.depth2Label/);
  assert.match(mapper, /dimensionUnit/);
  assert.match(mapper, /className="semantic-side-measurement"/);
  assert.match(mapper, /strokeWidth=\{2\.25\}/);
  assert.match(mapper, /strokeWidth=\{3\.6 \/ Math\.max\(1, zoom\)\}/);
  assert.match(mapper, /fontSize=\{18 \/ Math\.max\(1, zoom\)\}/);
  assert.match(mapper, /diagonal \* 0\.28/);
  assert.match(mapper, /diagonal \* 0\.09/);
});

test("just-saved mapped polygon keeps Front Back Depth overlay after auto-advance", () => {
  assert.match(mapper, /function savedPlotSemanticRoles/);
  assert.match(mapper, /function savedPlotRoleMeasurementText/);
  assert.match(mapper, /const lastVerifiedPlot =/);
  assert.match(mapper, /lastVerifiedId && lastVerifiedId !== plotId/);
  assert.match(mapper, /className="semantic-side-measurement saved"/);
  assert.match(mapper, /saved-semantic-measure-/);
  assert.match(mapper, /setLastVerifiedId\(verified\.plot\.id\)/);
  assert.match(mapper, /const hasNextInventoryPlot = selectNextPlot/);
});

test("measurement overlays are visual-only and saved geometry/read-back contracts stay untouched", () => {
  assert.match(mapper, /style=\{\{ pointerEvents: "none" \}\}/);
  assert.match(css, /\.semantic-side-measurement\{pointer-events:none\}/);
  assert.match(mapper, /polygon: JSON\.stringify\(points\)/);
  assert.match(mapper, /verifyPlotPersistence\(saved\)/);
  assert.match(mapper, /String\(saved\.edgeSemantics \|\| ""\) === String\(persisted\.edgeSemantics \|\| ""\)/);
});
