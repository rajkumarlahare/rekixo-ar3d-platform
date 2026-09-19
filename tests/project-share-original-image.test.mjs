import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("share upload stores branded derivative and immutable original source", async () => {
  const route = await readFile(
    new URL("../app/api/admin/project-share/route.ts", import.meta.url),
    "utf8",
  );

  assert.ok(route.includes('const sourceFile = form.get("sourceFile")'));
  assert.ok(route.includes("detectShareImageMime(sourceFile)"));
  assert.ok(route.includes("share/card"));
  assert.ok(route.includes("share/cards/${version}"));
  assert.ok(route.includes("share/source"));
  assert.ok(route.includes("share/sources/${version}"));
  assert.ok(route.includes('source: "ar3d-branded-derivative"'));
  assert.ok(route.includes('source: "original-upload"'));
  assert.ok(route.includes("brandId: GLOBAL_SHARE_BRAND.id"));
  assert.ok(route.includes("brandVersion: GLOBAL_SHARE_BRAND.version"));
});

test("share builder adds a dedicated AR3D footer without cropping or covering the source", async () => {
  const [manager, branding, logo] = await Promise.all([
    readFile(new URL("../app/project-share-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/share-branding.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/share-branding-logo.ts", import.meta.url), "utf8"),
  ]);

  assert.ok(branding.includes('SHARE_TEMPLATE = "ar3d-global-brand-footer-v2"'));
  assert.ok(branding.includes('id: "ar3d-vision-studio"'));
  assert.ok(branding.includes('version: "2026-09-19-footer-v2"'));
  assert.ok(logo.includes("GLOBAL_SHARE_BRAND_DATA_URL"));
  assert.ok(manager.includes("prepareBrandedShareImage"));
  assert.ok(manager.includes("context.drawImage(sourceBitmap, 0, 0, width, height)"));
  assert.ok(manager.includes("const logoX = Math.round((width - logoWidth) / 2)"));
  assert.ok(manager.includes("canvas.height = height + footerHeight"));
  assert.ok(manager.includes("context.fillRect(0, height, width"));
  assert.ok(
    manager.includes(
      "const logoY = height + Math.round((footerHeight - logoHeight) / 2)",
    ),
  );
  assert.ok(manager.includes("Source image is never covered or cropped"));
  assert.ok(manager.includes('form.set("file", shareImageFile)'));
  assert.ok(manager.includes('form.set("sourceFile", shareSourceFile)'));
});

test("share builder previews the branded derivative and keeps project logo separate", async () => {
  const manager = await readFile(
    new URL("../app/project-share-manager.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(manager.includes("AR3D footer auto"));
  assert.ok(manager.includes("AR3D branded share image ready"));
  assert.ok(manager.includes("Save branded share image"));
  assert.ok(manager.includes("const previewUrl = localPreview || state.cardUrl ||"));
  assert.ok(manager.includes("PROJECT LOGO"));
  assert.ok(manager.includes("objectUrl = URL.createObjectURL(shareImageFile)"));
});
