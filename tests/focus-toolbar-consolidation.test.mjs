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
  assert.ok(css.includes("REKIXO_MAPPER_TOOLBAR_PARITY_V2"));
  assert.ok(css.includes(".mapper-v4-canvas .mapper-focus-primary-action{"));
  assert.ok(css.includes("display:flex!important;"));
  assert.ok(css.includes(".mapper-v4-canvas .mapper-focus-actions{"));
  assert.ok(css.includes(".mapper-v4-canvas .mapper-v4-bottom-tools{"));
  assert.ok(css.includes(".mapper-v4-canvas .mapper-v4-bottom-action-row>.mapper-confirm-button{"));
  assert.ok(css.includes(".mapper-v4-canvas .mapper-v4-bottom-bar:not(.has-side-dock){"));
});

test("normal and fullscreen side assigner share the centered wide layout", () => {
  assert.ok(sideCss.includes("REKIXO_SIDE_DOCK_PARITY_V3"));
  assert.ok(sideCss.includes(".mapper-v4-canvas .mapper-side-dock{"));
  assert.ok(sideCss.includes("max-width:860px!important;"));
  assert.ok(sideCss.includes("justify-self:center!important;"));
  assert.ok(sideCss.includes("grid-template-columns:repeat(4,minmax(100px,1fr))!important;"));
  assert.ok(sideCss.includes("text-overflow:clip!important;"));
});

test("fullscreen side assigner remains viewport-centered", () => {
  assert.ok(sideCss.includes("REKIXO_FULLSCREEN_SIDE_DOCK_CENTER_V3"));
  assert.ok(sideCss.includes(".mapper-v4-canvas:fullscreen .plot-side-assigner {"));
  assert.ok(sideCss.includes("left: 50% !important;"));
  assert.ok(
    sideCss.includes(
      "bottom: calc(env(safe-area-inset-bottom, 0px) + 14px) !important;",
    ),
  );
  assert.ok(
    sideCss.includes("width: min(calc(100vw - 24px), 860px) !important;"),
  );
  assert.ok(sideCss.includes("transform: translateX(-50%) !important;"));
});
