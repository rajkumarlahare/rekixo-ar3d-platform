import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
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

test("login throttling atomically reserves IP and identifier attempts before auth",()=>{
  assert.match(login,/const IDENTIFIER_MAX=5/);
  assert.match(login,/const IP_MAX=20/);
  assert.match(login,/digestKey\("ip"/);
  assert.match(login,/digestKey\("ip\+identifier"/);
  assert.match(login,/DELETE FROM login_attempts WHERE window_start < \?/);
  assert.match(migration,/idx_login_attempts_window_start/);
  assert.match(login,/ON CONFLICT\(key\) DO UPDATE SET/);
  assert.match(login,/login_attempts\.attempts\+1/);
  assert.match(login,/RETURNING attempts, window_start AS windowStart/);
  assert.match(login,/ipRow\.attempts>IP_MAX\|\|identifierRow\.attempts>IDENTIFIER_MAX/);
  assert.match(login,/retry-after/);

  const reserveAt=login.indexOf("consumeAttempt(ipKey,now)");
  const blockedAt=login.indexOf("if(ipRow.attempts>IP_MAX||identifierRow.attempts>IDENTIFIER_MAX)");
  const authAt=login.indexOf("const session=await authenticateAdmin");
  assert.ok(reserveAt>=0&&blockedAt>reserveAt&&authAt>blockedAt);
  assert.doesNotMatch(login,/async function recordFailure/);
});

test("login counter SQL increments atomically and resets only after the window",()=>{
  const match=login.match(/env\.DB\.prepare\(\s*`([\s\S]*?RETURNING attempts, window_start AS windowStart)`\s*\)/);
  assert.ok(match?.[1],"atomic login counter SQL not found");

  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL)");
  const statement=db.prepare(match[1]);
  const windowMs=15*60*1000;
  const counts=[];
  for(let index=0;index<6;index+=1){
    const row=statement.get("same-key",1_000,windowMs,windowMs);
    counts.push(Number(row.attempts));
  }
  assert.deepEqual(counts,[1,2,3,4,5,6]);

  const reset=statement.get("same-key",1_000+windowMs,windowMs,windowMs);
  assert.equal(Number(reset.attempts),1);
  assert.equal(Number(reset.windowStart),1_000+windowMs);
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
