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
await page.getByRole("button", { name: "3D Preview" }).click();
await page.getByText(/Geo GLB: verified/).waitFor({ state: "visible", timeout: 45_000 });
await page.waitForTimeout(7000);

async function state(label) {
  const value = await page.evaluate(() => {
    const maps = Array.from(document.querySelectorAll("gmp-map-3d"));
    const map = maps.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 200 && rect.height > 200;
    }) || maps[0] || null;
    const model = map?.querySelector("gmp-model-3d") || null;
    const flattener = map?.querySelector("gmp-flattener") || null;
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
  const map = Array.from(document.querySelectorAll("gmp-map-3d")).find((candidate) => {
    const r = candidate.getBoundingClientRect();
    return r.width > 200 && r.height > 200;
  });
  const model = map?.querySelector("gmp-model-3d");
  if (!model) throw new Error("model missing");
  model.altitudeMode = "CLAMP_TO_GROUND";
  model.position = { lat: Number(model.position.lat), lng: Number(model.position.lng) };
  map.center = { lat: Number(model.position.lat), lng: Number(model.position.lng), altitude: 0 };
  map.range = 120;
  map.tilt = 68;
});

await mutate("03-google-example-orientation", () => {
  const map = Array.from(document.querySelectorAll("gmp-map-3d")).find((candidate) => {
    const r = candidate.getBoundingClientRect();
    return r.width > 200 && r.height > 200;
  });
  const model = map?.querySelector("gmp-model-3d");
  if (!model) throw new Error("model missing");
  model.orientation = { heading: 0, tilt: 270, roll: 90 };
  model.scale = 1;
  model.altitudeMode = "CLAMP_TO_GROUND";
  map.center = { lat: Number(model.position.lat), lng: Number(model.position.lng), altitude: 0 };
  map.range = 120;
  map.tilt = 68;
  map.heading = 0;
});

await mutate("04-scale-5-current-anchor", () => {
  const map = Array.from(document.querySelectorAll("gmp-map-3d")).find((candidate) => {
    const r = candidate.getBoundingClientRect();
    return r.width > 200 && r.height > 200;
  });
  const model = map?.querySelector("gmp-model-3d");
  if (!model) throw new Error("model missing");
  model.orientation = { heading: 0, tilt: 0, roll: 0 };
  model.scale = 5;
  model.altitudeMode = "CLAMP_TO_GROUND";
  map.center = { lat: Number(model.position.lat), lng: Number(model.position.lng), altitude: 0 };
  map.range = 220;
  map.tilt = 68;
  map.heading = 0;
});

await mutate("05-model-at-current-map-center", () => {
  const map = Array.from(document.querySelectorAll("gmp-map-3d")).find((candidate) => {
    const r = candidate.getBoundingClientRect();
    return r.width > 200 && r.height > 200;
  });
  const model = map?.querySelector("gmp-model-3d");
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
