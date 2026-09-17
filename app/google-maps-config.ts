import { env } from "cloudflare:workers";

function runtime() {
  return env as unknown as Record<string, unknown>;
}

export async function publicGoogleMapsBrowserKey() {
  const row = await env.DB.prepare(
    "SELECT value FROM platform_settings WHERE key='google_maps_browser_key' LIMIT 1",
  ).first<{ value: string }>();

  return (
    String(row?.value || "").trim() ||
    String(runtime().GOOGLE_MAPS_BROWSER_KEY || "").trim()
  );
}
