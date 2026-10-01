import { resolveGeo3DPlacementScope } from "@/modules/geo";
import {
  fetchEnginePublishedModel,
  preferredEngineGeoRenderModel,
  project3DLink,
  publishedEngineProject,
} from "@/modules/engine-integration";

function forwardedHeaders(upstream: Response) {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
    "x-rekixo-sha256",
    "x-rekixo-engine-model-transport",
    "x-rekixo-engine-model-status",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-type", "model/gltf-binary");
  headers.set("cache-control", "public,max-age=31536000,immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,HEAD,OPTIONS");
  headers.set("access-control-allow-headers", "Range");
  headers.set(
    "access-control-expose-headers",
    "Accept-Ranges,Content-Range,Content-Length,ETag,X-Rekixo-SHA256,X-Rekixo-Engine-Model-Transport",
  );
  headers.set("x-rekixo-model-proxy", "same-origin-engine");
  return headers;
}

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

  return { modelUrl: renderModel.url };
}

async function proxy(request: Request) {
  if (request.method === "OPTIONS") {
    const headers = forwardedHeaders(new Response());
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, { status: 405 });

  const resolved = await resolveModel(request);
  if ("error" in resolved)
    return Response.json(
      { error: resolved.error },
      { status: resolved.status, headers: { "cache-control": "no-store" } },
    );

  const range = request.headers.get("range");
  const upstream = await fetchEnginePublishedModel(resolved.modelUrl, {
    method: request.method,
    headers: range ? { Range: range } : undefined,
  });

  if (!upstream || (upstream.status !== 200 && upstream.status !== 206)) {
    const status = upstream?.status || 502;
    await upstream?.body?.cancel().catch(() => {});
    return Response.json(
      { error: "Engine model proxy unavailable", upstreamStatus: status },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardedHeaders(upstream),
  });
}

export async function GET(request: Request) {
  return proxy(request);
}

export async function HEAD(request: Request) {
  return proxy(request);
}

export async function OPTIONS(request: Request) {
  return proxy(request);
}
