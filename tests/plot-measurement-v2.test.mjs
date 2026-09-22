import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("measurement v2 migration is additive and Mangal Sq.Ft override is project-scoped", () => {
  const sql = read("drizzle/0023_rekixo_plot_measurement_v2.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS plot_edge_measurements/);
  assert.match(sql, /PRIMARY KEY \(project_id, plot_id, role, segment_index\)/);
  assert.match(sql, /sqmToSqftFactor', '10\.76'/);
  assert.match(sql, /SET sqft = ROUND\(sqm \* 10\.76, 3\)/);
  assert.match(sql, /lower\(trim\(p\.name\)\) = 'mangal raj park'/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM plots/i);
  assert.doesNotMatch(sql, /SET[\s\S]*sqyd\s*=/i);
  assert.equal(Number((119.95 * 10.76).toFixed(3)), 1290.662);
  assert.equal(Number((182.83 * 10.76).toFixed(3)), 1967.251);
});

test("area conversion is a project policy instead of a global 10.76 replacement", () => {
  const policy = read("app/area-policy.ts");
  const sheet = read("app/plot-sheet.ts");
  const route = read("app/api/super-mapper/route.ts");
  assert.match(policy, /STANDARD_SQM_TO_SQFT_FACTOR = 10\.7639/);
  assert.match(policy, /STANDARD_SQM_TO_SQYD_FACTOR/);
  assert.match(sheet, /sqmToSqftFactor/);
  assert.match(sheet, /sqmToSqyd\(sqm\)/);
  assert.match(route, /key === "sqmToSqftFactor"/);
  assert.match(route, /UPDATE plots SET sqft=ROUND\(sqm \* \?, 3\)/);
});

test("AI measurement manifest accepts source evidence and never needs geometry indices", () => {
  const parser = read("app/measurement-sheet.ts");
  assert.match(parser, /PlotMeasurementSheetRow/);
  assert.match(parser, /sourceRef/);
  assert.match(parser, /sourceRawText/);
  assert.match(parser, /MeasurementConfidence/);
  assert.match(parser, /verified/);
  assert.match(parser, /Front\/Back\/Depth measurements/);
  assert.doesNotMatch(parser, /frontEdgeIndex|depthEdgeIndex|backEdgeIndex/);
});

test("measurement import backfills sizes without touching polygon or sales status", () => {
  const route = read("app/api/super-mapper/route.ts");
  const start = route.indexOf('if (kind === "measurementSheet")');
  const end = route.indexOf('if (kind === "roadAccessSheet")', start);
  assert.ok(start >= 0 && end > start);
  const block = route.slice(start, end);
  assert.match(block, /parsePlotMeasurementSheetText/);
  assert.match(block, /UPDATE plots SET front=COALESCE/);
  assert.match(block, /INSERT INTO plot_edge_measurements/);
  assert.match(block, /source_ref/);
  assert.match(block, /confidence/);
  assert.doesNotMatch(block, /UPDATE plots SET[^\"\\n]*polygon\s*=/);
  assert.doesNotMatch(block, /UPDATE plots SET[^\"\\n]*status\s*=/);
  assert.doesNotMatch(block, /UPDATE plots SET[^\"\\n]*featured\s*=/);
});

test("normal manual quad workflow is front-first and direction CSV remains legacy fallback", () => {
  const mapper = read("app/plot-mapper.tsx");
  const resolver = read("app/plot-side-resolver.ts");
  assert.match(resolver, /frontFirstFourSideEdges/);
  assert.match(resolver, /front: 0/);
  assert.match(resolver, /depthA: 1/);
  assert.match(resolver, /back: 2/);
  assert.match(resolver, /depthB: 3/);
  assert.match(mapper, /frontFirstPendingRef/);
  assert.match(mapper, /pehli tapped boundary = road-facing Front/);
  assert.match(mapper, /Tap 1 \+ Tap 2 road-facing Front boundary/);
  assert.match(mapper, /frontFirstFourSideEdges\(points\.length\)/);
  assert.match(mapper, /resolveFourSideEdges/);
});

test("public drawer prefers edge-specific measurement rows and supports multi-segment roles", () => {
  const api = read("app/api/public-data/route.ts");
  const html = read("public/project/index.html");
  assert.match(api, /plotEdgeMeasurements/);
  assert.match(api, /edgeMeasurementsByPlot/);
  assert.match(html, /function plotEdgeMeasurementRows/);
  assert.match(html, /function plotEdgeMeasurementValue/);
  assert.match(html, /REKIXO_PUBLIC_EDGE_DIMENSIONS_V10_THREE_SIDE/);
  assert.match(html, /plotEdgeMeasurementValue\(p,role,edge\)\|\|value/);
});

test("runtime cache is bumped so public clients receive measurement v2", () => {
  for (const file of [
    "app/page.tsx",
    "app/preview/[projectId]/page.tsx",
    "app/projects/[slug]/page.tsx",
  ]) {
    assert.match(read(file), /v=63/);
  }
});
