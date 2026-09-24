import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const rootPage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const previewPage = await readFile(new URL("../app/preview/[projectId]/page.tsx", import.meta.url), "utf8");
const sharedPage = await readFile(new URL("../app/projects/[slug]/page.tsx", import.meta.url), "utf8");

test("public project runtime shell and JS revalidate instead of staying stale in browser cache", () => {
  assert.match(worker, /function isPublicProjectRuntimeAsset/);
  assert.match(worker, /project\/project-geometry\.js/);
  assert.match(worker, /project\/three-view\.js/);
  assert.match(worker, /secured\.headers\.set\("cache-control", "no-cache"\)/);
});

test("all iframe entry points share runtime v66 for this rollout", () => {
  assert.match(rootPage, /\/project\/index\.html\?projectId=.*&pv=.*&v=66/);
  assert.match(previewPage, /preview=1&v=66/);
  assert.match(sharedPage, /projectSlug=.*&pv=.*&v=66/);
});
