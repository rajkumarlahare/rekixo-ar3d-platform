import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../app/plot-side-semantics.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const semantics = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

test("numbered corner ranges follow original click order instead of shortest-path guessing", () => {
  // User-visible corner 3 → 12 on a 12-corner polygon means:
  // 3→4, 4→5, ... 11→12 (zero-based edge indexes 2..10).
  assert.deepEqual(
    semantics.forwardCornerEdgeChain(2, 11, 12),
    [2, 3, 4, 5, 6, 7, 8, 9, 10],
  );

  // Reverse/wrapped selection is explicit: corner 12 → 3 means
  // 12→1, 1→2, 2→3.
  assert.deepEqual(
    semantics.forwardCornerEdgeChain(11, 2, 12),
    [11, 0, 1],
  );

  assert.deepEqual(semantics.forwardCornerEdgeChain(2, 3, 12), [2]);
  assert.deepEqual(semantics.forwardCornerEdgeChain(2, 2, 12), []);
  assert.deepEqual(semantics.forwardCornerEdgeChain(-1, 2, 12), []);
});

test("legacy semantics remain layout-less and readable with zero migration", () => {
  const legacy = semantics.serializePlotSideSemantics(4, {
    front: [0],
    depthA: [1],
    back: [2],
    depthB: [3],
  });
  const raw = JSON.parse(legacy);
  assert.equal(raw.layout, undefined);
  assert.equal(semantics.parsePlotSideSemantics(legacy, 4).layout, undefined);
  assert.deepEqual(
    semantics.parsePlotSideSemantics(legacy, 4).roles,
    { front: [0], back: [2], depthA: [1], depthB: [3] },
  );
});

test("three-side semantics persist Front Back Depth and intentionally omit Depth B", () => {
  const three = semantics.serializePlotSideSemantics(
    5,
    {
      front: [0, 1],
      back: [3],
      depthA: [4],
      depthB: [],
    },
    "three",
  );
  const parsed = semantics.parsePlotSideSemantics(three, 5);
  assert.equal(parsed.layout, "three");
  assert.deepEqual(parsed.roles.front, [0, 1]);
  assert.deepEqual(parsed.roles.back, [3]);
  assert.deepEqual(parsed.roles.depthA, [4]);
  assert.equal(parsed.roles.depthB, undefined);

  const changedFront = semantics.setPlotSideEdge(three, "front", 2, 5);
  const reparsed = semantics.parsePlotSideSemantics(changedFront, 5);
  assert.equal(reparsed.layout, "three");
  assert.deepEqual(reparsed.roles.front, [2]);
  assert.equal(reparsed.roles.depthB, undefined);
});
