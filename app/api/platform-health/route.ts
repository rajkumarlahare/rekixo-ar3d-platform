import { env } from "cloudflare:workers";
import {
  clientFallbackHost,
  clientPlatformHost,
  requestHost,
  sharedAdminHost,
} from "@/modules/projects";
import { legacyTiyanshFallbackHost } from "@/modules/legacy-compat";

export async function GET(request: Request) {
  return Response.json(
    {
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
    },
    { headers: { "cache-control": "no-store" } },
  );
}
