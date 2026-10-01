import { resolveGeo3DPlacementScope } from "@/modules/geo";
import {
  enginePublishedModelUrl,
  preferredEngineGeoRenderModel,
  project3DLink,
  publishedEngineProject,
} from "@/modules/engine-integration";

async function resolveModel(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() || "";
  if (!projectId) return { error: "Project required", status: 400 as const };

  const scope = await resolveGeo3DPlacementScope(projectId);
  if (!scope) return { error: "Project unavailable", status: 404 as const };

  const link = await project3DLink(scope.platformProject.id);
  if (!link || link.status !== "active")
    return { error: "3D link unavailable", status: 404 as const };

  const engine = await publishedEngineProject(link.engineSlug);
  if (
    !engine?.project ||
    engine.project.status !== "published" ||
    engine.project.id !== link.engineProjectId ||
    !engine.release ||
    !engine.model ||
    engine.model.available === false
  )
    return { error: "Published Engine model unavailable", status: 404 as const };

  const requestedRelease = url.searchParams.get("release")?.trim() || "";
  if (requestedRelease && requestedRelease !== engine.release.id)
    return { error: "Release changed", status: 409 as const };

  const renderModel = preferredEngineGeoRenderModel(engine);
  if (
    !renderModel ||
    renderModel.mimeType !== "model/gltf-binary" ||
    renderModel.available === false ||
    !renderModel.url
  )
    return { error: "Render model unavailable", status: 404 as const };

  const requestedGeo = url.searchParams.get("geo")?.trim() || "";
  const actualGeo =
    engine.geoModel &&
    renderModel === engine.geoModel &&
    typeof engine.geoModel.sha256 === "string"
      ? engine.geoModel.sha256
      : "";
  if (requestedGeo && requestedGeo !== actualGeo)
    return { error: "Geo derivative changed", status: 409 as const };

  const safePublicUrl = enginePublishedModelUrl(renderModel.url);
  if (!safePublicUrl)
    return { error: "Engine model URL invalid", status: 404 as const };

  const parsed = new URL(safePublicUrl);
  if (!parsed.pathname.startsWith("/3Dprojects/api/releases/"))
    return { error: "Immutable release model required", status: 409 as const };

  // admin.rekixo.com/3Dprojects/* is owned by the Engine Admin Worker. Returning
  // a relative Location keeps the browser on the SAME origin while letting the
  // Engine Worker read R2 directly. This avoids both cross-origin Model3D fetches
  // and Platform Worker-to-Worker binary streaming.
  return { sameOriginPath: parsed.pathname + parsed.search };
}

async function redirect(request: Request) {
  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,HEAD,OPTIONS",
        "access-control-allow-headers": "Range",
      },
    });
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, { status: 405 });

  const resolved = await resolveModel(request);
  if ("error" in resolved)
    return Response.json(
      { error: resolved.error },
      { status: resolved.status, headers: { "cache-control": "no-store" } },
    );

  return new Response(null, {
    status: 307,
    headers: {
      location: resolved.sameOriginPath,
      "cache-control": "private,no-store",
      "x-content-type-options": "nosniff",
      "x-rekixo-model-proxy": "same-origin-engine-route",
    },
  });
}

export async function GET(request: Request) {
  return redirect(request);
}

export async function HEAD(request: Request) {
  return redirect(request);
}

export async function OPTIONS(request: Request) {
  return redirect(request);
}
