export const SHARED_ASSET_PREFIX = "/__rekixo";

export function isSharedAssetPath(pathname) {
  return pathname === SHARED_ASSET_PREFIX || pathname.startsWith(`${SHARED_ASSET_PREFIX}/`);
}

export function stripSharedAssetPath(pathname) {
  if (!isSharedAssetPath(pathname)) return pathname;
  return pathname.slice(SHARED_ASSET_PREFIX.length) || "/";
}

export function sharedPublicRuntimeAssetPath(pathname) {
  if (!isSharedAssetPath(pathname)) return null;
  const stripped = stripSharedAssetPath(pathname);
  if (stripped === "/project" || stripped === "/project/") {
    return "/project/index.html";
  }
  if (
    stripped === "/project/index.html" ||
    stripped === "/project/project-geometry.js" ||
    stripped === "/project/three-view.js" ||
    stripped === "/project/plots-data.js"
  ) {
    return stripped;
  }
  return null;
}

export function isPrefixedFrameworkAssetPath(pathname) {
  if (!isSharedAssetPath(pathname)) return false;
  const stripped = stripSharedAssetPath(pathname);
  return stripped.startsWith("/assets/") || stripped.startsWith("/_next/") || stripped.startsWith("/_vinext/");
}

export function rewriteAssetReferences(text) {
  return String(text).replace(
    /(^|[ "'(=<])\/(assets|_next|_vinext)\//gm,
    (_match, prefix, root) => `${prefix}${SHARED_ASSET_PREFIX}/${root}/`,
  );
}

// Shared-domain Next/Vinext responses can be React Flight streams. Buffering one
// of those responses with response.text() can leave the browser waiting forever.
// Rewrite textual bodies incrementally instead, while keeping a small carry-over
// window so an asset reference split across network chunks is still rewritten.
export function rewriteAssetBodyStream(body, carryLength = 128) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let carry = "";

  return body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const decoded = decoder.decode(chunk, { stream: true });
        const input = carry + decoded;
        const splitAt = Math.max(0, input.length - carryLength);

        if (splitAt > 0) {
          controller.enqueue(encoder.encode(rewriteAssetReferences(input.slice(0, splitAt))));
        }
        carry = input.slice(splitAt);
      },
      flush(controller) {
        const tail = carry + decoder.decode();
        controller.enqueue(encoder.encode(rewriteAssetReferences(tail)));
      },
    }),
  );
}

export function shouldRewriteAssetBody(contentType) {
  const type = String(contentType || "").toLowerCase();
  return type.includes("text/html") || type.includes("text/css") || type.includes("javascript") || type.includes("text/x-component") || type.includes("application/json");
}
