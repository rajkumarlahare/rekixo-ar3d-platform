import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [migration, schema, mapperRoute, mapperUi, publishRoute, snapshot, publicData] =
  await Promise.all([
    read("../drizzle/0029_rekixo_plot_inventory_reconciliation.sql"),
    read("../db/schema.ts"),
    read("../app/api/super-mapper/route.ts"),
    read("../app/plot-mapper.tsx"),
    read("../app/api/admin/publish/route.ts"),
    read("../app/public-publish-snapshot.ts"),
    read("../app/api/public-data/route.ts"),
  ]);

test("plots gain a default-active canonical inventory lifecycle", () => {
  assert.match(
    migration,
    /ALTER TABLE plots[\s\S]*ADD COLUMN inventory_active INTEGER NOT NULL DEFAULT 1/,
  );
  assert.match(migration, /idx_plots_project_inventory_active/);
  assert.match(schema, /inventoryActive:integer\("inventory_active"/);
});

test("plot-sheet preflight returns a no-write inventory reconciliation plan", () => {
  assert.match(mapperRoute, /async function plotInventoryDiff/);
  assert.match(mapperRoute, /inventoryConfirmationToken/);
  assert.match(mapperRoute, /crypto\.subtle\.digest/);
  assert.match(mapperRoute, /inventoryPendingRemoval/);
  assert.match(mapperRoute, /inventory,/);

  const preflightStart = mapperRoute.indexOf('if (kind === "plotSheetPreflight")');
  const importStart = mapperRoute.indexOf('if (kind === "plotSheet")', preflightStart);
  const block = mapperRoute.slice(preflightStart, importStart);
  assert.match(block, /plotInventoryDiff\(projectId, incomingIds\)/);
  assert.doesNotMatch(block, /setPlotInventoryActive/);
  assert.doesNotMatch(block, /BUCKET\.put/);
  assert.doesNotMatch(block, /savePlots\(/);
});

test("missing canonical plots cannot be deactivated without current confirmation token", () => {
  assert.match(mapperRoute, /PLOT_INVENTORY_CONFIRMATION_REQUIRED/);
  assert.match(
    mapperRoute,
    /inventoryConfirmation !== inventory\.confirmationToken/,
  );
  assert.match(
    mapperRoute,
    /setPlotInventoryActive\([\s\S]*inventory\.missingIds[\s\S]*false/,
  );
  assert.match(mapperRoute, /inventory_active=1/);
});

test("Super Admin shows a destructive inventory diff before submitting confirmation", () => {
  assert.match(mapperUi, /type PlotInventorySummary/);
  assert.match(mapperUi, /Canonical Plot Data inventory change detected/);
  assert.match(mapperUi, /Mapped boundaries affected/);
  assert.match(mapperUi, /Booked\/Sold affected/);
  assert.match(mapperUi, /Pricing rows affected/);
  assert.match(
    mapperUi,
    /Current published customer website पर ये Publish Update तक बने रहेंगे/,
  );
  assert.match(mapperUi, /inventoryConfirmation/);
});

test("draft mapper and authenticated preview hide pending removals", () => {
  assert.match(
    mapperRoute,
    /FROM plots WHERE project_id=\? AND inventory_active=1 ORDER BY id/,
  );
  assert.match(publicData, /eq\(plots\.inventoryActive, true\)/);
});

test("Publish Update snapshots active inventory then finalizes pending removals atomically", () => {
  assert.match(snapshot, /FROM plots WHERE project_id=\? AND inventory_active=1/);
  assert.match(
    snapshot,
    /plot_edge_measurements[\s\S]*p\.inventory_active=1/,
  );
  assert.match(snapshot, /finalizeInactivePlotInventoryStatements/);
  assert.match(snapshot, /UPDATE geo_features[\s\S]*linked_plot_id=NULL/);
  assert.match(snapshot, /DELETE FROM plot_edge_measurements/);
  assert.match(snapshot, /DELETE FROM plot_pricing/);
  assert.match(snapshot, /DELETE FROM plots WHERE project_id=\? AND inventory_active=0/);

  const capture = publishRoute.indexOf("capturePublishedSnapshotStatements");
  const finalize = publishRoute.indexOf("finalizeInactivePlotInventoryStatements", capture);
  assert.ok(capture >= 0);
  assert.ok(finalize > capture);
});

test("live customer status/pricing remain available until Publish Update", () => {
  assert.match(publicData, /SELECT id,status FROM plots WHERE project_id=\?/);
  assert.match(publicData, /from\(plotPricing\)/);
  assert.doesNotMatch(publicData, /SELECT id,status FROM plots WHERE project_id=\? AND inventory_active=1/);
});
