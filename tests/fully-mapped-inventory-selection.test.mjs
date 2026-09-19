import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("fully mapped inventory never invents a phantom next plot", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /else if \(orderedNextPlots\.length\) loadPlotDetails\(orderedNextPlots\[0\], false\)/);
  assert.match(mapper, /function selectNextPlot\(afterId = "", sourcePlots: Plot\[\] = plots\)/);
  assert.match(mapper, /ordered\.find\(\(plot\) => plot\.id === afterId\) \|\| ordered\[0\] \|\| null/);
  assert.doesNotMatch(
    mapper,
    /setPlotId\(nextPlotId\(afterId \|\| ordered\.at\(-1\)\?\.id \|\| "1"\)\)/,
  );
  assert.match(mapper, /all \$\{verified\.plots\.length\} inventory plots mapped/);
});

test("next-plot selection verifies against the server-readback inventory snapshot", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(
    mapper,
    /selectNextPlot\(\s*verified\.plot\.id,\s*verified\.plots,\s*\)/s,
  );
});
