import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync("drizzle/0024_mangal_raj_park_measurement_backfill.sql","utf8");

test("Mangal measurement backfill is tenant-scoped and 84-row guarded", () => {
  assert.match(sql,/MANGAL_RAJ_PARK_MEASUREMENT_BACKFILL_V1/);
  assert.match(sql,/lower\(trim\(p\.name\)\)='mangal raj park'/);
  assert.match(sql,/CHECK \(n=1\)/);
  assert.match(sql,/CHECK \(n=84\)/);
  assert.match(sql,/measurementSheetCount','84'/);
  assert.match(sql,/measurementSheetVerifiedCount','82'/);
  assert.match(sql,/measurementSheetReviewCount','2'/);
});
test("Mangal backfill keeps the 10.76 Sq.M to Sq.Ft rule project-scoped", () => {
  assert.match(sql,/sqmToSqftFactor','10\.76'/);
  assert.match(sql,/sqft=ROUND\([\s\S]*\*10\.76,3\)/);
  assert.doesNotMatch(sql,/UPDATE plots[\s\S]*sqyd\s*=/i);
});
test("Mangal backfill preserves geometry sales state and pricing", () => {
  const a=sql.indexOf("UPDATE plots"), b=sql.indexOf("INSERT INTO plot_edge_measurements",a);
  assert.ok(a>=0&&b>a);
  const update=sql.slice(a,b);
  assert.doesNotMatch(update,/\bpolygon\s*=/i);
  assert.doesNotMatch(update,/\bstatus\s*=/i);
  assert.doesNotMatch(update,/\bfeatured\s*=/i);
  assert.doesNotMatch(sql,/UPDATE\s+plot_pricing/i);
  assert.doesNotMatch(sql,/DELETE\s+FROM\s+plots/i);
  assert.doesNotMatch(sql,/DROP\s+TABLE\s+plots/i);
});
test("known sanctioned irregular measurements are pinned", () => {
  assert.match(sql,/\(1,125\.351,10\.99,12\.25,18\.9,17\.733,'10\.990 m','9\.000 \+ 3\.250 m'/);
  assert.match(sql,/\(30,252\.582,27\.15,0\.916,18\.84,33/);
  assert.match(sql,/\(31,230\.936,4\.071,26\.251,26\.8,15/);
  assert.match(sql,/\(57,132\.532,13\.3,12\.867,8\.691,16\.32/);
  assert.match(sql,/\(58,181\.666,9,11\.85,16\.32,24\.05/);
  assert.match(sql,/\(61,224\.723,12\.5,24\.97,17\.329,12/);
  assert.match(sql,/\(66,158\.568,19\.457,6\.97,12,17\.329/);
});
test("curved road corner stays source-backed without invented length", () => {
  assert.match(sql,/\(80,134\.200,9\.35,9\.35,NULL,15,'9\.350 m','9\.350 m','Curved road corner'/);
  assert.match(sql,/no printed arc length/i);
});
test("edge measurement V2 receives canonical semantic rows", () => {
  assert.match(sql,/INSERT INTO plot_edge_measurements/);
  assert.match(sql,/WHEN 'front' THEN p\.front_edge_index/);
  assert.match(sql,/WHEN 'back' THEN p\.back_edge_index/);
  assert.match(sql,/WHEN 'depthA' THEN p\.depth_edge_index/);
  assert.match(sql,/WHEN 'depthB' THEN p\.depth2_edge_index/);
  assert.match(sql,/Mangal Raj Park sanctioned layout · 2026-09-19/);
});

test("remote D1 migration avoids unauthorized TEMP tables", () => {
  assert.doesNotMatch(sql,/CREATE TEMP TABLE/i);
  assert.match(sql,/CREATE TABLE _mangal_target/);
  assert.match(sql,/DROP TABLE IF EXISTS _mangal_measurement_source/);
});
