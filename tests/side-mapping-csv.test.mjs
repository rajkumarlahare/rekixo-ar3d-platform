import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Side Mapping CSV is isolated from inventory", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /sideMappingSheetName/);
  assert.match(mapper, /upload\(event\.target\.files\[0\], "sideMappingSheet"\)/);
  assert.match(mapper, /Side Mapping correction template/);
});

test("completed Tiyansh project explicitly allows Side Mapping CSV", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(
    mapper,
    /\["sourcePdf", "logo", "measurementSheet", "roadAccessSheet", "sideMappingSheet"\]\.includes\(kind\)/,
  );
});

test("Side Mapping backend updates only semantic edge columns", () => {
  const route = read("app/api/super-mapper/route.ts");
  assert.match(route, /kind === "sideMappingSheet"/);
  assert.match(route, /parseSideMappingSheetText/);
  assert.match(route, /resolveFourSideEdges/);
  assert.match(route, /UPDATE plots SET front_edge_index=\?,back_edge_index=\?,depth_edge_index=\?,depth2_edge_index=\?,edge_semantics=\?,updated_at=\?/);
});

test("public diagram recovers Back and Depth B from Side Measurements", () => {
  const html = read("public/project/index.html");
  assert.match(html, /function parseSideDimensionFacts/);
  assert.match(html, /parsedSides\.back/);
  assert.match(html, /parsedSides\.depth2/);
});
