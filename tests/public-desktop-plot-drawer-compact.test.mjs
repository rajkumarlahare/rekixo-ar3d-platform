import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../public/project/index.html", import.meta.url),
  "utf8",
);

test("desktop/tablet plot drawer is compact and mobile contract stays separate", () => {
  const marker = page.indexOf("REKIXO_DESKTOP_PLOT_DRAWER_COMPACT_V1");
  const styleEnd = page.indexOf("</style>", marker);
  assert.ok(marker >= 0 && styleEnd > marker);
  const desktop = page.slice(marker, styleEnd);

  assert.match(desktop, /@media\(min-width:701px\)/);
  assert.match(desktop, /\.drawer\{[\s\S]*?width:clamp\(380px,38vw,430px\);[\s\S]*?max-width:430px;[\s\S]*?padding:24px 26px 72px/);
  assert.match(desktop, /\.drawer h2\{[\s\S]*?font-size:31px/);
  assert.match(desktop, /\.diagram\{[\s\S]*?margin-top:18px;[\s\S]*?padding:10px/);
  assert.match(desktop, /\.action\{[\s\S]*?height:52px;[\s\S]*?font-size:14px/);

  assert.match(
    page,
    /\/\* MOBILE PLOT DETAILS — reliable full-screen drawer \*\/[\s\S]*?@media\(max-width:700px\)\{[\s\S]*?width:100vw;max-width:none;[\s\S]*?height:100dvh/,
  );
});

test("drawer compaction is presentation-only", () => {
  assert.match(page, /function openPlot\(p,focus=false\)/);
  assert.match(page, /function diagram\(p\)/);
  assert.match(page, /function close\(\)/);
  assert.match(page, /matrixTransform\(ctm\.inverse\(\)\)/);
  assert.match(page, /function setSelected\(id\)/);
});
