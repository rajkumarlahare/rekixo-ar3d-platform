import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const [migration,users]=await Promise.all([
  read("../drizzle/0031_rekixo_archive_access_snapshot.sql"),
  read("../app/api/admin/users/route.ts"),
]);

test("future archives preserve exact access state before disabling it",()=>{
  assert.match(migration,/project_archive_access_snapshot/);
  assert.match(users,/archiveAccessSnapshotStatements/);
  assert.match(users,/SELECT project_id,'admin',id,status/);
  assert.match(users,/SELECT project_id,'membership',user_id,status/);
  assert.match(users,/SELECT project_id,'domain',host,status/);
  const snapshot=users.indexOf("...archiveAccessSnapshotStatements");
  const disable=users.indexOf("UPDATE projects SET status='deleted'",snapshot);
  assert.ok(snapshot>=0&&disable>snapshot);
});

test("restore replays saved access state atomically and legacy archives stay fail-closed",()=>{
  assert.match(users,/restoreArchivedProject/);
  assert.match(users,/hasSnapshot/);
  assert.match(users,/accessRestored:false/);
  assert.match(users,/project_domains SET status=COALESCE/);
  assert.match(users,/session_version=session_version\+1/);
  assert.match(users,/DELETE FROM project_archive_access_snapshot/);
});
