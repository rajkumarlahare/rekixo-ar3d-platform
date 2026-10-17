import assert from "node:assert/strict";
import test from "node:test";
import { deriveCustomerPlotAreas } from "../app/plot-area-derivation.mjs";

function squarePlot(id, values = {}) {
  return {
    id,
    sqft: 0,
    sqm: 0,
    sqyd: 0,
    dimensions: "",
    dimensionUnit: "ft",
    polygon: JSON.stringify([[0,0],[0.1,0],[0.1,0.2],[0,0.2]]),
    front: 10,
    depth: 20,
    back: 10,
    depth2: 20,
    frontEdgeIndex: 0,
    depthEdgeIndex: 1,
    backEdgeIndex: 2,
    depth2EdgeIndex: 3,
    edgeSemantics: JSON.stringify({
      version: 1, pointCount: 4, layout: "four",
      roles: { front: [0], depthA: [1], back: [2], depthB: [3] },
    }),
    ...values,
  };
}

test("customer area fallback calculates mapped geometry from saved side lengths", () => {
  const [plot] = deriveCustomerPlotAreas([squarePlot("A")], {
    mapWidth: 1000, mapHeight: 1000, sqmToSqftFactor: 10.7639,
  });
  assert.equal(plot.sqft, 200);
  assert.equal(plot.sqm, 18.581);
  assert.equal(plot.sqyd, 22.222);
  assert.equal(plot.areaSource, "side-measurements");
});

test("existing area values are retained and missing unit conversions are filled", () => {
  const [plot] = deriveCustomerPlotAreas([squarePlot("B", { sqft: 500 })], {
    mapWidth: 1000, mapHeight: 1000,
  });
  assert.equal(plot.sqft, 500);
  assert.equal(plot.sqm, 46.452);
  assert.equal(plot.sqyd, 55.556);
  assert.equal(plot.areaSource, undefined);
});

test("geometry fallback is fail-closed when there is no usable side calibration", () => {
  const [plot] = deriveCustomerPlotAreas([squarePlot("C", {
    front: null, depth: null, back: null, depth2: null,
    dimensionUnit: "",
    frontLabel: "", backLabel: "", depthLabel: "", depth2Label: "",
    edgeSemantics: "",
    frontEdgeIndex: null, backEdgeIndex: null, depthEdgeIndex: null, depth2EdgeIndex: null,
  })], { mapWidth: 1000, mapHeight: 1000 });
  assert.equal(plot.sqft, 0);
  assert.equal(plot.sqm, 0);
  assert.equal(plot.sqyd, 0);
  assert.equal(plot.areaSource, undefined);
});

test("project-wide side calibration can fill a plot whose own side values are missing", () => {
  const calibrated = squarePlot("A");
  const calibratedAgain = squarePlot("A2", { polygon: JSON.stringify([[0.4,0],[0.5,0],[0.5,0.2],[0.4,0.2]]) });
  const missingSides = squarePlot("B", {
    front: null, depth: null, back: null, depth2: null,
    dimensionUnit: "",
    frontLabel: "", backLabel: "", depthLabel: "", depth2Label: "",
    edgeSemantics: "",
    frontEdgeIndex: null, backEdgeIndex: null, depthEdgeIndex: null, depth2EdgeIndex: null,
    polygon: JSON.stringify([[0.2,0],[0.3,0],[0.3,0.2],[0.2,0.2]]),
  });
  const plots = deriveCustomerPlotAreas([calibrated, calibratedAgain, missingSides], {
    mapWidth: 1000, mapHeight: 1000,
  });
  assert.equal(plots[1].sqft, 200);
  assert.equal(plots[1].areaSource, "side-measurements");
});

test("explicit 25 by 60 plot dimensions calculate 1500 square feet, not scaled image area", () => {
  const [plot] = deriveCustomerPlotAreas([squarePlot("46", {
    dimensions: "25' × 60'",
    front: 25, back: 25, depth: 60, depth2: 60,
  })], { mapWidth: 7680, mapHeight: 4320, sqmToSqftFactor: 10.7639 });
  assert.equal(plot.sqft, 1500);
  assert.equal(plot.sqm, 139.355);
  assert.equal(plot.sqyd, 166.667);
  assert.equal(plot.areaSource, "side-measurements");
});

test("consistent saved rectangle side lengths take precedence over image pixel scaling", () => {
  const [plot] = deriveCustomerPlotAreas([squarePlot("R", {
    dimensions: "",
    polygon: JSON.stringify([[0,0],[0.12,0],[0.12,0.24],[0,0.24]]),
    front: 25, back: 25, depth: 60, depth2: 60,
  })], { mapWidth: 7680, mapHeight: 4320 });
  assert.equal(plot.sqft, 1500);
  assert.equal(plot.areaSource, "side-measurements");
});

test("customer area basis label is removed from the drawer", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../public/project/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /id="areaCalculationNote"/);
  assert.doesNotMatch(html, /Calculated from mapped boundaries and saved side measurements/);
});
