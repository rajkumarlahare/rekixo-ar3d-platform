import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const appRoot = path.join(ROOT, "app");

const moduleNames = [
  "auth",
  "audit",
  "domains",
  "projects",
  "plots",
  "mapper",
  "geo",
  "pricing",
  "sharing",
  "db",
  "super-admin",
  "client-admin",
  "public-project",
  "ui",
  "contracts",
];

const sharedImplementationBasenames = new Set([
  "admin-auth",
  "client-admin-policy",
  "client-login-identity",
  "client-password-policy",
  "audit",
  "domain-utils",
  "project-domains",
  "project-context",
  "project-links",
  "project-provisioning",
  "project-profile-policy",
  "project-customer-actions",
  "area-policy",
  "plot-edge-semantics",
  "plot-side-semantics",
  "plot-side-resolver",
  "plot-sheet",
  "mapper-geometry",
  "cad-import",
  "measurement-sheet",
  "road-access-sheet",
  "side-mapping-sheet",
  "plot-pricing-sheet",
  "geo-model",
  "geo-calibration",
  "geo-fine-alignment",
  "geo-public-image",
  "geo-public-manifest",
  "google-maps-config",
  "share-branding",
  "share-branding-logo",
  "admin-dashboard",
  "super-admin-dashboard",
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute));
    else out.push(absolute);
  }
  return out;
}

function entrypoint(file) {
  const normalized = file.split(path.sep).join("/");
  return (
    /\/app\/api\/.*\/(?:route|handler)\.ts$/.test(normalized) ||
    /\/app\/.*\/page\.tsx$/.test(normalized) ||
    normalized.endsWith("/app/page.tsx") ||
    normalized.endsWith("/app/layout.tsx")
  );
}

function localImports(source) {
  const imports = [];
  for (const match of source.matchAll(/(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g)) {
    imports.push(match[1]);
  }
  return imports;
}

test("Stage 2 module facades exist", () => {
  for (const name of moduleNames) {
    const expected =
      name === "db"
        ? path.join(ROOT, "modules", name, "index.ts")
        : path.join(ROOT, "modules", name, "index.ts");
    assert.ok(fs.existsSync(expected), `missing module facade: modules/${name}/index.ts`);
  }
});

test("route and page entrypoints use module facades for shared platform behavior", () => {
  const violations = [];
  for (const file of walk(appRoot).filter(entrypoint)) {
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of localImports(source)) {
      if (!specifier.startsWith(".")) continue;
      if (/^(?:\.\.\/)+db(?:\/schema)?$/.test(specifier)) {
        violations.push(`${path.relative(ROOT, file)} -> ${specifier}`);
        continue;
      }
      const basename = specifier.split("/").at(-1);
      if (basename && sharedImplementationBasenames.has(basename)) {
        violations.push(`${path.relative(ROOT, file)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `entrypoints bypass module boundaries:\n${violations.join("\n")}`,
  );
});

test("modules never depend on route handlers", () => {
  const moduleRoot = path.join(ROOT, "modules");
  const violations = [];
  for (const file of walk(moduleRoot).filter((item) => /\.(?:ts|tsx)$/.test(item))) {
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of localImports(source)) {
      if (specifier.includes("/app/api/")) {
        violations.push(`${path.relative(ROOT, file)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("Stage 2 has no database migration", () => {
  const stageDoc = fs.readFileSync(
    path.join(ROOT, "docs", "STAGE-2-MODULARIZATION.md"),
    "utf8",
  );
  assert.match(stageDoc, /No D1 migration is part of Stage 2/);
  assert.match(stageDoc, /No R2 object is moved/);
});
