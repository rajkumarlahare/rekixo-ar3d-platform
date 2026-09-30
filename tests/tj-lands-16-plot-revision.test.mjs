import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const sql = fs.readFileSync("drizzle/0035_tj_lands_16_plot_revision.sql", "utf8");
const TARGET = "43f33923-aa5d-4631-82ba-00cb8cfe4004";

const oldPolygons = {
  "1": "[[0.23564687498348394,0.5250539476527681],[0.1603300747495283,0.4803549113504609],[0.15942807714193602,0.30376365134000016],[0.23463212767494263,0.30256098668612647]]",
  "2": "[[0.2954042164864727,0.41320613484251045],[0.2958552152902688,0.5220472860180838],[0.23993136361954728,0.5204437331462521],[0.23948036481575113,0.41480968771434207]]",
  "15": "[[0.6467322846436669,0.29654766341675776],[0.647070533746514,0.4037852617204995],[0.765006720939205,0.4017808206307099],[0.7643302227335108,0.29514455465390504]]",
};

function createSchema(db) {
  db.exec(`
    CREATE TABLE projects(
      id TEXT PRIMARY KEY,name TEXT,slug TEXT,kind TEXT,status TEXT,
      public_status TEXT,publish_version INTEGER
    );
    CREATE TABLE project_public_snapshots(
      project_id TEXT PRIMARY KEY,publish_version INTEGER,project_name TEXT
    );
    CREATE TABLE settings(
      project_id TEXT,key TEXT,value TEXT,updated_at TEXT,
      PRIMARY KEY(project_id,key)
    );
    CREATE TABLE plots(
      project_id TEXT,id TEXT,sqft REAL,sqm REAL,sqyd REAL,dimensions TEXT,road TEXT,
      front REAL,depth REAL,back REAL,depth2 REAL,dimension_unit TEXT,
      front_edge_index INTEGER,depth_edge_index INTEGER,back_edge_index INTEGER,depth2_edge_index INTEGER,
      front_label TEXT,depth_label TEXT,back_label TEXT,depth2_label TEXT,
      side_dimensions TEXT,edge_semantics TEXT,polygon TEXT,status TEXT,notes TEXT,
      featured INTEGER,inventory_active INTEGER,updated_at TEXT,
      PRIMARY KEY(project_id,id)
    );
    CREATE TABLE published_plots(
      project_id TEXT,id TEXT,polygon TEXT,status TEXT,
      PRIMARY KEY(project_id,id)
    );
    CREATE TABLE plot_pricing(
      project_id TEXT,plot_id TEXT,pricing_type TEXT,unit TEXT,rate REAL,fixed_price REAL,
      currency TEXT,updated_at TEXT,PRIMARY KEY(project_id,plot_id)
    );
    CREATE TABLE plot_edge_measurements(
      project_id TEXT,plot_id TEXT,role TEXT,segment_index INTEGER,edge_index INTEGER,
      point_count INTEGER,length REAL,unit TEXT,raw_label TEXT,road_frontage INTEGER,
      road_access TEXT,source_ref TEXT,source_raw_text TEXT,confidence TEXT,verified INTEGER,
      updated_at TEXT,PRIMARY KEY(project_id,plot_id,role,segment_index)
    );
    CREATE TABLE geo_features(
      project_id TEXT,id TEXT,name TEXT,layer TEXT,geometry_type TEXT,geometry TEXT,
      linked_plot_id TEXT,source TEXT,properties TEXT,updated_at TEXT,
      PRIMARY KEY(project_id,id)
    );
  `);
}

function insertPlot(db, id, polygon, overrides = {}) {
  const base = {
    sqft: 1800,
    sqm: 167.2256338316038,
    sqyd: 200.00019354880666,
    dimensions: "30 ft x 60 ft",
    road: "Internal Road",
    front: 30,
    depth: 60,
    back: 30,
    depth2: 60,
    unit: "ft",
    fe: 0,
    de: 3,
    be: 2,
    d2e: 1,
    fl: null,
    dl: null,
    bl: null,
    d2l: null,
    side: null,
    semantics: '{"version":1,"pointCount":4,"layout":"four","roles":{"front":[0],"back":[2],"depthA":[3],"depthB":[1]}}',
    status: "available",
    notes: "30 x 60 ft",
    featured: 0,
    active: 1,
    ...overrides,
  };
  db.prepare(`
    INSERT INTO plots(
      project_id,id,sqft,sqm,sqyd,dimensions,road,front,depth,back,depth2,dimension_unit,
      front_edge_index,depth_edge_index,back_edge_index,depth2_edge_index,
      front_label,depth_label,back_label,depth2_label,side_dimensions,edge_semantics,
      polygon,status,notes,featured,inventory_active,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    TARGET,id,base.sqft,base.sqm,base.sqyd,base.dimensions,base.road,
    base.front,base.depth,base.back,base.depth2,base.unit,
    base.fe,base.de,base.be,base.d2e,
    base.fl,base.dl,base.bl,base.d2l,base.side,base.semantics,
    polygon,base.status,base.notes,base.featured,base.active,"before"
  );
}

function seed(db) {
  db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?,?)").run(
    TARGET,"TJ Lands","tj-lands-43f339","customer","active","published",10
  );
  db.prepare("INSERT INTO project_public_snapshots VALUES(?,?,?)").run(TARGET,10,"TJ Lands");

  const dirs='{"1":"left","2":"right","3":"right","4":"left","5":"left","6":"left","7":"right","8":"right","9":"right","10":"right","11":"left","12":"left","13":"left","14":"left","15":"left"}';
  for (const [key,value] of [
    ["mapWidth","2048"],["mapHeight","1152"],["plotSheetCount","15"],["plotFrontDirections",dirs]
  ]) db.prepare("INSERT INTO settings VALUES(?,?,?,?)").run(TARGET,key,value,"before");

  insertPlot(db,"1",oldPolygons["1"],{
    sqft:2600,sqm:241.54813775676104,sqyd:288.8891684593874,
    dimensions:"40 ft x 65 ft",front:20,depth:65,back:20,depth2:60,
    fe:0,de:3,be:2,d2e:1,
    semantics:'{"version":1,"pointCount":4,"layout":"four","roles":{"front":[0],"back":[2],"depthA":[3],"depthB":[1]}}',
    notes:"40 x 65 ft",
  });

  for (let i=2;i<=15;i++) {
    const polygon = i===2 ? oldPolygons["2"] : i===15 ? oldPolygons["15"] :
      JSON.stringify([[0.1+i/1000,0.1],[0.2+i/1000,0.1],[0.2+i/1000,0.2],[0.1+i/1000,0.2]]);
    if (i===2 || i===3) {
      insertPlot(db,String(i),polygon,{
        sqft:900,sqm:83.6128169158019,sqyd:100.00009677440333,
        dimensions:"30 ft x 30 ft",front:30,depth:30,back:30,depth2:30,
        de:i===2?1:3,d2e:i===2?3:1,notes:"30 x 30 ft"
      });
    } else {
      insertPlot(db,String(i),polygon);
    }
  }

  for(let i=1;i<=15;i++) {
    const p=db.prepare("SELECT polygon,status FROM plots WHERE project_id=? AND id=?").get(TARGET,String(i));
    db.prepare("INSERT INTO published_plots VALUES(?,?,?,?)").run(TARGET,String(i),p.polygon,p.status);
  }

  // Future-safe proof: non-Plot-1 references follow their physical plot number shift.
  db.prepare("INSERT INTO plot_pricing VALUES(?,?,?,?,?,?,?,?)").run(
    TARGET,"4","rate","sqyd",1000,null,"INR","before"
  );
  db.prepare("INSERT INTO plot_edge_measurements VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    TARGET,"5","front",0,0,4,30,"ft","30 ft",1,"Internal Road","src","raw","high",1,"before"
  );
  db.prepare("INSERT INTO geo_features VALUES(?,?,?,?,?,?,?,?,?,?)").run(
    TARGET,"g1","plot six","default","Polygon","{}", "6","manual","{}","before"
  );

  db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?,?)").run(
    "other","Other Project","other","customer","active","published",3
  );
  db.prepare("INSERT INTO project_public_snapshots VALUES(?,?,?)").run("other",3,"Other Project");
  db.prepare("INSERT INTO plots VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "other","1",777,72,86,"other","Other Road",10,20,30,40,"ft",0,1,2,3,
    null,null,null,null,null,null,"[[0,0],[1,0],[1,1],[0,1]]","sold","other",1,1,"other-before"
  );
}

test("TJ Lands revision is exact tenant, exact v10 snapshot, and fail-closed", () => {
  assert.match(sql,/43f33923-aa5d-4631-82ba-00cb8cfe4004/);
  assert.match(sql,/name='TJ Lands'/);
  assert.match(sql,/slug='tj-lands-43f339'/);
  assert.match(sql,/publish_version=10/);
  assert.match(sql,/total_rows=target_count\*15/);
  assert.match(sql,/published_rows=target_count\*15/);
  assert.match(sql,/plot1_ambiguous_refs=0/);
});

test("migration no-ops when TJ Lands tenant is absent", () => {
  const db = new DatabaseSync(":memory:");
  try {
    createSchema(db);
    db.prepare("INSERT INTO projects VALUES(?,?,?,?,?,?,?)").run(
      "other","Other","other","customer","active","published",1
    );
    db.exec(sql);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM plots").get().n,0);
  } finally {
    db.close();
  }
});

test("migration creates 16 mapped draft plots, splits old 1, and renumbers old 2..15", () => {
  const db = new DatabaseSync(":memory:");
  try {
    createSchema(db);
    seed(db);
    db.exec(sql);

    assert.equal(db.prepare("SELECT COUNT(*) n FROM plots WHERE project_id=?").get(TARGET).n,16);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM plots WHERE project_id=? AND inventory_active=1").get(TARGET).n,16);

    const p1=db.prepare("SELECT * FROM plots WHERE project_id=? AND id='1'").get(TARGET);
    const p2=db.prepare("SELECT * FROM plots WHERE project_id=? AND id='2'").get(TARGET);
    for (const p of [p1,p2]) {
      assert.equal(p.sqft,400);
      assert.equal(p.dimensions,"20 ft x 20 ft");
      assert.deepEqual([p.front,p.back,p.depth,p.depth2],[20,20,20,20]);
      assert.deepEqual([p.front_edge_index,p.depth_edge_index,p.back_edge_index,p.depth2_edge_index],[1,2,3,0]);
      assert.equal(p.status,"available");
    }

    assert.equal(
      p1.polygon,
      "[[0.23513472593463455,0.4127604166666667],[0.15998481376386242,0.4127604166666667],[0.15942807714193602,0.30376365134000016],[0.23463212767494263,0.30256098668612647]]"
    );
    assert.equal(
      p2.polygon,
      "[[0.23564687498348394,0.5250539476527681],[0.1603300747495283,0.4803549113504609],[0.15998481376386242,0.4127604166666667],[0.23513472593463455,0.4127604166666667]]"
    );

    const p3=db.prepare("SELECT sqft,dimensions,polygon FROM plots WHERE project_id=? AND id='3'").get(TARGET);
    assert.equal(p3.sqft,900);
    assert.equal(p3.dimensions,"30 ft x 30 ft");
    assert.equal(p3.polygon,oldPolygons["2"]);

    const p16=db.prepare("SELECT sqft,dimensions,polygon FROM plots WHERE project_id=? AND id='16'").get(TARGET);
    assert.equal(p16.sqft,1800);
    assert.equal(p16.dimensions,"30 ft x 60 ft");
    assert.equal(p16.polygon,oldPolygons["15"]);

    assert.equal(db.prepare("SELECT plot_id FROM plot_pricing WHERE project_id=?").get(TARGET).plot_id,"5");
    assert.equal(db.prepare("SELECT plot_id FROM plot_edge_measurements WHERE project_id=?").get(TARGET).plot_id,"6");
    assert.equal(db.prepare("SELECT linked_plot_id FROM geo_features WHERE project_id=?").get(TARGET).linked_plot_id,"7");

    assert.equal(db.prepare("SELECT value FROM settings WHERE project_id=? AND key='plotSheetCount'").get(TARGET).value,"16");
    assert.equal(
      db.prepare("SELECT value FROM settings WHERE project_id=? AND key='plotFrontDirections'").get(TARGET).value,
      '{"1":"left","2":"left","3":"right","4":"right","5":"left","6":"left","7":"left","8":"right","9":"right","10":"right","11":"right","12":"left","13":"left","14":"left","15":"left","16":"left"}'
    );

    // Live published v10 is deliberately unchanged until explicit Publish Update.
    assert.equal(db.prepare("SELECT COUNT(*) n FROM published_plots WHERE project_id=?").get(TARGET).n,15);
    assert.equal(
      db.prepare("SELECT polygon FROM published_plots WHERE project_id=? AND id='1'").get(TARGET).polygon,
      oldPolygons["1"]
    );

    const other=db.prepare("SELECT sqft,status,updated_at FROM plots WHERE project_id='other' AND id='1'").get();
    assert.deepEqual([other.sqft,other.status,other.updated_at],[777,"sold","other-before"]);
  } finally {
    db.close();
  }
});

test("migration does not mutate published snapshot tables or other projects", () => {
  assert.doesNotMatch(sql,/UPDATE\s+published_plots/i);
  assert.doesNotMatch(sql,/DELETE\s+FROM\s+published_plots/i);
  assert.doesNotMatch(sql,/INSERT\s+INTO\s+published_plots/i);
  assert.doesNotMatch(sql,/UPDATE\s+projects\s+SET\s+publish_version/i);
});
