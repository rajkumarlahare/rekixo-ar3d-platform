import { getDb } from "@/modules/db";
import { gallery, plotEdgeMeasurements, plotPricing, plots, settings } from "@/modules/db/schema";
import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getAdminSession } from "@/modules/auth";
import { publicProjectId } from "@/modules/projects";
import { activeProjectDomain } from "@/modules/domains";
import { currentProjectLinks } from "@/modules/projects";
import { withProjectContactFallbacks } from "@/modules/projects";
import { publicProject3DLink } from "@/modules/engine-integration";

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

    const [project, plotRows, edgeMeasurementRows, settingRows, galleryRows, adminDomain] =
      await Promise.all([
        env.DB.prepare(
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
          }>(),
        db.select().from(plots).where(eq(plots.projectId, projectId)),
        db
          .select()
          .from(plotEdgeMeasurements)
          .where(eq(plotEdgeMeasurements.projectId, projectId)),
        db.select().from(settings).where(eq(settings.projectId, projectId)),
        db
          .select({ id: gallery.id, caption: gallery.caption, filename: gallery.filename })
          .from(gallery)
          .where(eq(gallery.projectId, projectId))
          .orderBy(desc(gallery.sortOrder)),
        activeProjectDomain(projectId, "admin"),
      ]);

    if (!project) {
      return Response.json(
        { error: "Project unavailable" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    const adminHost = adminDomain || project.adminHost;
    const links = currentProjectLinks(project.slug, null, adminHost);
    const publicSettings = Object.fromEntries(
      settingRows
        .filter((item) => PUBLIC_SETTING_KEYS.has(item.key))
        .map((item) => [item.key, item.value]),
    );
    const effectivePublicSettings = withProjectContactFallbacks(publicSettings);
    const pricingEnabled = publicSettings.pricingEnabled === "1";
    const pricingRows = pricingEnabled
      ? await db
          .select()
          .from(plotPricing)
          .where(eq(plotPricing.projectId, projectId))
      : [];
    const pricingByPlot = new Map(pricingRows.map((item) => [item.plotId, item]));
    const engine3d = await publicProject3DLink(projectId);
    const edgeMeasurementsByPlot = new Map<string, typeof edgeMeasurementRows>();
    for (const item of edgeMeasurementRows) {
      const list = edgeMeasurementsByPlot.get(item.plotId) || [];
      list.push(item);
      edgeMeasurementsByPlot.set(item.plotId, list);
    }

    return Response.json(
      {
        projectId,
        projectName: project.name || "Project",
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
