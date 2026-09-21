import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const readme = fs.readFileSync("README.md", "utf8");
const architecture = fs.readFileSync("REKIXO-PLATFORM-V5.md", "utf8");
const deploy = fs.readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
const wrangler = fs.readFileSync("wrangler.jsonc", "utf8");
const prepare = fs.readFileSync("scripts/prepare-cloudflare-deploy.mjs", "utf8");

test("canonical source identity is Rekixo AR3D Platform", () => {
  assert.equal(pkg.name, "rekixo-ar3d-platform");
  assert.equal(lock.name, "rekixo-ar3d-platform");
  assert.equal(lock.packages[""].name, "rekixo-ar3d-platform");
  assert.match(readme, /# Rekixo AR3D Platform/);
  assert.match(architecture, /Canonical GitHub repository: `rekixo-ar3d-platform`/);
  assert.match(deploy, /^name: Deploy Rekixo AR3D Platform/m);
});

test("identity cleanup preserves live Cloudflare resource names", () => {
  assert.match(wrangler, /"name": "tiyansh-prime-square"/);
  assert.match(wrangler, /"database_name": "tiyansh-production"/);
  assert.match(wrangler, /"bucket_name": "tiyansh-gallery-production"/);
  assert.match(prepare, /"rekixo-super-admin"/);
  assert.match(prepare, /"rekixo-client-sites"/);
  assert.match(prepare, /"tiyansh-prime-square"/);
  assert.match(prepare, /database_name: "tiyansh-production"/);
  assert.match(prepare, /bucket_name: "tiyansh-gallery-production"/);
});

test("Tiyansh remains a project/legacy compatibility identity, not repository identity", () => {
  assert.match(readme, /Tiyansh Prime Square.*tenants\/data/s);
  assert.match(architecture, /Tiyansh Prime Square is a tenant\/project/);
});
