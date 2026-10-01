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

export type EngineGeoModel = EnginePublishedModel & {
  variant: "geo-optimized";
  sourceModelId: string;
  sourceSha256?: string;
  sha256?: string;
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
  geoModel?: EngineGeoModel;
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

type EngineServiceFetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type EngineRuntimeConfig = {
  AR3D_ENGINE_ADMIN_ORIGIN?: string;
  AR3D_ENGINE_PUBLIC_ORIGIN?: string;
  AR3D_ENGINE_ADMIN_SERVICE?: EngineServiceFetcher;
  AR3D_ENGINE_PUBLIC_SERVICE?: EngineServiceFetcher;
};

const runtimeConfig = () => env as unknown as EngineRuntimeConfig;

function engineAdminService() {
  const service = runtimeConfig().AR3D_ENGINE_ADMIN_SERVICE;
  return service && typeof service.fetch === "function" ? service : undefined;
}

function enginePublicService() {
  const service = runtimeConfig().AR3D_ENGINE_PUBLIC_SERVICE;
  return service && typeof service.fetch === "function" ? service : undefined;
}

export function engineAdminOrigin() {
  return String(
    runtimeConfig().AR3D_ENGINE_ADMIN_ORIGIN || "https://admin.rekixo.com",
  )
    .trim()
    .replace(/\/$/, "");
}

export function enginePublicOrigin() {
  return String(
    runtimeConfig().AR3D_ENGINE_PUBLIC_ORIGIN || "https://ar3dstudio.in",
  )
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
  service?: EngineServiceFetcher,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init: RequestInit = {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      };
      const response = service
        ? await service.fetch(url, init)
        : await fetch(url, init);
      if (response.ok) return (await response.json()) as EngineStatusPayload;
      // A definite client-side miss will not improve on an immediate retry.
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408
      )
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

function validIntegrationPayload(
  payload: EngineStatusPayload | null,
  clean: string,
) {
  return Boolean(
    validEngineProjectPayload(payload) &&
      payload?.contractVersion === AR3D_INTEGRATION_CONTRACT_VERSION &&
      payload.project.slug === clean,
  );
}

async function fetchAdminIntegrationProject(clean: string) {
  const url = new URL(
    `/3Dprojects/api/integration/projects/${encodeURIComponent(clean)}`,
    engineAdminOrigin(),
  ).toString();

  // Service binding is the primary server-to-server transport. It avoids
  // same-zone Worker routing/DNS coupling while keeping the HTTP contract as
  // the isolation boundary. External HTTPS remains a compatibility fallback.
  const service = engineAdminService();
  if (service) {
    const payload = await fetchEngineJson(url, 5000, 2, service);
    if (validIntegrationPayload(payload, clean)) return payload;
  }

  const payload = await fetchEngineJson(url, 5000, 2);
  return validIntegrationPayload(payload, clean) ? payload : null;
}

async function fetchPublishedRuntimeProject(clean: string) {
  const url = new URL(
    `/3Dprojects/api/projects/${encodeURIComponent(clean)}`,
    enginePublicOrigin(),
  ).toString();

  const service = enginePublicService();
  if (service) {
    const payload = await fetchEngineJson(url, 5000, 2, service);
    if (
      validEngineProjectPayload(payload) &&
      payload?.project?.slug === clean &&
      payload.project.status === "published"
    )
      return payload;
  }

  const payload = await fetchEngineJson(url, 5000, 2);
  if (
    validEngineProjectPayload(payload) &&
    payload?.project?.slug === clean &&
    payload.project.status === "published"
  )
    return payload;
  return null;
}

export async function engineProjectStatus(slug: string) {
  const clean = String(slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return null;

  // Prefer the versioned Engine integration contract. Published projects also
  // have the public runtime as a separate fallback, so existing projects keep
  // working even during a transient Admin Worker or routing failure.
  const adminPayload = await fetchAdminIntegrationProject(clean);
  if (adminPayload) return adminPayload;

  return fetchPublishedRuntimeProject(clean);
}

export function preferredEngineGeoRenderModel(
  engine: EngineStatusPayload | null | undefined,
): EnginePublishedModel | undefined {
  const source = engine?.model;
  if (!source) return undefined;

  const geo = engine?.geoModel;
  if (
    geo?.variant === "geo-optimized" &&
    geo.sourceModelId === source.id &&
    geo.projectId === source.projectId &&
    geo.mimeType === "model/gltf-binary" &&
    geo.available !== false &&
    geo.url
  )
    return geo;

  return source;
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

export function engineSameOriginAdminModelPath(
  modelUrl: string | undefined,
) {
  const safeUrl = enginePublishedModelUrl(modelUrl);
  if (!safeUrl) return null;
  const url = new URL(safeUrl);

  // Super Admin already lives on admin.rekixo.com, where /3Dprojects/* is
  // routed directly to the isolated Engine Admin Worker. Returning only the
  // validated path keeps the browser request same-origin and avoids a second
  // Platform Worker binary hop.
  return `${url.pathname}${url.search}`;
}

export async function publishedEngineProject(slug: string) {
  const clean = String(slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return null;

  // Immutable Studio releases are now part of the additive V1 Admin contract.
  // Prefer that server-to-server result when it proves an active release, then
  // fall back to the public runtime for legacy published Engine projects.
  const integration = await fetchAdminIntegrationProject(clean);
  if (
    integration?.project?.status === "published" &&
    integration.project.slug === clean &&
    integration.release?.id
  )
    return integration;

  return fetchPublishedRuntimeProject(clean);
}

function withEngineModelTransport(
  response: Response,
  transport: "admin-binding" | "public-binding" | "public-https",
) {
  const headers = new Headers(response.headers);
  headers.set("x-rekixo-engine-model-transport", transport);
  headers.set("x-rekixo-engine-model-status", String(response.status));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function fetchEnginePublishedModel(
  modelUrl: string | undefined,
  init: RequestInit = {},
) {
  const safeUrl = enginePublishedModelUrl(modelUrl);
  if (!safeUrl) return null;

  const requestInit: RequestInit = {
    ...init,
    cache: "no-store",
    redirect: "error",
  };
  const pathname = new URL(safeUrl).pathname;
  const immutableReleaseAsset = pathname.startsWith(
    "/3Dprojects/api/releases/",
  );

  const transports: Array<{
    label: "admin-binding" | "public-binding";
    service: EngineServiceFetcher;
  }> = [];
  if (immutableReleaseAsset) {
    const admin = engineAdminService();
    if (admin) transports.push({ label: "admin-binding", service: admin });
  }
  const publicService = enginePublicService();
  if (publicService)
    transports.push({ label: "public-binding", service: publicService });

  // A transport-specific 4xx/5xx must not short-circuit the fallback chain.
  // The Engine asset URL has already been allow-listed above, so success from
  // any isolated transport is equivalent. This matters when one bound Worker
  // does not recognize a route/version that another bound Worker or the public
  // runtime does.
  let lastFailure: Response | null = null;
  for (const { label, service } of transports) {
    try {
      const response = await service.fetch(safeUrl, requestInit);
      if (response.ok || response.status === 206)
        return withEngineModelTransport(response, label);
      await lastFailure?.body?.cancel().catch(() => {});
      lastFailure = withEngineModelTransport(response, label);
    } catch {
      // Continue to the next isolated transport.
    }
  }

  try {
    const response = await fetch(safeUrl, requestInit);
    if (response.ok || response.status === 206) {
      await lastFailure?.body?.cancel().catch(() => {});
      return withEngineModelTransport(response, "public-https");
    }
    await lastFailure?.body?.cancel().catch(() => {});
    return withEngineModelTransport(response, "public-https");
  } catch {
    return lastFailure;
  }
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
