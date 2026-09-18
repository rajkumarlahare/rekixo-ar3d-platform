import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(
  new URL("../app/projects/[slug]/map/geo-public-map.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../app/projects/[slug]/map/page.tsx", import.meta.url),
  "utf8",
);
const publicHandler = readFileSync(
  new URL("../app/api/public-geo/handler.ts", import.meta.url),
  "utf8",
);
const liveRoute = readFileSync(
  new URL("../app/api/super-geo-live/route.ts", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../app/projects/[slug]/map/geo-public-map.module.css", import.meta.url),
  "utf8",
);

test("public map preconnects to Google Maps origins before data fetch", () => {
  assert.match(page, /preconnect\("https:\/\/maps\.googleapis\.com"\)/);
  assert.match(page, /preconnect\("https:\/\/maps\.gstatic\.com"/);
  assert.match(client, /function ensureGoogleMapsConnectionHints/);
  assert.match(client, /https:\/\/maps\.googleapis\.com/);
  assert.match(client, /https:\/\/maps\.gstatic\.com/);
});

test("Google Maps JS starts in parallel with public Geo payload", () => {
  assert.match(client, /mapsApiKey/);
  assert.match(client, /loadGoogleMaps\(mapsApiKey\)/);
  assert.match(client, /fetch\(`\/api\/public-geo\?projectSlug=/);
  assert.match(page, /publicGoogleMapsBrowserKey/);
});

test("published geometry is precomputed and reused from immutable manifest", () => {
  assert.match(liveRoute, /buildGeoPublicManifest/);
  assert.match(liveRoute, /promotedManifestKey/);
  assert.match(publicHandler, /parseGeoPublicManifest/);
  assert.match(publicHandler, /manifestMemory/);
  assert.match(publicHandler, /cache\.match\(cacheKey\)/);
});

test("large masterplan texture is downscaled for mobile compositing without changing geo corners", () => {
  assert.match(client, /MOBILE_OVERLAY_MAX_DIMENSION = 2304/);
  assert.match(client, /DESKTOP_OVERLAY_MAX_DIMENSION = 3072/);
  assert.match(client, /document\.createElement\("canvas"\)/);
  assert.match(client, /context\.drawImage\(image, 0, 0, canvas\.width, canvas\.height\)/);
  assert.match(client, /cssProjectiveTransform\(matrix, surfaceWidth, surfaceHeight\)/);
  assert.match(client, /corners\.map\(\(\[lng, lat\]\)/);
});

test("projective overlay draw work is capped to one animation frame", () => {
  assert.match(client, /let drawFrame: number \| null = null/);
  assert.match(client, /window\.requestAnimationFrame/);
  assert.match(client, /window\.cancelAnimationFrame/);
});

test("masterplan chooses optimized derivative with original-image fallback", () => {
  assert.match(client, /masterplanUrls\?\.mobile/);
  assert.match(client, /masterplanUrls\?\.desktop/);
  assert.match(client, /masterplanUrls\?\.original/);
  assert.match(client, /window\.innerWidth <= 900/);
  assert.match(client, /image\.fetchPriority = "high"/);
  assert.match(client, /image\.decoding = "async"/);
  assert.match(client, /Optimized masterplan overlay unavailable; retrying original/);
  assert.match(client, /window\.setTimeout\(\(\) => \{/);
  assert.match(client, /12000/);
});

test("plot info-card helper keeps one valid function declaration", () => {
  assert.match(client, /function plotInfoCard\(feature: PublicFeature\) \{/);
  assert.doesNotMatch(client, /plotInfoCardfunction/);
});

test("canvas overlay keeps the same non-interactive styling as image overlay", () => {
  assert.match(css, /\.masterplanOverlay img,\s*\.masterplanOverlay canvas\s*\{/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /max-width:\s*none/);
});
