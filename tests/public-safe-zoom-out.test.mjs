import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../public/project/index.html", import.meta.url),
  "utf8",
);

test("customer map opens exactly at the existing start fit", () => {
  assert.match(
    page,
    /function reset\(\)\{calcFit\(\);scale=fit;pan=\{x:0,y:0\};pan=initialPanForPresentation\(\);render\(\)\}/,
  );
  assert.match(page, /fit = mobile \? Math\.max\(fw,fh\) : containFit/);
});

test("mobile zoom-out floor is full-image contain fit instead of opening cover fit", () => {
  assert.match(page, /let fit = 1, minFit = 1, scale = 1/);
  assert.match(page, /const containFit = Math\.min\(fw,fh\)/);
  assert.match(
    page,
    /minFit = Number\.isFinite\(containFit\) && containFit > 0[\s\S]*?Math\.min\(containFit,fit\)[\s\S]*?: fit/,
  );
  assert.match(
    page,
    /function zoomAt\(newScale,sx,sy\)\{newScale=clamp\(newScale,minFit,fit\*4\.5\)/,
  );
});

test("pinch and viewport resize preserve the same safe zoom-out floor", () => {
  assert.match(
    page,
    /const ns=clamp\(gesture\.scale\*distance\(a,b\)\/gesture\.dist,minFit,fit\*4\.5\)/,
  );
  assert.match(
    page,
    /calcFit\(\);scale=clamp\(fit\*z,minFit,fit\*4\.5\);render\(\)/,
  );
});

test("zoom-out patch keeps image and clickable polygons on one transformed world", () => {
  assert.match(
    page,
    /world\.style\.transform = .*scale\(\$\{scale\}\) rotate\(\$\{publicRotation\*90\}deg\)/,
  );
  assert.match(page, /const mapped=normalized\.map\(\(\[x,y\]\)=>\[x\*W,y\*H\]\)/);
});
