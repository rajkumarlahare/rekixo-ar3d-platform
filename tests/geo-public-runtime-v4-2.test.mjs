import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(
  new URL("../app/projects/[slug]/map/geo-public-map.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../app/projects/[slug]/map/geo-public-map.module.css", import.meta.url),
  "utf8",
);
const errorBoundary = readFileSync(
  new URL("../app/projects/[slug]/map/error.tsx", import.meta.url),
  "utf8",
);

test("public Google map is trapped inside its own stacking context", () => {
  assert.match(css, /\.shell\s*\{[\s\S]*isolation:\s*isolate;/);
  assert.match(css, /\.map\s*\{[\s\S]*z-index:\s*0;/);
  assert.match(css, /\.map\s*\{[\s\S]*isolation:\s*isolate;/);
  assert.match(css, /\.map\s*\{[\s\S]*background:\s*#07111e;/);
  assert.match(css, /\.header\s*\{[\s\S]*z-index:\s*50;/);
  assert.match(css, /\.loading,[\s\S]*\.error\s*\{[\s\S]*z-index:\s*60;/);
});

test("map becomes usable before all Google satellite tiles finish", () => {
  assert.match(client, /const \[mapReady, setMapReady\] = useState\(false\)/);
  assert.match(client, /map\.fitBounds\(bounds, 34\);[\s\S]*setMapReady\(true\)/);
  assert.match(client, /map\.addListener\("tilesloaded"/);
  assert.match(client, /performance\.mark\?\.\("rekixo-geo-tiles-loaded"\)/);
  assert.doesNotMatch(client, /Satellite tiles 20 sec me load nahi hue/);
});

test("public Geo payload is validated before React renders it", () => {
  assert.match(client, /function validatePublicGeoData/);
  assert.match(client, /Satellite map data incomplete hai/);
  assert.match(client, /return validatePublicGeoData\(payload\)/);
});

test("Maps authorization failure still surfaces instead of blank UI", () => {
  assert.match(client, /gm_authFailure/);
  assert.match(client, /Google Maps API key\/referrer authorization fail hui/);
});

test("plot polygons are rendered progressively instead of blocking first interaction", () => {
  assert.match(client, /PLOT_RENDER_CHUNK_SIZE = 24/);
  assert.match(
    client,
    /(?:function\s+appendPlotChunk|const\s+appendPlotChunk\s*=\s*\(\)\s*=>)/,
  );
  assert.match(client, /window\.requestAnimationFrame\(appendPlotChunk\)/);
});

test("route-level runtime errors keep a visible dark recovery screen", () => {
  assert.match(errorBoundary, /"use client"/);
  assert.match(errorBoundary, /Satellite Map runtime error/);
  assert.match(errorBoundary, /background:\s*"#06101d"/);
  assert.match(errorBoundary, /reset\(\)/);
});
