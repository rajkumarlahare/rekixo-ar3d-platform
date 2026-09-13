import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../public/project/index.html", import.meta.url),
  "utf8",
);

test("plot details records its open time before the trailing browser click can close it", () => {
  assert.match(page, /let lastPlotOpenAt = 0;/);
  assert.match(
    page,
    /drawer\.scrollTop=0; drawer\.classList\.add\('open'\); drawer\.setAttribute\('aria-hidden','false'\); scrim\.classList\.add\('open'\);\s*lastPlotOpenAt=performance\.now\(\);/,
  );
});

test("scrim close ignores the same tap's trailing synthetic click", () => {
  assert.match(page, /REKIXO_PLOT_DRAWER_GHOST_CLICK_FIX_V3/);
  assert.match(
    page,
    /const PLOT_DRAWER_OPEN_CLICK_GUARD_MS=420;/,
  );
  assert.match(
    page,
    /function closeFromScrim\(event\)\{[\s\S]*?performance\.now\(\)-lastPlotOpenAt<PLOT_DRAWER_OPEN_CLICK_GUARD_MS[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?return[\s\S]*?close\(\)[\s\S]*?\}/,
  );
  assert.match(
    page,
    /q\('#closeBtn'\)\.onclick=close; scrim\.onclick=closeFromScrim;/,
  );
  assert.doesNotMatch(page, /scrim\.onclick=close;/);
});

test("normal scrim close still works after the short open guard", () => {
  const start = page.indexOf("function closeFromScrim(event)");
  assert.ok(start >= 0);
  const end = page.indexOf("\n  function call()", start);
  assert.ok(end > start);
  const handler = page.slice(start, end);
  assert.match(handler, /if\(performance\.now\(\)-lastPlotOpenAt<PLOT_DRAWER_OPEN_CLICK_GUARD_MS\)/);
  assert.match(handler, /close\(\)/);
});

test("plot tap and drawer visual contracts remain unchanged", () => {
  assert.match(page, /if\(hit\) openPlot\(hit,false\);/);
  assert.match(page, /function openPlot\(p,focus=false\)\{/);
  assert.match(
    page,
    /\.drawer\{position:fixed;[^}]*transform:translateX\(-103%\);transition:\.22s ease;[^}]*\}\.drawer\.open\{transform:translateX\(0\)\}/,
  );
  assert.match(
    page,
    /transform:translate3d\(-101%,0,0\);[\s\S]*?transition:transform \.24s cubic-bezier\(\.22,\.8,\.26,1\);[\s\S]*?\.drawer\.open\{transform:translate3d\(0,0,0\)\}/,
  );
  assert.match(page, /\.drawer\{visibility:hidden;pointer-events:none\}/);
  assert.match(page, /\.drawer\.open\{visibility:visible;pointer-events:auto\}/);
});

test("ghost-click fix does not touch geometry, selected focus, pricing or start-view logic", () => {
  assert.match(page, /function pointInPolygon\(/);
  assert.match(page, /function clientToPlan\(x,y\)/);
  assert.match(page, /matrixTransform\(ctm\.inverse\(\)\)/);
  assert.match(page, /function plotAtClient\(x,y,padCss=0\)/);
  assert.match(page, /function setSelected\(id\)/);
  assert.match(page, /REKIXO_SELECTED_FOCUS_BRIGHTNESS_V2/);
  assert.match(page, /REKIXO_PROJECT_START_VIEW_V1/);
  assert.match(page, /REKIXO_PROJECT_PRICING_UPLOAD_V1/);
});
