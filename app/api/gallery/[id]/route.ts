import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/modules/db";
import { gallery } from "@/modules/db/schema";
import { publicProjectId } from "@/modules/projects";
import {
  publicSiteEnabled,
  publicSiteUnavailableResponse,
} from "@/modules/public-site-access";
import { getAdminSession } from "@/modules/auth";

async function activeProjectId(projectId: string) {
  if (!projectId) return null;
  const row = await env.DB.prepare(
    "SELECT id FROM projects WHERE id=? AND status='active' LIMIT 1",
  )
    .bind(projectId)
    .first<{ id: string }>();
  return row?.id || null;
}

type GalleryAccess = {
  projectId: string;
  mode: "admin" | "public";
};

async function galleryAccess(request: Request): Promise<GalleryAccess | null> {
  const session = await getAdminSession();
  const url = new URL(request.url);
  const requested = url.searchParams.get("projectId");
  const explicitPublic = url.searchParams.get("public") === "1";

  // Resolve published public identity independently from any admin cookie.
  const publicId = await publicProjectId(request);

  if (explicitPublic) {
    return publicId ? { projectId: publicId, mode: "public" } : null;
  }

  if (session?.role === "super_admin") {
    const projectId = requested ? await activeProjectId(requested) : null;
    return projectId ? { projectId, mode: "admin" } : null;
  }

  if (session?.role === "client_admin") {
    if (
      publicId &&
      publicId !== session.projectId &&
      (!requested || requested === publicId)
    ) {
      return { projectId: publicId, mode: "public" };
    }
    if (requested && requested !== session.projectId) return null;
    const projectId = await activeProjectId(session.projectId);
    return projectId ? { projectId, mode: "admin" } : null;
  }

  return publicId ? { projectId: publicId, mode: "public" } : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const access = await galleryAccess(request);
    if (!access) return new Response("Not found", { status: 404 });
    const { projectId, mode } = access;
    if (mode === "public" && !(await publicSiteEnabled(projectId))) {
      return publicSiteUnavailableResponse();
    }
    const [item] = await getDb()
      .select()
      .from(gallery)
      .where(and(eq(gallery.projectId, projectId), eq(gallery.id, id)))
      .limit(1);
    if (!item) return new Response("Not found", { status: 404 });
    const object = await env.BUCKET.get(item.objectKey);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "content-type": item.contentType,
      "cache-control":
        mode === "public"
          ? "public, max-age=300, must-revalidate"
          : "private, no-store",
      "x-content-type-options": "nosniff",
    });
    headers.set("x-rekixo-project", projectId);
    headers.set("x-rekixo-access-mode", mode);
    if (object.httpEtag) headers.set("etag", object.httpEtag);
    if (object.size) headers.set("content-length", String(object.size));
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Gallery image load failed", error);
    return new Response("Image load nahi hui", { status: 500 });
  }
}
