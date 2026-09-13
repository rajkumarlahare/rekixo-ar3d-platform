import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, three] = await Promise.all([
  readFile(new URL("../public/project/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/project/three-view.js", import.meta.url), "utf8"),
]);

test("2D selected focus is materially brighter while keeping motion timing", () => {
  assert.match(page, /REKIXO_SELECTED_FOCUS_BRIGHTNESS_V2/);
  assert.match(page, /0%,100%\{filter:drop-shadow\(0 0 4px rgba\(var\(--rekixo-focus-rgb\),\.82\)\) drop-shadow\(0 0 11px rgba\(var\(--rekixo-focus-rgb\),\.48\)\) brightness\(1\.10\)\}/);
  assert.match(page, /50%\{filter:drop-shadow\(0 0 8px rgba\(var\(--rekixo-focus-rgb\),\.95\)\) drop-shadow\(0 0 18px rgba\(var\(--rekixo-focus-rgb\),\.82\)\) brightness\(1\.42\)\}/);
  assert.match(page, /animation:rekixo-selected-edge 1\.45s linear infinite,rekixo-selected-pulse 2\.1s ease-in-out infinite/);
  assert.match(page, /stroke-dasharray:15 8/);
});

test("2D brighter focus stays status-aware", () => {
  assert.match(page, /\.plot\.selected\[data-status="available"\]\{--rekixo-focus-rgb:var\(--plot-available-rgb\)\}/);
  assert.match(page, /\.plot\.selected\[data-status="booked"\]\{--rekixo-focus-rgb:var\(--plot-booked-rgb\)\}/);
  assert.match(page, /\.plot\.selected\[data-status="sold"\]\{--rekixo-focus-rgb:var\(--plot-sold-rgb\)\}/);
});

test("2D gesture and reduced-motion safety stay intact", () => {
  assert.match(page, /\.map\.dragging \.plot\.selected\[data-status\],\.map\.gesture-active \.plot\.selected\[data-status\]\{animation:none;stroke-dasharray:none;filter:none\}/);
  assert.match(page, /@media \(prefers-reduced-motion:reduce\)\{/);
  assert.match(page, /\.plot\.selected\[data-status\]\{animation:none;stroke-dasharray:none;filter:drop-shadow\(0 0 4px rgba\(var\(--rekixo-focus-rgb\),\.82\)\) drop-shadow\(0 0 10px rgba\(var\(--rekixo-focus-rgb\),\.52\)\) brightness\(1\.12\)\}/);
});

test("3D selected focus amplifies the existing lightweight sweep", () => {
  assert.match(three, /REKIXO_SELECTED_FOCUS_BRIGHTNESS_V2/);
  assert.match(three, /float sweep=smoothstep\(\.72,1\.0,wave\)\*uFxMix;/);
  assert.match(three, /float glow=min\(1\.0,sweep\*1\.65\);/);
  assert.match(three, /vec3 lit=mix\(uColor\.rgb,vec3\(1\.0\),glow\);/);
  assert.match(three, /animateFx \? \.30 : 0/);
  assert.match(three, /animateFx \? \.50 : 0/);
});

test("3D pulse is brighter but palette/frame cap remain unchanged", () => {
  assert.match(three, /top=lightenStatus\(pal\.top,\.10\+\.25\*pulse\),side=lightenStatus\(pal\.side,\.08\+\.19\*pulse\),edge=lightenStatus\(pal\.edge,\.18\+\.30\*pulse\)/);
  assert.match(three, /const STATUS_OVERLAY_DARKEN=\.80/);
  assert.match(three, /now-this\.fxLast<32/);
  assert.match(three, /const animateFx=Boolean\(this\.selected&&!this\.motionReduced&&!this\.ptr\.size\)/);
});

test("brightness patch remains presentation-only", () => {
  assert.match(page, /function pointInPolygon\(/);
  assert.match(page, /function setSelected\(id\)/);
  assert.match(page, /matrixTransform\(ctm\.inverse\(\)\)/);
  assert.match(three, /function inside\(x,y,p\)/);
  assert.match(three, /build\(p\)\{const gl=this\.gl,H=0\.55,top=\[\],sh=\[\],side=\[\],loop=\[\],vert=\[\]/);
  assert.match(three, /wp\(p,y=\.02\)\{return\[\(p\[0\]-this\.imgW\/2\)\*this\.unit,y,\(p\[1\]-this\.imgH\/2\)\*this\.unit\]\}/);
  assert.doesNotMatch(three, /DB\.|R2|fetch\(/);
});
