import { env } from "cloudflare:workers";

export const PUBLIC_SITE_SETTING = "publicSiteEnabled";

export async function publicSiteEnabled(projectId: string) {
  if (!projectId) return false;
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE project_id=? AND key=? LIMIT 1",
  )
    .bind(projectId, PUBLIC_SITE_SETTING)
    .first<{ value: string }>();

  // Missing setting intentionally means ON for backward compatibility.
  return row?.value !== "0";
}

export function publicSiteUnavailableHeaders() {
  return {
    "cache-control": "no-store",
    "retry-after": "60",
    "x-rekixo-public-access": "disabled",
  };
}

export function publicSiteUnavailableResponse() {
  return Response.json(
    {
      error: "Project temporarily unavailable",
      code: "PROJECT_TEMPORARILY_UNAVAILABLE",
    },
    {
      status: 503,
      headers: publicSiteUnavailableHeaders(),
    },
  );
}
