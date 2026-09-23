import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("migration backfills a structural snapshot for already-published projects", async () => {
  const migration = await read("../drizzle/0027_rekixo_public_publish_snapshot.sql");
  for (const table of [
    "project_public_snapshots",
    "published_plots",
    "published_plot_edge_measurements",
    "published_settings",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /p\.public_status='published'/);
  assert.match(migration, /INSERT OR REPLACE INTO published_plots/);
  assert.match(migration, /INSERT OR REPLACE INTO published_settings/);
});

test("Publish Update captures D1 state and versioned R2 assets before moving live pointer", async () => {
  const [publishRoute, snapshot] = await Promise.all([
    read("../app/api/admin/publish/route.ts"),
    read("../app/public-publish-snapshot.ts"),
  ]);

  assert.match(publishRoute, /promotePublishedAssets\(projectId, nextVersion\)/);
  assert.match(publishRoute, /capturePublishedSnapshotStatements\(projectId, nextVersion, now\)/);
  assert.match(publishRoute, /publish_version=\?/);
  assert.match(snapshot, /published\/\$\{publishVersion\}\/\$\{kind\}/);
  assert.match(snapshot, /INSERT INTO published_plots/);
  assert.match(snapshot, /INSERT INTO published_plot_edge_measurements/);
  assert.match(snapshot, /INSERT INTO published_settings/);
  assert.match(snapshot, /INSERT INTO project_public_snapshots/);
});

test("customer public-data reads frozen structure but keeps business state live", async () => {
  const route = await read("../app/api/public-data/route.ts");

  assert.match(route, /FROM project_public_snapshots/);
  assert.match(route, /FROM published_plots/);
  assert.match(route, /FROM published_plot_edge_measurements/);
  assert.match(route, /FROM published_settings/);

  // Client Admin business state remains intentionally live.
  assert.match(route, /SELECT id,status FROM plots WHERE project_id=\?/);
  assert.match(route, /liveStatusByPlot/);
  assert.match(route, /PROJECT_CONTACT_KEYS/);
  assert.match(route, /liveContactSettings/);
  assert.match(route, /from\(plotPricing\)/);
  assert.match(route, /from\(gallery\)/);
});

test("public masterplan and logo bytes are frozen while mapper preview stays editable", async () => {
  const [assets, mapper, publicHtml] = await Promise.all([
    read("../app/api/project-asset/[kind]/route.ts"),
    read("../app/api/super-mapper/route.ts"),
    read("../public/project/index.html"),
  ]);

  assert.match(assets, /publishedAssetKey/);
  assert.match(assets, /authorizedPreview/);
  assert.match(assets, /publicVariant/);
  assert.match(assets, /x-rekixo-publish-asset/);
  assert.match(mapper, /freezeCurrentPublishedAssets\(projectId, \["masterplan"\]\)/);
  assert.match(mapper, /freezeCurrentPublishedAssets\(projectId, \["logo"\]\)/);
  assert.match(mapper, /Published masterplan preserve nahi hua/);
  assert.match(mapper, /Published logo preserve nahi hua/);
  assert.match(publicHtml, /variant=public&v=/);
  assert.match(publicHtml, /public-canonical/);
  assert.match(assets, /variant === "public-canonical"/);
  assert.match(assets, /share\/cards\/\$\{validShareVersion\}/);
});

test("public metadata, share image and 3D link stay on published snapshot", async () => {
  const [page, shareImage, shareRoute, publicData, engine] = await Promise.all([
    read("../app/projects/[slug]/page.tsx"),
    read("../app/projects/[slug]/share-image/[version]/route.ts"),
    read("../app/api/admin/project-share/route.ts"),
    read("../app/api/public-data/route.ts"),
    read("../app/engine-integration.ts"),
  ]);

  assert.match(page, /published_settings/);
  assert.match(page, /project_public_snapshots/);
  assert.match(shareImage, /published_settings/);
  assert.match(shareRoute, /freezeCurrentPublishedShareCard/);
  assert.match(publicData, /publicProject3DLinkFromSnapshot/);
  assert.match(engine, /publicProject3DLinkFromSnapshot/);
});
