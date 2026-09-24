import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

const compat = read("app/legacy-tiyansh-compat.ts");
const context = read("app/project-context.ts");
const auth = read("app/admin-auth.ts");
const assets = read("app/api/project-asset/[kind]/route.ts");
const gallery = read("app/api/gallery/[id]/route.ts");
const data = read("app/api/data/route.ts");
const schema = read("db/schema.ts");
const admin = read("app/admin-dashboard.tsx");
const publicRuntime = read("public/project/index.html");
const three = read("public/project/three-view.js");
const rootPage = read("app/page.tsx");
const sharedPage = read("app/projects/[slug]/page.tsx");
const previewPage = read("app/preview/[projectId]/page.tsx");
const deploy = read(".github/workflows/deploy-cloudflare.yml");
const mapper = read("app/plot-mapper.tsx");
const mobileMigration = read("drizzle/0025_client_mobile_login_v1.sql");

test("Tiyansh identity lives only in the explicit legacy compatibility boundary", () => {
  assert.match(compat, /LEGACY_TIYANSH_PROJECT_ID = "tiyansh-prime-square"/);
  assert.match(compat, /PLATFORM_ADMIN_SCOPE_ID = "__rekixo_platform__"/);
  assert.match(compat, /legacyTiyanshClientHostAllowed/);
  assert.match(context, /isLegacyTiyanshHost/);
  assert.doesNotMatch(context, /export const DEFAULT_PROJECT_ID/);
  assert.doesNotMatch(context, /function legacyFallbackHost/);
});

test("legacy Worker host is Tiyansh-only and is not a shared multi-tenant access host", () => {
  const platformHostBody = context.slice(
    context.indexOf("export function isPlatformAccessHost"),
    context.indexOf("export async function clientLoginModeForProject"),
  );
  assert.doesNotMatch(platformHostBody, /legacy/i);
  assert.match(auth, /legacyTiyanshClientHostAllowed\(projectId,normalized\)/);
  assert.doesNotMatch(auth, /\[shared,fallback,legacyFallback,platform\]/);
});

test("legacy Tiyansh host role is resolved from the active project state", () => {
  assert.match(
    context,
    /if \(isLegacyTiyanshHost\(host\)\) \{[\s\S]*projectById\(LEGACY_TIYANSH_PROJECT_ID, true\)/,
  );
  assert.match(
    context,
    /project\.publicStatus === "published"[\s\S]*\("public" as const\)[\s\S]*\("unpublished" as const\)/,
  );
  assert.doesNotMatch(
    context,
    /if \(isLegacyTiyanshHost\(host\)\)\s*return \{ projectId: LEGACY_TIYANSH_PROJECT_ID, role: "public" as const \}/,
  );
});

test("Super Admin has a platform scope instead of an implicit Tiyansh tenant", () => {
  assert.match(auth, /projectId:PLATFORM_ADMIN_SCOPE_ID/);
  assert.doesNotMatch(auth, /role:"super_admin",projectId:"tiyansh-prime-square"/);
  assert.match(assets, /requested \? await activeProjectId\(requested\) : null/);
  assert.match(gallery, /requested \? await activeProjectId\(requested\) : null/);
  assert.match(data, /session\.role === "super_admin" \? String\(requested \|\| ""\)\.trim\(\) : session\.projectId/);
  assert.match(data, /Use project-specific Super Admin tools/);
});

test("runtime schema requires explicit tenant IDs for mutable customer data", () => {
  assert.doesNotMatch(schema, /default\("tiyansh-prime-square"\)/);
  for (const table of ["plots", "settings", "gallery"]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
});

test("Client Admin no longer bootstraps Tiyansh data from bundled public files", () => {
  assert.doesNotMatch(admin, /public\/plots\.json/);
  assert.doesNotMatch(admin, /tiyanshDefaults|COMPLETED_PROJECT_ID|isTiyansh/);
  assert.match(admin, /const basePlots=useMemo<Plot\[\]>\(\(\)=>\[\],\[\]\)/);
  assert.match(admin, /api\/project-asset\/masterplan\?projectId=/);
});

test("public project runtime is fully data-backed for every tenant including Tiyansh", () => {
  assert.doesNotMatch(publicRuntime, /<script src="plots-data\.js"><\/script>/);
  assert.doesNotMatch(publicRuntime, /REKIXO_DEFAULT_PROJECT/);
  assert.doesNotMatch(publicRuntime, /window\.TIYANSH_PLOTS/);
  assert.doesNotMatch(publicRuntime, /isTiyansh/);
  assert.doesNotMatch(publicRuntime, /master\.src='masterplan\.jpg'/);
  assert.match(publicRuntime, /const REKIXO_GENERIC_BOOT=true/);
  assert.match(publicRuntime, /window\.REKIXO_APPLY_PUBLIC_DATA=applyPublicData/);
  assert.match(publicRuntime, /new RekixoPlot3D/);
  assert.match(three, /class RekixoPlot3D/);
  assert.match(three, /window\.RekixoPlot3D=RekixoPlot3D/);
});

test("Tiyansh static recovery artifacts are archived outside the live public tree", () => {
  assert.ok(fs.existsSync("legacy/tiyansh-reference/plots.json"));
  assert.ok(fs.existsSync("legacy/tiyansh-reference/plots-data.js"));
  assert.ok(fs.existsSync("legacy/tiyansh-reference/masterplan.jpg"));
  assert.ok(!fs.existsSync("public/plots.json"));
  assert.ok(!fs.existsSync("public/masterplan.jpg"));
  assert.ok(!fs.existsSync("public/project/masterplan.jpg"));
  assert.ok(!fs.existsSync("public/project/plots-data.js"));
});

test("all public entry points use runtime v65 and explicit tenant context", () => {
  assert.match(rootPage, /projectId=\$\{encodeURIComponent\(target\.projectId \|\| ""\)\}&v=65/);
  assert.match(sharedPage, /projectSlug=.*&v=65/);
  assert.match(previewPage, /preview=1&v=65/);
});

test("existing Tiyansh email login compatibility and future mobile login remain intact", () => {
  assert.match(mobileMigration, /SELECT id,'clientLoginMode','email'/);
  assert.match(mobileMigration, /login_id=lower\(trim\(email\)\)/);
  assert.match(auth, /loginCandidates/);
});

test("mapper and deployment retain rollback compatibility without tenant special-casing", () => {
  assert.match(mapper, /projectId=\$\{encodeURIComponent\(projectId\)\}/);
  assert.match(deploy, /Legacy Tiyansh Worker/);
  assert.match(deploy, /verify-tiyansh-generic-parity\.mjs/);
});
