import { env } from "cloudflare:workers";
import { projectBySlug } from "../../project-context";
import { createGeoOverlayVariant } from "../../geo-public-image";

const LIVE_SETTING_KEYS = [
  "geoPublicEnabled",
  "geoPublicLabProjectId",
  "geoPublicOverlayKey",
  "geoPublicOverlayMobileKey",
  "geoPublicOverlayDesktopKey",
  "geoPublicToken",
] as const;

async function liveSettings(projectId: string) {
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

function promotedKeyAllowed(key: string, labProjectId: string) {
  return key.startsWith(`projects/${labProjectId}/geo/promoted/`);
}

async function optimizedVariantKey(options: {
  live: Map<string, string>;
  labProjectId: string;
  overlayKey: string;
  variant: "mobile" | "desktop";
}) {
  const settingKey =
    options.variant === "mobile"
      ? "geoPublicOverlayMobileKey"
      : "geoPublicOverlayDesktopKey";
  const configured = String(options.live.get(settingKey) || "");
  if (configured && promotedKeyAllowed(configured, options.labProjectId)) {
    const ready = await env.BUCKET.head(configured);
    if (ready) return configured;
  }

  const candidate = `${options.overlayKey}.${options.variant}.webp`;
  if (!promotedKeyAllowed(candidate, options.labProjectId)) return options.overlayKey;
  const existing = await env.BUCKET.head(candidate);
  if (existing) return candidate;

  const created = await createGeoOverlayVariant({
    sourceKey: options.overlayKey,
    targetKey: candidate,
    width: options.variant === "mobile" ? 1800 : 3072,
    quality: options.variant === "mobile" ? 82 : 86,
    customMetadata: { lazyVariant: "1", variant: options.variant },
  });
  return created ? candidate : options.overlayKey;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const slug = url.searchParams.get("projectSlug")?.trim() || "";
  if (!slug) return new Response("Not found", { status: 404 });

  const source = await projectBySlug(slug);
  if (!source) return new Response("Not found", { status: 404 });

  const live = await liveSettings(source.id);
  if (live.get("geoPublicEnabled") !== "1")
    return new Response("Not found", { status: 404 });

  const labProjectId = String(live.get("geoPublicLabProjectId") || "");
  const overlayKey = String(live.get("geoPublicOverlayKey") || "");
  const token = String(live.get("geoPublicToken") || "");
  if (!labProjectId || !overlayKey || !token)
    return new Response("Not found", { status: 404 });

  if (!(await validLabLink(source.id, labProjectId)))
    return new Response("Not found", { status: 404 });

  if (!promotedKeyAllowed(overlayKey, labProjectId))
    return new Response("Not found", { status: 404 });

  const requestedToken = url.searchParams.get("v") || "";
  if (requestedToken && requestedToken !== token)
    return new Response("Not found", { status: 404 });

  const requestedVariant = url.searchParams.get("variant");
  const variant =
    requestedVariant === "mobile" || requestedVariant === "desktop"
      ? requestedVariant
      : null;
  const objectKey = variant
    ? await optimizedVariantKey({ live, labProjectId, overlayKey, variant })
    : overlayKey;

  const object = await env.BUCKET.get(objectKey);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType || "image/png",
    "cache-control": requestedToken
      ? "public,max-age=31536000,immutable"
      : "public,max-age=0,must-revalidate",
    "server-timing": `masterplan;dur=${Date.now() - startedAt}`,
    "x-content-type-options": "nosniff",
    "x-rekixo-project": source.id,
    "x-rekixo-geo-overlay-variant": objectKey === overlayKey ? "original" : variant || "original",
  });
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
