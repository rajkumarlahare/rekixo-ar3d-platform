import { requireSuperAdmin } from "@/modules/auth";
import {
  resolveGeo3DPlacementScope,
} from "@/modules/geo";
import {
  enginePublishedModelUrl,
  fetchEnginePublishedModel,
  project3DLink,
  publishedEngineProject,
} from "@/modules/engine-integration";

function proxyHeaders(source: Response, includeLength = true) {
  const headers = new Headers();
  headers.set(
    "content-type",
    source.headers.get("content-type") || "model/gltf-binary",
  );
  headers.set("cache-control", "private,no-store");
  headers.set("x-content-type-options", "nosniff");
  const length = source.headers.get("content-length");
  if (includeLength && length) headers.set("content-length", length);
  const range = source.headers.get("content-range");
  if (range) headers.set("content-range", range);
  const acceptRanges = source.headers.get("accept-ranges");
  if (acceptRanges) headers.set("accept-ranges", acceptRanges);
  return headers;
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

  const headers = new Headers({
    Accept: "model/gltf-binary,application/octet-stream;q=0.9",
  });
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const upstream = await fetchEnginePublishedModel(preview.sourceModelUrl, {
    method: "GET",
    headers,
  });
  if (!upstream)
    return Response.json({ error: "3D preview model unavailable" }, { status: 502 });
  if (!upstream.ok && upstream.status !== 206)
    return Response.json({ error: "3D preview model unavailable" }, { status: 502 });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: proxyHeaders(upstream),
  });
}

export async function HEAD(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return new Response(null, { status: 403 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() || "";
  if (!projectId) return new Response(null, { status: 400 });

  const preview = await resolvePreview(projectId);
  if (!preview) return new Response(null, { status: 404 });

  const upstream = await fetchEnginePublishedModel(preview.sourceModelUrl, {
    method: "HEAD",
  });
  if (!upstream) return new Response(null, { status: 502 });
  return new Response(null, {
    status: upstream.status,
    headers: proxyHeaders(upstream, false),
  });
}
