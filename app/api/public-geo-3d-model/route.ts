import { projectBySlug } from "@/modules/public-project";
import { publicSiteEnabled } from "@/modules/public-site-access";
import { resolvePublicGeo3DPlacement } from "@/modules/geo";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("projectSlug")?.trim() || "";
  if (!slug)
    return Response.json({ error: "Project slug required" }, { status: 400 });

  const project = await projectBySlug(slug);
  if (!project || !(await publicSiteEnabled(project.id)))
    return Response.json({ error: "Project unavailable" }, { status: 404 });

  const resolved = await resolvePublicGeo3DPlacement(project.id);
  if (!resolved)
    return Response.json(
      { error: "Published 3D placement unavailable" },
      { status: 404 },
    );

  // Resolve authorization/project state here, then let the browser download the
  // immutable public Engine GLB directly. This removes Worker-to-Worker binary
  // streaming while preserving fail-closed project and release checks.
  return redirectModel(resolved.sourceModelUrl);
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

  return redirectModel(resolved.sourceModelUrl);
}
