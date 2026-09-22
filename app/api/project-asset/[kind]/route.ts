import { env } from "cloudflare:workers";
import { getAdminSession } from "@/modules/auth";
import { publicProjectId } from "@/modules/projects";

const PUBLIC_KINDS = new Set(["masterplan", "logo", "shareCard"]);
const ADMIN_KINDS = new Set(["sourcePdf"]);
const SUPER_ADMIN_ONLY = new Set([
  "sourceCad",
  "cadGeometry",
  "plotSheet",
  "masterplanOriginal",
]);

async function activeProjectId(projectId: string) {
  if (!projectId) return null;
  const row = await env.DB.prepare(
    "SELECT id FROM projects WHERE id=? AND status='active' LIMIT 1",
  )
    .bind(projectId)
    .first<{ id: string }>();
  return row?.id || null;
}

async function authorizedProjectId(request: Request) {
  const session = await getAdminSession();
  const requested = new URL(request.url).searchParams.get("projectId");

  // Super Admin works across many tenants. The selected project must always
  // win over the legacy Tiyansh session fallback.
  if (session?.role === "super_admin") {
    return requested ? activeProjectId(requested) : null;
  }

  // Client admins remain hard tenant-scoped.
  if (session?.role === "client_admin") {
    if (requested && requested !== session.projectId) return null;
    return activeProjectId(session.projectId);
  }

  return publicProjectId(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (![...PUBLIC_KINDS, ...ADMIN_KINDS, ...SUPER_ADMIN_ONLY].includes(kind))
    return new Response("Not found", { status: 404 });

  const session = await getAdminSession();
  if (SUPER_ADMIN_ONLY.has(kind) && session?.role !== "super_admin")
    return new Response("Not found", { status: 404 });
  if (ADMIN_KINDS.has(kind) && !session)
    return new Response("Not found", { status: 404 });

  const projectId = await authorizedProjectId(request);
  if (!projectId) return new Response("Not found", { status: 404 });

  const requestUrl = new URL(request.url);
  const wantsPublicMasterplan =
    kind === "masterplan" && requestUrl.searchParams.get("variant") === "public";

  // The mapper always keeps the canonical high-detail object. Public/preview 2D
  // may explicitly request the lighter derivative produced from the SAME upload.
  // The browser checks its aspect ratio before exposing polygons and falls back to
  // canonical if an old/stale derivative is ever encountered.
  const objectKind = wantsPublicMasterplan
    ? "masterplanPublic"
    : kind === "masterplan"
      ? "masterplan"
      : kind;

  let objectKey =
    kind === "shareCard"
      ? `projects/${projectId}/share/card`
      : `projects/${projectId}/mapper/${objectKind}`;

  // New large-masterplan uploads keep the original at a versioned R2 key so a
  // failed replacement can never destroy the previous source. Old projects still
  // resolve the historical stable key with zero migration.
  if (kind === "masterplanOriginal") {
    const pointer = await env.DB.prepare(
      "SELECT value FROM settings WHERE project_id=? AND key='masterplanOriginalObjectToken' LIMIT 1",
    )
      .bind(projectId)
      .first<{ value: string }>();
    const token = String(pointer?.value || "");
    if (/^[a-zA-Z0-9_-]{12,80}$/.test(token)) {
      objectKey = `projects/${projectId}/mapper/masterplanOriginal/${token}`;
    }
  }

  let object = await env.BUCKET.get(objectKey);
  let servedMasterplanSource =
    kind === "masterplan"
      ? wantsPublicMasterplan
        ? "public-optimized"
        : "canonical"
      : objectKind;

  if (!object && wantsPublicMasterplan) {
    object = await env.BUCKET.get(`projects/${projectId}/mapper/masterplan`);
    servedMasterplanSource = "canonical-fallback";
  } else if (!object && kind === "masterplan") {
    object = await env.BUCKET.get(`projects/${projectId}/mapper/masterplanPublic`);
    servedMasterplanSource = "public-fallback";
  }
  if (!object) return new Response("Not found", { status: 404 });

  const previewRequest = requestUrl.searchParams.get("preview") === "1";
  const versionedRequest = requestUrl.searchParams.has("v");
  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType || "application/octet-stream",
    "cache-control":
      session || previewRequest
        ? "no-store"
        : kind === "masterplan" && wantsPublicMasterplan && versionedRequest
          ? "public,max-age=31536000,immutable"
          : kind === "masterplan"
            ? "public,max-age=0,must-revalidate"
          : kind === "shareCard"
            ? versionedRequest
              ? "public,max-age=31536000,immutable"
              : "public,max-age=0,must-revalidate"
            : kind === "logo"
              ? "public,max-age=31536000,immutable"
              : "private,no-store",
    "x-content-type-options": "nosniff",
  });
  headers.set("x-rekixo-project", projectId);
  if (kind === "masterplan") {
    headers.set("x-rekixo-masterplan-source", servedMasterplanSource);
  }
  if (kind === "sourceCad" || kind === "plotSheet" || kind === "masterplanOriginal")
    headers.set("content-disposition", "attachment");
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
