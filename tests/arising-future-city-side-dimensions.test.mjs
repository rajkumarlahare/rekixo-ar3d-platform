import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const sql = fs.readFileSync("drizzle/0032_arising_future_city_plot_side_dimensions.sql", "utf8");
const TARGET = "74f50880-8adf-4158-bd8c-f65f2b1c718b";

function createSchema(db) {
  db.exec(`
    CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,slug TEXT,status TEXT,public_status TEXT,publish_version INTEGER);
    CREATE TABLE project_public_snapshots(project_id TEXT PRIMARY KEY,publish_version INTEGER);
    CREATE TABLE plots(
      project_id TEXT,id TEXT,sqft REAL,sqm REAL,sqyd REAL,dimensions TEXT,road TEXT,
      front REAL,depth REAL,back REAL,depth2 REAL,dimension_unit TEXT,
      front_edge_index INTEGER,depth_edge_index INTEGER,back_edge_index INTEGER,depth2_edge_index INTEGER,
      front_label TEXT,depth_label TEXT,back_label TEXT,depth2_label TEXT,side_dimensions TEXT,edge_semantics TEXT,
      polygon TEXT,status TEXT,featured INTEGER,inventory_active INTEGER,updated_at TEXT,
      PRIMARY KEY(project_id,id)
    );
    CREATE TABLE published_plots(
      project_id TEXT,id TEXT,sqft REAL,sqm REAL,sqyd REAL,dimensions TEXT,road TEXT,
      front REAL,depth REAL,back REAL,depth2 REAL,dimension_unit TEXT,
      front_edge_index INTEGER,depth_edge_index INTEGER,back_edge_index INTEGER,depth2_edge_index INTEGER,
      front_label TEXT,depth_label TEXT,back_label TEXT,depth2_label TEXT,side_dimensions TEXT,edge_semantics TEXT,
      polygon TEXT,status TEXT,featured INTEGER,updated_at TEXT,
      PRIMARY KEY(project_id,id)
    );
    CREATE TABLE plot_edge_measurements(
      project_id TEXT,plot_id TEXT,role TEXT,segment_index INTEGER,edge_index INTEGER,point_count INTEGER,
      length REAL,unit TEXT,raw_label TEXT,road_frontage INTEGER,road_access TEXT,source_ref TEXT,source_raw_text TEXT,
      confidence TEXT,verified INTEGER,updated_at TEXT,
      PRIMARY KEY(project_id,plot_id,role,segment_index)
    );
    CREATE TABLE published_plot_edge_measurements(
      project_id TEXT,plot_id TEXT,role TEXT,segment_index INTEGER,edge_index INTEGER,point_count INTEGER,
      length REAL,unit TEXT,raw_label TEXT,road_frontage INTEGER,road_access TEXT,
      PRIMARY KEY(project_id,plot_id,role,segment_index)
    );
    CREATE TABLE plot_pricing(project_id TEXT,plot_id TEXT,rate REAL);
  `);
}

function regularDimensionMap() {
  const ids = Array.from({ length: 110 }, (_, i) => String(i + 13));
  const map = new Map([["18", `47'8" x 45'`], ["68", `33' x 40'`]]);
  const remaining = ids.filter((id) => !map.has(id));
  const counts = [
    [`33' x 40'`, 44],
    [`33' x 45'`, 37],
    [`33' x 43'6"`, 8],
    [`47'8" x 40'`, 5],
    [`47'8" x 45'`, 3],
    [`47'8" x 43'6"`, 1],
    [`60' x 40'`, 5],
    [`60' x 45'`, 4],
    [`60' x 43'6"`, 1],
  ];
  let cursor = 0;
  for (const [dimension, count] of counts) {
    for (let i = 0; i < count; i += 1) map.set(remaining[cursor++], dimension);
  }
  assert.equal(cursor, remaining.length);
  return map;
}

function seed(db) {
  db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)").run(
    TARGET,"Arising Future City","arising-future-city-74f508","active","published",9,
  );
  db.prepare("INSERT INTO project_public_snapshots VALUES(?,?)").run(TARGET,9);
  db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)").run(
    "other","Other Project","other","active","published",1,
  );
  db.prepare("INSERT INTO project_public_snapshots VALUES(?,?)").run("other",1);

  const insertPlot = db.prepare(`INSERT INTO plots VALUES(${Array(27).fill("?").join(",")})`);
  const insertPublished = db.prepare(`INSERT INTO published_plots VALUES(${Array(26).fill("?").join(",")})`);
  const polygon = "[[0,0],[1,0],[1,1],[0,1]]";
  const dims = regularDimensionMap();
  const irregularIds = [...Array.from({length:12},(_,i)=>String(i+1)),...Array.from({length:6},(_,i)=>String(i+123))];

  const add = (id, dimension, irregular=false) => {
    const is68 = id === "68";
    const frontEdge = irregular ? 1 : is68 ? 2 : 1;
    const depthEdge = irregular ? 2 : is68 ? null : 2;
    const backEdge = irregular ? 3 : is68 ? 1 : 3;
    const depth2Edge = irregular ? 0 : null;
    const semantics = irregular
      ? '{"version":1,"pointCount":4,"roles":{"front":[1],"back":[3],"depthA":[2],"depthB":[0]}}'
      : is68
        ? '{"version":1,"pointCount":4,"roles":{"front":[2],"back":[1]}}'
        : '{"version":1,"pointCount":4,"roles":{"front":[1],"back":[3],"depthA":[2]}}';
    const common = [
      TARGET,id,1000,92.9,111.1,dimension,"33 FT ROAD",
      null,null,null,null,null,frontEdge,depthEdge,backEdge,depth2Edge,
      null,null,null,null,null,semantics,polygon,"booked",1,
    ];
    insertPlot.run(...common,1,"before");
    insertPublished.run(...common,"before");
  };
  for (const [id, dimension] of dims) add(id,dimension,false);
  for (const id of irregularIds) add(id,"Irregular",true);

  const other = [
    "other","1",777,72.2,86.3,"10' x 10'","OTHER ROAD",
    10,20,30,40,"ft",0,1,2,3,"10'","20'","30'","40'","sentinel","sentinel",
    polygon,"sold",1,
  ];
  insertPlot.run(...other,1,"other-before");
  insertPublished.run(...other,"other-before");
}

test("Arising repair is exact-tenant and fail-closed", () => {
  assert.match(sql,/74f50880-8adf-4158-bd8c-f65f2b1c718b/);
  assert.match(sql,/name='Arising Future City'/);
  assert.match(sql,/slug='arising-future-city-74f508'/);
  assert.match(sql,/p\.publish_version=9/);
  assert.match(sql,/total=128/);
  assert.match(sql,/regular=110/);
  assert.match(sql,/irregular=18/);
  assert.match(sql,/draft_edges=440/);
  assert.match(sql,/published_edges=440/);
});

test("migration fixes regular customer plot labels without touching another project or irregular plots", () => {
  const db = new DatabaseSync(":memory:");
  try {
    createSchema(db);
    seed(db);
    db.exec(sql);

    const p18 = db.prepare(`SELECT front,back,depth,depth2,dimension_unit AS unit,
      front_edge_index AS frontEdge,depth_edge_index AS depthEdge,back_edge_index AS backEdge,depth2_edge_index AS depth2Edge,
      front_label AS frontLabel,back_label AS backLabel,depth_label AS depthLabel,depth2_label AS depth2Label,
      sqft,sqm,sqyd,road,status,featured,polygon FROM plots WHERE project_id=? AND id='18'`).get(TARGET);
    assert.equal(p18.front,47.666667);
    assert.equal(p18.back,47.666667);
    assert.equal(p18.depth,45);
    assert.equal(p18.depth2,45);
    assert.equal(p18.unit,"ft");
    assert.deepEqual([p18.frontEdge,p18.depthEdge,p18.backEdge,p18.depth2Edge],[1,2,3,0]);
    assert.equal(p18.frontLabel,`47'8"`);
    assert.equal(p18.backLabel,`47'8"`);
    assert.equal(p18.depthLabel,`45'`);
    assert.equal(p18.depth2Label,`45'`);
    assert.deepEqual([p18.sqft,p18.sqm,p18.sqyd,p18.road,p18.status,p18.featured,p18.polygon],
      [1000,92.9,111.1,"33 FT ROAD","booked",1,"[[0,0],[1,0],[1,1],[0,1]]"]);

    const p68 = db.prepare(`SELECT front_edge_index AS f,depth_edge_index AS d,back_edge_index AS b,depth2_edge_index AS d2
      FROM plots WHERE project_id=? AND id='68'`).get(TARGET);
    assert.deepEqual([p68.f,p68.d,p68.b,p68.d2],[3,2,1,0]);

    assert.equal(db.prepare("SELECT COUNT(*) n FROM plot_edge_measurements WHERE project_id=?").get(TARGET).n,440);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM published_plot_edge_measurements WHERE project_id=?").get(TARGET).n,440);

    const irregular = db.prepare("SELECT front,depth,front_label AS label FROM plots WHERE project_id=? AND id='1'").get(TARGET);
    assert.deepEqual([irregular.front,irregular.depth,irregular.label],[null,null,null]);

    const other = db.prepare("SELECT front,depth,status,featured,updated_at AS u FROM plots WHERE project_id='other' AND id='1'").get();
    assert.deepEqual([other.front,other.depth,other.status,other.featured,other.u],[10,20,"sold",1,"other-before"]);
  } finally {
    db.close();
  }
});

test("repair does not mutate area, road, geometry, sales state or pricing", () => {
  const a=sql.indexOf("UPDATE plots"), b=sql.indexOf("INSERT INTO plot_edge_measurements",a);
  assert.ok(a>=0&&b>a);
  const update=sql.slice(a,b);
  for(const forbidden of [/\bpolygon\s*=/i,/\bstatus\s*=/i,/\bfeatured\s*=/i,/\bsqft\s*=/i,/\bsqm\s*=/i,/\bsqyd\s*=/i,/\broad\s*=/i]) {
    assert.doesNotMatch(update,forbidden);
  }
  assert.doesNotMatch(sql,/UPDATE\s+plot_pricing/i);
  assert.doesNotMatch(sql,/DELETE\s+FROM\s+plots/i);
  assert.doesNotMatch(sql,/DROP\s+TABLE\s+plots/i);
});
