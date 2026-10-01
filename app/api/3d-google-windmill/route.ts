const WINDMILL_URL =
  "https://maps-docs-team.web.app/assets/windmill.glb";

function responseHeaders(upstream: Response) {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-encoding",
    "etag",
    "last-modified",
    "vary",
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
    "Content-Length,Content-Encoding,ETag,X-Rekixo-Upstream-Content-Encoding",
  );
  headers.set(
    "x-rekixo-upstream-content-encoding",
    upstream.headers.get("content-encoding") || "identity",
  );
  headers.set("x-rekixo-model-proxy", "google-windmill");
  return headers;
}

async function proxy(request: Request) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: responseHeaders(new Response()) });
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, { status: 405 });

  // Do not forward byte ranges to this cross-zone diagnostic asset. Cloudflare
  // may negotiate a compressed representation for Worker subrequests even when
  // identity is requested. Returning the complete encoded representation while
  // preserving Content-Encoding lets the browser decode it correctly before
  // Model3DElement consumes it.
  const upstream = await fetch(WINDMILL_URL, {
    method: request.method,
    headers: { "Accept-Encoding": "identity" },
    cache: "no-store",
    redirect: "follow",
  });

  if (upstream.status !== 200) {
    await upstream.body?.cancel().catch(() => {});
    return Response.json(
      { error: "Google windmill proxy upstream unavailable", status: upstream.status },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: 200,
    statusText: "OK",
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
