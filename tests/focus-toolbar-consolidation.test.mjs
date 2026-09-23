import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [mapper, css, sideCss] = await Promise.all([
  source("../app/plot-mapper.tsx"),
  source("../app/super-mapper.css"),
  source("../app/mapper-side-controls.css"),
]);

test("focus toolbar mirrors the existing safe mapping actions", () => {
  assert.match(mapper, /className="mapper-focus-actions"/);
  assert.match(mapper, /onClick={undoPoint}/);
  assert.match(mapper, /onClick={clearCurrentSelection}/);
  assert.match(mapper, /onClick={clonePreviousShape}/);
  assert.match(mapper, /onClick={toggleBulkSidesMode}/);
  assert.match(
    mapper,
    /className="primary mapper-focus-confirm mapper-focus-primary-action"/,
  );
  assert.match(mapper, /onClick={confirmPlot}/);
});

test("focus confirm sits immediately after Select and before plot status", () => {
  const select = mapper.indexOf("onClick={enableSelectMode}");
  const focusConfirm = mapper.indexOf("mapper-focus-primary-action");
  const plotStatus = mapper.indexOf(
    'shape === "quad" ? `Plot ${plotId} · ${points.length}/4 corners`',
  );
  assert.ok(select >= 0);
  assert.ok(focusConfirm > select);
  assert.ok(plotStatus > focusConfirm);
});

test("bulk clear remains the final toolbar action after normal focus actions", () => {
  const focusActions = mapper.indexOf('className="mapper-focus-actions"');
  const bulkClear = mapper.indexOf('className="mapper-clear-all"');
  assert.ok(focusActions >= 0);
  assert.ok(bulkClear > focusActions);
});

test("fullscreen removes duplicated lower actions but preserves side assignment", () => {
  assert.match(css, /REKIXO_FOCUS_TOOLBAR_ACTIONS_V1/);
  assert.match(css, /:fullscreen \.mapper-focus-actions\{[\s\S]*?display:flex/);
  assert.match(css, /mapper-focus-primary-action\{[\s\S]*?display:none!important/);
  assert.match(css, /:fullscreen \.mapper-focus-primary-action\{[\s\S]*?display:flex!important/);
  assert.match(css, /:fullscreen \.mapper-v4-bottom-tools\{[\s\S]*?display:none!important/);
  assert.match(css, /:fullscreen \.mapper-v4-bottom-bar:not\(\.has-side-dock\)\{[\s\S]*?display:none!important/);
  assert.match(css, /:fullscreen \.mapper-side-dock\{[\s\S]*?grid-column:1/);
});

test("fullscreen plot side assigner is bottom-centered and wide enough for labels", () => {
  assert.match(sideCss, /REKIXO_FULLSCREEN_SIDE_DOCK_CENTER_V2/);
  assert.match(
    sideCss,
    /:fullscreen \.plot-side-assigner\s*\{[\s\S]*?left:\s*50% !important;[\s\S]*?bottom:\s*calc\(env\(safe-area-inset-bottom, 0px\) \+ 14px\) !important;[\s\S]*?width:\s*min\(calc\(100vw - 24px\), 860px\) !important;[\s\S]*?transform:\s*translateX\(-50%\) !important;/,
  );
  assert.match(
    sideCss,
    /:fullscreen \.mapper-side-dock \.plot-side-role-grid\s*\{[\s\S]*?repeat\(4,minmax\(100px,1fr\)\)/,
  );
  assert.match(sideCss, /text-overflow:\s*clip !important/);
});
