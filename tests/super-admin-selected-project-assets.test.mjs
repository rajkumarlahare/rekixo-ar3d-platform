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

test("super admin asset requests require the explicit selected project", () => {
  assert.match(assets, /if \(session\?\.role === "super_admin"\)/);
  assert.match(assets, /return requested \? activeProjectId\(requested\) : null/);
  assert.doesNotMatch(assets, /requested \|\| session\.projectId/);
  assert.match(assets, /headers\.set\("x-rekixo-project", projectId\)/);
});

test("client admin explicit foreign project is rejected", () => {
  assert.match(assets, /if \(requested && requested !== session\.projectId\) return null/);
  assert.match(gallery, /if \(requested && requested !== session\.projectId\) return null/);
});

test("gallery follows the same explicit Super Admin project rule", () => {
  assert.match(gallery, /if \(session\?\.role === "super_admin"\)/);
  assert.match(gallery, /return requested \? activeProjectId\(requested\) : null/);
  assert.doesNotMatch(gallery, /requested \|\| session\.projectId/);
});
