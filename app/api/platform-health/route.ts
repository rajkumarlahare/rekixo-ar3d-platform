import { env } from "cloudflare:workers";
import {
  clientFallbackHost,
  clientPlatformHost,
  requestHost,
  sharedAdminHost,
} from "@/modules/projects";
import { legacyTiyanshFallbackHost } from "@/modules/legacy-compat";
import { getAdminSession } from "@/modules/auth";

export async function GET(request: Request) {
  const session = await getAdminSession();
  const privileged = session?.role === "super_admin" && session.id === "owner";
  return Response.json(
    privileged
      ? {
          ok: true,
          architecture: "rekixo-platform-v5",
          panelMode:
            (env as unknown as Record<string, string>).PANEL_MODE === "super"
              ? "super"
              : "client",
          host: requestHost(request),
          clientFallbackHost: clientFallbackHost() || null,
          legacyFallbackHost: legacyTiyanshFallbackHost() || null,
          platformHost: clientPlatformHost() || null,
          sharedAdminHost: sharedAdminHost() || null,
        }
      : { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
