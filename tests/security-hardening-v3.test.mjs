import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const [auth,login,health,logout,pkg,lock,migration]=await Promise.all([
  read("../app/admin-auth.ts"),
  read("../app/api/admin/login/route.ts"),
  read("../app/api/platform-health/route.ts"),
  read("../app/api/admin/logout/route.ts"),
  read("../package.json"),
  read("../package-lock.json"),
  read("../drizzle/0030_rekixo_auth_hardening.sql"),
]);

test("session signatures use WebCrypto verification and owner sessions are server-revocable",()=>{
  assert.match(auth,/crypto\.subtle\.verify\("HMAC"/);
  assert.match(auth,/super_admin_security/);
  assert.match(auth,/owner\.sessionVersion/);
  assert.match(logout,/session_version=session_version\+1/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS super_admin_security/);
});

test("login throttling is bounded by IP and identifier with indexed cleanup",()=>{
  assert.match(login,/const IDENTIFIER_MAX=5/);
  assert.match(login,/const IP_MAX=20/);
  assert.match(login,/digestKey\("ip"/);
  assert.match(login,/digestKey\("ip\+identifier"/);
  assert.match(login,/DELETE FROM login_attempts WHERE window_start < \?/);
  assert.match(migration,/idx_login_attempts_window_start/);
  assert.match(login,/retry-after/);

  const blockedAt=login.indexOf("if(blocked(ipRow,now,IP_MAX)||blocked(identifierRow,now,IDENTIFIER_MAX))");
  const authAt=login.indexOf("const session=await authenticateAdmin");
  const identifierWriteAt=login.indexOf("recordFailure(identifierKey,identifierRow,now)");
  assert.ok(blockedAt>=0&&authAt>blockedAt&&identifierWriteAt>authAt);
});

test("anonymous platform health is minimized while owner diagnostics remain available",()=>{
  assert.match(health,/const privileged = session\?\.role === "super_admin"/);
  assert.match(health,/privileged[\s\S]*\: \{ ok: true \}/);
  assert.match(health,/"cache-control": "no-store"/);
});

test("dependency baseline is patched and vinext upgrade is controlled on branch",()=>{
  const data=JSON.parse(pkg);
  assert.equal(data.dependencies.next,"16.3.6");
  assert.equal(data.dependencies.react,"19.2.8");
  assert.equal(data.dependencies["react-dom"],"19.2.8");
  assert.equal(data.devDependencies["react-server-dom-webpack"],"19.2.8");
  assert.equal(data.devDependencies["eslint-config-next"],"16.3.6");
  assert.equal(data.devDependencies["@vitejs/plugin-rsc"],"0.5.35");
  assert.equal(data.devDependencies.vinext,"1.0.0-beta.10");
  assert.equal(data.overrides["image-size"],"2.0.4");
});

test("dependency lockfile resolves the exact controlled security baseline",()=>{
  const data=JSON.parse(lock);
  const packages=data.packages||{};
  assert.equal(packages["node_modules/next"]?.version,"16.3.6");
  assert.equal(packages["node_modules/react"]?.version,"19.2.8");
  assert.equal(packages["node_modules/react-dom"]?.version,"19.2.8");
  assert.equal(packages["node_modules/react-server-dom-webpack"]?.version,"19.2.8");
  assert.equal(packages["node_modules/@vitejs/plugin-rsc"]?.version,"0.5.35");
  assert.equal(packages["node_modules/vinext"]?.version,"1.0.0-beta.10");
  const imageSize=packages["node_modules/image-size"]?.version;
  if(imageSize!==undefined)assert.equal(imageSize,"2.0.4");
});
