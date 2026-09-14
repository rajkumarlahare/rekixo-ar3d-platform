import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("migration is additive nullable metadata only", () => {
  const sql = read("drizzle/0017_rekixo_exact_dimension_labels.sql");
  assert.match(sql, /ADD COLUMN front_label TEXT/);
  assert.match(sql, /ADD COLUMN depth_label TEXT/);
  assert.match(sql, /ADD COLUMN side_dimensions TEXT/);
  assert.doesNotMatch(sql, /DROP|DELETE FROM|UPDATE plots/i);
});

test("exact labels remain optional for every existing project", () => {
  const sheet = read("app/plot-sheet.ts");
  assert.match(sheet, /frontLabel: string/);
  assert.match(sheet, /depthLabel: string/);
  assert.match(sheet, /sideDimensions: string/);
  assert.match(sheet, /value\(row, indexes\.frontLabel\)/);
});

test("Super Mapper stays project scoped and sheet refresh preserves live state", () => {
  const route = read("app/api/super-mapper/route.ts");
  assert.match(route, /WHERE project_id=\?/);
  assert.match(route, /front_label=COALESCE\(excluded\.front_label,front_label\)/);
  assert.match(route, /depth_label=COALESCE\(excluded\.depth_label,depth_label\)/);
  assert.match(route, /side_dimensions=COALESCE\(excluded\.side_dimensions,side_dimensions\)/);
  const preserve = route.match(/const statement = preserveGeometry[\s\S]*?\? "([^"]+)"/)?.[1] || "";
  assert.doesNotMatch(preserve, /status=excluded\.status/);
  assert.doesNotMatch(preserve, /polygon=excluded\.polygon/);
});

test("projects without exact labels keep the old customer formatter byte-for-byte", () => {
  const html = read("public/project/index.html");
  const oldFormatter =
    "function plotLengthText(value,unit){\n" +
    "    const number=Number(value);\n" +
    "    if(!(number>0))return '';\n" +
    "    const rounded=Math.abs(number-Math.round(number))<.001?String(Math.round(number)):Number(number.toFixed(2)).toString();\n" +
    "    return rounded+' '+(unit==='m'?'m':'ft')\n" +
    "  }";
  assert.ok(html.includes(oldFormatter), "legacy numeric formatter changed");
  assert.match(
    html,
    /cleanDimensionLabel\(p\.frontLabel\)\|\|plotLengthText\(p\.front,p\.dimensionUnit\)/,
  );
  assert.match(
    html,
    /cleanDimensionLabel\(p\.depthLabel\)\|\|plotLengthText\(p\.depth,p\.dimensionUnit\)/,
  );
  assert.match(html, /id="sideDimensionsRow" style="display:none"/);
});

test("customer Front-left and Depth-bottom presentation remains unchanged", () => {
  const html = read("public/project/index.html");
  assert.match(html, /LEFT side = Front, BOTTOM side = Depth/);
  assert.match(html, /frontEdgeIndex stays mapper metadata only/);
  assert.match(html, /const verticalText='Front'/);
  assert.match(html, /const horizontalText='Depth'/);
});

test("runtime code contains no VISTAR tenant hardcode", () => {
  const runtime = [
    read("public/project/index.html"),
    read("app/api/super-mapper/route.ts"),
    read("app/plot-sheet.ts"),
  ].join("\n").toLowerCase();
  assert.doesNotMatch(runtime, /vatika-green-city-vistar|vatika green city vistar/);
});
