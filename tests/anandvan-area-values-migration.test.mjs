import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(new URL("../scripts/sql/apply-anandvan-area-values-once.sql", import.meta.url), "utf8");
const publicRoute = await readFile(new URL("../app/api/public-data/route.ts", import.meta.url), "utf8");
const snapshot = await readFile(new URL("../app/public-publish-snapshot.ts", import.meta.url), "utf8");

test("Anandvan live area script is scoped and guarded to the workbook's 47 plot IDs", () => {
  assert.match(script, /slug='anandvan-city-south-block-2ee1a1'/);
  assert.match(script, /lower\(trim\(name\)\)='anandvan city south block'/);
  assert.match(script, /inventory_active=1 AND id IN/);
  assert.match(script, /CHECK \(ok = 1\)/);
  assert.match(script, /published_plots/);
  assert.doesNotMatch(script, /\('SHOP-[1-5]'/, "Added shops are excluded from the 47-row area correction");
  const blocks = [...script.matchAll(/WITH correction\(id,sqft,sqm,sqyd\) AS \(VALUES([\s\S]*?)\n\)/g)];
  assert.equal(blocks.length, 2, "Both current and published area tables are updated");
  for (const block of blocks) {
    const ids = [...block[1].matchAll(/^\s*\('([^']+)',\s*[\d.]+,\s*[\d.]+,\s*[\d.]+\)/gm)].map((match) => match[1]);
    assert.equal(ids.length, 47);
    assert.equal(new Set(ids).size, 47);
    assert.ok(!ids.some((id) => id.startsWith("SHOP-")));
  }
  assert.match(script, /'sqmToSqftFactor','10\.76'/);
  assert.match(script, /'46', 1500, 139\.41, 166\.667/);
});

test("the project-specific conversion factor is exposed to, and preserved in, the customer public snapshot", () => {
  assert.match(publicRoute, /"sqmToSqftFactor"/);
  assert.match(snapshot, /"sqmToSqftFactor"/);
});
