import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const mapsKey = process.env.MAPS_KEY;
const origin = process.env.SUPER_ORIGIN || "https://rekixo-super-admin.ai-8f3.workers.dev";
const playwrightModule = process.env.PLAYWRIGHT_MODULE;
const pngModule = process.env.PNG_MODULE;
const pixelmatchModule = process.env.PIXELMATCH_MODULE;
assert.ok(mapsKey && playwrightModule && pngModule && pixelmatchModule);

const modelUrl =
  "https://ar3dstudio.in/3Dprojects/api/releases/release_57c56ec2-50c0-4ee2-b916-df89bead1b94/geo-models/b162a605-c922-4d7d-a4d6-194e44c37a95/model.glb?v=1";
const latitude = 21.99496;
const longitude = 82.954409;

await mkdir("artifacts", { recursive: true });
const { chromium } = await import(playwrightModule);
const pngImported = await import(pngModule);
const PNG = pngImported.PNG || pngImported.default?.PNG;
const pixelImported = await import(pixelmatchModule);
const pixelmatch = pixelImported.default || pixelImported.pixelmatch;
assert.ok(PNG && pixelmatch);

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const browserErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") browserErrors.push(msg.text());
});
page.on("pageerror", (error) => browserErrors.push(String(error)));

try {
  const response = await page.goto(`${origin}/admin/login`, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
  assert.ok(response?.ok(), `production origin HTTP ${response?.status()}`);

  const runtime = await page.evaluate(
    async ({ mapsKey, modelUrl, latitude, longitude }) => {
      document.open();
      document.write("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
      document.close();
      document.documentElement.style.margin = "0";
      document.body.style.margin = "0";
      const host = document.createElement("div");
      host.id = "diag-map-host";
      Object.assign(host.style, {
        width: "1280px",
        height: "900px",
        position: "fixed",
        inset: "0",
        background: "#111",
      });
      document.body.append(host);

      await new Promise((resolve, reject) => {
        const callbackName = "__rekixoJyotiDiagMapsReady";
        window[callbackName] = resolve;
        const script = document.createElement("script");
        script.async = true;
        script.defer = true;
        script.src =
          "https://maps.googleapis.com/maps/api/js?key=" +
          encodeURIComponent(mapsKey) +
          "&v=weekly&loading=async&callback=" +
          callbackName;
        script.onerror = () => reject(new Error("Google Maps JS load failed"));
        document.head.append(script);
      });

      if (!window.google?.maps?.importLibrary)
        throw new Error("google.maps.importLibrary unavailable");
      const maps3d = await window.google.maps.importLibrary("maps3d");
      const { Map3DElement, Model3DElement, FlattenerElement } = maps3d;
      if (!Map3DElement || !Model3DElement || !FlattenerElement)
        throw new Error("Required maps3d elements unavailable");

      const halfM = 20;
      const latDelta = halfM / 111320;
      const cosLat = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
      const lngDelta = halfM / (111320 * cosLat);
      const path = [
        { lat: latitude + latDelta, lng: longitude - lngDelta },
        { lat: latitude + latDelta, lng: longitude + lngDelta },
        { lat: latitude - latDelta, lng: longitude + lngDelta },
        { lat: latitude - latDelta, lng: longitude - lngDelta },
      ];

      const map = new Map3DElement({
        center: { lat: latitude, lng: longitude },
        range: 190,
        tilt: 68,
        heading: 0,
        mode: "HYBRID",
        gestureHandling: "GREEDY",
      });
      const flattener = new FlattenerElement({ path });
      const model = new Model3DElement({
        src: modelUrl,
        position: { lat: latitude, lng: longitude, altitude: 0 },
        orientation: { heading: 0, tilt: 0, roll: 0 },
        scale: 1,
        altitudeMode: "RELATIVE_TO_GROUND",
      });

      host.replaceChildren(map);
      map.append(flattener);
      map.append(model);

      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        map.addEventListener("gmp-steadychange", (event) => {
          if (event.isSteady) finish();
        });
        setTimeout(finish, 12_000);
      });
      await new Promise((resolve) => setTimeout(resolve, 8_000));

      return {
        hostConnected: host.isConnected,
        mapTag: map.tagName,
        modelTag: model.tagName,
        flattenerTag: flattener.tagName,
        mapConnected: map.isConnected,
        modelConnected: model.isConnected,
        flattenerConnected: flattener.isConnected,
        modelSrc: String(model.src || model.getAttribute("src") || ""),
      };
    },
    { mapsKey, modelUrl, latitude, longitude },
  );

  assert.equal(runtime.mapConnected, true);
  assert.equal(runtime.modelConnected, true);
  assert.equal(runtime.flattenerConnected, true);
  assert.match(runtime.modelSrc, /\/geo-models\/.*\/model\.glb\?v=1/);

  const host = page.locator("#diag-map-host");
  const withModel1 = await host.screenshot({
    path: "artifacts/jyoti-with-model-1.png",
  });
  await page.waitForTimeout(1_500);
  const withModel2 = await host.screenshot({
    path: "artifacts/jyoti-with-model-2.png",
  });

  const removed = await page.evaluate(() => {
    const model = document.querySelector("gmp-model-3d");
    if (!model) return false;
    model.remove();
    return true;
  });
  assert.equal(removed, true);
  await page.waitForTimeout(2_000);
  const withoutModel = await host.screenshot({
    path: "artifacts/jyoti-without-model.png",
  });

  const a = PNG.sync.read(withModel1);
  const b = PNG.sync.read(withModel2);
  const c = PNG.sync.read(withoutModel);
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  assert.equal(b.width, c.width);
  assert.equal(b.height, c.height);

  const scratch1 = new PNG({ width: a.width, height: a.height });
  const scratch2 = new PNG({ width: a.width, height: a.height });
  const baselineDiff = pixelmatch(
    a.data,
    b.data,
    scratch1.data,
    a.width,
    a.height,
    { threshold: 0.15 },
  );
  const modelDiff = pixelmatch(
    b.data,
    c.data,
    scratch2.data,
    b.width,
    b.height,
    { threshold: 0.15 },
  );
  const pixels = b.width * b.height;
  const report = {
    origin,
    modelUrl,
    testedPlacement: {
      longitude,
      latitude,
      altitudeM: 0,
      headingDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      scale: 1,
      flattenMeters: 40,
    },
    runtime,
    pixelDiff: {
      pixels,
      baselineDiff,
      modelDiff,
      baselineRatio: baselineDiff / pixels,
      modelRatio: modelDiff / pixels,
    },
    browserErrors,
  };
  await writeFile(
    "artifacts/jyoti-live-visual.json",
    JSON.stringify(report, null, 2),
  );
  console.log("LIVE_JYOTI_VISUAL", JSON.stringify(report));

  assert.ok(
    modelDiff > Math.max(1000, baselineDiff * 1.5),
    `custom model visual effect not proven: model=${modelDiff}, baseline=${baselineDiff}`,
  );
} finally {
  await browser.close();
}
