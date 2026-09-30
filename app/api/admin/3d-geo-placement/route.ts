import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "@/modules/auth";
import { writeAudit } from "@/modules/audit";
import {
  geo3DPlacementSchemaReady,
  geo3DSuggestedCenter,
  loadGeo3DPlacement,
  resolveGeo3DPlacementScope,
  publicGoogleMapsBrowserKey,
} from "@/modules/geo";
import {
  project3DLink,
  publishedEngineProject,
} from "@/modules/engine-integration";

const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

function finite(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

async function state(projectId: string) {
  const scope = await resolveGeo3DPlacementScope(projectId);
  if (!scope) return { error: "Project nahi mila", status: 404 as const };
  const [placement, link, suggestedCenter, mapsApiKey] = await Promise.all([
    loadGeo3DPlacement(scope.platformProject.id),
    project3DLink(scope.platformProject.id),
    geo3DSuggestedCenter(scope.geoProjectId),
    publicGoogleMapsBrowserKey(),
  ]);
  const engine = link ? await publishedEngineProject(link.engineSlug) : null;
  return {
    schemaReady: await geo3DPlacementSchemaReady(),
    scope: {
      geoProjectId: scope.geoProjectId,
      platformProject: scope.platformProject,
      isGeoLab: scope.isGeoLab,
    },
    placement,
    suggestedCenter,
    maps: {
      enabled: Boolean(mapsApiKey),
      apiKey: mapsApiKey || null,
    },
    link: link
      ? {
          engineProjectId: link.engineProjectId,
          engineSlug: link.engineSlug,
          publicEnabled: link.publicEnabled,
          status: link.status,
        }
      : null,
    engine: engine?.project
      ? {
          project: engine.project,
          model: engine.model
            ? {
                id: engine.model.id,
                name: engine.model.name,
                mimeType: engine.model.mimeType,
                available: engine.model.available !== false,
              }
            : null,
          release: engine.release ?? null,
          previewModelUrl:
            engine.model?.mimeType === "model/gltf-binary" &&
            engine.model.available !== false
              ? `/api/admin/3d-geo-model?projectId=${encodeURIComponent(projectId)}&release=${encodeURIComponent(String(engine.release?.id || ""))}`
              : null,
        }
      : null,
  };
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });
  const result = await state(projectId);
  if ("error" in result)
    return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result, { headers: { "cache-control": "private,no-store" } });
}

export async function PUT(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  if (!(await geo3DPlacementSchemaReady()))
    return Response.json({ error: "Geo 3D placement migration pending hai" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = String(body.projectId || "").trim();
  const scope = await resolveGeo3DPlacementScope(projectId);
  if (!scope)
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  const link = await project3DLink(scope.platformProject.id);
  if (!link || link.status !== "active")
    return Response.json({ error: "Pehle customer project ko 3D Engine se link karein" }, { status: 409 });

  const engine = await publishedEngineProject(link.engineSlug);
  if (
    !engine?.project ||
    engine.project.status !== "published" ||
    engine.project.id !== link.engineProjectId ||
    !engine.release ||
    !engine.model ||
    engine.model.available === false
  )
    return Response.json({ error: "Published Engine release/model available nahi hai" }, { status: 409 });

  const longitude = finite(body.longitude, -180, 180);
  const latitude = finite(body.latitude, -90, 90);
  const altitudeM = finite(body.altitudeM ?? 0, -1000, 10000);
  const headingDeg = finite(body.headingDeg ?? 0, -3600, 3600);
  const pitchDeg = finite(body.pitchDeg ?? 0, -360, 360);
  const rollDeg = finite(body.rollDeg ?? 0, -360, 360);
  const scale = finite(body.scale ?? 1, 0.001, 1000);
  const publicEnabled = Boolean(body.publicEnabled);

  if ([longitude, latitude, altitudeM, headingDeg, pitchDeg, rollDeg, scale].some((value) => value === null))
    return Response.json({ error: "3D placement values invalid hain" }, { status: 400 });

  if (publicEnabled && !link.publicEnabled)
    return Response.json({ error: "Pehle 3D Engine public experience enable karein" }, { status: 409 });
  if (publicEnabled && engine.model.mimeType !== "model/gltf-binary")
    return Response.json(
      { error: "Customer Geo 3D ke liye published Engine model GLB hona chahiye" },
      { status: 409 },
    );

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO geo_3d_placements (
      platform_project_id,geo_project_id,engine_project_id,engine_slug,
      engine_release_id,engine_release_version,engine_model_id,
      longitude,latitude,altitude_m,heading_deg,pitch_deg,roll_deg,scale,
      public_enabled,updated_by,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(platform_project_id) DO UPDATE SET
      geo_project_id=excluded.geo_project_id,
      engine_project_id=excluded.engine_project_id,
      engine_slug=excluded.engine_slug,
      engine_release_id=excluded.engine_release_id,
      engine_release_version=excluded.engine_release_version,
      engine_model_id=excluded.engine_model_id,
      longitude=excluded.longitude,
      latitude=excluded.latitude,
      altitude_m=excluded.altitude_m,
      heading_deg=excluded.heading_deg,
      pitch_deg=excluded.pitch_deg,
      roll_deg=excluded.roll_deg,
      scale=excluded.scale,
      public_enabled=excluded.public_enabled,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at`,
  )
    .bind(
      scope.platformProject.id,
      scope.geoProjectId,
      link.engineProjectId,
      link.engineSlug,
      engine.release.id,
      Number(engine.release.version),
      engine.model.id,
      longitude,
      latitude,
      altitudeM,
      headingDeg,
      pitchDeg,
      rollDeg,
      scale,
      publicEnabled ? 1 : 0,
      actor.email,
      now,
      now,
    )
    .run();

  await writeAudit(actor, "geo.3d_placement_saved", scope.platformProject.id, engine.model.id, {
    geoProjectId: scope.geoProjectId,
    engineSlug: link.engineSlug,
    releaseId: engine.release.id,
    releaseVersion: Number(engine.release.version),
    publicEnabled,
  });

  return Response.json(await state(projectId), {
    headers: { "cache-control": "private,no-store" },
  });
}

export async function DELETE(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  const scope = await resolveGeo3DPlacementScope(projectId);
  if (!scope)
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  if (await geo3DPlacementSchemaReady()) {
    await env.DB.prepare("DELETE FROM geo_3d_placements WHERE platform_project_id=?")
      .bind(scope.platformProject.id)
      .run();
  }
  await writeAudit(actor, "geo.3d_placement_removed", scope.platformProject.id, null, {
    geoProjectId: scope.geoProjectId,
  });
  return Response.json({ ok: true });
}
