import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("mobile precision zoom keeps plot side role controls viewport-visible", async () => {
  const [layout, css, mapper] = await Promise.all([
    source("../app/layout.tsx"),
    source("../app/mapper-side-controls.css"),
    source("../app/plot-mapper.tsx"),
  ]);

  assert.match(layout, /import "\.\/mapper-side-controls\.css";/);
  assert.match(mapper, /className="plot-side-assigner"/);
  assert.match(mapper, /Front \/ Back \/ Depth A \/ Depth B/);

  assert.match(css, /REKIXO_MAPPER_SIDE_CONTROLS_VISIBLE_V1/);
  assert.match(css, /any-pointer:\s*coarse/);
  assert.match(css, /\.mapper-v4-canvas \.plot-side-assigner\s*\{[\s\S]*position:\s*fixed\s*!important/);
  assert.match(css, /bottom:\s*calc\(env\(safe-area-inset-bottom, 0px\) \+ 72px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)\s*!important/);
  assert.match(css, /\.mapper-v4-canvas:fullscreen \.plot-side-assigner/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});
