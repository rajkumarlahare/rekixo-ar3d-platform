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

test("canonical semantics supports legacy four-side and optional three-side layout safely", () => {
  const source = read("app/plot-side-semantics.ts");
  assert.match(source, /"front" \| "back" \| "depthA" \| "depthB"/);
  assert.match(source, /PlotSideLayout = "three" \| "four"/);
  assert.match(source, /layout\?: PlotSideLayout/);
  assert.match(source, /pointCount/);
  assert.match(source, /serializePlotSideSemantics/);
  assert.match(source, /setPlotSideEdge/);
  assert.match(source, /current\?\.layout/);
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

test("Super Admin exposes numbered corner-range side assignment with legacy edge fallback", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /REKIXO_IRREGULAR_SIDE_ASSIGNER_V3_CORNER_RANGE/);
  assert.match(mapper, /selectedSemanticEdge/);
  assert.match(mapper, /assignSelectedSemanticRole/);
  assert.match(mapper, /handleSemanticCornerTap/);
  assert.match(mapper, /Role button → start corner → end corner/);
  assert.match(mapper, /3 sides · Front \/ Back \/ Depth/);
  assert.match(mapper, /4 sides · Front \/ Back \/ Depth A \/ Depth B/);
  assert.match(mapper, /semantic-badge-/);
});

test("curved irregular sides use explicit click-order corner ranges without schema migration", () => {
  const mapper = read("app/plot-mapper.tsx");
  const semantics = read("app/plot-side-semantics.ts");
  const migration = read("drizzle/0018_rekixo_plot_side_semantics.sql");

  assert.match(semantics, /forwardCornerEdgeChain/);
  assert.match(semantics, /Corner 3 → 12/);
  assert.doesNotMatch(mapper, /shortestContiguousEdgeChain/);
  assert.match(mapper, /semanticChainRole/);
  assert.match(mapper, /semanticChainStart/);
  assert.match(mapper, /assignSemanticRoleEdges/);
  assert.match(mapper, /handleSemanticCornerTap/);
  assert.match(mapper, /edgeSemanticsDraft/);
  assert.match(mapper, /resolvedSideLayout/);
  assert.match(mapper, /serializePlotSideSemantics\([\s\S]*resolvedSideLayout/);
  assert.match(mapper, /frontEdgeIndex: edgeValue/);
  assert.match(mapper, /semanticRoleMidpoint/);
  assert.match(semantics, /roles: Partial<Record<PlotSideRole, number\[\]>>/);
  assert.doesNotMatch(migration, /DROP|DELETE FROM|UPDATE plots/i);
});

test("existing single-edge semantics remain valid while three-side layout can omit Depth B", () => {
  const semantics = read("app/plot-side-semantics.ts");
  const resolver = read("app/plot-side-resolver.ts");
  assert.match(semantics, /else roles\[role\] = \[edge\]/);
  assert.match(semantics, /layout\?: PlotSideLayout/);
  assert.match(resolver, /front: \[0\]/);
  assert.match(resolver, /depthA: \[1\]/);
  assert.match(resolver, /back: \[2\]/);
  assert.match(resolver, /depthB: \[3\]/);
});

test("customer irregular diagram uses actual-edge dimensions and no guessed fallback", () => {
  const html = read("public/project/index.html");
  assert.match(html, /function plotSideSemantics/);
  assert.match(html, /parsed\.front\.length/);
  assert.match(html, /front!==null&&distinctRoles/);
  assert.match(html, /REKIXO_PUBLIC_EDGE_DIMENSIONS_V10_THREE_SIDE/);
  assert.match(html, /const irregular=.*includes\('irregular'\)/);
  assert.match(html, /setLegacyDiagramDimensionsVisible\(!canonicalRendered&&!irregular\)/);
  assert.match(html, /diagram-legend\{display:none!important\}/);
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

test("runtime cache version is v63", () => {
  assert.match(read("tests/public-runtime-cache-policy.test.mjs"), /runtime v63/);
  for (const file of ["app/page.tsx","app/preview/[projectId]/page.tsx","app/projects/[slug]/page.tsx"]) {
    assert.match(read(file), /v=63/);
  }
});
