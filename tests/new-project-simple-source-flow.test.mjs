import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Plot Mapper presents one normal onboarding path and moves correction sources to Advanced", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /Normal new-project flow/);
  assert.match(mapper, /Masterplan → one verified Plot Data file → map boundaries → quality check → preview → publish/);
  assert.match(mapper, /2\. Verified Plot Data/);
  assert.match(mapper, /ONE CSV\/JSON: area \+ road \+ Front\/Back\/Depth A\/Depth B \+ Front Direction/);
  assert.match(mapper, /Advanced \/ corrections/);
  assert.match(mapper, /Road Access correction CSV/);
  assert.match(mapper, /Side Mapping correction CSV/);\n  assert.match(mapper, /Download verified Plot Data template/);\n  assert.match(mapper, /Road Access correction template/);\n  assert.match(mapper, /Side Mapping correction template/);
});

test("advanced correction importers remain present and isolated", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /upload\(event\.target\.files\[0\], "roadAccessSheet"\)/);
  assert.match(mapper, /upload\(event\.target\.files\[0\], "sideMappingSheet"\)/);
  assert.match(mapper, /upload\(event\.target\.files\[0\], "sourceCad"\)/);
});
