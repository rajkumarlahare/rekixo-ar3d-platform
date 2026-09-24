import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [auth, mapper, assets, gallery] = await Promise.all([
  readFile(new URL("../app/admin-auth.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/plot-mapper.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/project-asset/[kind]/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/gallery/[id]/route.ts", import.meta.url), "utf8"),
]);

test("Super Admin session is platform-scoped while mapper selects an explicit project", () => {
  assert.match(auth, /projectId:PLATFORM_ADMIN_SCOPE_ID/);
  assert.doesNotMatch(auth, /role:"super_admin",projectId:"tiyansh-prime-square"/);
  assert.match(
    mapper,
    /\/api\/project-asset\/\$\{kind\}\?projectId=\$\{encodeURIComponent\(projectId\)\}/,
  );
});

test("super admin private asset requests still require the explicit selected project", () => {
  assert.match(assets, /if \(session\?\.role === "super_admin"\)/);
  assert.match(assets, /requested \? await activeProjectId\(requested\) : null/);
  assert.doesNotMatch(assets, /requested \|\| session\.projectId/);
  assert.match(assets, /headers\.set\("x-rekixo-project", projectId\)/);
  assert.match(assets, /headers\.set\("x-rekixo-access-mode", mode\)/);
});

test("client admin foreign private project remains rejected after public fallback check", () => {
  assert.match(
    assets,
    /publicId[\s\S]*publicId !== session\.projectId[\s\S]*mode: "public"/,
  );
  assert.match(
    assets,
    /if \(requested && requested !== session\.projectId\) return null/,
  );
  assert.match(
    gallery,
    /publicId[\s\S]*publicId !== session\.projectId[\s\S]*mode: "public"/,
  );
  assert.match(
    gallery,
    /if \(requested && requested !== session\.projectId\) return null/,
  );
});

test("gallery keeps explicit Super Admin selection for private/admin reads", () => {
  assert.match(gallery, /if \(session\?\.role === "super_admin"\)/);
  assert.match(gallery, /requested \? await activeProjectId\(requested\) : null/);
  assert.doesNotMatch(gallery, /requested \|\| session\.projectId/);
  assert.match(gallery, /"x-rekixo-access-mode", mode/);
});
