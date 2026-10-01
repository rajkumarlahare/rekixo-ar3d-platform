import { requireSuperAdmin } from "@/modules/auth";
import { publicGoogleMapsBrowserKey } from "@/modules/geo";

const allowedVersions = new Set(["3.65", "3.66", "beta", "weekly"]);

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private,no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return html("<p>Super Admin access required</p>", 403);

  const requested =
    new URL(request.url).searchParams.get("v")?.trim() || "3.65";
  const version = allowedVersions.has(requested) ? requested : "3.65";
  const apiKey = await publicGoogleMapsBrowserKey();
  if (!apiKey) return html("<p>Google Maps browser key missing</p>", 503);

  const scriptUrl =
    "https://maps.googleapis.com/maps/api/js?key=" +
    encodeURIComponent(apiKey) +
    "&v=" +
    encodeURIComponent(version) +
    "&loading=async&libraries=maps3d&callback=__rekixoProbeReady";

  const safeVersion = escapeHtml(version);
  const scriptJson = JSON.stringify(scriptUrl);

  return html(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Maps 3D Probe ${safeVersion}</title>
<style>
html,body{height:100%;margin:0;background:#02070d;color:#dbe8f6;font:12px system-ui,sans-serif;overflow:hidden}
gmp-map-3d{position:absolute;inset:0;width:100%;height:100%}
#status{position:absolute;z-index:3;left:10px;top:10px;max-width:calc(100% - 20px);padding:7px 9px;border:1px solid #33506c;border-radius:8px;background:rgba(7,17,30,.88);backdrop-filter:blur(6px)}
#status.error{border-color:#9a563b;color:#ffd0b9}
</style>
</head>
<body>
<div id="status">Maps JS ${safeVersion} · loading Google windmill through same-origin proxy…</div>
<script>
window.__rekixoProbeReady = async function () {
  const status = document.getElementById("status");
  try {
    const { Map3DElement, Model3DElement } =
      await google.maps.importLibrary("maps3d");

    const map = new Map3DElement({
      center: { lat: 39.1178, lng: -106.4452, altitude: 4395.4952 },
      range: 1500,
      tilt: 74,
      heading: 0,
      mode: "HYBRID",
    });

    const response = await fetch(
      "/api/3d-google-windmill?transport=decoded-v2",
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error("windmill proxy HTTP " + response.status);
    const bytes = await response.arrayBuffer();
    const magic = new TextDecoder().decode(new Uint8Array(bytes, 0, 4));
    if (magic !== "glTF")
      throw new Error("windmill proxy returned invalid GLB bytes");
    const objectUrl = URL.createObjectURL(
      new Blob([bytes], { type: "model/gltf-binary" }),
    );

    const model = new Model3DElement({
      src: objectUrl,
      position: { lat: 39.1178, lng: -106.4452, altitude: 4495.4952 },
      orientation: { heading: 0, tilt: 270, roll: 90 },
      scale: 0.15,
      altitudeMode: "CLAMP_TO_GROUND",
    });

    document.body.append(map);
    map.append(model);
    status.textContent =
      "requested ${safeVersion} · runtime " +
      String(google.maps.version || "unknown") +
      " · gmp-model-3d attached · blob GLB " +
      String(bytes.byteLength) +
      " bytes";
  } catch (error) {
    status.className = "error";
    status.textContent =
      "probe error: " +
      (error instanceof Error ? error.message : String(error));
  }
};

const script = document.createElement("script");
script.async = true;
script.defer = true;
script.onerror = function () {
  const status = document.getElementById("status");
  status.className = "error";
  status.textContent = "Maps JavaScript API script load failed";
};
script.src = ${scriptJson};
document.head.appendChild(script);
</script>
</body>
</html>`);
}
