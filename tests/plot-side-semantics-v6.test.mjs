import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("migration is additive and future-side fields are nullable", () => {
  const sql = read("drizzle/0018_rekixo_plot_side_semantics.sql");
  for (const field of ["back REAL","depth2 REAL","back_edge_index INTEGER","depth2_edge_index INTEGER","back_label TEXT","depth2_label TEXT","edge_semantics TEXT"]) {
    assert.match(sql, new RegExp(field.replace(" ", "\\s+")));
  }
  assert.doesNotMatch(sql, /DROP|DELETE FROM|UPDATE plots/i);
});

test("canonical semantics supports Front Back Depth A Depth B with point-count safety", () => {
  const source = read("app/plot-side-semantics.ts");
  assert.match(source, /"front" \| "back" \| "depthA" \| "depthB"/);
  assert.match(source, /pointCount/);
  assert.match(source, /serializePlotSideSemantics/);
  assert.match(source, /setPlotSideEdge/);
});

test("plot sheet accepts four-side human CSV columns", () => {
  const source = read("app/plot-sheet.ts");
  assert.match(source, /back: number \| null/);
  assert.match(source, /depth2: number \| null/);
  assert.match(source, /backEdgeIndex: number \| null/);
  assert.match(source, /depth2EdgeIndex: number \| null/);
  const schema = read("db/schema.ts");
  assert.match(schema, /backEdgeIndex:integer\("back_edge_index"\)/);
  assert.match(schema, /depth2EdgeIndex:integer\("depth2_edge_index"\)/);
  assert.match(source, /backLabel: string/);
  assert.match(source, /depth2Label: string/);
});

test("sheet re-import preserves manual canonical semantics when new columns are blank", () => {
  const route = read("app/api/super-mapper/route.ts");
  assert.match(route, /edge_semantics=COALESCE\(excluded\.edge_semantics,edge_semantics\)/);
  assert.match(route, /back_label=COALESCE\(excluded\.back_label,back_label\)/);
  assert.match(route, /depth2_label=COALESCE\(excluded\.depth2_label,depth2_label\)/);
  assert.match(route, /WHERE project_id=\?/);
});

test("Super Admin exposes direct and bulk Front Back Depth A Depth B assignment", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, />Front side<\/button>|\["front", "Front side"\]/);
  assert.match(mapper, /\["back", "Back side"\]/);
  assert.match(mapper, /\["depthA", "Depth A"\]/);
  assert.match(mapper, /\["depthB", "Depth B"\]/);
  assert.match(mapper, /semantic-badge-/);
});

test("customer actual-edge renderer is opt-in and legacy fallback remains", () => {
  const html = read("public/project/index.html");
  assert.match(html, /function plotSideSemantics/);
  assert.match(html, /parsed\.front\.length/);
  assert.match(html, /front!==null&&distinctRoles/);
  assert.match(html, /renderSemanticDiagramEdges/);
  assert.match(html, /Legacy fallback contract/);
  assert.match(html, /LEFT side = Front, BOTTOM side = Depth/);
  assert.match(html, /frontEdgeIndex stays mapper metadata only/);
});

test("runtime has no VISTAR tenant hardcode", () => {
  const runtime = [
    read("app/plot-side-semantics.ts"),
    read("app/plot-mapper.tsx"),
    read("app/api/super-mapper/route.ts"),
    read("public/project/index.html"),
  ].join("\n").toLowerCase();
  assert.doesNotMatch(runtime, /vatika-green-city-vistar|vatika green city vistar/);
});

test("runtime cache version is v57", () => {
  assert.match(read("tests/public-runtime-cache-policy.test.mjs"), /runtime v57/);
  for (const file of ["app/page.tsx","app/preview/[projectId]/page.tsx","app/projects/[slug]/page.tsx"]) {
    assert.match(read(file), /v=57/);
  }
});
