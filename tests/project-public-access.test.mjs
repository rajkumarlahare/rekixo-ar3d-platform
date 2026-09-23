import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminApi = await readFile(
  new URL("../app/api/admin/project-public-access/route.ts", import.meta.url),
  "utf8",
);
const publicApi = await readFile(
  new URL("../app/api/public-data/route.ts", import.meta.url),
  "utf8",
);
const dashboard = await readFile(
  new URL("../app/super-admin-dashboard.tsx", import.meta.url),
  "utf8",
);
const manager = await readFile(
  new URL("../app/project-public-access-manager.tsx", import.meta.url),
  "utf8",
);
const publicHtml = await readFile(
  new URL("../public/project/index.html", import.meta.url),
  "utf8",
);

test("public access switch is project-scoped, Super Admin-only and default-on", () => {
  assert.match(adminApi, /requireSuperAdmin\(\)/);
  assert.match(adminApi, /sameOrigin\(request\)/);
  assert.match(adminApi, /const PUBLIC_SITE_SETTING = "publicSiteEnabled"/);
  assert.match(adminApi, /const enabled = setting\?\.value !== "0"/);
  assert.match(adminApi, /DELETE FROM settings WHERE project_id=\? AND key=\?/);
  assert.match(adminApi, /project\.public_access_disabled/);
  assert.match(adminApi, /project\.public_access_enabled/);
});

test("Super Admin workspace shows the access control for every selected project", () => {
  assert.match(
    dashboard,
    /import ProjectPublicAccessManager from "\.\/project-public-access-manager";/,
  );
  assert.match(dashboard, /<ProjectPublicAccessManager/);
  assert.match(dashboard, /key=\{\`public-access:\$\{projectId\}\`\}/);
  assert.match(manager, /PUBLIC SITE ACCESS/);
  assert.match(manager, /Project Temporarily Unavailable/);
});

test("public data is paused with 503 while authenticated preview bypasses the gate", () => {
  assert.match(publicApi, /REKIXO_PUBLIC_ACCESS_GATE_V1/);
  assert.match(publicApi, /if \(!previewId\)/);
  assert.match(publicApi, /key='publicSiteEnabled'/);
  assert.match(publicApi, /publicAccess\?\.value === "0"/);
  assert.match(publicApi, /code: "PROJECT_TEMPORARILY_UNAVAILABLE"/);
  assert.match(publicApi, /status: 503/);
  assert.match(publicApi, /"cache-control": "no-store"/);
});

test("public shell recognizes intentional pause and does not mislabel it as an internet failure", () => {
  assert.match(publicHtml, /id="rekixoBootErrorTitle"/);
  assert.match(
    publicHtml,
    /error\.code=payload&&typeof payload==='object'\?String\(payload\.code\|\|''\):''/,
  );
  assert.match(
    publicHtml,
    /if\(error&&error\.code==='PROJECT_TEMPORARILY_UNAVAILABLE'\)break;/,
  );
  assert.match(publicHtml, /Project Temporarily Unavailable/);
  assert.match(
    publicHtml,
    /This project is temporarily unavailable\. Please try again later\./,
  );
});
