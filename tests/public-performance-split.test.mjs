import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const [dataRoute,liveRoute,galleryRoute,html]=await Promise.all([
  read("../app/api/public-data/route.ts"),
  read("../app/api/public-live/route.ts"),
  read("../app/api/public-gallery/route.ts"),
  read("../public/project/index.html"),
]);

test("versioned structural payload is independently cacheable",()=>{
  assert.match(dataRoute,/searchParams\.get\("view"\) === "structure"/);
  assert.match(dataRoute,/searchParams\.get\("pv"\)/);
  assert.match(dataRoute,/public,max-age=31536000,immutable/);
  assert.doesNotMatch(dataRoute,/const currentPlotPromise/);
  assert.doesNotMatch(dataRoute,/const currentSettingsPromise/);
});

test("live business state is compact and no-store",()=>{
  assert.match(liveRoute,/SELECT id,status FROM plots/);
  assert.match(liveRoute,/plot_pricing/);
  assert.match(liveRoute,/PROJECT_CONTACT_KEYS/);
  assert.match(liveRoute,/"cache-control":"no-store"/);
  assert.match(html,/\/api\/public-live/);
  assert.match(html,/setInterval\(\(\)=>void refreshLiveState\(\),30000\)/);
});

test("gallery metadata no longer refetches full project JSON",()=>{
  assert.match(galleryRoute,/gallery:items/);
  assert.match(html,/fetch\('\/api\/public-gallery'/);
  const start=html.indexOf("async function openGallery()");
  const end=html.indexOf("function closeGallery()",start);
  const block=html.slice(start,end);
  assert.doesNotMatch(block,/\/api\/public-data/);
});
