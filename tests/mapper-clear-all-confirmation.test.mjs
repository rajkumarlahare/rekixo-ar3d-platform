import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapper = await readFile(
  new URL("../app/plot-mapper.tsx", import.meta.url),
  "utf8",
);
const css = await readFile(
  new URL("../app/super-mapper.css", import.meta.url),
  "utf8",
);

test("Clear All opens an in-app confirmation before destructive mutation", () => {
  assert.match(mapper, /const \[clearAllConfirmOpen, setClearAllConfirmOpen\] = useState\(false\)/);
  assert.match(mapper, /function requestClearAllSelections\(\)/);
  assert.match(mapper, /onClick=\{requestClearAllSelections\}/);
  assert.match(mapper, /role="dialog"/);
  assert.match(mapper, /aria-modal="true"/);
  assert.match(mapper, /Clear all selections\?/);
  assert.match(mapper, />Cancel<\/button>/);
  assert.match(mapper, /onClick=\{\(\) => void clearAllSelections\(\)\}/);
});

test("bulk clear API call stays behind the explicit dialog confirmation", () => {
  const start = mapper.indexOf("async function clearAllSelections()");
  const end = mapper.indexOf("\n  function cadTap", start);
  const clearBlock = mapper.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(clearBlock, /window\.confirm\(/);
  assert.match(clearBlock, /setClearAllConfirmOpen\(false\)/);
  assert.match(clearBlock, /action: "clear_all_polygons"/);
  assert.match(clearBlock, /confirmation: `CLEAR \$\{projectId\}`/);
  assert.match(clearBlock, /verifyAllBoundariesCleared\(\)/);
});

test("confirmation UI is styled for both normal and fullscreen mapper modes", () => {
  assert.match(css, /REKIXO_CLEAR_ALL_CONFIRMATION_V1/);
  assert.match(css, /\.mapper-clear-confirm-backdrop\{/);
  assert.match(css, /position:fixed/);
  assert.match(css, /z-index:2147483000/);
  assert.match(css, /\.mapper-clear-confirm-dialog\{/);
  assert.match(css, /\.mapper-clear-confirm-actions button\.danger\{/);
});
