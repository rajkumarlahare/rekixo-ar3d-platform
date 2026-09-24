import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PLOT_PLAYWRIGHT_MODULE).href);
const stage = process.env.E2E_STAGE || "admin";
const base = process.env.E2E_BASE_URL || "http://localhost:4173";
const projectId = "e2e-phase11";
const projectSlug = "phase-11-e2e";
const artifactDir = path.join(process.cwd(), "artifacts", "full-admin-e2e");
fs.mkdirSync(artifactDir, { recursive: true });
const auth = fs.existsSync("/tmp/rekixo-phase11-auth.json")
  ? JSON.parse(fs.readFileSync("/tmp/rekixo-phase11-auth.json", "utf8"))
  : null;
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
  "base64",
);

function watchPage(page, errors) {
  page.on("pageerror", (error) => errors.push(String(error)));
}

async function chooseProject(page) {
  await page.getByRole("button", { name: "Plot Mapper" }).click();
  // Pin the fixture through the real server-side project search so this journey
  // stays deterministic even when migrations seed more than the first 50 projects.
  await page.getByRole("textbox", { name: "Search client projects" }).fill(projectSlug);
  await page.waitForFunction(
    (id) => [...document.querySelectorAll("#workspace-project option")].some((o) => o.value === id),
    projectId,
  );
  await page.locator("#workspace-project").selectOption(projectId);
  await page.waitForSelector(".mapper-v4-canvas");
  await page.locator('img[alt="Project masterplan"]').waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const image = document.querySelector('img[alt="Project masterplan"]');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });
}

async function adminJourney(browser) {
  assert.ok(auth?.email && auth?.password, "ephemeral E2E credentials missing");
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  watchPage(page, errors);

  await page.goto(`${base}/admin/login`, { waitUntil: "networkidle" });
  await page.locator("#login-id").fill(auth.email);
  await page.locator("#login-password").fill(auth.password);
  await page.getByRole("button", { name: "Sign In as Super Admin" }).click();
  await page.waitForURL(/\/admin\/?$/);
  await page.waitForSelector(".super-shell");

  const upload = await context.request.post(`${base}/api/super-mapper`, {
    headers: { origin: base },
    multipart: {
      projectId,
      kind: "masterplan",
      mapWidth: "1200",
      mapHeight: "1200",
      originalWidth: "1200",
      originalHeight: "1200",
      file: { name: "phase11-masterplan.png", mimeType: "image/png", buffer: tinyPng },
    },
  });
  assert.equal(upload.ok(), true, `masterplan upload ${upload.status()}: ${await upload.text()}`);

  await chooseProject(page);
  await page.screenshot({ path: path.join(artifactDir, "admin-desktop-before-map.png"), fullPage: true });

  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "4-corner plot" }).click();
  const svg = page.locator(".mapper-image-wrap svg").first();
  const box = await svg.boundingBox();
  assert.ok(box && box.width > 40 && box.height > 40, "mapper SVG visible");
  for (const [x, y] of [[.22,.22],[.46,.22],[.46,.48],[.22,.48]]) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    await page.waitForTimeout(90);
  }
  await page.waitForFunction(() => document.querySelectorAll(".mapper-point-handle").length === 4);
  await page.waitForFunction(() => {
    const button = document.querySelector("button.mapper-focus-confirm");
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await page.screenshot({ path: path.join(artifactDir, "admin-desktop-sides-ready.png"), fullPage: true });

  await page.getByRole("button", { name: "Toggle mapping focus/fullscreen" }).click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.screenshot({ path: path.join(artifactDir, "admin-desktop-focus.png") });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.fullscreenElement);

  await page.locator("button.mapper-focus-confirm").click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".mapper-review-list article")].some(
      (row) => row.textContent?.includes("P-1") && row.classList.contains("mapped"),
    ),
  );

  const verify = await context.request.get(
    `${base}/api/super-mapper?projectId=${encodeURIComponent(projectId)}&verify=${Date.now()}`,
  );
  assert.equal(verify.ok(), true);
  const state = await verify.json();
  const saved = state.plots?.find((plot) => plot.id === "P-1");
  assert.ok(saved, "P-1 persisted");
  assert.equal(JSON.parse(saved.polygon || "[]").length, 4);
  assert.deepEqual(
    [saved.frontEdgeIndex, saved.depthEdgeIndex, saved.backEdgeIndex, saved.depth2EdgeIndex],
    [0, 1, 2, 3],
  );
  assert.match(String(saved.edgeSemantics || ""), /"front":\[0\]/);

  const previewPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "Authenticated preview" }).first().click();
  const preview = await previewPromise;
  watchPage(preview, errors);
  await preview.waitForLoadState("domcontentloaded");
  await preview.frameLocator("iframe").locator('.plot[data-plot-id="P-1"]').waitFor();
  await preview.screenshot({ path: path.join(artifactDir, "admin-authenticated-preview.png"), fullPage: true });
  await preview.close();

  const publish = page.getByRole("button", { name: "Publish Website" });
  await publish.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Publish Website"));
    return b instanceof HTMLButtonElement && !b.disabled;
  });
  page.once("dialog", (dialog) => dialog.accept());
  await publish.click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".rekixo-publish-stats span")].some(
      (x) => x.textContent?.includes("Status") && x.textContent?.includes("published"),
    ),
  );

  const publishState = await context.request.get(
    `${base}/api/admin/publish?projectId=${encodeURIComponent(projectId)}`,
  );
  const published = await publishState.json();
  assert.equal(published.publicStatus, "published");
  assert.equal(Number(published.publishVersion), 1);
  assert.equal(published.ready, true);
  await page.screenshot({ path: path.join(artifactDir, "admin-desktop-published.png"), fullPage: true });

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    storageState: await context.storageState(),
  });
  const mobilePage = await mobile.newPage();
  watchPage(mobilePage, errors);
  await mobilePage.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForSelector(".super-shell");
  await chooseProject(mobilePage);
  await mobilePage.screenshot({ path: path.join(artifactDir, "admin-mobile-mapper.png"), fullPage: true });
  await mobile.close();

  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS login → project → mapper → sides → confirm → preview → publish");
}

async function customerJourney(browser) {
  for (const target of [
    { name: "desktop", viewport: { width: 1440, height: 1000 } },
    { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const errors = [];
    const context = await browser.newContext({
      viewport: target.viewport,
      isMobile: Boolean(target.isMobile),
      hasTouch: Boolean(target.hasTouch),
    });
    const page = await context.newPage();
    watchPage(page, errors);
    const response = await page.goto(`${base}/projects/${projectSlug}`, { waitUntil: "domcontentloaded" });
    assert.ok(response?.ok(), `${target.name} customer route`);

    const frame = page.frameLocator("iframe");
    const plot = frame.locator('.plot[data-plot-id="P-1"]');
    await plot.waitFor({ state: "attached" });
    assert.equal(await plot.getAttribute("data-status"), "available");
    assert.equal(await frame.locator("#countTotal").textContent(), "1");
    await plot.click();
    await frame.locator("#plotDrawer").waitFor({ state: "visible" });

    await page.screenshot({
      path: path.join(artifactDir, `customer-${target.name}.png`),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("PASS published customer desktop/mobile route");
}

const browser = await chromium.launch();
try {
  if (stage === "admin") await adminJourney(browser);
  else if (stage === "customer") await customerJourney(browser);
  else throw new Error(`Unknown E2E_STAGE: ${stage}`);
} finally {
  await browser.close();
}
