import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const liveRoute = readFileSync(
  new URL("../app/api/super-geo-live/route.ts", import.meta.url),
  "utf8",
);
const overlayRoute = readFileSync(
  new URL("../app/api/super-geo-overlay/route.ts", import.meta.url),
  "utf8",
);
const publicRoute = readFileSync(
  new URL("../app/api/public-geo/route.ts", import.meta.url),
  "utf8",
);
const publicHandler = readFileSync(
  new URL("../app/api/public-geo/handler.ts", import.meta.url),
  "utf8",
);
const publicManifest = readFileSync(
  new URL("../app/geo-public-manifest.ts", import.meta.url),
  "utf8",
);
const publicAssetRoute = readFileSync(
  new URL("../app/api/public-geo-masterplan/route.ts", import.meta.url),
  "utf8",
);
const publicAssetHandler = readFileSync(
  new URL("../app/api/public-geo-masterplan/handler.ts", import.meta.url),
  "utf8",
);
const geoMapper = readFileSync(
  new URL("../app/geo-mapper.tsx", import.meta.url),
  "utf8",
);
const visual = readFileSync(
  new URL("../app/geo-visual-calibration.tsx", import.meta.url),
  "utf8",
);
const editor = readFileSync(
  new URL("../app/masterplan-mask-editor.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../app/projects/[slug]/map/page.tsx", import.meta.url),
  "utf8",
);
const client = readFileSync(
  new URL("../app/projects/[slug]/map/geo-public-map.tsx", import.meta.url),
  "utf8",
);

test("Geo Lab promotion points customer project at immutable published Geo revision", () => {
  assert.match(liveRoute, /geoLabSourceProjectId/);
  assert.match(liveRoute, /publishedRevision/);
  assert.match(liveRoute, /geo_versions WHERE project_id=\? AND version=\?/);
  assert.match(liveRoute, /geoPublicLabProjectId/);
  assert.match(liveRoute, /geoPublicRevision/);
  assert.match(liveRoute, /geoPublicOverlayKey/);
  assert.match(liveRoute, /geoPublicManifestKey/);
  assert.match(liveRoute, /geoPublicToken/);
  assert.doesNotMatch(liveRoute, /UPDATE projects SET public_status/);
  assert.doesNotMatch(liveRoute, /UPDATE plots SET/);
});

test("Promotion freezes overlay and precomputes customer geometry manifest", () => {
  assert.match(liveRoute, /geo\/promoted\/\$\{revision\}\/\$\{token\}/);
  assert.match(liveRoute, /env\.BUCKET\.put\(promotedOverlayKey/);
  assert.match(liveRoute, /env\.BUCKET\.put\(promotedManifestKey/);
  assert.match(liveRoute, /buildGeoPublicManifest/);
  assert.match(liveRoute, /normalProjectPublishChanged: false/);
  assert.match(liveRoute, /plotBusinessStateChanged: false/);
});

test("Mask editor can persist exact transparent live overlay into isolated Geo Lab R2", () => {
  assert.match(visual, /projectId=\{projectId\}/);
  assert.match(editor, /projectId: string/);
  assert.match(editor, /super-geo-overlay/);
  assert.match(editor, /Save live overlay/);
  assert.match(overlayRoute, /geo\/public-overlay\.png/);
  assert.match(overlayRoute, /requireSuperAdmin/);
  assert.match(overlayRoute, /sameOrigin/);
});

test("Public Geo endpoint resolves owned promoted state and reuses immutable manifest", () => {
  assert.match(publicRoute, /export \{ GET \} from "\.\/handler"/);
  assert.match(publicHandler, /projectBySlug\(slug\)/);
  assert.match(publicHandler, /geoPublicEnabled/);
  assert.match(publicHandler, /validLabLink/);
  assert.match(publicHandler, /parseGeoPublicManifest/);
  assert.match(publicHandler, /geo_versions WHERE project_id=\? AND version=\?/);
  assert.match(publicManifest, /applyGeoFineAlignment/);
  assert.match(publicManifest, /mapNormalizedPointToGeo/);
  assert.doesNotMatch(publicHandler, /\bnotes\b/);
});

test("Public masterplan route accepts only owned promoted R2 keys and immutable token", () => {
  assert.match(publicAssetRoute, /export \{ GET \} from "\.\/handler"/);
  assert.match(publicAssetHandler, /promotedKeyAllowed/);
  assert.match(publicAssetHandler, /projects\/\$\{labProjectId\}\/geo\/promoted\//);
  assert.match(publicAssetHandler, /requestedToken !== token/);
  assert.match(publicAssetHandler, /variant === "mobile"/);
});

test("Customer map page uses Google Hybrid labels plus projective masterplan and clickable polygons", () => {
  assert.match(page, /isPlatformAccessHost/);
  assert.match(page, /projectBySlug/);
  assert.match(page, /publicGoogleMapsBrowserKey/);
  assert.match(client, /mapTypeId: "hybrid"/);
  assert.match(client, /clickableIcons: true/);
  assert.match(client, /new google\.maps\.OverlayView/);
  assert.match(client, /solveHomography/);
  assert.match(client, /new google\.maps\.Polygon/);
  assert.match(client, /new google\.maps\.InfoWindow/);
});

test("Geo Mapper exposes explicit promote and customer-link workflow without changing normal publish", () => {
  assert.match(geoMapper, /Customer Satellite Live/);
  assert.match(geoMapper, /Promote Published Geo/);
  assert.match(geoMapper, /Copy Customer Map Link/);
  assert.match(geoMapper, /\/api\/super-geo-live/);
});
