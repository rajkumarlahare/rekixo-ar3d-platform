import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const [auth,login,health,users,pkg]=await Promise.all([
  read("../app/admin-auth.ts"),
  read("../app/api/admin/login/route.ts"),
  read("../app/api/platform-health/route.ts"),
  read("../app/api/admin/users/route.ts"),
  read("../package.json"),
]);

test("session verification uses constant-time comparison and revocable owner version",()=>{
  assert.match(auth,/function timingSafeTextEqual/);
  assert.match(auth,/timingSafeTextEqual\(sig,await signature\(body\)\)/);
  assert.match(auth,/ADMIN_SESSION_VERSION/);
  assert.match(auth,/session\.sessionVersion===ownerSessionVersion\(\)/);
});

test("login throttling is bounded per account pair and per IP",()=>{
  assert.match(login,/IP_MAX=25/);
  assert.match(login,/pair:.*identifier\.trim\(\)\.toLowerCase\(\)/);
  assert.match(login,/ip:\$\{ip\}/);
  assert.match(login,/DELETE FROM login_attempts WHERE window_start < \?/);
  assert.match(login,/STALE_AFTER=24\*60\*60\*1000/);
  assert.match(login,/recordFailure\(db,keys\.pair/);
  assert.match(login,/recordFailure\(db,keys\.ip/);
});

test("public health endpoint discloses no deployment topology",()=>{
  assert.match(health,/\{ ok: true \}/);
  assert.doesNotMatch(health,/host|CLIENT_PLATFORM_HOST|ADMIN_HOST|mode|worker/i);
  assert.match(health,/"cache-control": "no-store"/);
});

test("last active admin removal archives instead of stranding an active project",()=>{
  assert.match(users,/id<>\? AND status='active'/);
  assert.match(users,/if\(Number\(otherActive\?\.total\|\|0\)>0\)/);
  assert.match(users,/UPDATE projects SET status='deleted'/);
});

test("dependency baseline uses patched Next and React RSC versions",()=>{
  const data=JSON.parse(pkg);
  assert.equal(data.dependencies.next,"16.3.6");
  assert.equal(data.dependencies.react,"19.2.8");
  assert.equal(data.dependencies["react-dom"],"19.2.8");
  assert.equal(data.devDependencies["react-server-dom-webpack"],"19.2.8");
  assert.equal(data.devDependencies["eslint-config-next"],"16.3.6");
  assert.equal(data.overrides["image-size"],"2.0.4");
});
