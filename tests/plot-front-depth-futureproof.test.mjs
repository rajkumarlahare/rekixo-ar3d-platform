import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("additive migration stores semantic front/depth metadata without touching sales state", () => {
  const sql = read("drizzle/0015_rekixo_plot_front_depth.sql");
  assert.match(sql, /ADD COLUMN front REAL/);
  assert.match(sql, /ADD COLUMN depth REAL/);
  assert.match(sql, /ADD COLUMN dimension_unit TEXT/);
  assert.match(sql, /ADD COLUMN front_edge_index INTEGER/);
  assert.doesNotMatch(sql, /UPDATE\s+plots/i);
  assert.doesNotMatch(sql, /status\s*=/i);
});

test("Drizzle plot schema exposes nullable front depth unit and front edge", () => {
  const schema = read("db/schema.ts");
  assert.match(schema, /front:real\("front"\)/);
  assert.match(schema, /depth:real\("depth"\)/);
  assert.match(schema, /dimensionUnit:text\("dimension_unit"\)/);
  assert.match(schema, /frontEdgeIndex:integer\("front_edge_index"\)/);
});

test("plot sheet supports bulk semantic dimensions and one-based human front edge", () => {
  const sheet = read("app/plot-sheet.ts");
  assert.match(sheet, /frontage/);
  assert.match(sheet, /plotdepth/);
  assert.match(sheet, /dimensionUnit/);
  assert.match(sheet, /frontEdgeIndex/);
  assert.match(sheet, /return oneBased - 1/);
});

test("Super Mapper persists semantic metadata while conflict update still does not overwrite live status", () => {
  const route = read("app/api/super-mapper/route.ts");
  assert.match(route, /dimension_unit AS dimensionUnit/);
  assert.match(route, /front_edge_index AS frontEdgeIndex/);
  assert.match(route, /front=excluded\.front/);
  assert.match(route, /depth=excluded\.depth/);
  const statements = [...route.matchAll(/ON CONFLICT\(project_id,id\) DO UPDATE SET ([^"]+)/g)].map((m) => m[1]);
  assert.ok(statements.length >= 2);
  for (const statement of statements) {
    assert.doesNotMatch(statement, /status=excluded\.status/);
    assert.doesNotMatch(statement, /featured=excluded\.featured/);
  }
});

test("Super Admin mapper keeps measurements independent from edge-first four-side identity", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /REKIXO_IRREGULAR_SIDE_ASSIGNER_V3_CORNER_RANGE/);
  assert.match(mapper, /selectedSemanticEdge/);
  assert.match(mapper, /assignSelectedSemanticRole/);
  assert.match(mapper, /3 sides · Front \/ Back \/ Depth/);
  assert.match(mapper, /\["front", "Front"/);
  assert.match(mapper, /\["back", "Back"/);
  assert.match(mapper, /\["depthA", "Depth A"/);
  assert.match(mapper, /\["depthB", "Depth B"/);
  assert.match(mapper, /Same boundary segment do alag side roles me assign nahi ho sakta/);
  assert.match(mapper, /Plot corner count badla hai/);
  assert.match(mapper, /serializePlotSideSemantics/);
  assert.doesNotMatch(mapper, /Front aur Depth dono size bharein/);
  assert.match(
    mapper,
    /Front Edge,Back Edge,Depth Edge,Depth 2 Edge,Front Label,Back Label,Depth Label,Depth 2 Label,Side Dimensions,Notes/,
  );
});

test("server read-back verifies front/depth metadata together with canonical polygon", () => {
  const mapper = read("app/plot-mapper.tsx");
  assert.match(mapper, /sameOptionalNumber\(saved\.front, persisted\.front\)/);
  assert.match(mapper, /sameOptionalNumber\(saved\.depth, persisted\.depth\)/);
  assert.match(mapper, /sameGeometry && sameMetadata/);
});

test("customer drawer diagram always shows Front on left and Depth on bottom", () => {
  const html = read("public/project/index.html");
  assert.match(html, /id="frontFactRow"/);
  assert.match(html, /id="depthFactRow"/);
  assert.match(html, /function plotLengthText/);

  assert.match(
    html,
    /const verticalText='Front'\+\(semantic\.front\?' · '\+semantic\.front:''\)/
  );
  assert.match(
    html,
    /const horizontalText='Depth'\+\(semantic\.depth\?' · '\+semantic\.depth:''\)/
  );

  assert.doesNotMatch(html, /frontIsVertical/);
  assert.doesNotMatch(html, /Plot width/);
  assert.doesNotMatch(html, /Plot depth/);
  assert.match(html, /syncFrontDepthFacts\(p\)/);
});

test("plots without semantic values show labels without fabricating sizes", () => {
  const html = read("public/project/index.html");

  assert.match(
    html,
    /const verticalText='Front'\+\(semantic\.front\?' · '\+semantic\.front:''\)/
  );
  assert.match(
    html,
    /const horizontalText='Depth'\+\(semantic\.depth\?' · '\+semantic\.depth:''\)/
  );

  assert.match(
    html,
    /frontRow\.style\.display=semantic\.front\?'flex':'none'/
  );
  assert.match(
    html,
    /depthRow\.style\.display=semantic\.depth\?'flex':'none'/
  );
});

test("public-data remains schema-driven so new metadata flows without tenant-specific hardcode", () => {
  const route = read("app/api/public-data/route.ts");
  assert.match(route, /db\.select\(\)\.from\(plots\)/);
  assert.doesNotMatch(route, /vatika/i);
  assert.doesNotMatch(route, /front\s*:\s*18/);
});
