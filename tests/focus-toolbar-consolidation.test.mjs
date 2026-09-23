import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [mapper, css] = await Promise.all([
  source("../app/plot-mapper.tsx"),
  source("../app/super-mapper.css"),
]);

test("focus toolbar mirrors the existing safe mapping actions", () => {
  assert.match(mapper, /className="mapper-focus-actions"/);
  assert.match(mapper, /onClick={undoPoint}/);
  assert.match(mapper, /onClick={clearCurrentSelection}/);
  assert.match(mapper, /onClick={clonePreviousShape}/);
  assert.match(mapper, /onClick={toggleBulkSidesMode}/);
  assert.match(mapper, /className="primary mapper-focus-confirm"/);
  assert.match(mapper, /onClick={confirmPlot}/);
});

test("bulk clear is the final toolbar action after focus controls", () => {
  const focusActions = mapper.indexOf('className="mapper-focus-actions"');
  const bulkClear = mapper.indexOf('className="mapper-clear-all"');
  assert.ok(focusActions >= 0);
  assert.ok(bulkClear > focusActions);
});

test("fullscreen removes duplicated lower actions but preserves side assignment", () => {
  assert.match(css, /REKIXO_FOCUS_TOOLBAR_ACTIONS_V1/);
  assert.match(css, /:fullscreen \.mapper-focus-actions\{[\s\S]*?display:flex/);
  assert.match(css, /:fullscreen \.mapper-v4-bottom-tools\{[\s\S]*?display:none!important/);
  assert.match(css, /:fullscreen \.mapper-v4-bottom-bar:not\(\.has-side-dock\)\{[\s\S]*?display:none!important/);
  assert.match(css, /:fullscreen \.mapper-side-dock\{[\s\S]*?grid-column:1/);
});
