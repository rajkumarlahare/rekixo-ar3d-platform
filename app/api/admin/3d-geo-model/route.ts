import { requireSuperAdmin } from "@/modules/auth";
import {
  resolveGeo3DPlacementScope,
} from "@/modules/geo";
import {
  enginePublishedModelUrl,
  project3DLink,
  publishedEngineProject,
} from "@/modules/engine-integration";

function redirectModel(sourceModelUrl: string) {
  return new Response(null, {
    status: 307,
    headers: {
      location: sourceModelUrl,
      "cache-control": "private,no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function resolvePreview(projectId: string) {
  const scope = await resolveGeo3DPlacementScope(projectId);
  if (!scope) return null;

  const link = await project3DLink(scope.platformProject.id);
  if (!link || link.status !== "active") return null;

  const engine = await publishedEngineProject(link.engineSlug);
  if (
    !engine?.project ||
    engine.project.status !== "published" ||
    engine.project.id !== link.engineProjectId ||
    !engine.release ||
    !engine.model ||
    engine.model.available === false ||
    engine.model.mimeType !== "model/gltf-binary"
  )
    return null;

  const sourceModelUrl = enginePublishedModelUrl(engine.model.url);
  if (!sourceModelUrl) return null;
  return { sourceModelUrl };
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor)
    return Response.json(
      { error: "Super Admin access required" },
      { status: 403 },
    );

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() || "";
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });

  const preview = await resolvePreview(projectId);
  if (!preview)
    return Response.json(
      { error: "Published linked GLB preview unavailable" },
      { status: 404 },
    );

  // The immutable Engine release asset is already public and checksum-pinned.
  // Redirect the browser instead of streaming 25+ MB through another Worker.
  // Engine CORS + Range support keeps Google Maps 3D and browser probes working.
  return redirectModel(preview.sourceModelUrl);
}

export async function HEAD(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return new Response(null, { status: 403 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() || "";
  if (!projectId) return new Response(null, { status: 400 });

  const preview = await resolvePreview(projectId);
  if (!preview) return new Response(null, { status: 404 });

  return redirectModel(preview.sourceModelUrl);
}
