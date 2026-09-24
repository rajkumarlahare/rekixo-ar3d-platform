import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source=await readFile(
  new URL("../app/api/super-mapper-masterplan-upload/route.ts",import.meta.url),
  "utf8",
);

test("R2 multipart upload IDs are treated as opaque provider values",()=>{
  assert.match(source,/Cloudflare R2 uploadId is opaque/);
  assert.match(source,/value\.length <= 1024/);
  assert.doesNotMatch(source,/function validUploadId[\s\S]{0,180}\^\[a-zA-Z0-9/);
  assert.match(source,/resumeMultipartUpload\([\s\S]*uploadId/);
});
