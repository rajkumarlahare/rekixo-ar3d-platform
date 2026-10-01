import { createHmac } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";

const playwrightPath = process.env.PLOT_PLAYWRIGHT_MODULE;
if (!playwrightPath) throw new Error("PLOT_PLAYWRIGHT_MODULE missing");
const { chromium } = await import(playwrightPath);

const baseUrl = "https://admin.rekixo.com";
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET missing");

function collectResults(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectResults(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value.results)) output.push(...value.results);
  for (const nested of Object.values(value)) collectResults(nested, output);
  return output;
}

const ownerPayload = JSON.parse(await readFile(process.env.OWNER_JSON, "utf8"));
const ownerRows = collectResults(ownerPayload);
const sessionVersion = Number(ownerRows.find((row) => row.sessionVersion)?.sessionVersion || 0);
if (!Number.isInteger(sessionVersion) || sessionVersion < 1)
  throw new Error("Super Admin session version unavailable");

const dbPayload = JSON.parse(await readFile(process.env.JYOTI_JSON, "utf8"));
const dbRows = collectResults(dbPayload);
const project = dbRows.find((row) => row.projectId);
if (!project) throw new Error("Jyoti Platform link/placement row unavailable");

const b64url = (buffer) =>
  Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const session = {
  id: "owner",
  name: "Rekixo Super Admin",
  email: "ai@rekixo.com",
  loginId: "ai@rekixo.com",
  loginType: "email",
  role: "super_admin",
  projectId: "rekixo-platform-admin",
  sessionVersion,
  mustChangePassword: false,
  exp: Date.now() + 60 * 60 * 1000,
};
const body = b64url(Buffer.from(JSON.stringify(session)));
const signature = b64url(createHmac("sha256", Buffer.from(sessionSecret, "base64")).update(body).digest());
const cookie = `${body}.${signature}`;

await mkdir("artifacts/jyoti-live-geo-debug", { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
await context.addCookies([
  {
    name: "tiyansh_admin",
    value: cookie,
    url: baseUrl,
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    expires: Math.floor(Date.now() / 1000) + 3600,
  },
]);
const page = await context.newPage();

const consoleMessages = [];
page.on("console", (message) => {
  const text = message.text();
  if (/gmp|google|model|webgl|maps|error|warn/i.test(text))
    consoleMessages.push({ type: message.type(), text: text.slice(0, 1000) });
});
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error).slice(0, 2000)));
const failedRequests = [];
page.on("requestfailed", (request) => {
  const url = request.url();
  if (/google|maps|geo-model|\.glb/i.test(url))
    failedRequests.push({ url, error: request.failure()?.errorText || "failed" });
});
const responses = [];
page.on("response", (response) => {
  const url = response.url();
  if (/geo-model|\.glb|maps\.googleapis|maps\.gstatic/i.test(url)) {
    responses.push({
      status: response.status(),
      url,
      contentType: response.headers()["content-type"] || "",
    });
  }
});

await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByRole("button", { name: "Geo Mapper" }).click();
const search = page.getByRole("textbox", { name: "Search client projects" });
await search.fill("Jyoti Paradise Demo Admin");
const select = page.locator("#workspace-project");
await select.waitFor({ state: "visible", timeout: 30_000 });
await select.selectOption(project.projectId);
await page.getByText("3D Building on Geo Map", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });

const liveState = await page.evaluate(async (projectId) => {
  const response = await fetch(
    `/api/admin/3d-geo-placement?projectId=${encodeURIComponent(projectId)}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || `placement API ${response.status}`);
  return payload;
}, project.projectId);

const render = liveState.placement || {
  // Current unsaved working values visible in the user's live Geo Mapper.
  // Diagnostic only: never persisted by this workflow.
  longitude: liveState.suggestedCenter?.longitude ?? 82.9545003,
  latitude: liveState.suggestedCenter?.latitude ?? 21.9949849,
  altitudeM: 0,
  headingDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  scale: 1,
};
if (!Number.isFinite(Number(render.longitude)) || !Number.isFinite(Number(render.latitude)))
  throw new Error("Live render coordinates unavailable");
if (!liveState.engine?.previewModelUrl)
  throw new Error("Live preview model URL unavailable");

const sanitizedState = JSON.parse(JSON.stringify(liveState));
if (sanitizedState.maps) delete sanitizedState.maps.apiKey;
await writeFile(
  "artifacts/jyoti-live-geo-debug/admin-placement-state.json",
  JSON.stringify(sanitizedState, null, 2),
);

await page.evaluate(
  async ({ previewModelUrl, render, flattenBaseMesh, flattenHalfSizeM }) => {
    const deadline = Date.now() + 30_000;
    while (!window.google?.maps?.importLibrary && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 100));
    if (!window.google?.maps?.importLibrary)
      throw new Error("Google Maps library not available on live admin page");

    const library = await window.google.maps.importLibrary("maps3d");
    const preflight = await fetch(previewModelUrl, {
      method: "GET",
      headers: { Range: "bytes=0-3" },
      cache: "no-store",
      credentials: "same-origin",
    });
    if (preflight.status !== 200 && preflight.status !== 206)
      throw new Error(`GLB preflight failed ${preflight.status}`);
    const finalUrl = preflight.url || previewModelUrl;
    const magic = new TextDecoder().decode(new Uint8Array(await preflight.arrayBuffer()).slice(0, 4));
    if (magic !== "glTF") throw new Error("GLB magic invalid");

    const latitude = Number(render.latitude);
    const longitude = Number(render.longitude);
    const half = Math.max(1, Number(flattenHalfSizeM || 20));
    const latDelta = half / 111_320;
    const cosLat = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
    const lngDelta = half / (111_320 * cosLat);
    const square = [
      { lat: latitude + latDelta, lng: longitude - lngDelta },
      { lat: latitude + latDelta, lng: longitude + lngDelta },
      { lat: latitude - latDelta, lng: longitude + lngDelta },
      { lat: latitude - latDelta, lng: longitude - lngDelta },
    ];

    document.getElementById("jyoti-live-diag-host")?.remove();
    const host = document.createElement("div");
    host.id = "jyoti-live-diag-host";
    Object.assign(host.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      width: "100vw",
      height: "100vh",
      background: "#000",
    });
    document.body.append(host);

    const map = new library.Map3DElement({
      center: { lat: latitude, lng: longitude },
      range: 220,
      tilt: 68,
      heading: Number(render.headingDeg || 0),
      mode: "HYBRID",
      gestureHandling: "GREEDY",
    });
    Object.assign(map.style, { width: "100%", height: "100%", display: "block" });
    host.append(map);

    let flattener = null;
    if (flattenBaseMesh && library.FlattenerElement) {
      flattener = new library.FlattenerElement({ path: square });
      map.append(flattener);
    }
    let footprint = null;
    if (library.Polygon3DElement) {
      footprint = new library.Polygon3DElement({
        path: square,
        fillColor: "rgba(255,0,0,0.18)",
        strokeColor: "#ff2020",
        strokeWidth: 5,
        altitudeMode: "CLAMP_TO_GROUND",
        drawsOccludedSegments: true,
      });
      map.append(footprint);
    }

    const model = new library.Model3DElement({
      src: finalUrl,
      position: {
        lat: latitude,
        lng: longitude,
        altitude: Number(render.altitudeM || 0),
      },
      orientation: {
        heading: Number(render.headingDeg || 0),
        tilt: Number(render.pitchDeg || 0),
        roll: Number(render.rollDeg || 0),
      },
      scale: Number(render.scale || 1),
      altitudeMode: "RELATIVE_TO_GROUND",
    });
    map.append(model);

    window.__jyotiGeoDiag = {
      map,
      model,
      flattener,
      footprint,
      anchor: { lat: latitude, lng: longitude },
      finalUrl,
      preflightStatus: preflight.status,
    };
    if (typeof map.flyCameraTo === "function") {
      await map.flyCameraTo({
        endCamera: {
          center: { lat: latitude, lng: longitude, altitude: 12 },
          altitudeMode: "RELATIVE_TO_GROUND",
          range: 130,
          tilt: 68,
          heading: Number(render.headingDeg || 0),
        },
        durationMillis: 0,
      });
    }
  },
  {
    previewModelUrl: liveState.engine.previewModelUrl,
    render,
    flattenBaseMesh: liveState.engine?.renderPolicy?.flattenBaseMesh === true,
    flattenHalfSizeM: liveState.engine?.renderPolicy?.flattenHalfSizeM || 0,
  },
);
await page.waitForTimeout(7000);

async function state(label) {
  const value = await page.evaluate(() => {
    const diagnostic = window.__jyotiGeoDiag || {};
    const maps = Array.from(document.querySelectorAll("gmp-map-3d"));
    const map = diagnostic.map || maps.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 200 && rect.height > 200;
    }) || maps[0] || null;
    const model = diagnostic.model || map?.querySelector("gmp-model-3d") || null;
    const flattener = diagnostic.flattener || map?.querySelector("gmp-flattener") || null;
    const position = model?.position;
    const orientation = model?.orientation;
    const center = map?.center;
    const cameraPosition = map?.cameraPosition;
    const rect = map?.getBoundingClientRect?.();
    return {
      mapCount: maps.length,
      map: map
        ? {
            tagName: map.tagName,
            connected: map.isConnected,
            center: center ? { lat: center.lat, lng: center.lng, altitude: center.altitude } : null,
            cameraPosition: cameraPosition
              ? { lat: cameraPosition.lat, lng: cameraPosition.lng, altitude: cameraPosition.altitude }
              : null,
            range: map.range,
            tilt: map.tilt,
            heading: map.heading,
            roll: map.roll,
            mode: map.mode,
            rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
            childTags: Array.from(map.children).map((child) => child.tagName),
          }
        : null,
      model: model
        ? {
            tagName: model.tagName,
            connected: model.isConnected,
            src: String(model.src || ""),
            position: position
              ? { lat: position.lat, lng: position.lng, altitude: position.altitude }
              : null,
            orientation: orientation
              ? {
                  heading: orientation.heading,
                  tilt: orientation.tilt,
                  roll: orientation.roll,
                }
              : null,
            scale:
              typeof model.scale === "number"
                ? model.scale
                : model.scale
                  ? { x: model.scale.x, y: model.scale.y, z: model.scale.z }
                  : null,
            altitudeMode: model.altitudeMode,
          }
        : null,
      flattener: flattener
        ? {
            connected: flattener.isConnected,
            path: Array.from(flattener.path || []).map((point) => ({
              lat: point.lat,
              lng: point.lng,
              altitude: point.altitude,
            })),
          }
        : null,
    };
  });
  await page.screenshot({
    path: `artifacts/jyoti-live-geo-debug/${label}.png`,
    fullPage: false,
  });
  return value;
}

const states = {};
states.current = await state("01-current");

async function mutate(name, mutation) {
  await page.evaluate(mutation);
  await page.waitForTimeout(3500);
  states[name] = await state(name);
}

await mutate("02-clamp-current-orientation", () => {
  const map = window.__jyotiGeoDiag?.map;
  const model = window.__jyotiGeoDiag?.model;
  if (!model) throw new Error("model missing");
  model.altitudeMode = "CLAMP_TO_GROUND";
  model.position = { lat: Number(model.position.lat), lng: Number(model.position.lng) };
  map.center = { lat: Number(model.position.lat), lng: Number(model.position.lng) };
  map.range = 120;
  map.tilt = 68;
  if (typeof map.flyCameraTo === "function")
    void map.flyCameraTo({
      endCamera: {
        center: { lat: Number(model.position.lat), lng: Number(model.position.lng), altitude: 12 },
        altitudeMode: "RELATIVE_TO_GROUND",
        range: 120,
        tilt: 68,
        heading: Number(model.orientation?.heading || 0),
      },
      durationMillis: 0,
    });
});

await mutate("03-google-example-orientation", () => {
  const map = window.__jyotiGeoDiag?.map;
  const model = window.__jyotiGeoDiag?.model;
  if (!model) throw new Error("model missing");
  model.orientation = { heading: 0, tilt: 270, roll: 90 };
  model.scale = 1;
  model.altitudeMode = "CLAMP_TO_GROUND";
  map.center = { lat: Number(model.position.lat), lng: Number(model.position.lng) };
  map.range = 120;
  map.tilt = 68;
  map.heading = 0;
  if (typeof map.flyCameraTo === "function")
    void map.flyCameraTo({
      endCamera: {
        center: { lat: Number(model.position.lat), lng: Number(model.position.lng), altitude: 12 },
        altitudeMode: "RELATIVE_TO_GROUND",
        range: 120,
        tilt: 68,
        heading: 0,
      },
      durationMillis: 0,
    });
});

await mutate("04-scale-5-current-anchor", () => {
  const map = window.__jyotiGeoDiag?.map;
  const model = window.__jyotiGeoDiag?.model;
  if (!model) throw new Error("model missing");
  model.orientation = { heading: 0, tilt: 0, roll: 0 };
  model.scale = 5;
  model.altitudeMode = "CLAMP_TO_GROUND";
  map.center = { lat: Number(model.position.lat), lng: Number(model.position.lng) };
  map.range = 220;
  map.tilt = 68;
  map.heading = 0;
  if (typeof map.flyCameraTo === "function")
    void map.flyCameraTo({
      endCamera: {
        center: { lat: Number(model.position.lat), lng: Number(model.position.lng), altitude: 12 },
        altitudeMode: "RELATIVE_TO_GROUND",
        range: 220,
        tilt: 68,
        heading: 0,
      },
      durationMillis: 0,
    });
});

await mutate("05-model-at-current-map-center", () => {
  const map = window.__jyotiGeoDiag?.map;
  const model = window.__jyotiGeoDiag?.model;
  if (!model || !map?.center) throw new Error("model/map missing");
  model.position = { lat: Number(map.center.lat), lng: Number(map.center.lng) };
  model.orientation = { heading: 0, tilt: 0, roll: 0 };
  model.scale = 3;
  model.altitudeMode = "CLAMP_TO_GROUND";
  map.range = 180;
  map.tilt = 68;
});

const diagnostic = {
  project: {
    projectId: project.projectId,
    projectName: project.projectName,
    engineSlug: project.engineSlug,
    longitude: Number(project.longitude),
    latitude: Number(project.latitude),
    altitudeM: Number(project.altitudeM),
    headingDeg: Number(project.headingDeg),
    pitchDeg: Number(project.pitchDeg),
    rollDeg: Number(project.rollDeg),
    scale: Number(project.scale),
    publicEnabled: Number(project.publicEnabled),
  },
  states,
  consoleMessages,
  pageErrors,
  failedRequests,
  responses,
};
await writeFile(
  "artifacts/jyoti-live-geo-debug/diagnostic.json",
  JSON.stringify(diagnostic, null, 2),
);
console.log("JYOTI_LIVE_GEO_DIAGNOSTIC", JSON.stringify(diagnostic));

await browser.close();
