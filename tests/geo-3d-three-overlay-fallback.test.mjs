import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Super Admin Geo preview defaults to isolated Rekixo Three overlay", () => {
  const visual = read("app/geo-3d-placement-visual.tsx");
  const overlay = read("app/geo-3d-three-overlay.ts");
  const css = read("app/geo-3d-placement-visual.module.css");

  assert.match(visual, /"rekixo-overlay" \| "google-native"/);
  assert.match(visual, />\("rekixo-overlay"\);/);
  assert.match(visual, /createGeo3DThreeOverlay\(/);
  assert.match(visual, /modelBytes: projectModelBytes/);
  assert.match(visual, /getPlacement: \(\) => placementRef\.current/);
  assert.match(visual, /Rekixo GLB/);
  assert.match(visual, /Google native/);
  assert.match(visual, /Renderer: Rekixo Three overlay/);
  assert.match(visual, /GLB bounds:/);

  assert.match(overlay, /from "three"/);
  assert.match(overlay, /three\/addons\/loaders\/GLTFLoader\.js/);
  assert.match(overlay, /parseAsync\(modelBytes\.slice\(0\), ""\)/);
  assert.match(overlay, /renderer\.setClearColor\(0x000000, 0\)/);
  assert.match(overlay, /THREE\.NeutralToneMapping/);
  assert.doesNotMatch(overlay, /ACESFilmicToneMapping/);
  assert.match(overlay, /map\.center/);
  assert.match(overlay, /map\.heading/);
  assert.match(overlay, /map\.tilt/);
  assert.match(overlay, /map\.range/);
  assert.match(overlay, /map\.fov/);
  assert.match(overlay, /addEventListener\("pointerdown", onPointerDown\)/);
  assert.match(overlay, /addEventListener\("pointermove", onPointerMove\)/);
  assert.match(overlay, /addEventListener\("wheel", onWheel/);
  assert.match(overlay, /map\.heading = normalizeHeading/);
  assert.match(overlay, /map\.tilt = clampTilt/);
  assert.match(overlay, /map\.range = clampRange/);
  assert.match(css, /\.modelOverlay/);
  assert.match(css, /pointer-events: auto/);
  assert.match(css, /touch-action: none/);
  assert.match(visual, /View \+90°/);
  assert.match(visual, /Controls: drag orbit\/tilt/);
});

test("Rekixo overlay remains preview-only and does not mutate customer publication", () => {
  const visual = read("app/geo-3d-placement-visual.tsx");
  const manager = read("app/geo-3d-placement-manager.tsx");
  const route = read("app/api/admin/3d-geo-placement/route.ts");

  assert.doesNotMatch(visual, /fetch\([^\n]*method:\s*"PUT"/);
  assert.match(manager, /publicEnabled: false/);
  assert.doesNotMatch(route, /UPDATE geo_features/);
  assert.doesNotMatch(route, /UPDATE plots/);
});

test("Three dependency is pinned for deterministic production builds", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));

  assert.equal(pkg.dependencies.three, "0.186.1");
  assert.equal(lock.packages[""].dependencies.three, "0.186.1");
  assert.equal(lock.packages["node_modules/three"].version, "0.186.1");
  assert.equal(
    lock.packages["node_modules/three"].integrity,
    "sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==",
  );
});
