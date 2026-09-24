import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

const [gallery,mapper,multipart,pkg,lock]=await Promise.all([
  read("../app/api/gallery/route.ts"),
  read("../app/api/super-mapper/route.ts"),
  read("../app/api/super-mapper-masterplan-upload/route.ts"),
  read("../package.json"),
  read("../package-lock.json"),
]);

test("untrusted image uploads stay limited to browser-safe project formats",()=>{
  assert.match(gallery,/allowed=\["image\/jpeg","image\/png","image\/webp"\]/);
  assert.match(mapper,/IMAGE_MIME_TYPES = new Set\(\["image\/jpeg", "image\/png", "image\/webp"\]\)/);
  assert.match(mapper,/IMAGE_EXTENSIONS = new Set\(\["jpg", "jpeg", "png", "webp"\]\)/);

  for(const exotic of ["image/jxl","image/heif","image/heic",".jxl",".heif",".heic",".icns"]){
    assert.equal(gallery.includes(exotic),false,`gallery must reject ${exotic}`);
    assert.equal(mapper.includes(exotic),false,`mapper must reject ${exotic}`);
  }
});

test("transitive image-size parser is pinned to the patched override in manifest and lockfile",()=>{
  const manifest=JSON.parse(pkg);
  assert.equal(manifest.overrides["image-size"],"2.0.4");

  const parsed=JSON.parse(lock);
  const installed=parsed.packages?.["node_modules/image-size"]?.version;
  if(installed!==undefined) assert.equal(installed,"2.0.4");
  assert.notEqual(installed,"2.0.2");
  assert.notEqual(installed,"2.0.3");
});

test("R2 multipart upload IDs are treated as opaque provider values",()=>{
  assert.match(multipart,/R2 uploadId is an opaque provider-issued value/);
  assert.match(multipart,/value\.length <= 1024/);
  assert.match(multipart,/!\/\[\\u0000-\\u001f\\u007f\]\/\.test\(value\)/);
  assert.doesNotMatch(multipart,/\[a-zA-Z0-9\._~\-\]/);
  assert.match(multipart,/resumeMultipartUpload\([\s\S]*uploadId/);
});
