import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [clients, domainsUi, usersApi, domainsApi, css] = await Promise.all([
  source("../app/client-admin-manager.tsx"),
  source("../app/project-domain-manager.tsx"),
  source("../app/api/admin/users/route.ts"),
  source("../app/api/admin/domains/route.ts"),
  source("../app/super-mapper.css"),
]);

test("long Super Admin lists are collapsed and paged on demand", () => {
  assert.match(clients, /Client projects & admins/);
  assert.match(clients, /Security activity/);
  assert.match(clients, /super-collapse-toggle/);
  assert.match(clients, /section=clients&limit=/);
  assert.match(clients, /section=archived&limit=/);
  assert.match(clients, /section=project_options&limit=/);
  assert.match(clients, /section=audits&limit=/);
  assert.match(clients, /Load \$\{Math\.min\(CLIENT_PAGE_SIZE/);
  assert.match(clients, /Load \$\{Math\.min\(AUDIT_PAGE_SIZE/);
  assert.match(css, /REKIXO_SUPER_ADMIN_COLLAPSIBLE_LISTS_V1/);
  assert.match(css, /rekixo-super-list-reveal/);
});

test("client list summary stays count-only while projects and archives page independently", () => {
  assert.match(usersApi, /section==="summary"/);
  assert.match(usersApi, /projectCount:Number/);
  assert.match(usersApi, /archivedCount:Number/);
  assert.match(usersApi, /section==="project_options"/);
  assert.match(usersApi, /section==="archived"/);
  assert.match(usersApi, /section==="clients"/);
  assert.match(usersApi, /section==="audits"/);
  assert.match(usersApi, /LIMIT \? OFFSET \?/);
  assert.match(usersApi, /audits:audits\.results/);
  assert.match(usersApi, /clientAdminUrl:clientAdminUrl\(\)/);
});

test("domain cards do not load until expansion and use server pagination", () => {
  assert.match(domainsUi, /summary=1/);
  assert.match(domainsUi, /limit=\$\{Math\.max\(1, limit\)\}&offset=\$\{offset\}/);
  assert.match(domainsUi, /if \(next && !loaded\) await loadPage/);
  assert.match(domainsUi, /Project links & domains/);
  assert.match(domainsApi, /summaryOnly/);
  assert.match(domainsApi, /LIMIT \? OFFSET \?/);
  assert.match(domainsApi, /nextOffset/);
  assert.match(domainsApi, /hasMore/);
});

test("paged client deletion uses server-returned canonical active admin counts", () => {
  assert.match(clients, /user\.projectAdminCount/);
  assert.match(clients, /user\.projectActiveAdminCount/);
  assert.match(clients, /removingLastActive/);
  assert.match(usersApi, /projectAdminCount/);
  assert.match(usersApi, /projectActiveAdminCount/);
  assert.match(usersApi, /id<>\? AND status='active'/);
  assert.doesNotMatch(clients, /users\.filter\(\(item\) => item\.projectId === user\.projectId\)\.length/);
});
