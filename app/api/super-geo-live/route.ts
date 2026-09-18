import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "../../admin-auth";
import { writeAudit } from "../../audit";
import { buildGeoPublicManifest, type GeoPublicSnapshot } from "../../geo-public-manifest";
import { createGeoOverlayVariant } from "../../geo-public-image";
import { publicGoogleMapsBrowserKey } from "../../google-maps-config";
import { currentProjectLinks } from "../../project-links";

const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

const LIVE_SETTING_KEYS = [
  "geoPublicEnabled",
  "geoPublicLabProjectId",
  "geoPublicRevision",
  "geoPublicOverlayKey",
  "geoPublicManifestKey",
  "geoPublicOverlayMobileKey",
  "geoPublicOverlayDesktopKey",
  "geoPublicToken",
  "geoPublicPromotedAt",
  "geoPublicPlotClicks",
  "geoPublicShowLegend",
  "geoPublicShowPolygons",
  "geoPublicViewMode",
] as const;

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  publicStatus: string;
  publicHost: string | null;
  adminHost: string | null;
};

async function setting(projectId: string, key: string) {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE project_id=? AND key=? LIMIT 1",
  )
    .bind(projectId, key)
    .first<{ value: string }>();
  return String(row?.value || "");
}

async function settingsMap(projectId: string) {
  const rows = await env.DB.prepare(
    `SELECT key,value FROM settings WHERE project_id=? AND key IN (${LIVE_SETTING_KEYS.map(() => "?").join(",")})`,
  )
    .bind(projectId, ...LIVE_SETTING_KEYS)
    .all<{ key: string; value: string }>();
  return new Map(rows.results.map((row) => [row.key, row.value]));
}

async function project(projectId: string) {
  return env.DB.prepare(
    "SELECT id,name,slug,public_status AS publicStatus,status,public_host AS publicHost,admin_host AS adminHost FROM projects WHERE id=? AND status='active' LIMIT 1",
  )
    .bind(projectId)
    .first<ProjectRow>();
}

async function labContext(labProjectId: string) {
  const [lab, labMode, sourceProjectId, sourceProjectName, geoState] =
    await Promise.all([
      project(labProjectId),
      setting(labProjectId, "geoLabMode"),
      setting(labProjectId, "geoLabSourceProjectId"),
      setting(labProjectId, "geoLabSourceProjectName"),
      env.DB.prepare(
        "SELECT draft_revision AS draftRevision,published_revision AS publishedRevision,public_enabled AS publicEnabled,published_at AS publishedAt FROM geo_project_settings WHERE project_id=?",
      )
        .bind(labProjectId)
        .first<{
          draftRevision: number;
          publishedRevision: number;
          publicEnabled: number;
          publishedAt: string | null;
        }>(),
    ]);

  if (!lab) return { error: "Geo Lab project nahi mila", status: 404 as const };
  if (labMode !== "1" || !sourceProjectId)
    return { error: "Selected project valid GEO LAB clone nahi hai", status: 409 as const };

  const source = await project(sourceProjectId);
  if (!source)
    return { error: "Geo Lab source/customer project nahi mila", status: 404 as const };

  const sourceIsLab = await setting(source.id, "geoLabMode");
  if (sourceIsLab === "1")
    return { error: "Geo Lab ka source customer project hona chahiye", status: 409 as const };

  return {
    lab,
    source,
    sourceProjectName: sourceProjectName || source.name,
    geoState: {
      draftRevision: Number(geoState?.draftRevision || 0),
      publishedRevision: Number(geoState?.publishedRevision || 0),
      publicEnabled: Boolean(geoState?.publicEnabled),
      publishedAt: geoState?.publishedAt || null,
    },
  };
}

function customerMapUrl(source: ProjectRow) {
  const links = currentProjectLinks(source.slug, source.publicHost, source.adminHost);
  const base = links.platformUrl || links.fallbackUrl;
  return base ? `${base}/map` : "";
}

async function publicMapsKeyConfigured() {
  return Boolean(await publicGoogleMapsBrowserKey());
}

async function responseFor(labProjectId: string) {
  const context = await labContext(labProjectId);
  if ("error" in context) return context;

  const [live, overlayHead, mapsKeyConfigured] = await Promise.all([
    settingsMap(context.source.id),
    env.BUCKET.head(`projects/${labProjectId}/geo/public-overlay.png`),
    publicMapsKeyConfigured(),
  ]);

  const promotedLabId = String(live.get("geoPublicLabProjectId") || "");
  const promotedRevision = Number(live.get("geoPublicRevision") || 0);
  const promotedEnabled = live.get("geoPublicEnabled") === "1";
  const promotedCurrent =
    promotedEnabled &&
    promotedLabId === labProjectId &&
    promotedRevision === context.geoState.publishedRevision &&
    context.geoState.publishedRevision > 0;

  return {
    lab: true,
    source: {
      id: context.source.id,
      name: context.source.name,
      slug: context.source.slug,
      publicStatus: context.source.publicStatus,
    },
    geo: context.geoState,
    overlaySaved: Boolean(overlayHead),
    mapsKeyConfigured,
    display: {
      plotClicks: live.get("geoPublicPlotClicks") !== "0",
      showLegend: live.get("geoPublicShowLegend") !== "0",
      showPolygons: live.get("geoPublicShowPolygons") !== "0",
      viewMode: live.get("geoPublicViewMode") === "masterplan" ? "masterplan" : "north",
    },
    promotion: {
      enabled: promotedEnabled,
      current: promotedCurrent,
      revision: promotedRevision,
      promotedAt: String(live.get("geoPublicPromotedAt") || "") || null,
      token: String(live.get("geoPublicToken") || "") || null,
    },
    customerMapUrl: customerMapUrl(context.source),
    customerReady:
      promotedCurrent &&
      context.source.publicStatus === "published" &&
      mapsKeyConfigured,
  };
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();

  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId)
    return Response.json({ error: "Geo Lab project required" }, { status: 400 });

  const result = await responseFor(projectId);
  if ("error" in result)
    return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result, {
    headers: { "cache-control": "private,no-store" },
  });
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    action?: string;
    plotClicks?: boolean;
    showLegend?: boolean;
    showPolygons?: boolean;
    viewMode?: "north" | "masterplan";
  };
  const labProjectId = String(body.projectId || "").trim();
  if (!labProjectId)
    return Response.json({ error: "Geo Lab project required" }, { status: 400 });

  const context = await labContext(labProjectId);
  if ("error" in context)
    return Response.json({ error: context.error }, { status: context.status });

  const now = new Date().toISOString();

  if (body.action === "disable") {
    await env.DB.prepare(
      "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,'geoPublicEnabled','0',?) ON CONFLICT(project_id,key) DO UPDATE SET value='0',updated_at=excluded.updated_at",
    )
      .bind(context.source.id, now)
      .run();

    await writeAudit(actor, "geo.customer_live_disabled", context.source.id, labProjectId, {});
    const result = await responseFor(labProjectId);
    return Response.json(result, {
      headers: { "cache-control": "private,no-store" },
    });
  }

  if (body.action === "save_display") {
    if (typeof body.plotClicks !== "boolean" || typeof body.showLegend !== "boolean")
      return Response.json({ error: "Geo display settings invalid hain" }, { status: 400 });

    // Backward-compatible with an older cached Super Admin bundle that does not
    // send showPolygons yet. Missing setting means ON for existing/future projects.
    const current = await settingsMap(context.source.id);
    const showPolygons =
      typeof body.showPolygons === "boolean"
        ? body.showPolygons
        : current.get("geoPublicShowPolygons") !== "0";
    const viewMode =
      body.viewMode === "masterplan" || body.viewMode === "north"
        ? body.viewMode
        : current.get("geoPublicViewMode") === "masterplan"
          ? "masterplan"
          : "north";
    // Hidden polygons must never leave invisible public click targets behind.
    const plotClicks = showPolygons ? body.plotClicks : false;

    const values: Array<[string, string]> = [
      ["geoPublicPlotClicks", plotClicks ? "1" : "0"],
      ["geoPublicShowLegend", body.showLegend ? "1" : "0"],
      ["geoPublicShowPolygons", showPolygons ? "1" : "0"],
      ["geoPublicViewMode", viewMode],
    ];
    await env.DB.batch(
      values.map(([key, value]) =>
        env.DB.prepare(
          "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
        ).bind(context.source.id, key, value, now),
      ),
    );
    await writeAudit(actor, "geo.customer_display_saved", context.source.id, labProjectId, {
      plotClicks,
      showLegend: body.showLegend,
      showPolygons,
      viewMode,
    });
    const result = await responseFor(labProjectId);
    return Response.json(result, {
      headers: { "cache-control": "private,no-store" },
    });
  }

  if (body.action !== "promote")
    return Response.json({ error: "Unsupported Geo live action" }, { status: 400 });

  const revision = context.geoState.publishedRevision;
  if (
    !context.geoState.publicEnabled ||
    revision < 1 ||
    context.geoState.draftRevision !== revision
  ) {
    return Response.json(
      {
        error:
          "Pehle current Geo draft ko Publish Geo Snapshot karein. Draft aur Published revision same honi chahiye.",
      },
      { status: 409 },
    );
  }

  const snapshotRow = await env.DB.prepare(
    "SELECT snapshot FROM geo_versions WHERE project_id=? AND version=? LIMIT 1",
  )
    .bind(labProjectId, revision)
    .first<{ snapshot: string }>();
  if (!snapshotRow?.snapshot)
    return Response.json({ error: "Published Geo snapshot missing hai" }, { status: 409 });

  let manifest;
  try {
    manifest = buildGeoPublicManifest(
      JSON.parse(snapshotRow.snapshot) as GeoPublicSnapshot,
      revision,
    );
  } catch (error) {
    console.warn("Geo public manifest build failed", error);
    return Response.json(
      { error: "Published Geo geometry customer map ke liye invalid hai" },
      { status: 409 },
    );
  }

  const savedOverlayKey = `projects/${labProjectId}/geo/public-overlay.png`;
  let sourceOverlay = await env.BUCKET.get(savedOverlayKey);
  let sourceOverlayKey = savedOverlayKey;
  let overlaySource = "saved-public-overlay";
  if (!sourceOverlay) {
    sourceOverlayKey = `projects/${labProjectId}/mapper/masterplanPublic`;
    sourceOverlay = await env.BUCKET.get(sourceOverlayKey);
    overlaySource = "masterplan-public-fallback";
  }
  if (!sourceOverlay) {
    sourceOverlayKey = `projects/${labProjectId}/mapper/masterplan`;
    sourceOverlay = await env.BUCKET.get(sourceOverlayKey);
    overlaySource = "masterplan-canonical-fallback";
  }
  if (!sourceOverlay)
    return Response.json({ error: "Geo live masterplan overlay missing hai" }, { status: 409 });

  const token = crypto.randomUUID();
  const promotedBaseKey = `projects/${labProjectId}/geo/promoted/${revision}/${token}`;
  const promotedOverlayKey = `${promotedBaseKey}/overlay-original`;
  const promotedManifestKey = `${promotedBaseKey}/manifest.json`;
  const promotedMobileKey = `${promotedBaseKey}/overlay-mobile.webp`;
  const promotedDesktopKey = `${promotedBaseKey}/overlay-desktop.webp`;

  await env.BUCKET.put(promotedOverlayKey, sourceOverlay.body, {
    httpMetadata: sourceOverlay.httpMetadata,
    customMetadata: {
      ...(sourceOverlay.customMetadata || {}),
      geoRevision: String(revision),
      promotedAt: now,
      overlaySource,
    },
  });
  await env.BUCKET.put(promotedManifestKey, JSON.stringify(manifest), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      geoRevision: String(revision),
      promotedAt: now,
      schemaVersion: String(manifest.schemaVersion),
    },
  });

  const variantMetadata = {
    geoRevision: String(revision),
    promotedAt: now,
    overlaySource,
  };
  const [mobileReady, desktopReady] = await Promise.all([
    createGeoOverlayVariant({
      sourceKey: promotedOverlayKey,
      targetKey: promotedMobileKey,
      width: 1800,
      quality: 82,
      customMetadata: variantMetadata,
    }),
    createGeoOverlayVariant({
      sourceKey: promotedOverlayKey,
      targetKey: promotedDesktopKey,
      width: 3072,
      quality: 86,
      customMetadata: variantMetadata,
    }),
  ]);

  try {
    const values: Array<[string, string]> = [
      ["geoPublicEnabled", "1"],
      ["geoPublicLabProjectId", labProjectId],
      ["geoPublicRevision", String(revision)],
      ["geoPublicOverlayKey", promotedOverlayKey],
      ["geoPublicManifestKey", promotedManifestKey],
      ["geoPublicOverlayMobileKey", mobileReady ? promotedMobileKey : ""],
      ["geoPublicOverlayDesktopKey", desktopReady ? promotedDesktopKey : ""],
      ["geoPublicToken", token],
      ["geoPublicPromotedAt", now],
    ];
    await env.DB.batch(
      values.map(([key, value]) =>
        env.DB.prepare(
          "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
        ).bind(context.source.id, key, value, now),
      ),
    );
  } catch (error) {
    await Promise.all([
      env.BUCKET.delete(promotedOverlayKey),
      env.BUCKET.delete(promotedManifestKey),
      mobileReady ? env.BUCKET.delete(promotedMobileKey) : Promise.resolve(),
      desktopReady ? env.BUCKET.delete(promotedDesktopKey) : Promise.resolve(),
    ]);
    throw error;
  }

  await writeAudit(actor, "geo.customer_live_promoted", context.source.id, labProjectId, {
    revision,
    sourceProject: context.source.name,
    overlaySource,
    manifestPrecomputed: true,
    mobileOverlayOptimized: mobileReady,
    desktopOverlayOptimized: desktopReady,
    normalProjectPublishChanged: false,
    plotBusinessStateChanged: false,
  });

  const result = await responseFor(labProjectId);
  return Response.json(result, {
    headers: { "cache-control": "private,no-store" },
  });
}
