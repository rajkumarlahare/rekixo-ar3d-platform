import { env } from "cloudflare:workers";

export const AR3D_INTEGRATION_CONTRACT_VERSION = 1 as const;

type EngineProject = {
  id: string;
  slug: string;
  name: string;
  location?: string;
  status: "draft" | "published" | "archived";
};

export type EnginePublishedModel = {
  id: string;
  projectId: string;
  name: string;
  version: number;
  mimeType: string;
  byteSize?: number;
  available?: boolean;
  url?: string;
};

export type EnginePublishedRelease = {
  id: string;
  version: number;
  manifestSha256?: string;
  createdAt?: string;
};

export type EngineStatusPayload = {
  contractVersion?: number;
  project: EngineProject;
  enabledSceneCount?: number;
  activeModelAvailable?: boolean;
  model?: EnginePublishedModel;
  release?: EnginePublishedRelease;
};

export type Project3DLink = {
  platformProjectId: string;
  engineProjectId: string;
  engineSlug: string;
  status: "active" | "disabled";
  publicEnabled: boolean;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
};

const cfg = () => env as unknown as Record<string, string>;

export function engineAdminOrigin() {
  return String(cfg().AR3D_ENGINE_ADMIN_ORIGIN || "https://admin.rekixo.com")
    .trim()
    .replace(/\/$/, "");
}

export function enginePublicOrigin() {
  return String(cfg().AR3D_ENGINE_PUBLIC_ORIGIN || "https://ar3dstudio.in")
    .trim()
    .replace(/\/$/, "");
}

export function enginePublicUrl(slug: string) {
  return `${enginePublicOrigin()}/3Dprojects/${encodeURIComponent(slug)}`;
}

export function engineAdminUrl(slug: string, platformProjectId?: string) {
  const url = new URL("/3Dprojects", engineAdminOrigin());
  url.searchParams.set("project", slug);
  if (platformProjectId) url.searchParams.set("platformProject", platformProjectId);
  return url.toString();
}

async function fetchEngineJson(
  url: string,
  timeoutMs = 5000,
  attempts = 2,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok) return (await response.json()) as EngineStatusPayload;
      // A definite client-side miss will not improve on an immediate retry.
      if (response.status >= 400 && response.status < 500 && response.status !== 408)
        return null;
    } catch {
      // A cold Worker, transient network error, or timeout gets one bounded retry.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

function validEngineProjectPayload(payload: EngineStatusPayload | null) {
  return Boolean(
    payload?.project?.id &&
      payload.project.slug &&
      ["draft", "published", "archived"].includes(payload.project.status),
  );
}

export async function engineProjectStatus(slug: string) {
  const clean = String(slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return null;

  // Prefer the Engine Admin integration contract because it can resolve draft
  // projects too. Published projects also have an immutable public release
  // endpoint; use that as a read-only fallback so a transient Admin route/cold
  // start cannot prevent an already-published project from being linked.
  const adminUrl = new URL(
    `/3Dprojects/api/integration/projects/${encodeURIComponent(clean)}`,
    engineAdminOrigin(),
  );
  const adminPayload = await fetchEngineJson(adminUrl.toString());
  const payload = adminPayload;
  if (
    validEngineProjectPayload(payload) &&
    payload?.contractVersion === AR3D_INTEGRATION_CONTRACT_VERSION &&
    payload.project.slug === clean
  )
    return payload;

  const publicPayload = await publishedEngineProject(clean);
  if (
    validEngineProjectPayload(publicPayload) &&
    publicPayload?.project?.slug === clean &&
    publicPayload.project.status === "published"
  )
    return publicPayload;

  return null;
}

export function enginePublishedModelUrl(modelUrl: string | undefined) {
  const raw = String(modelUrl || "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw, enginePublicOrigin());
  } catch {
    return null;
  }
  if (url.origin !== new URL(enginePublicOrigin()).origin) return null;
  if (
    !url.pathname.startsWith("/3Dprojects/api/releases/") &&
    !url.pathname.startsWith("/3Dprojects/api/models/")
  )
    return null;
  return url.toString();
}

export async function publishedEngineProject(slug: string) {
  const clean = String(slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return null;
  const url = new URL(
    `/3Dprojects/api/projects/${encodeURIComponent(clean)}`,
    enginePublicOrigin(),
  );
  return fetchEngineJson(url.toString(), 5000, 2);
}

export async function project3DLink(platformProjectId: string): Promise<Project3DLink | null> {
  const row = await env.DB.prepare(
    `SELECT platform_project_id AS platformProjectId,
            engine_project_id AS engineProjectId,
            engine_slug AS engineSlug,
            status,
            public_enabled AS publicEnabled,
            public_url AS publicUrl,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM project_3d_links
      WHERE platform_project_id=?
      LIMIT 1`,
  )
    .bind(platformProjectId)
    .first<Project3DLink & { publicEnabled: number }>();

  return row ? { ...row, publicEnabled: Boolean(row.publicEnabled) } : null;
}

type PublicProject3DLinkInput = Pick<
  Project3DLink,
  "engineProjectId" | "engineSlug" | "status" | "publicEnabled" | "publicUrl"
>;

async function resolvePublicProject3DLink(link: PublicProject3DLinkInput | null) {
  if (!link || link.status !== "active" || !link.publicEnabled) return null;

  // Fail closed: public Platform UI exposes 3D only while the Engine confirms
  // that the linked project is currently published.
  const engine = await publishedEngineProject(link.engineSlug);
  if (!engine?.project || engine.project.id !== link.engineProjectId) return null;
  if (engine.project.status !== "published") return null;

  return {
    contractVersion: AR3D_INTEGRATION_CONTRACT_VERSION,
    engineProjectId: link.engineProjectId,
    engineSlug: link.engineSlug,
    name: engine.project.name,
    url: link.publicUrl,
  };
}

export async function publicProject3DLink(platformProjectId: string) {
  return resolvePublicProject3DLink(await project3DLink(platformProjectId));
}

export async function publicProject3DLinkFromSnapshot(link: {
  engineProjectId: string | null;
  engineSlug: string | null;
  engineLinkStatus: string | null;
  enginePublicEnabled: number | boolean | null;
  enginePublicUrl: string | null;
}) {
  if (
    !link.engineProjectId ||
    !link.engineSlug ||
    !link.enginePublicUrl
  )
    return null;

  return resolvePublicProject3DLink({
    engineProjectId: link.engineProjectId,
    engineSlug: link.engineSlug,
    status: link.engineLinkStatus === "active" ? "active" : "disabled",
    publicEnabled: Boolean(link.enginePublicEnabled),
    publicUrl: link.enginePublicUrl,
  });
}
