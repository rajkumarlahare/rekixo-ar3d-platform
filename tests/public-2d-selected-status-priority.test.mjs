import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../public/project/index.html", import.meta.url), "utf8");

function getAlpha(re, label) {
  const m = page.match(re);
  assert.ok(m, `missing ${label}`);
  return Number(m[1]);
}

const rows = [
  ["available",
   /\.show-all \.plot\[data-status="available"\]\{fill:rgba\(var\(--plot-available-rgb\),(\.[0-9]+)\)/,
   /\.show-all\.status-filter-available \.plot\[data-status="available"\]\{fill:rgba\(var\(--plot-available-rgb\),(\.[0-9]+)\)/,
   /\.show-all \.plot\.selected\[data-status="available"\]\{fill:rgba\(var\(--plot-available-rgb\),(\.[0-9]+)\)/],
  ["booked",
   /\.show-all \.plot\[data-status="booked"\]\{fill:rgba\(var\(--plot-booked-rgb\),(\.[0-9]+)\)/,
   /\.show-all\.status-filter-booked \.plot\[data-status="booked"\]\{fill:rgba\(var\(--plot-booked-rgb\),(\.[0-9]+)\)/,
   /\.show-all \.plot\.selected\[data-status="booked"\]\{fill:rgba\(var\(--plot-booked-rgb\),(\.[0-9]+)\)/],
  ["sold",
   /\.show-all \.plot\[data-status="sold"\]\{fill:rgba\(var\(--plot-sold-rgb\),(\.[0-9]+)\)/,
   /\.show-all\.status-filter-sold \.plot\[data-status="sold"\]\{fill:rgba\(var\(--plot-sold-rgb\),(\.[0-9]+)\)/,
   /\.show-all \.plot\.selected\[data-status="sold"\]\{fill:rgba\(var\(--plot-sold-rgb\),(\.[0-9]+)\)/],
];

test("STATUS ON selected plot keeps a real alpha-priority gap", () => {
  assert.match(page, /REKIXO_PUBLIC_2D_SELECTED_STATUS_PRIORITY_V1/);
  for (const [name, allRe, filteredRe, selectedRe] of rows) {
    const all = getAlpha(allRe, `${name} all`);
    const filtered = getAlpha(filteredRe, `${name} filtered`);
    const selected = getAlpha(selectedRe, `${name} selected`);
    assert.ok(
      selected - Math.max(all, filtered) >= 0.25 - Number.EPSILON,
      `${name}: selected ${selected} must exceed strongest background ${Math.max(all, filtered)} by >= .25`,
    );
  }
});

test("STATUS ON selection keeps strong white moving focus edge", () => {
  assert.match(page, /\.show-all \.plot\.selected\[data-status\]\{stroke:#fff;stroke-width:2\.05\}/);
  assert.match(page, /stroke-dasharray:15 8/);
  assert.match(page, /animation:rekixo-selected-edge 1\.45s linear infinite,rekixo-selected-pulse 2\.1s ease-in-out infinite/);
});

test("priority cascade follows generic and filtered status paint", () => {
  const generic = page.indexOf('.show-all .plot[data-status="available"]');
  const filtered = page.indexOf('.show-all.status-filter-available .plot[data-status="available"]');
  const priority = page.indexOf('REKIXO_PUBLIC_2D_SELECTED_STATUS_PRIORITY_V1');
  assert.ok(generic >= 0 && filtered >= 0 && priority > filtered && priority > generic);
});

test("fix stays theme-aware and presentation-only", () => {
  assert.match(page, /rgba\(var\(--plot-available-rgb\),\.60\)/);
  assert.match(page, /rgba\(var\(--plot-booked-rgb\),\.62\)/);
  assert.match(page, /rgba\(var\(--plot-sold-rgb\),\.62\)/);
  assert.match(page, /function setSelected\(id\)/);
  assert.match(page, /svg\.getScreenCTM\?\.\(\)/);
  assert.match(page, /matrixTransform\(ctm\.inverse\(\)\)/);
});
