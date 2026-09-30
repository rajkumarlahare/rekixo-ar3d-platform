import { env } from "cloudflare:workers";
import {
  enginePublishedModelUrl,
  project3DLink,
  publishedEngineProject,
} from "@/modules/engine-integration";
import { normalizeGeoGeometry } from "./geo-model";

export type Geo3DPlacement = {
  platformProjectId: string;
  geoProjectId: string;
  engineProjectId: string;
  engineSlug: string;
  engineReleaseId: string;
  engineReleaseVersion: number;
  engineModelId: string;
  longitude: number;
  latitude: number;
  altitudeM: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  scale: number;
  publicEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlacementRow = Omit<Geo3DPlacement, "publicEnabled"> & {
  publicEnabled: number;
};

export async function geo3DPlacementSchemaReady() {
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name='geo_3d_placements'",
    ).first<{ total: number }>();
    return Number(row?.total || 0) === 1;
  } catch {
    return false;
  }
}

export async function loadGeo3DPlacement(
  platformProjectId: string,
): Promise<Geo3DPlacement | null> {
  if (!(await geo3DPlacementSchemaReady())) return null;
  const row = await env.DB.prepare(
    `SELECT platform_project_id AS platformProjectId,
            geo_project_id AS geoProjectId,
            engine_project_id AS engineProjectId,
            engine_slug AS engineSlug,
            engine_release_id AS engineReleaseId,
            engine_release_version AS engineReleaseVersion,
            engine_model_id AS engineModelId,
            longitude,latitude,
            altitude_m AS altitudeM,
            heading_deg AS headingDeg,
            pitch_deg AS pitchDeg,
            roll_deg AS rollDeg,
            scale,
            public_enabled AS publicEnabled,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM geo_3d_placements
      WHERE platform_project_id=?
      LIMIT 1`,
  )
    .bind(platformProjectId)
    .first<PlacementRow>();
  return row ? { ...row, publicEnabled: Boolean(row.publicEnabled) } : null;
}

export async function resolveGeo3DPlacementScope(requestedProjectId: string) {
  const project = await env.DB.prepare(
    "SELECT id,name,slug,status FROM projects WHERE id=? AND status!='deleted' LIMIT 1",
  )
    .bind(requestedProjectId)
    .first<{ id: string; name: string; slug: string; status: string }>();
  if (!project) return null;

  const settings = await env.DB.prepare(
    "SELECT key,value FROM settings WHERE project_id=? AND key IN ('geoLabMode','geoLabSourceProjectId')",
  )
    .bind(requestedProjectId)
    .all<{ key: string; value: string }>();
  const map = new Map(settings.results.map((row) => [row.key, row.value]));
  const sourceId =
    map.get("geoLabMode") === "1"
      ? String(map.get("geoLabSourceProjectId") || "").trim()
      : requestedProjectId;
  if (!sourceId) return null;

  const source =
    sourceId === requestedProjectId
      ? project
      : await env.DB.prepare(
          "SELECT id,name,slug,status FROM projects WHERE id=? AND status!='deleted' LIMIT 1",
        )
          .bind(sourceId)
          .first<{ id: string; name: string; slug: string; status: string }>();
  if (!source) return null;
  return {
    requestedProject: project,
    geoProjectId: requestedProjectId,
    platformProject: source,
    isGeoLab: source.id !== requestedProjectId,
  };
}

export async function geo3DVisualFeatures(geoProjectId: string) {
  try {
    const rows = await env.DB.prepare(
      "SELECT id,name,geometry,linked_plot_id AS linkedPlotId,source FROM geo_features WHERE project_id=? AND geometry_type='Polygon' ORDER BY CASE WHEN source='plot_mapper' THEN 0 ELSE 1 END,layer,name,id LIMIT 400",
    )
      .bind(geoProjectId)
      .all<{
        id: string;
        name: string;
        geometry: string;
        linkedPlotId: string | null;
        source: string;
      }>();

    return rows.results.flatMap((row) => {
      try {
        const geometry = normalizeGeoGeometry(JSON.parse(row.geometry));
        if (geometry.type !== "Polygon" || !geometry.coordinates[0]?.length)
          return [];
        return [
          {
            id: row.id,
            name: row.name,
            linkedPlotId: row.linkedPlotId,
            source: row.source,
            path: geometry.coordinates[0],
          },
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export async function geo3DSuggestedCenter(geoProjectId: string) {
  try {
    const rows = await env.DB.prepare(
      "SELECT longitude,latitude FROM geo_control_points WHERE project_id=? ORDER BY sort_order ASC LIMIT 12",
    )
      .bind(geoProjectId)
      .all<{ longitude: number; latitude: number }>();
    if (!rows.results.length) return null;
    const longitude =
      rows.results.reduce((sum, row) => sum + Number(row.longitude), 0) /
      rows.results.length;
    const latitude =
      rows.results.reduce((sum, row) => sum + Number(row.latitude), 0) /
      rows.results.length;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    return { longitude, latitude, source: "geo-control-points" as const };
  } catch {
    return null;
  }
}

export async function resolvePublicGeo3DPlacement(platformProjectId: string) {
  const placement = await loadGeo3DPlacement(platformProjectId);
  if (!placement?.publicEnabled) return null;

  const link = await project3DLink(platformProjectId);
  if (
    !link ||
    link.status !== "active" ||
    !link.publicEnabled ||
    link.engineProjectId !== placement.engineProjectId ||
    link.engineSlug !== placement.engineSlug
  )
    return null;

  const engine = await publishedEngineProject(link.engineSlug);
  if (
    !engine?.project ||
    engine.project.status !== "published" ||
    engine.project.id !== placement.engineProjectId ||
    !engine.release ||
    engine.release.id !== placement.engineReleaseId ||
    Number(engine.release.version) !== placement.engineReleaseVersion ||
    !engine.model ||
    engine.model.id !== placement.engineModelId ||
    engine.model.available === false ||
    engine.model.mimeType !== "model/gltf-binary"
  )
    return null;

  const sourceModelUrl = enginePublishedModelUrl(engine.model.url);
  if (!sourceModelUrl) return null;

  return {
    placement,
    engine,
    sourceModelUrl,
    experienceUrl: link.publicUrl,
  };
}
