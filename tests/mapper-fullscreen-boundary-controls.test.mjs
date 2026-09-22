import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const mapper = fs.readFileSync("app/plot-mapper.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

test("fullscreen toolbar exposes the same three boundary actions beside corner status", () => {
  const toolbar = mapper.indexOf('className="mapper-zoombar mapper-v4-toolbar"');
  const cornerStatus = mapper.indexOf('Plot ${plotId} · ${points.length}', toolbar);
  const tools = mapper.indexOf('className="mapper-inline-shape-tools"', cornerStatus);
  const zoom = mapper.indexOf('Math.round(zoom * 100)', tools);

  assert.ok(toolbar >= 0, "mapper toolbar missing");
  assert.ok(cornerStatus > toolbar, "plot/corner status missing");
  assert.ok(tools > cornerStatus, "boundary controls must be immediately after corner status");
  assert.ok(zoom > tools, "boundary controls must stay before zoom controls");

  const toolbarBlock = mapper.slice(tools, zoom);
  assert.match(toolbarBlock, /aria-label="4-corner plot"/);
  assert.match(toolbarBlock, /<FourCornerIcon \/>/);
  assert.match(toolbarBlock, /aria-label="Irregular corner plot"/);
  assert.match(toolbarBlock, /<IrregularCornerIcon \/>/);
  assert.match(toolbarBlock, /aria-label="Boundary complete"/);
  assert.match(toolbarBlock, /<CheckCircle2 \/>/);
  assert.match(toolbarBlock, /onClick=\{beginFourCornerBoundary\}/);
  assert.match(toolbarBlock, /onClick=\{beginIrregularBoundary\}/);
  assert.match(toolbarBlock, /onClick=\{completeIrregularBoundary\}/);
});

test("normal Plot Mapping Controls reuse the exact same handlers", () => {
  const normal = mapper.indexOf('<div className="card manual-fallback-card">');
  assert.ok(normal >= 0, "normal plot mapping controls missing");
  const block = mapper.slice(normal);

  assert.match(block, /onClick=\{beginFourCornerBoundary\}[\s\S]*Front-first plot · 4 corners/);
  assert.match(block, /onClick=\{beginIrregularBoundary\}[\s\S]*Irregular · corner taps/);
  assert.match(block, /onClick=\{completeIrregularBoundary\}[\s\S]*Boundary complete/);
});

test("shared handlers preserve active drafts and keep triangle semantics", () => {
  assert.match(mapper, /function beginBoundaryShape\(nextShape: "quad" \| "polygon"\)/);
  assert.match(mapper, /if \(shape === nextShape && points\.length\)[\s\S]*setManualPhase\("select"\)[\s\S]*return;/);
  assert.match(mapper, /function beginFourCornerBoundary\(\)[\s\S]*beginBoundaryShape\("quad"\)/);
  assert.match(mapper, /function beginIrregularBoundary\(\)[\s\S]*beginBoundaryShape\("polygon"\)/);
  assert.match(mapper, /function completeIrregularBoundary\(\)/);
  assert.match(mapper, /points\.length === 3 \? "three" : "four"/);
  assert.match(mapper, /roles\.depthB = \[\]/);
  assert.match(mapper, /commitSemanticRoles\(roles, "three"\)/);
});

test("toolbar buttons are compact icon-only and occupy the empty space before zoom", () => {
  assert.match(css, /\.mapper-inline-shape-tools\{display:flex;align-items:center;gap:5px;margin-right:auto/);
  assert.match(css, /\.mapper-v4-toolbar \.mapper-inline-shape-tools button\{width:38px;min-width:38px;height:38px;min-height:38px/);
  assert.match(css, /\.mapper-v4-canvas:fullscreen \.mapper-inline-shape-tools button\{[\s\S]*width:40px;[\s\S]*height:40px/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.mapper-v4-toolbar \.mapper-inline-shape-tools button\{width:42px/);
});
