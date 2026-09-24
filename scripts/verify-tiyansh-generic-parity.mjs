import assert from "node:assert/strict";

const phase = process.argv[2] || "preflight";
const projectId = "tiyansh-prime-square";
const projectSlug = "tiyansh-prime-square";
const workersSubdomain =
  String(process.env.REKIXO_WORKERS_SUBDOMAIN || "").trim() || "ai-8f3";
const platformHost = String(process.env.REKIXO_PLATFORM_HOST || "")
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const genericOrigin =
  String(process.env.REKIXO_GENERIC_ORIGIN || "").trim().replace(/\/$/, "") ||
  (platformHost ? `https://${platformHost}` : "");
assert.ok(
  genericOrigin,
  "REKIXO_PLATFORM_HOST or REKIXO_GENERIC_ORIGIN is required for generic live parity",
);
const legacyOrigin =
  String(process.env.REKIXO_LEGACY_ORIGIN || "").trim().replace(/\/$/, "") ||
  `https://tiyansh-prime-square.${workersSubdomain}.workers.dev`;

async function read(url, options = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: { accept: "*/*", ...(options.headers || {}) },
    ...options,
  });
  return response;
}

function normalizedPublicData(data) {
  const plots = [...(Array.isArray(data.plots) ? data.plots : [])].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
  );
  const gallery = [...(Array.isArray(data.gallery) ? data.gallery : [])].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );
  return {
    projectId: data.projectId,
    projectName: data.projectName,
    slug: data.slug,
    publishVersion: data.publishVersion,
    publishedAt: data.publishedAt,
    plots,
    settings: data.settings || {},
    gallery,
  };
}

async function publicData(origin, query = "") {
  const response = await read(`${origin}/api/public-data${query}`, {
    headers: { accept: "application/json" },
  });
  assert.equal(response.status, 200, `${origin} public-data HTTP ${response.status}`);
  assert.equal(
    response.headers.get("x-rekixo-project"),
    projectId,
    `${origin} resolved wrong project`,
  );
  const data = await response.json();
  assert.equal(data.projectId, projectId);
  assert.equal(data.slug, projectSlug);
  assert.ok(Array.isArray(data.plots) && data.plots.length > 0, "Tiyansh plots missing");

  for (const plot of data.plots) {
    assert.ok(plot.id, "plot id missing");
    assert.ok(plot.polygon, `plot ${plot.id} missing polygon`);
    const polygon = JSON.parse(plot.polygon);
    assert.ok(Array.isArray(polygon) && polygon.length >= 3, `plot ${plot.id} invalid polygon`);
  }

  const settings = data.settings || {};
  assert.ok(String(settings.masterplanName || "").trim(), "Tiyansh masterplanName missing");
  assert.ok(Number(settings.mapWidth) > 0, "Tiyansh mapWidth missing");
  assert.ok(Number(settings.mapHeight) > 0, "Tiyansh mapHeight missing");
  assert.ok(String(settings.projectName || data.projectName || "").trim(), "Tiyansh project name missing");
  assert.ok(["0", "1", undefined].includes(settings.pricingEnabled), "invalid pricingEnabled");

  return { response, data };
}

async function verifyMasterplan(origin, query) {
  const response = await read(`${origin}/api/project-asset/masterplan${query}`);
  assert.equal(response.status, 200, `${origin} masterplan HTTP ${response.status}`);
  assert.equal(response.headers.get("x-rekixo-project"), projectId);
  assert.match(response.headers.get("content-type") || "", /^image\//i);
}

async function verifyGallery(origin, data, query) {
  const first = Array.isArray(data.gallery) ? data.gallery[0] : null;
  if (!first?.id) return;
  const response = await read(
    `${origin}/api/gallery/${encodeURIComponent(first.id)}${query}`,
  );
  assert.equal(response.status, 200, `${origin} gallery HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") || "", /^image\//i);
}

async function verifyEmailLogin(origin, path) {
  const response = await read(`${origin}${path}`, {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200, `${origin}${path} HTTP ${response.status}`);
  const html = await response.text();
  assert.match(
    html,
    /EMAIL ADDRESS|type=["']email["']/i,
    "legacy Tiyansh must remain email + password login",
  );
}

const genericQuery = `?projectSlug=${encodeURIComponent(projectSlug)}`;
const legacyQuery = "";

const generic = await publicData(genericOrigin, genericQuery);
const legacy = await publicData(legacyOrigin, legacyQuery);

assert.deepEqual(
  normalizedPublicData(generic.data),
  normalizedPublicData(legacy.data),
  "generic and legacy public project data diverged",
);

await verifyMasterplan(
  genericOrigin,
  `?projectId=${encodeURIComponent(projectId)}&v=stage3`,
);
await verifyMasterplan(legacyOrigin, "?v=stage3");
await verifyGallery(
  genericOrigin,
  generic.data,
  `?projectId=${encodeURIComponent(projectId)}`,
);
await verifyGallery(legacyOrigin, legacy.data, "");
await verifyEmailLogin(
  genericOrigin,
  `/projects/${encodeURIComponent(projectSlug)}/admin-login`,
);
await verifyEmailLogin(legacyOrigin, "/admin/login");

if (phase === "generic" || phase === "post-legacy") {
  const projectPage = await read(
    `${genericOrigin}/projects/${encodeURIComponent(projectSlug)}`,
    { headers: { accept: "text/html" } },
  );
  assert.equal(projectPage.status, 200, "generic Tiyansh project page failed");
  const html = await projectPage.text();
  assert.match(html, /projectSlug=tiyansh-prime-square/);
  assert.match(html, /v=66/);
}

if (phase === "post-legacy") {
  const foreign = await read(`${legacyOrigin}/projects/mangal-raj-park`, {
    headers: { accept: "text/html" },
    redirect: "manual",
  });
  assert.equal(
    foreign.status,
    404,
    `legacy Tiyansh host must not act as a shared multi-tenant host (got ${foreign.status})`,
  );
}

console.log(
  JSON.stringify({
    ok: true,
    phase,
    projectId,
    plots: generic.data.plots.length,
    gallery: generic.data.gallery?.length || 0,
    pricingEnabled: generic.data.settings?.pricingEnabled === "1",
    genericOrigin,
    legacyOrigin,
  }),
);
