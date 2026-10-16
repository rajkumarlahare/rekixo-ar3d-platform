import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/plot-facing.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function parsePlotSideSemantics(value, pointCount) {
  let parsed;
  try { parsed = typeof value === "string" ? JSON.parse(value) : value; }
  catch { return null; }
  if (!parsed || Number(parsed.version) !== 1) return null;
  if (pointCount != null && Number(parsed.pointCount) !== pointCount) return null;
  return parsed;
}
const moduleUnderTest = { exports: {} };
const fakeRequire = (specifier) => {
  if (specifier === "./plot-side-semantics") return { parsePlotSideSemantics };
  throw new Error(`Unexpected runtime import in plot-facing.ts: ${specifier}`);
};
new Function("require", "exports", "module", javascript)(fakeRequire, moduleUnderTest.exports, moduleUnderTest);
const facing = moduleUnderTest.exports;

const polygon = [[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]];
const semantics = {
  version: 1, pointCount: 4,
  roles: { front: [0], depthA: [1], back: [2], depthB: [3] },
  roadFacingRoles: ["front", "depthA", "back", "depthB"],
};
function directionsFor(northAngle, edgeSemantics = semantics) {
  return Object.fromEntries(
    facing.plotFacingResultsForNorthAngle(polygon, JSON.stringify(edgeSemantics), northAngle)
      .map(({ role, direction }) => [role, direction]),
  );
}

test("source North at top resolves four mapped sides to N/E/S/W", () => {
  assert.deepEqual(directionsFor(0), { front:"north", depthA:"east", back:"south", depthB:"west" });
});
test("source North at right rotates side labels by one quadrant", () => {
  assert.deepEqual(directionsFor(90), { front:"west", depthA:"north", back:"east", depthB:"south" });
});
test("45 degree North bearing resolves diagonal-facing sides deterministically", () => {
  assert.deepEqual(directionsFor(45), { front:"north-west", depthA:"north-east", back:"south-east", depthB:"south-west" });
});
test("calibration and display rotation conversions round-trip for all quarter turns", () => {
  const baseline = directionsFor(37);
  for (const rotation of [0,1,2,3]) {
    const displayed = facing.displayNorthAngleFromSource(37, rotation);
    const sourceAngle = facing.sourceNorthAngleFromDisplay(displayed, rotation);
    assert.equal(sourceAngle, 37);
    assert.deepEqual(directionsFor(sourceAngle), baseline);
  }
});
test("angle normalization works and explicit plot-facing overrides remain authoritative", () => {
  assert.equal(facing.normalizeMasterplanNorthAngle(-15), 345);
  assert.equal(facing.normalizeMasterplanNorthAngle(360), 0);
  assert.equal(directionsFor(0, { ...semantics, facingDirectionOverrides: { front: "east" } }).front, "east");
});
