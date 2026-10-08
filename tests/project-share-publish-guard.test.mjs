import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("publish readiness still requires share metadata and a saved share image", async () => {
  const [publishRoute, assetRoute, panel] = await Promise.all([
    readFile(new URL("../app/api/admin/publish/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/project-asset/[kind]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/project-publish-panel.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(publishRoute.includes("shareTitle"));
  assert.ok(publishRoute.includes("Share title required"));
  assert.ok(publishRoute.includes("Share description required"));
  assert.ok(publishRoute.includes("Share preview image required"));
  assert.ok(assetRoute.includes('"masterplan", "logo", "shareCard"'));
  assert.ok(assetRoute.includes("/share/card"));
  assert.ok(assetRoute.includes('object.httpMetadata?.contentType'));
  assert.ok(panel.includes("rekixo:share-profile-updated"));
});

test("Open Graph uses the versioned public share asset endpoint without fake dimensions", async () => {
  const page = await readFile(
    new URL("../app/projects/[slug]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(page.includes("hasShareImage"));
  assert.ok(page.includes('const images = meta.imageUrl'));
  assert.ok(page.includes('{ url: meta.imageUrl, alt: meta.title }'));
  assert.ok(page.includes("/api/project-asset/shareCard?"));
  assert.ok(page.includes("project.id"));
  assert.ok(page.includes("settings.shareVersion"));
  assert.ok(page.includes("&public=1"));
  assert.ok(!page.includes("/share-image/"));
  assert.ok(!page.includes("width: 1200"));
  assert.ok(!page.includes("height: 630"));
  assert.ok(page.includes("icons: meta.logoUrl"));
  assert.ok(page.includes('card: meta.hasShareImage ? "summary_large_image" : "summary"'));
});
