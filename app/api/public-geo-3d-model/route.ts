import { projectBySlug } from "@/modules/public-project";
import { publicSiteEnabled } from "@/modules/public-site-access";
import { resolvePublicGeo3DPlacement } from "@/modules/geo";
import { fetchEnginePublishedModel } from "@/modules/engine-integration";

function modelHeaders(upstream: Response) {
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
  headers.set("x-rekixo-model-proxy", "public-geo");
  return headers;
}

async function resolveModel(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("projectSlug")?.trim() || "";
  if (!slug) return { error: "Project slug required", status: 400 as const };

  const project = await projectBySlug(slug);
  if (!project || !(await publicSiteEnabled(project.id)))
    return { error: "Project unavailable", status: 404 as const };

  const resolved = await resolvePublicGeo3DPlacement(project.id);
  if (!resolved)
    return {
      error: "Published 3D placement unavailable",
      status: 404 as const,
    };

  return { sourceModelUrl: resolved.sourceModelUrl };
}

async function proxy(request: Request) {
  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: modelHeaders(new Response()),
    });
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, { status: 405 });

  const resolved = await resolveModel(request);
  if ("error" in resolved)
    return Response.json(
      { error: resolved.error },
      { status: resolved.status, headers: { "cache-control": "no-store" } },
    );

  const range = request.headers.get("range");
  const upstream = await fetchEnginePublishedModel(resolved.sourceModelUrl, {
    method: request.method,
    headers: range ? { Range: range } : undefined,
  });

  if (!upstream || (upstream.status !== 200 && upstream.status !== 206)) {
    const upstreamStatus = upstream?.status || 502;
    await upstream?.body?.cancel().catch(() => {});
    return Response.json(
      { error: "Published 3D model proxy unavailable", upstreamStatus },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: modelHeaders(upstream),
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
