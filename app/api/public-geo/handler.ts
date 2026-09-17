import { env } from "cloudflare:workers";
import { projectBySlug } from "../../project-context";
import {
  buildGeoPublicManifest,
  parseGeoPublicManifest,
  type GeoPublicManifest,
  type GeoPublicSnapshot,
} from "../../geo-public-manifest";
import { publicGoogleMapsBrowserKey } from "../../google-maps-config";

const LIVE_SETTING_KEYS = [
  "geoPublicEnabled",
  "geoPublicLabProjectId",
  "geoPublicRevision",
  "geoPublicOverlayKey",
  "geoPublicManifestKey",
  "geoPublicOverlayMobileKey",
  "geoPublicOverlayDesktopKey",
  "geoPublicToken",
] as const;

async function sourceLiveSettings(projectId: string) {
  const rows = await env.DB.prepare(
    `SELECT key,value FROM settings WHERE project_id=? AND key IN (${LIVE_SETTING_KEYS.map(() => "?").join(",")})`,
  )
    .bind(projectId, ...LIVE_SETTING_KEYS)
    .all<{ key: string; value: string }>();
  return new Map(rows.results.map((row) => [row.key, row.value]));
}

async function validLabLink(sourceProjectId: string, labProjectId: string) {
  const rows = await env.DB.prepare(
    "SELECT key,value FROM settings WHERE project_id=? AND key IN ('geoLabMode','geoLabSourceProjectId')",
  )
    .bind(labProjectId)
    .all<{ key: string; value: string }>();
  const values = new Map(rows.results.map((row) => [row.key, row.value]));
  return values.get("geoLabMode") === "1" && values.get("geoLabSourceProjectId") === sourceProjectId;
}

function statusValue(value: string) {
  const normalized = String(value || "available").toLowerCase();
  if (normalized === "sold") return "sold" as const;
  if (normalized === "booked" || normalized === "hold") return "booked" as const;
  return "available" as const;
}

function promotedKeyAllowed(key: string, labProjectId: string) {
  return key.startsWith(`projects/${labProjectId}/geo/promoted/`);
}

async function loadPublicManifest(options: {
  labProjectId: string;
  revision: number;
  overlayKey: string;
  configuredManifestKey: string;
}) {
  const fallbackKey = `${options.overlayKey}.manifest.json`;
  const candidate =
    options.configuredManifestKey && promotedKeyAllowed(options.configuredManifestKey, options.labProjectId)
      ? options.configuredManifestKey
      : fallbackKey;

  if (promotedKeyAllowed(candidate, options.labProjectId)) {
    const object = await env.BUCKET.get(candidate);
    if (object) {
      try {
        return { manifest: parseGeoPublicManifest(await object.text(), options.revision), source: "r2" as const };
      } catch (error) {
        console.warn("Cached Geo public manifest invalid, rebuilding", error);
      }
    }
  }

  const version = await env.DB.prepare(
    "SELECT snapshot FROM geo_versions WHERE project_id=? AND version=? LIMIT 1",
  )
    .bind(options.labProjectId, options.revision)
    .first<{ snapshot: string }>();
  if (!version?.snapshot) throw new Error("Published Geo snapshot unavailable");

  const manifest = buildGeoPublicManifest(JSON.parse(version.snapshot) as GeoPublicSnapshot, options.revision);
  if (promotedKeyAllowed(candidate, options.labProjectId)) {
    try {
      await env.BUCKET.put(candidate, JSON.stringify(manifest), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
        customMetadata: {
          geoRevision: String(options.revision),
          schemaVersion: String(manifest.schemaVersion),
          backfilled: "1",
        },
      });
    } catch (error) {
      console.warn("Geo public manifest backfill skipped", error);
    }
  }
  return { manifest, source: "computed" as const };
}

function decorateManifest(
  manifest: GeoPublicManifest,
  plots: Array<{
    id: string;
    status: string;
    sqft: number;
    sqm: number;
    sqyd: number;
    dimensions: string;
    road: string;
  }>,
) {
  const plotsById = new Map(plots.map((plot) => [plot.id, plot]));
  let available = 0;
  let booked = 0;
  let sold = 0;
  let total = 0;
  const features = manifest.features.map((feature) => {
    const plot = feature.linkedPlotId ? plotsById.get(feature.linkedPlotId) : undefined;
    const status = statusValue(plot?.status || "available");
    if (feature.linkedPlotId) {
      total += 1;
      if (status === "sold") sold += 1;
      else if (status === "booked") booked += 1;
      else available += 1;
    }
    return {
      ...feature,
      status,
      sqft: Number(plot?.sqft || 0),
      sqm: Number(plot?.sqm || 0),
      sqyd: Number(plot?.sqyd || 0),
      dimensions: String(plot?.dimensions || ""),
      road: String(plot?.road || ""),
    };
  });
  return { features, counts: { total, available, booked, sold } };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("projectSlug")?.trim() || "";
    if (!slug) return Response.json({ error: "Project slug required" }, { status: 400 });

    const source = await projectBySlug(slug);
    if (!source) return Response.json({ error: "Published project nahi mila" }, { status: 404 });

    const live = await sourceLiveSettings(source.id);
    if (live.get("geoPublicEnabled") !== "1")
      return Response.json({ error: "Satellite Geo map live nahi hai" }, { status: 404 });

    const labProjectId = String(live.get("geoPublicLabProjectId") || "");
    const revision = Number(live.get("geoPublicRevision") || 0);
    const overlayKey = String(live.get("geoPublicOverlayKey") || "");
    const manifestKey = String(live.get("geoPublicManifestKey") || "");
    const token = String(live.get("geoPublicToken") || "");
    if (!labProjectId || revision < 1 || !overlayKey || !token)
      return Response.json({ error: "Geo live pointer incomplete hai" }, { status: 404 });

    if (!(await validLabLink(source.id, labProjectId)))
      return Response.json({ error: "Geo live ownership mismatch" }, { status: 404 });

    const manifestStartedAt = Date.now();
    const [manifestResult, plotRows, mapsKey] = await Promise.all([
      loadPublicManifest({ labProjectId, revision, overlayKey, configuredManifestKey: manifestKey }),
      env.DB.prepare(
        "SELECT id,status,sqft,sqm,sqyd,dimensions,road FROM plots WHERE project_id=? ORDER BY id",
      )
        .bind(source.id)
        .all<{
          id: string;
          status: string;
          sqft: number;
          sqm: number;
          sqyd: number;
          dimensions: string;
          road: string;
        }>(),
      publicGoogleMapsBrowserKey(),
    ]);
    const manifestMs = Date.now() - manifestStartedAt;
    const { features, counts } = decorateManifest(manifestResult.manifest, plotRows.results);
    const baseMasterplanUrl =
      `/api/public-geo-masterplan?projectSlug=${encodeURIComponent(source.slug)}` +
      `&v=${encodeURIComponent(token)}`;

    return Response.json(
      {
        schemaVersion: 2,
        project: { id: source.id, name: source.name, slug: source.slug },
        revision,
        maps: { enabled: Boolean(mapsKey), apiKey: mapsKey || null },
        masterplanUrl: baseMasterplanUrl,
        masterplanUrls: {
          original: baseMasterplanUrl,
          mobile: `${baseMasterplanUrl}&variant=mobile`,
          desktop: `${baseMasterplanUrl}&variant=desktop`,
        },
        masterplanCorners: manifestResult.manifest.masterplanCorners,
        bounds: manifestResult.manifest.bounds,
        features,
        counts,
      },
      {
        headers: {
          "cache-control": "public,max-age=0,s-maxage=10,stale-while-revalidate=30",
          "server-timing":
            `geo-manifest;dur=${manifestMs};desc=\"${manifestResult.source}\", total;dur=${Date.now() - startedAt}`,
          "x-rekixo-project": source.id,
          "x-rekixo-geo-revision": String(revision),
          "x-rekixo-geo-manifest": manifestResult.source,
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error("Public Geo map load failed", error);
    return Response.json(
      { error: "Satellite Geo map unavailable" },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "server-timing": `total;dur=${Date.now() - startedAt}`,
        },
      },
    );
  }
}
