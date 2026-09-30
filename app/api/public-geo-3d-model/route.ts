import { projectBySlug } from "@/modules/public-project";
import { publicSiteEnabled } from "@/modules/public-site-access";
import { resolvePublicGeo3DPlacement } from "@/modules/geo";

function responseHeaders(source: Response) {
  const headers = new Headers();
  headers.set("content-type", source.headers.get("content-type") || "model/gltf-binary");
  headers.set("cache-control", "public,max-age=60,must-revalidate");
  headers.set("x-content-type-options", "nosniff");
  headers.set("access-control-allow-origin", "*");
  const length = source.headers.get("content-length");
  if (length) headers.set("content-length", length);
  const range = source.headers.get("content-range");
  if (range) headers.set("content-range", range);
  const acceptRanges = source.headers.get("accept-ranges");
  if (acceptRanges) headers.set("accept-ranges", acceptRanges);
  return headers;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("projectSlug")?.trim() || "";
  if (!slug) return Response.json({ error: "Project slug required" }, { status: 400 });

  const project = await projectBySlug(slug);
  if (!project || !(await publicSiteEnabled(project.id)))
    return Response.json({ error: "Project unavailable" }, { status: 404 });

  const resolved = await resolvePublicGeo3DPlacement(project.id);
  if (!resolved)
    return Response.json({ error: "Published 3D placement unavailable" }, { status: 404 });

  const headers = new Headers({ Accept: "model/gltf-binary,application/octet-stream;q=0.9" });
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const upstream = await fetch(resolved.sourceModelUrl, {
    method: "GET",
    headers,
    cache: "no-store",
    redirect: "error",
  });
  if (!upstream.ok && upstream.status !== 206)
    return Response.json({ error: "3D model unavailable" }, { status: 502 });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders(upstream),
  });
}

export async function HEAD(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("projectSlug")?.trim() || "";
  if (!slug) return new Response(null, { status: 400 });

  const project = await projectBySlug(slug);
  if (!project || !(await publicSiteEnabled(project.id)))
    return new Response(null, { status: 404 });

  const resolved = await resolvePublicGeo3DPlacement(project.id);
  if (!resolved) return new Response(null, { status: 404 });

  const upstream = await fetch(resolved.sourceModelUrl, {
    method: "HEAD",
    cache: "no-store",
    redirect: "error",
  });
  return new Response(null, {
    status: upstream.status,
    headers: responseHeaders(upstream),
  });
}
