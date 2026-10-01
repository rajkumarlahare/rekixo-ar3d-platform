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
  assert.match(overlay, /applyBuildingCenteredCamera/);
  assert.match(overlay, /flyCameraTo\(\{ endCamera, durationMillis: 0 \}\)/);
  assert.match(overlay, /root\.position\.set\(0, placement\.altitudeM, 0\)/);
  assert.doesNotMatch(overlay, /localMeters/);
  assert.match(overlay, /map\.heading = orbitHeading/);
  assert.match(overlay, /map\.tilt = orbitTilt/);
  assert.match(overlay, /map\.range = orbitRange/);
  assert.match(overlay, /cameraPosition\?: unknown/);
  assert.match(overlay, /pinGoogleCenterToBuilding/);
  assert.match(overlay, /coordinate\(map\.center, "altitude"\)/);
  assert.match(overlay, /lat: placement\.latitude/);
  assert.match(overlay, /lng: placement\.longitude/);
  assert.match(overlay, /queueOrbitToGoogleMap/);
  assert.doesNotMatch(overlay, /scheduleGoogleCameraSettle/);
  assert.match(overlay, /const minFrameInterval = interactive \? 15 : 32/);
  assert.match(overlay, /const overlayFovDeg/);
  assert.match(overlay, /THREE\.MathUtils\.clamp\(value, 28, 82\)/);
  assert.match(overlay, /0\.00105/);
  assert.match(overlay, /rotateViewBy:/);
  assert.match(overlay, /focusView:/);
  assert.match(visual, /threeOverlayHandleRef\.current\.rotateViewBy\(90\)/);
  assert.match(visual, /threeOverlayHandleRef\.current\.focusView\(headingDeg\)/);
  assert.match(css, /\.modelOverlay/);
  assert.match(css, /pointer-events: auto/);
  assert.match(css, /touch-action: none/);
  assert.match(visual, /View \+90°/);
  assert.match(visual, /focus3DMap\(/);
  assert.match(visual, /Number\.isFinite\(currentRange\) \? currentRange : 190/);
  assert.match(visual, /Controls: drag orbit\/tilt/);
});

test("Geo orbit drives Google and Rekixo from one deterministic camera state", () => {
  const overlay = read("app/geo-3d-three-overlay.ts");

  assert.match(overlay, /lockedCenterAltitudeM/);
  assert.match(overlay, /deterministicCameraPosition/);
  assert.match(overlay, /map\.cameraPosition =/);
  assert.match(overlay, /northM = -Math\.cos\(heading\) \* horizontalM/);
  assert.match(overlay, /eastM = -Math\.sin\(heading\) \* horizontalM/);

  const applyStart = overlay.indexOf("const applyBuildingCenteredCamera");
  const pointerStart = overlay.indexOf("const pointerSeparation", applyStart);
  assert.ok(applyStart >= 0 && pointerStart > applyStart);
  const applyBlock = overlay.slice(applyStart, pointerStart);
  assert.doesNotMatch(applyBlock, /flyCameraTo/);
  assert.doesNotMatch(applyBlock, /map\.center\s*=/);
  assert.match(applyBlock, /queueOrbitToGoogleMap/);

  const releaseStart = overlay.indexOf("const releasePointer");
  const wheelStart = overlay.indexOf("const onWheel", releaseStart);
  assert.ok(releaseStart >= 0 && wheelStart > releaseStart);
  const releaseBlock = overlay.slice(releaseStart, wheelStart);
  assert.doesNotMatch(releaseBlock, /flyCameraTo/);
  assert.doesNotMatch(releaseBlock, /map\.center\s*=/);

  const renderStart = overlay.indexOf("const render =");
  const frameStart = overlay.indexOf("const frame =", renderStart);
  assert.ok(renderStart >= 0 && frameStart > renderStart);
  const renderBlock = overlay.slice(renderStart, frameStart);
  assert.match(renderBlock, /orbitHeading \?\?/);
  assert.match(renderBlock, /orbitTilt \?\?/);
  assert.match(renderBlock, /orbitRange \?\?/);
  assert.doesNotMatch(renderBlock, /const cameraPosition = map\.cameraPosition/);
  assert.doesNotMatch(renderBlock, /const center = map\.center/);
  assert.match(renderBlock, /Never read asynchronous Google camera values back/);
  assert.match(renderBlock, /finite\(map\.fov, overlayFovDeg\)/);
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
