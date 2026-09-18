import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const visual = readFileSync(
  new URL("../app/geo-visual-calibration.tsx", import.meta.url),
  "utf8",
);
const mapper = readFileSync(
  new URL("../app/geo-mapper.tsx", import.meta.url),
  "utf8",
);
const liveRoute = readFileSync(
  new URL("../app/api/super-geo-live/route.ts", import.meta.url),
  "utf8",
);
const publicHandler = readFileSync(
  new URL("../app/api/public-geo/handler.ts", import.meta.url),
  "utf8",
);
const publicMap = readFileSync(
  new URL("../app/projects/[slug]/map/geo-public-map.tsx", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../drizzle/0020_arising_geo_public_display.sql", import.meta.url),
  "utf8",
);
const polygonMigration = readFileSync(
  new URL("../drizzle/0021_arising_geo_hide_polygons.sql", import.meta.url),
  "utf8",
);

test("Geo Lab preview toggle is not presented as public click policy", () => {
  assert.match(visual, /Plot overlay preview \(\{previewPlotFeatures\.length\}\)/);
  assert.match(visual, /Public customer map ka plot click behavior Customer Satellite Live settings se control hota hai/);
  assert.doesNotMatch(visual, /<span>Clickable plots \(/);
});

test("public Geo display policy is source-project scoped and backward compatible", () => {
  assert.match(liveRoute, /"geoPublicPlotClicks"/);
  assert.match(liveRoute, /"geoPublicShowLegend"/);
  assert.match(liveRoute, /"geoPublicShowPolygons"/);
  assert.match(liveRoute, /body\.action === "save_display"/);
  assert.match(liveRoute, /context\.source\.id/);
  assert.match(publicHandler, /live\.get\("geoPublicPlotClicks"\) !== "0"/);
  assert.match(publicHandler, /live\.get\("geoPublicShowLegend"\) !== "0"/);
  assert.match(publicHandler, /live\.get\("geoPublicShowPolygons"\) !== "0"/);
  assert.match(publicHandler, /display: \{ plotClicks, showLegend, showPolygons \}/);
  assert.match(mapper, /Public map behavior/);
  assert.match(mapper, /Project-scoped setting hai/);
});

test("public polygons, plot interaction and availability legend can be controlled safely", () => {
  assert.match(publicMap, /const hasLinkedPlot = Boolean\(feature\.linkedPlotId\)/);
  assert.match(publicMap, /const interactive = plotClicks && hasLinkedPlot/);
  assert.match(publicMap, /clickable: hasLinkedPlot/);
  assert.match(publicMap, /if \(interactive\) \{/);
  assert.match(publicMap, /if \(data\.display\?\.showPolygons !== false\) \{/);
  assert.match(publicMap, /data\.display\?\.plotClicks !== false/);
  assert.match(publicMap, /data && data\.display\?\.showLegend !== false/);
  assert.match(mapper, /Show plot shapes \/ outlines/);
  assert.match(mapper, /Plot shapes OFF hone par public map polygon render aur invisible click targets dono band rehte hain/);
});

test("Arising alone receives non-clickable, no-legend and hidden-polygon defaults", () => {
  assert.match(migration, /lower\(trim\(name\)\) = 'arising future city'/);
  assert.match(migration, /'geoPublicPlotClicks', '0'/);
  assert.match(migration, /'geoPublicShowLegend', '0'/);
  assert.match(polygonMigration, /lower\(trim\(name\)\) = 'arising future city'/);
  assert.match(polygonMigration, /'geoPublicShowPolygons', '0'/);
  assert.match(polygonMigration, /'geoPublicPlotClicks', '0'/);
  assert.doesNotMatch(liveRoute, /arising future city/i);
  assert.doesNotMatch(publicHandler, /arising future city/i);
  assert.doesNotMatch(publicMap, /arising future city/i);
});
