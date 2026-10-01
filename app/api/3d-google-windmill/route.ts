const WINDMILL_URL =
  "https://maps-docs-team.web.app/assets/windmill.glb";

function responseHeaders(upstream: Response) {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-type", "model/gltf-binary");
  headers.set("cache-control", "public,max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,HEAD,OPTIONS");
  headers.set("access-control-allow-headers", "Range");
  headers.set(
    "access-control-expose-headers",
    "Accept-Ranges,Content-Range,Content-Length,ETag",
  );
  headers.set("x-rekixo-model-proxy", "google-windmill");
  return headers;
}

async function proxy(request: Request) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: responseHeaders(new Response()) });
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, { status: 405 });

  const range = request.headers.get("range");
  const headers = new Headers({ "Accept-Encoding": "identity" });
  if (range) headers.set("Range", range);
  const upstream = await fetch(WINDMILL_URL, {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "follow",
  });

  if (upstream.status !== 200 && upstream.status !== 206) {
    await upstream.body?.cancel().catch(() => {});
    return Response.json(
      { error: "Google windmill proxy upstream unavailable", status: upstream.status },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders(upstream),
  });
}

export async function GET(request: Request) {
  return proxy(request);
}

export async function HEAD(request: Request) {
  return proxy(request);
}

export async function OPTIONS(request: Request) {
  return proxy(request);
}
