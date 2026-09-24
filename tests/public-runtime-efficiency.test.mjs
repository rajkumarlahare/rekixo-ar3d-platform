import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const [status,html,gallery]=await Promise.all([
  read("../app/api/public-status/route.ts"),
  read("../public/project/index.html"),
  read("../app/api/gallery/[id]/route.ts"),
]);

test("customer runtime uses a lightweight live status endpoint",()=>{
  assert.match(status,/SELECT id,status FROM plots/);
  assert.match(status,/inventory_active=1/);
  assert.match(status,/publicSiteEnabled/);
  assert.match(status,/"cache-control": "no-store"/);
  assert.match(html,/fetch\('\/api\/public-status'/);
  assert.match(html,/setInterval\(refreshLiveStatuses,20000\)/);
  assert.match(html,/else void refreshLiveStatuses\(\)/);
});

test("gallery opens from already-loaded metadata instead of refetching whole project",()=>{
  assert.match(html,/let PUBLIC_GALLERY=\[\]/);
  assert.match(html,/PUBLIC_GALLERY=Array\.isArray\(data&&data\.gallery\)/);
  const openStart=html.indexOf("function openGallery()");
  const closeStart=html.indexOf("function closeGallery()",openStart);
  const block=html.slice(openStart,closeStart);
  assert.ok(openStart>=0&&closeStart>openStart);
  assert.match(block,/const items=PUBLIC_GALLERY/);
  assert.doesNotMatch(block,/\/api\/public-data/);
});

test("public gallery responses revalidate so deletion is observable",()=>{
  assert.match(gallery,/mode === "public"[\s\S]*\? "no-store"/);
  assert.doesNotMatch(gallery,/max-age=31536000, immutable/);
});
