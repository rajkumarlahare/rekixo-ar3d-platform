import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Road Access CSV is a separate source and does not replace plot inventory", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /roadAccessSheetName/);
  assert.match(mapper, /upload\(event\.target\.files\[0\], "roadAccessSheet"\)/);
  assert.match(mapper, /Road Access correction template/);
  assert.match(mapper, /Verified Plot Data/);
});

test("completed Tiyansh project allows Road Access CSV without unlocking mapper", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(
    mapper,
    /\["sourcePdf", "logo", "measurementSheet", "roadAccessSheet", "sideMappingSheet"\]\.includes\(kind\)/,
  );
});

test("Road Access backend updates only existing plots road field", () => {
  const route = read("app/api/super-mapper/route.ts");
  assert.match(route, /kind === "roadAccessSheet"/);
  assert.match(route, /parseRoadAccessSheetText/);
  assert.match(
    route,
    /UPDATE plots SET road=\?,updated_at=\? WHERE project_id=\? AND id=\?/,
  );
  assert.match(route, /Road Access CSV me unknown Plot ID/);
  assert.match(route, /mapper\.roadAccess_imported/);
});

test("Road Access parser requires ID and Road Access and ignores blank road cells", () => {
  const parser = read("app/road-access-sheet.ts");
  assert.match(parser, /Plot No\/ID aur Road Access columns chahiye/);
  assert.match(parser, /if \(!id \|\| !road\) continue/);
  assert.match(parser, /duplicate Plot ID/);
});

test("customer drawer already renders canonical road field", () => {
  const html = read("public/project/index.html");
  assert.match(html, /id="roadLabel">ROAD ACCESS/);
  assert.match(html, /q\('#road'\)\.textContent=facing\|\|p\.road\|\|'—'/);
});
