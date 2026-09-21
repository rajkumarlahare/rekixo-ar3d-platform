import { env } from "cloudflare:workers";
import { normalizeHost } from "./domain-utils";

export const LEGACY_TIYANSH_PROJECT_ID = "tiyansh-prime-square";
export const PLATFORM_ADMIN_SCOPE_ID = "__rekixo_platform__";

const cfg = () => env as unknown as Record<string, string>;

export function legacyTiyanshFallbackHost() {
  return normalizeHost(
    cfg().LEGACY_FALLBACK_HOST || "tiyansh-prime-square.ai-8f3.workers.dev",
  );
}

export function isLegacyTiyanshProject(projectId: string | null | undefined) {
  return String(projectId || "").trim() === LEGACY_TIYANSH_PROJECT_ID;
}

export function isLegacyTiyanshHost(hostValue: string | null | undefined) {
  const host = normalizeHost(hostValue || "");
  return Boolean(host && host === legacyTiyanshFallbackHost());
}

export function legacyTiyanshClientHostAllowed(
  projectId: string,
  hostValue: string | null | undefined,
) {
  return isLegacyTiyanshProject(projectId) && isLegacyTiyanshHost(hostValue);
}
