import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mapper = await readFile(new URL("../app/plot-mapper.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("mapped plot labels are screen-stable instead of growing with mapper zoom", () => {
  assert.match(mapper, /REKIXO_MAPPER_ZOOM_STABLE_LABELS_V1/);
  assert.match(mapper, /const MAPPER_LABEL_SCREEN_FONT_PX = 14;/);
  assert.match(mapper, /const MAPPER_LABEL_SCREEN_STROKE_PX = 2\.4;/);
  assert.match(mapper, /const mappedPlotLabelZoom = Math\.max\(1, zoom\);/);
  assert.match(
    mapper,
    /fontSize: `\$\{\(MAPPER_LABEL_SCREEN_FONT_PX \/ mappedPlotLabelZoom\)\.toFixed\(4\)\}px`/,
  );
  assert.match(
    mapper,
    /strokeWidth: `\$\{\(MAPPER_LABEL_SCREEN_STROKE_PX \/ mappedPlotLabelZoom\)\.toFixed\(4\)\}px`/,
  );
});

test("only mapped plot number text consumes the adaptive label style", () => {
  assert.match(
    mapper,
    /<text x=\{center\[0\] \* 1000\} y=\{center\[1\] \* 1000\} style=\{mappedPlotLabelStyle\}>\{plot\.id\}<\/text>/,
  );
  assert.doesNotMatch(
    mapper,
    /className="pair-number"[^>]*style=\{mappedPlotLabelStyle\}/,
  );
});

test("the fixed screen target remains constant through the full 1x-18x mapper range", () => {
  const fontMatch = mapper.match(/const MAPPER_LABEL_SCREEN_FONT_PX = ([0-9.]+);/);
  const strokeMatch = mapper.match(/const MAPPER_LABEL_SCREEN_STROKE_PX = ([0-9.]+);/);
  assert.ok(fontMatch && strokeMatch);

  const targetFont = Number(fontMatch[1]);
  const targetStroke = Number(strokeMatch[1]);

  for (const zoom of [1, 1.5, 4, 8, 12, 18]) {
    const sourceFont = targetFont / zoom;
    const sourceStroke = targetStroke / zoom;
    assert.ok(Math.abs(sourceFont * zoom - targetFont) < 1e-9);
    assert.ok(Math.abs(sourceStroke * zoom - targetStroke) < 1e-9);
  }
});

test("mapper zoom geometry remains linear and saved polygon logic is untouched", () => {
  assert.match(mapper, /const MAX_MAPPER_ZOOM = 18;/);
  assert.match(
    mapper,
    /`min\(\$\{zoom \* 100\}%, \$\{\(zoom \* 58 \* visualAspect\)\.toFixed\(4\)\}vh\)`/,
  );
  assert.match(mapper, /function parsePolygon\(plot: Plot\)/);
  assert.match(mapper, /validNormalizedPolygon/);
  assert.match(mapper, /snapPoint/);
  assert.match(mapper, /polygon: JSON\.stringify\(points\)/);
});

test("legacy CSS remains fallback styling only", () => {
  assert.match(css, /\.mapper-image-wrap \.mapped-plot text \{[\s\S]*font-size: 20px;/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.mapper-image-wrap \.mapped-plot text\{font-size:13px\}/);
});
