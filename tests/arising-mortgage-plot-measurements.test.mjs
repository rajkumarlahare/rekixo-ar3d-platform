import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const sql = fs.readFileSync("drizzle/0033_arising_mortgage_plot_measurements.sql","utf8");
const TARGET = "74f50880-8adf-4158-bd8c-f65f2b1c718b";

function schema(db) {
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
      length REAL,unit TEXT,raw_label TEXT,road_frontage INTEGER,road_access TEXT,
      source_ref TEXT,source_raw_text TEXT,confidence TEXT,verified INTEGER,updated_at TEXT,
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

const oldEdges = new Map([
  ["1",[1,2,3,0,4]],["2",[1,2,3,0,4]],["3",[1,0,3,2,4]],
  ["4",[1,0,3,2,4]],["5",[1,0,3,2,4]],["6",[1,0,3,2,4]],
  ["7",[1,4,5,0,6]],["8",[1,0,3,2,4]],["9",[2,1,0,3,4]],
  ["10",[2,1,0,3,4]],["11",[2,1,null,3,4]],["12",[3,2,1,null,4]],
  ["123",[1,null,3,2,4]],["124",[2,1,null,3,4]],["125",[2,1,0,3,4]],
  ["126",[2,1,0,3,4]],["127",[2,3,0,1,4]],["128",[2,3,0,1,4]],
]);

function seed(db) {
  db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)").run(
    TARGET,"Arising Future City","arising-future-city-74f508","active","published",9
  );
  db.prepare("INSERT INTO project_public_snapshots VALUES(?,?)").run(TARGET,9);
  db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)").run(
    "other","Other Project","other","active","published",1
  );
  db.prepare("INSERT INTO project_public_snapshots VALUES(?,?)").run("other",1);

  const insertPlot = db.prepare(`INSERT INTO plots VALUES(${Array(27).fill("?").join(",")})`);
  const insertPublished = db.prepare(`INSERT INTO published_plots VALUES(${Array(26).fill("?").join(",")})`);

  for (const [id,edge] of oldEdges) {
    const pointCount=edge[4];
    const polygon = pointCount===6
      ? "[[0,0],[1,0],[1,1],[0.3,1.1],[0.1,1.05],[0,1]]"
      : "[[0,0],[1,0],[1,1],[0,1]]";
    const semantics = JSON.stringify({
      version:1,pointCount,
      roles:{
        front:[edge[0]],
        ...(edge[2]===null?{}:{back:[edge[2]]}),
        ...(edge[1]===null?{}:{depthA:[edge[1]]}),
        ...(edge[3]===null?{}:{depthB:[edge[3]]}),
      }
    });
    const common=[
      TARGET,id,1000,92.9,111.1,"Irregular","ROAD",
      null,null,null,null,null,edge[0],edge[1],edge[2],edge[3],
      null,null,null,null,null,semantics,polygon,"booked",1,
    ];
    insertPlot.run(...common,1,"before");
    insertPublished.run(...common,"before");
  }

  const regular=[
    TARGET,"18",2143.57,199.14,238.174,`47'8" x 45'`,"ROAD",
    47.666667,45,47.666667,45,"ft",1,2,3,0,`47'8"`,`45'`,`47'8"`,`45'`,
    "regular sentinel","regular semantics","[[0,0],[1,0],[1,1],[0,1]]","sold",1,
  ];
  insertPlot.run(...regular,1,"regular-before");
  insertPublished.run(...regular,"regular-before");

  const other=[
    "other","1",777,72.2,86.3,"Irregular","OTHER ROAD",
    10,20,30,40,"ft",0,1,2,3,"10'","20'","30'","40'","other sentinel","other semantics",
    "[[0,0],[1,0],[1,1],[0,1]]","sold",1,
  ];
  insertPlot.run(...other,1,"other-before");
  insertPublished.run(...other,"other-before");
  db.prepare("INSERT INTO plot_pricing VALUES(?,?,?)").run(TARGET,"1",999);
}

test("mortgage measurement migration is exact-tenant and 18-row guarded",()=>{
  assert.match(sql,/74f50880-8adf-4158-bd8c-f65f2b1c718b/);
  assert.match(sql,/name='Arising Future City'/);
  assert.match(sql,/slug='arising-future-city-74f508'/);
  assert.match(sql,/p\.publish_version=9/);
  assert.match(sql,/target_rows=target_count\*18/);
  assert.match(sql,/draft_edges=target_count\*72/);
  assert.match(sql,/published_edges=target_count\*72/);
});

test("migration is safe no-op when Arising tenant is absent",()=>{
  const db=new DatabaseSync(":memory:");
  try{
    schema(db);
    db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?)").run("other","Other Project","other","active","published",1);
    db.prepare("INSERT INTO project_public_snapshots VALUES(?,?)").run("other",1);
    db.exec(sql);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM plot_edge_measurements").get().n,0);
  }finally{db.close()}
});

test("all visible mortgage plots receive side sizes while regular and other projects remain untouched",()=>{
  const db=new DatabaseSync(":memory:");
  try{
    schema(db);seed(db);db.exec(sql);

    const one=db.prepare(`SELECT front_label f,depth_label d,back_label b,depth2_label d2,
      front_edge_index fe,depth_edge_index de,back_edge_index be,depth2_edge_index d2e,
      sqft,sqm,sqyd,road,status,featured,polygon FROM plots WHERE project_id=? AND id='1'`).get(TARGET);
    assert.deepEqual([one.f,one.d,one.b,one.d2],[`34'4"`,`78'2"`,`33'9"`,`84'7"`]);
    assert.deepEqual([one.fe,one.de,one.be,one.d2e],[1,2,3,0]);
    assert.deepEqual([one.sqft,one.sqm,one.sqyd,one.road,one.status,one.featured,one.polygon],
      [1000,92.9,111.1,"ROAD","booked",1,"[[0,0],[1,0],[1,1],[0,1]]"]);

    const twelve=db.prepare(`SELECT front_label f,back_label b,depth_label d,depth2_label d2,
      depth2_edge_index d2e FROM plots WHERE project_id=? AND id='12'`).get(TARGET);
    assert.deepEqual([twelve.f,twelve.b,twelve.d,twelve.d2,twelve.d2e],
      [`33'11"`,`33'9"`,`40'`,`40'`,0]);

    const p124=db.prepare(`SELECT front_label f,back_label b,depth_label d,depth2_label d2,
      back_edge_index be FROM plots WHERE project_id=? AND id='124'`).get(TARGET);
    assert.deepEqual([p124.f,p124.b,p124.d,p124.d2,p124.be],
      [`43'7"`,`32'3"`,`60'`,`61'1"`,0]);

    assert.equal(db.prepare("SELECT COUNT(*) n FROM plot_edge_measurements WHERE project_id=?").get(TARGET).n,72);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM published_plot_edge_measurements WHERE project_id=?").get(TARGET).n,72);

    const regular=db.prepare("SELECT front_label f,status,updated_at u FROM plots WHERE project_id=? AND id='18'").get(TARGET);
    assert.deepEqual([regular.f,regular.status,regular.u],[`47'8"`,"sold","regular-before"]);

    const other=db.prepare("SELECT front,depth,status,updated_at u FROM plots WHERE project_id='other' AND id='1'").get();
    assert.deepEqual([other.front,other.depth,other.status,other.u],[10,20,"sold","other-before"]);

    assert.equal(db.prepare("SELECT rate FROM plot_pricing WHERE project_id=? AND plot_id='1'").get(TARGET).rate,999);
  }finally{db.close()}
});

test("known sanctioned/transcribed dimensions are pinned",()=>{
  assert.match(sql,/\('1',34\.333333,78\.166667,33\.750000,84\.583333/);
  assert.match(sql,/\('6',48\.500000,53\.166667,47\.666667,44\.166667/);
  assert.match(sql,/\('12',33\.916667,40\.000000,33\.750000,40\.000000/);
  assert.match(sql,/\('123',60\.000000,33\.000000,60\.000000,33\.000000/);
  assert.match(sql,/\('124',43\.583333,60\.000000,32\.250000,61\.083333/);
  assert.match(sql,/\('128',33\.000000,46\.416667,33\.583333,40\.333333/);
});

test("repair does not mutate area, road, polygon, sales state, featured or pricing",()=>{
  const a=sql.indexOf("UPDATE plots"),b=sql.indexOf("INSERT INTO plot_edge_measurements",a);
  assert.ok(a>=0&&b>a);
  const update=sql.slice(a,b);
  for(const forbidden of [
    /\bsqft\s*=/i,/\bsqm\s*=/i,/\bsqyd\s*=/i,/\broad\s*=/i,
    /\bpolygon\s*=/i,/\bstatus\s*=/i,/\bfeatured\s*=/i
  ]) assert.doesNotMatch(update,forbidden);
  assert.doesNotMatch(sql,/UPDATE\s+plot_pricing/i);
  assert.doesNotMatch(sql,/DELETE\s+FROM\s+plots/i);
});
