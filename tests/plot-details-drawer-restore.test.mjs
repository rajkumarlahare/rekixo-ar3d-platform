import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../public/project/index.html", import.meta.url), "utf8");

function motionBlock() {
  const marker = page.indexOf("REKIXO_UI_MOTION_SYSTEM_V1");
  assert.ok(marker >= 0, "motion-system marker missing");
  const end = page.indexOf("</style>", marker);
  assert.ok(end > marker, "motion-system style boundary missing");
  return page.slice(marker, end);
}

test("plot drawer uses the proven pre-motion transform and visibility contract", () => {
  assert.match(
    page,
    /\.drawer\{position:fixed;[^}]*transform:translateX\(-103%\);transition:\.22s ease;[^}]*\}\.drawer\.open\{transform:translateX\(0\)\}/,
  );
  assert.match(
    page,
    /\/\* MOBILE PLOT DETAILS — reliable full-screen drawer \*\/[\s\S]*?transform:translate3d\(-101%,0,0\);[\s\S]*?transition:transform \.24s cubic-bezier\(\.22,\.8,\.26,1\);[\s\S]*?\.drawer\.open\{transform:translate3d\(0,0,0\)\}/,
  );
  assert.match(page, /\.drawer\{visibility:hidden;pointer-events:none\}/);
  assert.match(page, /\.drawer\.open\{visibility:visible;pointer-events:auto\}/);
});

test("new generic UI motion layer does not override drawer presence or transform", () => {
  const block = motionBlock();
  assert.match(block, /REKIXO_PLOT_DRAWER_LEGACY_RESTORE_V2/);
  assert.doesNotMatch(block, /\.drawer\s*\{/);
  assert.doesNotMatch(block, /\.drawer\.open\s*\{/);
  assert.doesNotMatch(block, /[,\s]\.drawer[,{\s]/);
});

test("plot tap still opens the same details drawer", () => {
  assert.match(page, /function openPlot\(p,focus=false\)\{/);
  assert.match(
    page,
    /drawer\.scrollTop=0; drawer\.classList\.add\('open'\); drawer\.setAttribute\('aria-hidden','false'\); scrim\.classList\.add\('open'\);/,
  );
  assert.match(page, /if\(hit\) openPlot\(hit,false\);/);
  assert.match(
    page,
    /function close\(\)\{drawer\.classList\.remove\('open'\);drawer\.setAttribute\('aria-hidden','true'\);scrim\.classList\.remove\('open'\)\}/,
  );
});

test("drawer restore does not alter canonical hit testing or plot geometry", () => {
  assert.match(page, /function pointInPolygon\(/);
  assert.match(page, /function clientToPlan\(x,y\)/);
  assert.match(page, /matrixTransform\(ctm\.inverse\(\)\)/);
  assert.match(page, /function plotAtClient\(x,y,padCss=0\)/);
  assert.match(page, /function setSelected\(id\)/);
  assert.match(page, /REKIXO_SELECTED_FOCUS_BRIGHTNESS_V2/);
  assert.match(page, /REKIXO_PROJECT_START_VIEW_V1/);
});

test("gallery and lightbox keep the new motion system", () => {
  const block = motionBlock();
  assert.match(block, /\.gallery-modal\{\s*display:flex;\s*opacity:0;/);
  assert.match(block, /\.gallery-modal\.open\{/);
  assert.match(block, /\.image-lightbox\{\s*display:flex;\s*opacity:0;/);
  assert.match(block, /\.image-lightbox\.open\{/);
});
