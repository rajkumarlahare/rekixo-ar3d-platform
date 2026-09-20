import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration=fs.readFileSync("drizzle/0025_client_mobile_login_v1.sql","utf8");
const identity=fs.readFileSync("app/client-login-identity.ts","utf8");
const provisioning=fs.readFileSync("app/project-provisioning.ts","utf8");
const auth=fs.readFileSync("app/admin-auth.ts","utf8");
const users=fs.readFileSync("app/api/admin/users/route.ts","utf8");
const login=fs.readFileSync("app/admin/login/login-form.tsx","utf8");

test("existing projects are pinned to email login while new provisioning defaults to mobile",()=>{
  assert.match(migration,/clientLoginMode','email'/);
  assert.match(migration,/SELECT id,'clientLoginMode','email'/);
  assert.match(provisioning,/clientLoginMode:\s*"mobile"/);
});

test("admin identity migration is additive and preserves legacy email accounts",()=>{
  assert.match(migration,/ADD COLUMN login_type TEXT NOT NULL DEFAULT 'email'/);
  assert.match(migration,/ADD COLUMN login_id TEXT/);
  assert.match(migration,/ADD COLUMN mobile TEXT/);
  assert.match(migration,/login_id=lower\(trim\(email\)\)/);
  assert.doesNotMatch(migration,/DROP TABLE admin_users|DELETE FROM admin_users/i);
});

test("mobile login uses a dedicated canonical login id instead of overloading the email field",()=>{
  assert.match(identity,/normalizeMobileLogin/);
  assert.match(identity,/\+91/);
  assert.match(identity,/internalEmailForMobile/);
  assert.match(users,/loginType/);
  assert.match(users,/loginId/);
  assert.match(auth,/u\.login_id/);
  assert.match(auth,/u\.login_type/);
});

test("login form supports legacy email, new mobile, and shared mixed mode",()=>{
  assert.match(login,/loginType\?: "email" \| "mobile" \| "mixed"/);
  assert.match(login,/MOBILE NUMBER/);
  assert.match(login,/EMAIL OR MOBILE NUMBER/);
  assert.match(login,/name="loginId"/);
});

test("new mobile accounts remain password based and first-login password rotation stays intact",()=>{
  assert.match(provisioning,/must_change_password/);
  assert.match(provisioning,/input\.loginType/);
  assert.match(provisioning,/input\.loginId/);
  assert.match(auth,/verifyPassword/);
});
