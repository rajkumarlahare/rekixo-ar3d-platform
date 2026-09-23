import { getDb } from "@/modules/db";
import {
  gallery,
  plotEdgeMeasurements,
  plotPricing,
  plots,
  settings,
} from "@/modules/db/schema";
import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getAdminSession } from "@/modules/auth";
import {
  PROJECT_CONTACT_KEYS,
  publicProjectId,
  currentProjectLinks,
  withProjectContactFallbacks,
} from "@/modules/projects";
import { activeProjectDomain } from "@/modules/domains";
import {
  publicProject3DLink,
  publicProject3DLinkFromSnapshot,
} from "@/modules/engine-integration";

const PUBLIC_SETTING_KEYS = new Set([
  "projectName",
  "brandName",
  "brandShort",
  "template",
  "accentColor",
  "plotStatusAvailableColor",
  "plotStatusBookedColor",
  "plotStatusSoldColor",
  "pricingEnabled",
  "customerCallEnabled",
  "publicInitialViewMode",
  "publicInitialFocusX",
  "publicInitialFocusY",
  "location",
  "address",
  "phone1",
  "phone2",
  "whatsapp",
  "mapUrl",
  "brochureUrl",
  "masterplanName",
  "mapWidth",
  "mapHeight",
  "publicRotation",
  "logoName",
  "logoVersion",
  "shareTitle",
  "shareDescription",
  "shareImage",
]);

type PublishedSnapshot = {
  publishVersion: number;
  projectName: string;
  engineProjectId: string | null;
  engineSlug: string | null;
  engineLinkStatus: string | null;
  enginePublicEnabled: number;
  enginePublicUrl: string | null;
};

type PublishedPlot = {
  projectId: string;
  id: string;
  sqft: number;
  sqm: number;
  sqyd: number;
  dimensions: string;
  road: string;
  front: number | null;
  depth: number | null;
  back: number | null;
  depth2: number | null;
  dimensionUnit: string | null;
  frontEdgeIndex: number | null;
  depthEdgeIndex: number | null;
  backEdgeIndex: number | null;
  depth2EdgeIndex: number | null;
  frontLabel: string | null;
  depthLabel: string | null;
  backLabel: string | null;
  depth2Label: string | null;
  sideDimensions: string | null;
  edgeSemantics: string | null;
  polygon: string;
  status: string;
  featured: number | boolean;
  notes?: string;
};

type PublishedEdgeMeasurement = {
  projectId: string;
  plotId: string;
  role: string;
  segmentIndex: number;
  edgeIndex: number | null;
  pointCount: number | null;
  length: number | null;
  unit: string | null;
  rawLabel: string | null;
  roadFrontage: number | boolean;
  roadAccess: string | null;
};

async function previewProjectId(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("preview") !== "1") return null;
  const requested = url.searchParams.get("projectId");
  if (!requested) return null;
  const session = await getAdminSession();
  if (!session) return null;
  if (session.role !== "super_admin" && session.projectId !== requested) return null;
  const row = await env.DB.prepare(
    "SELECT id FROM projects WHERE id=? AND status='active' LIMIT 1",
  )
    .bind(requested)
    .first<{ id: string }>();
  return row?.id || null;
}

function contactSettingPlaceholders() {
  return PROJECT_CONTACT_KEYS.map(() => "?").join(",");
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const previewId = await previewProjectId(request);
    const projectId = previewId || (await publicProjectId(request));
    if (!projectId) {
      return Response.json(
        { error: "Project domain configured/published nahi hai" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    // REKIXO_PUBLIC_ACCESS_GATE_V1
    // Authenticated previews intentionally bypass this public-only pause switch.
    // Missing setting means ON, preserving all existing and future project behavior.
    if (!previewId) {
      const publicAccess = await env.DB.prepare(
        "SELECT value FROM settings WHERE project_id=? AND key='publicSiteEnabled' LIMIT 1",
      )
        .bind(projectId)
        .first<{ value: string }>();
      if (publicAccess?.value === "0") {
        return Response.json(
          {
            error: "Project temporarily unavailable",
            code: "PROJECT_TEMPORARILY_UNAVAILABLE",
          },
          {
            status: 503,
            headers: {
              "cache-control": "no-store",
              "retry-after": "60",
              "x-rekixo-public-access": "disabled",
            },
          },
        );
      }
    }

    const project = await env.DB.prepare(
      "SELECT name,slug,public_status AS publicStatus,published_at AS publishedAt,publish_version AS publishVersion,admin_host AS adminHost FROM projects WHERE id=? AND status='active' LIMIT 1",
    )
      .bind(projectId)
      .first<{
        name: string;
        slug: string;
        publicStatus: string;
        publishedAt: string | null;
        publishVersion: number;
        adminHost: string | null;
      }>();

    if (!project) {
      return Response.json(
        { error: "Project unavailable" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    const snapshot = !previewId
      ? await env.DB.prepare(
          `SELECT
             publish_version AS publishVersion,
             project_name AS projectName,
             engine_project_id AS engineProjectId,
             engine_slug AS engineSlug,
             engine_link_status AS engineLinkStatus,
             engine_public_enabled AS enginePublicEnabled,
             engine_public_url AS enginePublicUrl
           FROM project_public_snapshots
           WHERE project_id=?
           LIMIT 1`,
        )
          .bind(projectId)
          .first<PublishedSnapshot>()
      : null;

    const snapshotReady =
      !previewId &&
      Boolean(snapshot) &&
      Number(snapshot?.publishVersion || -1) === Number(project.publishVersion || 0);

    if (!previewId && project.publicStatus === "published" && !snapshotReady) {
      console.warn(
        "Published project snapshot missing or stale; using compatibility fallback",
        projectId,
        project.publishVersion,
      );
    }

    const currentPlotPromise = db.select().from(plots).where(eq(plots.projectId, projectId));
    const currentEdgePromise = db
      .select()
      .from(plotEdgeMeasurements)
      .where(eq(plotEdgeMeasurements.projectId, projectId));
    const currentSettingsPromise = db
      .select()
      .from(settings)
      .where(eq(settings.projectId, projectId));

    const plotPromise = snapshotReady
      ? env.DB.prepare(
          `SELECT
             project_id AS projectId,id,sqft,sqm,sqyd,dimensions,road,front,depth,
             back,depth2,dimension_unit AS dimensionUnit,
             front_edge_index AS frontEdgeIndex,depth_edge_index AS depthEdgeIndex,
             back_edge_index AS backEdgeIndex,depth2_edge_index AS depth2EdgeIndex,
             front_label AS frontLabel,depth_label AS depthLabel,
             back_label AS backLabel,depth2_label AS depth2Label,
             side_dimensions AS sideDimensions,edge_semantics AS edgeSemantics,
             polygon,status,featured
           FROM published_plots
           WHERE project_id=?
           ORDER BY id`,
        )
          .bind(projectId)
          .all<PublishedPlot>()
          .then((result) => result.results)
      : currentPlotPromise;

    const edgePromise = snapshotReady
      ? env.DB.prepare(
          `SELECT
             project_id AS projectId,plot_id AS plotId,role,
             segment_index AS segmentIndex,edge_index AS edgeIndex,
             point_count AS pointCount,length,unit,raw_label AS rawLabel,
             road_frontage AS roadFrontage,road_access AS roadAccess
           FROM published_plot_edge_measurements
           WHERE project_id=?
           ORDER BY plot_id,role,segment_index`,
        )
          .bind(projectId)
          .all<PublishedEdgeMeasurement>()
          .then((result) => result.results)
      : currentEdgePromise;

    const settingPromise = snapshotReady
      ? env.DB.prepare(
          "SELECT key,value FROM published_settings WHERE project_id=?",
        )
          .bind(projectId)
          .all<{ key: string; value: string }>()
          .then((result) => result.results)
      : currentSettingsPromise;

    const liveStatusPromise = snapshotReady
      ? env.DB.prepare("SELECT id,status FROM plots WHERE project_id=?")
          .bind(projectId)
          .all<{ id: string; status: string }>()
          .then((result) => result.results)
      : Promise.resolve([] as Array<{ id: string; status: string }>);

    const liveContactPromise = snapshotReady
      ? env.DB.prepare(
          `SELECT key,value FROM settings
           WHERE project_id=? AND key IN (${contactSettingPlaceholders()})`,
        )
          .bind(projectId, ...PROJECT_CONTACT_KEYS)
          .all<{ key: string; value: string }>()
          .then((result) => result.results)
      : Promise.resolve([] as Array<{ key: string; value: string }>);

    const [
      plotRows,
      edgeMeasurementRows,
      settingRows,
      liveStatusRows,
      liveContactRows,
      galleryRows,
      adminDomain,
    ] = await Promise.all([
      plotPromise,
      edgePromise,
      settingPromise,
      liveStatusPromise,
      liveContactPromise,
      db
        .select({ id: gallery.id, caption: gallery.caption, filename: gallery.filename })
        .from(gallery)
        .where(eq(gallery.projectId, projectId))
        .orderBy(desc(gallery.sortOrder)),
      activeProjectDomain(projectId, "admin"),
    ]);

    const adminHost = adminDomain || project.adminHost;
    const links = currentProjectLinks(project.slug, null, adminHost);
    const publicSettings = Object.fromEntries(
      settingRows
        .filter((item) => PUBLIC_SETTING_KEYS.has(item.key))
        .map((item) => [item.key, item.value]),
    );
    const liveContactSettings = Object.fromEntries(
      liveContactRows.map((item) => [item.key, item.value]),
    );
    const effectivePublicSettings = withProjectContactFallbacks({
      ...publicSettings,
      ...liveContactSettings,
    });

    const pricingEnabled = publicSettings.pricingEnabled === "1";
    const pricingRows = pricingEnabled
      ? await db
          .select()
          .from(plotPricing)
          .where(eq(plotPricing.projectId, projectId))
      : [];
    const pricingByPlot = new Map(pricingRows.map((item) => [item.plotId, item]));
    const engine3d =
      snapshotReady && snapshot
        ? await publicProject3DLinkFromSnapshot(snapshot)
        : await publicProject3DLink(projectId);

    const edgeMeasurementsByPlot = new Map<string, typeof edgeMeasurementRows>();
    for (const item of edgeMeasurementRows) {
      const list = edgeMeasurementsByPlot.get(item.plotId) || [];
      list.push(item);
      edgeMeasurementsByPlot.set(item.plotId, list);
    }

    const liveStatusByPlot = new Map(
      liveStatusRows.map((item) => [item.id, item.status]),
    );

    return Response.json(
      {
        projectId,
        projectName:
          snapshotReady && snapshot?.projectName
            ? snapshot.projectName
            : project.name || "Project",
        slug: project.slug,
        preview: Boolean(previewId),
        publishVersion: project.publishVersion,
        publishedAt: project.publishedAt,
        adminUrl: links.adminUrl,
        platformUrl: links.platformUrl,
        engine3d,
        plots: plotRows.map((plot) => {
          const { notes, ...publicPlot } = plot;
          void notes;
          const edgeMeasurements = (edgeMeasurementsByPlot.get(plot.id) || []).map(
            (item) => ({
              role: item.role,
              segmentIndex: item.segmentIndex,
              edgeIndex: item.edgeIndex,
              pointCount: item.pointCount,
              length: item.length,
              unit: item.unit,
              rawLabel: item.rawLabel,
              roadFrontage: item.roadFrontage,
              roadAccess: item.roadAccess,
            }),
          );
          const price = pricingEnabled ? pricingByPlot.get(plot.id) : null;
          return {
            ...publicPlot,
            status: liveStatusByPlot.get(plot.id) || publicPlot.status,
            ...(edgeMeasurements.length ? { edgeMeasurements } : {}),
            ...(price
              ? {
                  pricing: {
                    type: price.pricingType,
                    unit: price.unit,
                    rate: price.rate,
                    fixedPrice: price.fixedPrice,
                    currency: price.currency,
                  },
                }
              : {}),
          };
        }),
        settings: effectivePublicSettings,
        gallery: galleryRows,
      },
      {
        headers: {
          "cache-control": "no-store",
          "x-rekixo-project": projectId,
          "x-rekixo-publish-version": String(project.publishVersion || 0),
          "x-rekixo-publish-snapshot": snapshotReady ? "1" : "0",
        },
      },
    );
  } catch (error) {
    console.error("Public data load failed", error);
    return Response.json(
      { error: "Project data unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
