import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const [galleryApi,galleryBytes,publicHtml,users,manager,auth,logout,health,assetRoute]=await Promise.all([
  read("../app/api/gallery/route.ts"),
  read("../app/api/gallery/[id]/route.ts"),
  read("../public/project/index.html"),
  read("../app/api/admin/users/route.ts"),
  read("../app/client-admin-manager.tsx"),
  read("../app/admin-auth.ts"),
  read("../app/api/admin/logout/route.ts"),
  read("../app/api/platform-health/route.ts"),
  read("../app/api/project-asset/[kind]/route.ts"),
]);

test("gallery deletion fails closed before best-effort R2 cleanup",()=>{
  const removeRow=galleryApi.indexOf('DELETE FROM gallery WHERE project_id=? AND id=?');
  const removeObject=galleryApi.indexOf('await env.BUCKET.delete(item.objectKey)');
  assert.ok(removeRow>=0&&removeObject>removeRow);
  assert.match(galleryApi,/cleanupPending:!objectDeleted/);
  assert.match(galleryBytes,/mode === "public"[\s\S]*\? "no-store"/);
});

test("open customer runtime refreshes live state without a page reload",()=>{
  assert.match(publicHtml,/fetch\('\/api\/public-live'/);
  assert.match(publicHtml,/document\.hidden/);
  assert.match(publicHtml,/visibilitychange/);
  assert.match(publicHtml,/if\(!document\.hidden\)void refreshLiveState\(\)/);
  assert.match(publicHtml,/setInterval\(\(\)=>void refreshLiveState\(\),30000\)/);
});

test("archive restore replays saved access while legacy archives stay fail closed",()=>{
  assert.match(users,/project_archive_access_snapshot/);
  assert.match(users,/accessRestored:false/);
  assert.match(users,/project_domains SET status=COALESCE/);
  assert.match(users,/session_version=session_version\+1/);
  assert.match(manager,/saved domains\/admin access state restore hoga/);
  assert.match(manager,/data\.accessRestored\?/);
});

test("client and owner credential/access changes revoke existing sessions",()=>{
  const toggle=users.slice(users.indexOf('if(action==="toggle")'),users.indexOf('if(action==="domains")'));
  const reset=users.slice(users.indexOf('if(action==="reset_password")'),users.indexOf('return Response.json({error:"Invalid action"'));
  const archive=users.slice(users.indexOf("export async function DELETE"));
  assert.match(toggle,/session_version=session_version\+1/);
  assert.match(reset,/session_version=session_version\+1/);
  assert.match(archive,/session_version=session_version\+1/);
  assert.match(logout,/super_admin_security SET session_version=session_version\+1/);
  assert.match(auth,/owner\.sessionVersion/);
});

test("signature and password comparisons avoid direct secret string equality",()=>{
  assert.match(auth,/crypto\.subtle\.verify\("HMAC"/);
  assert.match(auth,/let diff=0;for\(let i=0;i<actual\.length;i\+\+\)diff\|=actual\[i\]\^expected\[i\]/);
  assert.doesNotMatch(auth,/actual===expected/);
});

test("anonymous health is minimal and immutable asset revocation boundary is explicit",()=>{
  assert.match(health,/privileged[\s\S]*\: \{ ok: true \}/);
  const gate=assetRoute.indexOf("publicSiteEnabled(projectId)");
  const readObject=assetRoute.indexOf("env.BUCKET.get(objectKey)");
  assert.ok(gate>=0&&readObject>gate);
  assert.match(assetRoute,/already stored in a browser\/CDN immutable cache cannot be recalled/);
  assert.match(assetRoute,/public,max-age=31536000,immutable/);
});
