import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("share builder uses global AR3D branding and preserves the original source", async () => {
  const [dashboard, manager, route, css, provisioning, branding] =
    await Promise.all([
      readFile(new URL("../app/super-admin-dashboard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/project-share-manager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/project-share/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/super-mapper.css", import.meta.url), "utf8"),
      readFile(new URL("../app/project-provisioning.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/share-branding.ts", import.meta.url), "utf8"),
    ]);

  assert.match(dashboard, /type WorkspaceTab = [^;]*"share"[^;]*;/);
  assert.ok(dashboard.includes("Share Builder"));
  assert.ok(branding.includes('SHARE_TEMPLATE = "ar3d-global-brand-footer-v3"'));
  assert.ok(manager.includes("SHARE IMAGE / WHATSAPP POSTER"));
  assert.ok(manager.includes('form.set("file", shareImageFile)'));
  assert.ok(manager.includes('form.set("sourceFile", shareSourceFile)'));
  assert.ok(manager.includes("Save branded share image"));
  assert.ok(manager.includes("no crop"));
  assert.ok(manager.includes("prepareBrandedShareImage"));
  assert.ok(manager.includes("canvas.height = height + footerHeight"));
  assert.ok(manager.includes("footerBackground"));
  assert.ok(manager.includes("AR3D footer auto"));
  assert.ok(manager.includes("GLOBAL_SHARE_BRAND_DATA_URL"));
  assert.ok(css.includes("ORIGINAL POSTER"));
  assert.ok(css.includes("object-fit:contain"));
  assert.ok(!css.includes("aspect-ratio:1200/630"));
  assert.ok(route.includes("detectShareImageMime"));
  assert.ok(route.includes('source: "ar3d-branded-derivative"'));
  assert.ok(route.includes("share/sources/${version}"));
  assert.ok(provisioning.includes('import { SHARE_TEMPLATE } from "./share-branding"'));
  assert.match(provisioning, /shareTemplate:\s*SHARE_TEMPLATE/);
});

test("metadata-only edits still rotate the share URL cache version", async () => {
  const route = await readFile(
    new URL("../app/api/admin/project-share/route.ts", import.meta.url),
    "utf8",
  );
  assert.ok(route.includes("Any metadata edit gets a fresh share URL"));
  assert.ok(route.includes('writeSetting(projectId, "shareVersion", version, now)'));
});
