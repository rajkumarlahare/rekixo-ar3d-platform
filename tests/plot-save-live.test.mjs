import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("mobile mapper blocks long-press browser selection and hides plot sidebar on coarse pointers", async () => {
  const [mapper, css] = await Promise.all([
    source("../app/plot-mapper.tsx"),
    source("../app/globals.css"),
  ]);
  assert.match(mapper, /onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(mapper, /enableSelectMode/);
  assert.match(mapper, /any-pointer: coarse/);
  assert.match(css, /Rekixo Plot Mapper V4\.1/);
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /@media \(any-pointer: coarse\), \(hover: none\)/);
  assert.match(css, /\.mapper-v4-work > \.mapper-review-list\s*\{[\s\S]*display:\s*none/);
});

test("each confirmed polygon is server-read-back verified before draft cleanup and next plot", async () => {
  const [mapper, api, publicData, publicSite] = await Promise.all([
    source("../app/plot-mapper.tsx"),
    source("../app/api/super-mapper/route.ts"),
    source("../app/api/public-data/route.ts"),
    source("../public/project/index.html"),
  ]);
  assert.match(mapper, /verifyPlotPersistence/);
  assert.match(mapper, /cache:\s*"no-store"/);
  assert.match(mapper, /SERVER VERIFIED/);
  const verifyPos = mapper.indexOf("verifyPlotPersistence(saved)");
  const cleanupPos = mapper.indexOf("localStorage.removeItem(mappingDraftKey(projectId, verified.plot.id))");
  const nextPos = mapper.indexOf("selectNextPlot(\n        verified.plot.id,\n        verified.plots,\n      )");
  assert.ok(verifyPos >= 0 && cleanupPos > verifyPos && nextPos > cleanupPos);
  assert.match(api, /await savePlots\(projectId, incoming\)/);
  assert.match(api, /cache-control": "no-store"/);
  assert.match(publicData, /from\(plots\)/);
  assert.match(publicData, /cache-control": "no-store"/);
  assert.match(publicSite, /fetch\('\/api\/public-data'[\s\S]*cache:'no-store'/);
});

test("Clear on a mapped plot removes the persisted boundary and verifies server read-back", async () => {
  const [mapper, api] = await Promise.all([
    source("../app/plot-mapper.tsx"),
    source("../app/api/super-mapper/route.ts"),
  ]);
  assert.match(mapper, /function clearCurrentSelection\(\)/);
  assert.match(mapper, /currentHasSavedBoundary/);
  assert.match(mapper, /void remove\(saved\)/);

  const removeStart = mapper.indexOf("async function remove(plot: Plot)");
  const removeEnd = mapper.indexOf("function cadTap", removeStart);
  const removeBody = mapper.slice(removeStart, removeEnd);
  assert.match(removeBody, /polygon: ""/);
  assert.match(removeBody, /verifyPlotPersistence\(saved\)/);
  assert.match(removeBody, /SERVER VERIFIED removed/);
  assert.match(removeBody, /mappingDraftKey\(projectId, verified\.plot\.id\)/);

  assert.match(api, /saved\[0\]\.polygon/);
  assert.match(api, /"mapper\.boundary_removed"/);
});

test("RPK original 29.51 MB and future masterplans up to 100 MB remain supported", async () => {
  const [mapper, api, multipart] = await Promise.all([
    source("../app/plot-mapper.tsx"),
    source("../app/api/super-mapper/route.ts"),
    source("../app/api/super-mapper-masterplan-upload/route.ts"),
  ]);
  assert.match(mapper, /MAX_ORIGINAL_MASTERPLAN_BYTES = 100 \* 1024 \* 1024/);
  assert.match(mapper, /MASTERPLAN_ORIGINAL_CHUNK_BYTES = 8 \* 1024 \* 1024/);
  assert.match(multipart, /MAX_ORIGINAL_BYTES = 100 \* 1024 \* 1024/);
  // Legacy inline clients stay accepted at their historical safe limit.
  assert.match(api, /originalFile\.size > 40 \* 1024 \* 1024/);
});
