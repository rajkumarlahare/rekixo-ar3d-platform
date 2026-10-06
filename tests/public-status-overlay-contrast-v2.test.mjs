import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [geometry, css] = await Promise.all([
  readFile(new URL("../public/project/project-geometry.js", import.meta.url), "utf8"),
  readFile(new URL("../public/project/status-overlay.css", import.meta.url), "utf8"),
]);

function alpha(name) {
  const match = css.match(new RegExp(`--rekixo-status-overlay-alpha-${name}:([.0-9]+)`));
  assert.ok(match, `${name} overlay alpha missing`);
  return Number(match[1]);
}

test("public viewer loads the versioned status-overlay stylesheet once", () => {
  assert.match(geometry, /REKIXO_PUBLIC_STATUS_OVERLAY_BOOTSTRAP_V2/);
  assert.match(geometry, /status-overlay\.css\?v=2/);
  assert.match(geometry, /data-rekixo-status-overlay="v2"/);
  assert.match(geometry, /new URL\('status-overlay\.css\?v=2', currentScript\.src\)/);
});

test("2D overlay uses project-scoped theme RGB as the single color source", () => {
  assert.match(css, /var\(--plot-available-rgb\)/);
  assert.match(css, /var\(--plot-booked-rgb\)/);
  assert.match(css, /var\(--plot-sold-rgb\)/);
  assert.doesNotMatch(css, /--status-overlay-(?:available|booked|sold)-rgb/);
});

test("masterplan background contribution is bounded by stronger status opacity", () => {
  assert.equal(alpha("available"), 0.46);
  assert.equal(alpha("booked"), 0.58);
  assert.equal(alpha("sold"), 0.68);

  // Sold keeps only 32% of the masterplan pixel in the final alpha blend,
  // preventing dark/green source plots from turning the Sold state muddy.
  assert.ok(1 - alpha("sold") <= 0.32 + Number.EPSILON);
  assert.ok(alpha("sold") > alpha("booked"));
  assert.ok(alpha("booked") > alpha("available"));
});

test("selected plots keep status fill parity and use edge/glow for focus", () => {
  for (const status of ["available", "booked", "sold"]) {
    assert.match(
      css,
      new RegExp(`\\.plot\\.selected\\[data-status="${status}"\\][\\s\\S]*?fill:rgba\\(var\\(--plot-${status}-rgb\\),var\\(--rekixo-status-overlay-alpha-${status}\\)\\)!important`),
    );
  }
  assert.match(css, /stroke:#fff!important/);
  assert.match(css, /stroke-width:2\.05!important/);
});

test("status-filter view reuses the same semantic fill opacity", () => {
  for (const status of ["available", "booked", "sold"]) {
    assert.match(
      css,
      new RegExp(`status-filter-${status}[\\s\\S]*?fill:rgba\\(var\\(--plot-${status}-rgb\\),var\\(--rekixo-status-overlay-alpha-${status}\\)\\)!important`),
    );
  }
});
