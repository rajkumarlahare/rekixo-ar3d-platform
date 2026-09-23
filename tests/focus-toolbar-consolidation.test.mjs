import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [mapper, css, sideCss] = await Promise.all([
  source("../app/plot-mapper.tsx"),
  source("../app/super-mapper.css"),
  source("../app/mapper-side-controls.css"),
]);

test("mapper toolbar exposes the existing safe mapping actions", () => {
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

test("confirm/update sits immediately after Select and before plot status", () => {
  const select = mapper.indexOf("onClick={enableSelectMode}");
  const confirm = mapper.indexOf("mapper-focus-primary-action");
  const plotStatus = mapper.indexOf(
    'shape === "quad" ? `Plot ${plotId} · ${points.length}/4 corners`',
  );
  assert.ok(select >= 0);
  assert.ok(confirm > select);
  assert.ok(plotStatus > confirm);
});

test("bulk clear remains the final toolbar action", () => {
  const actions = mapper.indexOf('className="mapper-focus-actions"');
  const bulkClear = mapper.indexOf('className="mapper-clear-all"');
  assert.ok(actions >= 0);
  assert.ok(bulkClear > actions);
});

test("normal and fullscreen mapper use the same consolidated top toolbar", () => {
  assert.match(css, /REKIXO_MAPPER_TOOLBAR_PARITY_V2/);
  assert.match(
    css,
    /.mapper-v4-canvas .mapper-focus-primary-action{[sS]*?display:flex!important/,
  );
  assert.match(
    css,
    /.mapper-v4-canvas .mapper-focus-actions{[sS]*?display:flex/,
  );
  assert.match(
    css,
    /.mapper-v4-canvas .mapper-v4-bottom-tools{[sS]*?display:none!important/,
  );
  assert.match(
    css,
    /.mapper-v4-canvas .mapper-v4-bottom-action-row>.mapper-confirm-button{[sS]*?display:none!important/,
  );
  assert.match(
    css,
    /.mapper-v4-canvas .mapper-v4-bottom-bar:not(.has-side-dock){[sS]*?display:none!important/,
  );
});

test("normal and fullscreen side assigner share the centered wide layout", () => {
  assert.match(sideCss, /REKIXO_SIDE_DOCK_PARITY_V3/);
  assert.match(
    sideCss,
    /.mapper-v4-canvas .mapper-side-dock{[sS]*?max-width:860px!important;[sS]*?justify-self:center!important/,
  );
  assert.match(
    sideCss,
    /.mapper-v4-canvas .mapper-side-dock .plot-side-role-grid{[sS]*?repeat(4,minmax(100px,1fr))/,
  );
  assert.match(sideCss, /text-overflow:clip!important/);
});

test("fullscreen side assigner remains viewport-centered", () => {
  assert.match(sideCss, /REKIXO_FULLSCREEN_SIDE_DOCK_CENTER_V2/);
  assert.match(
    sideCss,
    /:fullscreen .plot-side-assigners*{[sS]*?left:s*50% !important;[sS]*?bottom:s*calc(env(safe-area-inset-bottom, 0px) + 14px) !important;[sS]*?width:s*min(calc(100vw - 24px), 860px) !important;[sS]*?transform:s*translateX(-50%) !important;/,
  );
});
