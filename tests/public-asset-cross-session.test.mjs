import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [assets, gallery, context, publicHtml, shareRoute] = await Promise.all([
  read("../app/api/project-asset/[kind]/route.ts"),
  read("../app/api/gallery/[id]/route.ts"),
  read("../app/project-context.ts"),
  read("../public/project/index.html"),
  read("../app/api/admin/project-share/route.ts"),
]);

test("public asset identity is resolved independently from an unrelated admin cookie", () => {
  assert.match(assets, /const publicId = PUBLIC_KINDS\.has\(kind\)[\s\S]*await publicProjectId\(request\)/);
  assert.match(assets, /if \(explicitPublic\)[\s\S]*mode: "public"/);
  assert.match(
    assets,
    /publicId &&[\s\S]*publicId !== session\.projectId[\s\S]*requested === publicId[\s\S]*mode: "public"/,
  );
  assert.match(assets, /mode === "public"[\s\S]*!authorizedPreview/);
});

test("foreign draft/private assets remain inaccessible to a client admin", () => {
  assert.match(
    assets,
    /if \(requested && requested !== session\.projectId\) return null/,
  );
  assert.match(
    assets,
    /PUBLIC_KINDS\.has\(kind\)[\s\S]*await publicProjectId\(request\)/,
  );
  // publicProjectId uses projectById/projectBySlug without includeDraft, which
  // fail closed unless public_status is published.
  assert.match(
    context,
    /if \(!row \|\| \(!includeDraft && row\.publicStatus !== "published"\)\) return null/,
  );
});

test("public gallery works even when another client session cookie is present", () => {
  assert.match(gallery, /const publicId = await publicProjectId\(request\)/);
  assert.match(gallery, /const explicitPublic = url\.searchParams\.get\("public"\) === "1"/);
  assert.match(
    gallery,
    /publicId &&[\s\S]*publicId !== session\.projectId[\s\S]*mode: "public"/,
  );
  assert.match(
    gallery,
    /mode === "public"[\s\S]*"public, max-age=31536000, immutable"[\s\S]*"private, no-store"/,
  );
});

test("customer runtime explicitly marks gallery image requests public", () => {
  assert.match(
    publicHtml,
    /galleryJoiner\+'public=1'/,
  );
  // Super Admin share-card preview deliberately keeps its admin-scoped URL.
  assert.match(
    shareRoute,
    /shareCard\?projectId=\$\{encodeURIComponent\(projectId\)\}&v=/,
  );
  assert.doesNotMatch(
    shareRoute,
    /shareCard\?projectId=\$\{encodeURIComponent\(projectId\)\}&public=1/,
  );
});

test("admin and preview requests keep canonical private behavior", () => {
  assert.match(assets, /mode: "admin"/);
  assert.match(assets, /const authorizedPreview = previewRequest && mode === "admin"/);
  assert.match(
    assets,
    /"cache-control":[\s\S]*mode === "admin"[\s\S]*\? "no-store"/,
  );
  assert.match(gallery, /mode === "admin"/);
  assert.match(gallery, /"private, no-store"/);
});
