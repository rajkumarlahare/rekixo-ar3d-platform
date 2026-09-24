import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [adminApi, publicApi, access, dashboard, manager, publicHtml] =
  await Promise.all([
    readFile(
      new URL("../app/api/admin/project-public-access/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/public-data/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/public-site-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/super-admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/project-public-access-manager.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../public/project/index.html", import.meta.url), "utf8"),
  ]);

test("public access switch is project-scoped, Super Admin-only and default-on", () => {
  assert.match(adminApi, /requireSuperAdmin\(\)/);
  assert.match(adminApi, /sameOrigin\(request\)/);
  assert.match(adminApi, /PUBLIC_SITE_SETTING/);
  assert.match(access, /PUBLIC_SITE_SETTING = "publicSiteEnabled"/);
  assert.match(access, /return row\?\.value !== "0"/);
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

test("public data is paused with centralized 503 while authenticated preview bypasses the gate", () => {
  assert.match(publicApi, /REKIXO_PUBLIC_ACCESS_GATE_V2/);
  assert.match(
    publicApi,
    /if \(!previewId && !\(await publicSiteEnabled\(projectId\)\)\)/,
  );
  assert.match(publicApi, /return publicSiteUnavailableResponse\(\)/);
  assert.match(access, /code: "PROJECT_TEMPORARILY_UNAVAILABLE"/);
  assert.match(access, /status: 503/);
  assert.match(access, /"cache-control": "no-store"/);
  assert.match(access, /"retry-after": "60"/);
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
