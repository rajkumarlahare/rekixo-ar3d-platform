import { env } from "cloudflare:workers";

function runtime() {
  return env as unknown as Record<string, unknown>;
}

let cachedBrowserKey: { value: string; expiresAt: number } | null = null;
const MAPS_KEY_CACHE_MS = 5 * 60 * 1000;

export async function publicGoogleMapsBrowserKey() {
  const now = Date.now();
  if (cachedBrowserKey && cachedBrowserKey.expiresAt > now)
    return cachedBrowserKey.value;

  const row = await env.DB.prepare(
    "SELECT value FROM platform_settings WHERE key='google_maps_browser_key' LIMIT 1",
  ).first<{ value: string }>();

  const value =
    String(row?.value || "").trim() ||
    String(runtime().GOOGLE_MAPS_BROWSER_KEY || "").trim();

  cachedBrowserKey = { value, expiresAt: now + MAPS_KEY_CACHE_MS };
  return value;
}
