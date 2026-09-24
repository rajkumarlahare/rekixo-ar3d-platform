import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source=await readFile(
  new URL("../app/api/project-asset/[kind]/route.ts",import.meta.url),
  "utf8",
);

test("authenticated mapper preview resolves before explicit public asset routing",()=>{
  const preview=source.indexOf('const previewRequest = url.searchParams.get("preview") === "1"');
  const superPreview=source.indexOf('previewRequest && session?.role === "super_admin"');
  const clientPreview=source.indexOf('previewRequest && session?.role === "client_admin"');
  const publicBranch=source.indexOf("if (explicitPublic)");
  assert.ok(preview>=0);
  assert.ok(superPreview>preview && superPreview<publicBranch);
  assert.ok(clientPreview>superPreview && clientPreview<publicBranch);
  assert.match(source,/variant === "public"/);
  assert.match(source,/mode: "admin"/);
  assert.match(source,/const wantsPublicMasterplan =\s*kind === "masterplan" && variant === "public"/);
});
