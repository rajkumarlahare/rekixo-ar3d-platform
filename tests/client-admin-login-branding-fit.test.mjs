import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [form, css] = await Promise.all([
  readFile(new URL("../app/admin/login/login-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/login/login-critical.ts", import.meta.url), "utf8"),
]);

test("client project login is branded as Builder Admin with an inline crane mark", () => {
  assert.match(form, /function BuilderAdminMark\(\)/);
  assert.match(form, /aria-label="Builder crane"/);
  assert.match(form, /"Builder Admin"/);
  assert.match(form, /login-icon--builder/);
  assert.match(form, /builder-mark-gold/);
  assert.match(form, /builder-mark-red/);
});

test("desktop login is compact enough to fit common laptop viewports", () => {
  assert.match(css, /width: min\(100%, 500px\)/);
  assert.match(css, /padding: 30px 38px 24px/);
  assert.match(css, /min-height: 56px/);
  assert.match(css, /margin: 8px 0 24px/);
  assert.match(css, /@media \(max-height: 680px\) and \(min-width: 601px\)/);
});

test("mobile login remains responsive and does not use fixed viewport height", () => {
  assert.match(css, /min-height: 100dvh/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.doesNotMatch(css, /height:\s*100vh/);
  assert.doesNotMatch(css, /height:\s*100dvh/);
});
