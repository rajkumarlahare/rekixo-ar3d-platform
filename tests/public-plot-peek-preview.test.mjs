import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, three] = await Promise.all([
  readFile(new URL("../public/project/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/project/three-view.js", import.meta.url), "utf8"),
]);

test("plot peek is presentation-only and status-themed", () => {
  assert.match(page, /REKIXO_PLOT_PEEK_V1/);
  assert.match(page, /\.plot-peek\{--peek-rgb:var\(--plot-available-rgb\)/);
  assert.match(page, /pointer-events:none/);
  assert.match(page, /data-status="booked"/);
  assert.match(page, /plotPeekArea\(p\)/);
});

test("desktop 2D hover reuses canonical transformed plot hit testing", () => {
  assert.match(page, /schedulePlotPeekHover\(e\)/);
  assert.match(page, /e\.pointerType!=='mouse'/);
  assert.match(page, /const hit=plotAtClient\(point\.x,point\.y,0\)/);
  assert.match(page, /svg\.getScreenCTM\?\.\(\)/);
});

test("mobile 2D long press previews without turning release into a drawer tap", () => {
  assert.match(page, /PLOT_PEEK_LONG_PRESS_MS=460,PLOT_PEEK_MOVE_CANCEL_PX=12/);
  assert.match(page, /beginPlotPeekPress\(e,hit\)/);
  assert.match(page, /const suppressTap=plotPeekPressShown&&plotPeekPressPointerId===e\.pointerId/);
  assert.match(page, /const wasTap=single&&!g\.moved&&!cancelled&&!suppressTap/);
  assert.match(page, /if\(d>PLOT_PEEK_MOVE_CANCEL_PX\)cancelPlotPeekPress\(true\)/);
});

test("3D hover uses a non-mutating hitTest and touch long press suppresses click selection", () => {
  assert.match(three, /hitTest\(x,y\)\{/);
  assert.match(three, /previewAt\(x,y\)\{const p=this\.hitTest\(x,y\)/);
  assert.match(three, /startLongPress\(e,p\)/);
  assert.match(three, /this\.longPressTimer=setTimeout/);
  assert.match(three, /const suppressPick=this\.longPressShown&&this\.longPressPointerId===e\.pointerId/);
  assert.match(three, /const p=this\.hitTest\(x,y\);if\(p\)this\.select\(p\.id,false,true\)/);
});

test("preview cancels on pan, pinch, mode switch, blur and live-state refresh is safe", () => {
  assert.match(page, /if\(active\)\{viewport\.classList\.add\('dragging'\);cancelPlotPeekPress\(true\);hidePlotPeek\(\)\}/);
  assert.match(page, /const cancelMapGesture=\(\)=>\{cancelPlotPeekPress\(true\);hidePlotPeek\(\)/);
  assert.match(page, /cancelPlotPeekPress\(true\);hidePlotPeek\(\);pointers\.clear\(\)/);
  assert.match(page, /freshPeek=plots\.find/);
  assert.match(three, /deactivate\(\)\{this\.cancelLongPress\(true\);this\.endPreview\(\)/);
});
