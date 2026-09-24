import { env } from "cloudflare:workers";
import { projectBySlug } from "../../../../project-context";
import {
  publicSiteEnabled,
  publicSiteUnavailableResponse,
} from "@/modules/public-site-access";

type RouteParams = Promise<{ slug: string; version: string }>;

function validVersion(value: string) {
  return /^\d{1,20}$/.test(value);
}

async function shareAsset(slug: string, version: string) {
  if (!validVersion(version)) return { object: null, disabled: false };

  const project = await projectBySlug(slug);
  if (!project) return { object: null, disabled: false };
  if (!(await publicSiteEnabled(project.id))) {
    return { object: null, disabled: true };
  }

  const snapshot = await env.DB.prepare(
    "SELECT 1 AS ok FROM project_public_snapshots WHERE project_id=? LIMIT 1",
  )
    .bind(project.id)
    .first<{ ok: number }>();
  const rows = snapshot
    ? await env.DB.prepare(
        "SELECT key,value FROM published_settings WHERE project_id=? AND key IN ('shareImage','shareVersion')",
      )
        .bind(project.id)
        .all<{ key: string; value: string }>()
    : await env.DB.prepare(
        "SELECT key,value FROM settings WHERE project_id=? AND key IN ('shareImage','shareVersion')",
      )
        .bind(project.id)
        .all<{ key: string; value: string }>();

  const settings = Object.fromEntries(
    (rows.results || []).map((row) => [row.key, row.value]),
  );
  const currentVersion = String(settings.shareVersion || "1");
  const versionedKey = `projects/${project.id}/share/cards/${version}`;

  let object = await env.BUCKET.get(versionedKey);

  // Backward-compatible self-heal for the share image that existed before
  // versioned R2 snapshots were introduced. Only the currently published
  // version may be copied from the canonical object.
  if (!object && settings.shareImage && version === currentVersion) {
    const canonical = await env.BUCKET.get(
      `projects/${project.id}/share/card`,
    );
    if (!canonical) return { object: null, disabled: false };

    const bytes = await canonical.arrayBuffer();
    const contentType =
      canonical.httpMetadata?.contentType || "application/octet-stream";

    await env.BUCKET.put(versionedKey, bytes, {
      httpMetadata: { contentType },
      customMetadata: {
        source: "share-card-snapshot",
        version,
      },
    });

    object = await env.BUCKET.get(versionedKey);
  }

  return { object, disabled: false };
}

function responseHeaders(object: R2ObjectBody) {
  const headers = new Headers({
    "content-type":
      object.httpMetadata?.contentType || "application/octet-stream",
    "content-length": String(object.size),
    "content-disposition": "inline",
    "cache-control": "public,max-age=31536000,immutable",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "cross-origin",
    "access-control-allow-origin": "*",
  });

  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return headers;
}

async function resolve(params: RouteParams) {
  const { slug, version } = await params;
  return shareAsset(slug, version);
}

export async function GET(
  _request: Request,
  { params }: { params: RouteParams },
) {
  const result = await resolve(params);
  if (result.disabled) return publicSiteUnavailableResponse();
  if (!result.object) return new Response("Not found", { status: 404 });

  return new Response(result.object.body, {
    status: 200,
    headers: responseHeaders(result.object),
  });
}

export async function HEAD(
  _request: Request,
  { params }: { params: RouteParams },
) {
  const result = await resolve(params);
  if (result.disabled) return publicSiteUnavailableResponse();
  if (!result.object) return new Response(null, { status: 404 });

  return new Response(null, {
    status: 200,
    headers: responseHeaders(result.object),
  });
}
