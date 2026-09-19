import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../drizzle/0014_rekixo_plot_pricing.sql", import.meta.url), "utf8");
const parser = await readFile(new URL("../app/plot-pricing-sheet.ts", import.meta.url), "utf8");
const api = await readFile(new URL("../app/api/admin/project-pricing/route.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../app/project-pricing-source.tsx", import.meta.url), "utf8");
const mapper = await readFile(new URL("../app/plot-mapper.tsx", import.meta.url), "utf8");
const publicApi = await readFile(new URL("../app/api/public-data/route.ts", import.meta.url), "utf8");
const publicPage = await readFile(new URL("../public/project/index.html", import.meta.url), "utf8");
const three = await readFile(new URL("../public/project/three-view.js", import.meta.url), "utf8");

test("pricing storage is additive and project-scoped", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS plot_pricing/);
  assert.match(migration, /PRIMARY KEY \(project_id, plot_id\)/);
  assert.match(schema, /export const plotPricing = sqliteTable\("plot_pricing"/);
  assert.match(schema, /primaryKey\(\{columns:\[table\.projectId,table\.plotId\]\}\)/);
});

test("pricing upload parser supports ranges and exact overrides", () => {
  assert.match(parser, /plotId:/);
  assert.match(parser, /fromId:/);
  assert.match(parser, /toId:/);
  assert.match(parser, /"sqyd" \| "sqft" \| "sqm"/);
  assert.match(parser, /Range rules first/);
  assert.match(parser, /Exact plot rows intentionally override a range/);
  assert.match(parser, /Overlapping pricing ranges Plot/);
  assert.match(parser, /duplicate exact row/);
});

test("pricing admin route resolves app-level modules from its nested API directory", () => {
  assert.match(api, /from "\.\.\/\.\.\/\.\.\/admin-auth"/);
  assert.match(api, /from "\.\.\/\.\.\/\.\.\/audit"/);
  assert.match(api, /from "\.\.\/\.\.\/\.\.\/plot-pricing-sheet"/);
  assert.doesNotMatch(api, /from "\.\.\/\.\.\/admin-auth"/);
  assert.doesNotMatch(api, /from "\.\.\/\.\.\/audit"/);
  assert.doesNotMatch(api, /from "\.\.\/\.\.\/plot-pricing-sheet"/);
});

test("pricing admin API is Super Admin only and toggle never deletes saved rates", () => {
  assert.match(api, /requireSuperAdmin\(\)/);
  assert.match(api, /sameOrigin\(request\)/);
  assert.match(api, /project\.pricing_toggled/);
  assert.match(api, /project\.pricing_uploaded/);
  assert.match(api, /DELETE FROM plot_pricing WHERE project_id=\?/);
  const patchStart = api.indexOf("export async function PATCH");
  const postStart = api.indexOf("export async function POST");
  assert.ok(patchStart >= 0 && postStart > patchStart);
  assert.doesNotMatch(api.slice(patchStart, postStart), /DELETE FROM plot_pricing/);
});

test("Plot Mapper exposes checkbox first and upload only when pricing is enabled", () => {
  assert.match(mapper, /import ProjectPricingSource from "\.\/project-pricing-source";/);
  assert.match(mapper, /<ProjectPricingSource/);
  assert.match(ui, /type="checkbox"/);
  assert.match(ui, /\{enabled \? \(/);
  assert.match(ui, /Upload pricing sheet/);
  assert.match(ui, /Download Pricing CSV Template/);
  assert.match(ui, /Checkbox OFF karne se uploaded pricing delete nahi hoti/);
});

test("public API attaches pricing only when project feature is ON", () => {
  assert.match(publicApi, /"pricingEnabled"/);
  assert.match(publicApi, /const pricingEnabled = publicSettings\.pricingEnabled === "1"/);
  assert.match(publicApi, /pricingEnabled[\s\S]*plotPricing/);
  assert.match(publicApi, /pricing:\s*\{/);
  assert.match(publicApi, /const \{ notes, \.\.\.publicPlot \} = plot/);
  assert.match(publicApi, /edgeMeasurements/);\n  assert.match(publicApi, /\.\.\.\(price/);
});

test("public drawer hides pricing by default and calculates base price from live plot area", () => {
  assert.match(publicPage, /id="pricingRateRow" style="display:none"/);
  assert.match(publicPage, /id="pricingBaseRow" style="display:none"/);
  assert.match(publicPage, /function syncPlotPricing\(p\)/);
  assert.match(publicPage, /const area=Number\(p\[unit\]\)/);
  assert.match(publicPage, /const base=area\*rate/);
  assert.match(publicPage, /function pricingUnitLabel\(unit\)\{return unit==='sqft'\?'SQ\.FT':\(unit==='sqm'\?'SQ\.M':'SQ\.YD'\)\}/);
  assert.match(publicPage, /rateLabel\.textContent='RATE \/ '\+pricingUnitLabel\(unit\)/);
  assert.match(publicPage, /BASE PRICE/);
  assert.match(publicPage, /syncPlotPricing\(p\)/);
  assert.match(publicPage, /syncPlotPricing\(fresh\)/);
});

test("3D renderer geometry stays pricing-agnostic", () => {
  assert.doesNotMatch(three, /plotPricing|pricingEnabled|BASE PRICE|pricingRate/i);
});
