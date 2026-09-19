import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("plot sheet rejects ambiguous measurement units and contradictory area columns", () => {
  const source = read("app/plot-sheet.ts");
  assert.match(source, /Dimension Unit \(m ya ft\) explicitly dena zaroori hai/);
  assert.match(source, /assertAreaConsistency/);
  assert.match(source, /Sqft aur Sqm values 1% tolerance/);
  assert.match(source, /Sqft aur Sqyd values 1% tolerance/);
  assert.doesNotMatch(source, /return "ft" as const;\n}/);
});

test("plot sheet exposes a rich-detail quality report", () => {
  const source = read("app/plot-sheet.ts");
  assert.match(source, /export type PlotSheetQuality/);
  assert.match(source, /assessPlotSheetRows/);
  assert.match(source, /missingSideMeasurements/);
  assert.match(source, /partialSideMeasurements/);
  assert.match(source, /genericAreaOnlyDimensions/);
  assert.match(source, /richDetailReady/);
});

test("Super Mapper performs no-write plot sheet preflight before import", () => {
  const route = read("app/api/super-mapper/route.ts");
  assert.match(route, /kind === "plotSheetPreflight"/);
  assert.match(route, /mapper\.plotSheet_preflight/);
  assert.match(route, /assessPlotSheetRows\(rows\)/);
  const preflightStart = route.indexOf('if (kind === "plotSheetPreflight")');
  const plotSheetStart = route.indexOf('if (kind === "plotSheet")', preflightStart);
  const preflightBlock = route.slice(preflightStart, plotSheetStart);
  assert.doesNotMatch(preflightBlock, /BUCKET\.put/);
  assert.doesNotMatch(preflightBlock, /savePlots\(/);
});

test("Super Admin warns before incomplete rich-detail CSV is imported", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /preflightPlotSheet/);
  assert.match(mapper, /plotSheetPreflight/);
  assert.match(mapper, /Venkatesh jaisa Front \/ Back \/ Depth detail/);
  assert.match(mapper, /Plot Data Quality/);
  assert.match(mapper, /4-side measurements/);
  assert.match(mapper, /RICH DETAILS READY/);
});

test("canonical plot CSV template carries complete plot-detail columns", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(
    mapper,
    /Plot No,Sqft,Sqm,Sqyd,Dimensions,Road Access,Front,Back,Depth,Depth 2,Dimension Unit/,
  );
  assert.match(mapper, /Side Dimensions,Notes/);
});
