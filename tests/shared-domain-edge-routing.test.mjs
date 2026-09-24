import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("shared boss domain routes are narrow and never hijack the Vercel root", async () => {
  const deploy = await source("../scripts/prepare-cloudflare-deploy.mjs");

  for (const expected of [
    "${platformHost}/projects/*",
    "${platformHost}/__rekixo/*",
    "${platformHost}/api/public-data*",
    "${platformHost}/api/project-asset/*",
    "${platformHost}/api/admin/*",
    "${platformHost}/api/client/*",
    "${platformHost}/api/data*",
    "${platformHost}/api/gallery*",
  ]) {
    assert.ok(deploy.includes(expected), `missing shared-domain route ${expected}`);
  }

  assert.doesNotMatch(deploy, /`\$\{platformHost\}\/\*`/);
  assert.match(deploy, /if \(mode === "client" && sharedDomainRoutes\.length\)/);
  assert.match(deploy, /delete config\.routes/);
});

test("query-bearing Rekixo API routes terminate in wildcard so Cloudflare matches query strings", async () => {
  const deploy = await source("../scripts/prepare-cloudflare-deploy.mjs");

  for (const expected of [
    "${platformHost}/api/public-data*",
    "${platformHost}/api/data*",
    "${platformHost}/api/gallery*",
  ]) {
    assert.ok(deploy.includes(expected), `query-safe route missing: ${expected}`);
  }

  assert.doesNotMatch(deploy, /\`\$\{platformHost\}\/api\/public-data\`,/);
  assert.doesNotMatch(deploy, /\`\$\{platformHost\}\/api\/data\`,/);
  assert.doesNotMatch(deploy, /\`\$\{platformHost\}\/api\/gallery\`,/);
});

test("client-admin feature APIs are explicitly routed to the Generic Client Worker and are private", async () => {
  const [deploy, worker] = await Promise.all([
    source("../scripts/prepare-cloudflare-deploy.mjs"),
    source("../worker/index.ts"),
  ]);

  assert.ok(
    deploy.includes("${platformHost}/api/client/*"),
    "shared-domain client API route missing",
  );
  assert.match(worker, /pathname\.startsWith\("\/api\/client"\)/);
  assert.match(worker, /isSensitiveClientPath\(externalUrl\.pathname\)/);
  assert.match(worker, /secured\.headers\.set\("cache-control", "no-store"\)/);
});

test("Rekixo static assets use a native isolated namespace plus compatibility fallback", async () => {
  const [worker, projectPage, dashboard, nextConfig, helpers] = await Promise.all([
    source("../worker/index.ts"),
    source("../app/projects/[slug]/page.tsx"),
    source("../app/admin-dashboard.tsx"),
    source("../next.config.ts"),
    source("../worker/shared-assets.mjs"),
  ]);

  assert.match(nextConfig, /assetPrefix:\s*"\/__rekixo"/);
  assert.match(helpers, /SHARED_ASSET_PREFIX = "\/__rekixo"/);
  assert.match(helpers, /rewriteAssetReferences/);
  assert.match(worker, /stripSharedAssetPrefix/);
  assert.match(worker, /fetchPrefixedFrameworkAsset/);
  assert.match(worker, /env\.ASSETS\.fetch\(request\)/);
  assert.match(worker, /CLIENT_PLATFORM_HOST/);
  assert.match(worker, /externalUrl\.pathname\.startsWith\("\/projects\/"\)/);
  assert.match(projectPage, /\/__rekixo\/project\/\?projectSlug=/);
  assert.doesNotMatch(projectPage, /\/__rekixo\/project\/index\.html\?projectSlug=/);
  assert.match(dashboard, /\/api\/project-asset\/masterplan\?projectId=/);
});

test("free workers.dev fallback remains independent of shared-domain rewriting", async () => {
  const worker = await source("../worker/index.ts");
  assert.match(worker, /isSharedPlatformRequest\(externalUrl, env\)/);
  assert.match(worker, /configured && normalizedHost\(url\.hostname\) === configured/);
});
