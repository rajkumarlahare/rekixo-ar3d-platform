"use client";

import { useEffect } from "react";
import {
  edgeIndexForDisplayDirection,
  type EdgeDirection,
  type QuarterTurn,
} from "./plot-edge-semantics";
import { serializePlotSideSemantics } from "./plot-side-semantics";

type UploadKind =
  | "masterplan"
  | "logo"
  | "sourceCad"
  | "plotSheet"
  | "roadAccessSheet"
  | "sideMappingSheet"
  | "sourcePdf";

type SideConfig = {
  directions: Record<string, EdgeDirection>;
  rotation: QuarterTurn;
  expiresAt: number;
};

type MapperPlotPayload = {
  id?: unknown;
  polygon?: unknown;
  frontEdgeIndex?: unknown;
  backEdgeIndex?: unknown;
  depthEdgeIndex?: unknown;
  depth2EdgeIndex?: unknown;
  edgeSemantics?: unknown;
  [key: string]: unknown;
};

const UPLOAD_KINDS = new Set<UploadKind>([
  "masterplan",
  "logo",
  "sourceCad",
  "plotSheet",
  "roadAccessSheet",
  "sideMappingSheet",
  "sourcePdf",
]);

const CARD_NEEDLES: Record<UploadKind, string[]> = {
  masterplan: ["masterplan"],
  logo: ["project logo"],
  sourceCad: ["cad source", "dwg / dxf", "dwg/dxf"],
  plotSheet: ["plot inventory", "plot details sheet"],
  roadAccessSheet: ["road access"],
  sideMappingSheet: ["side mapping"],
  sourcePdf: ["technical pdf", "pdf reference"],
};

function parseUploadKind(value: FormDataEntryValue | null): UploadKind | null {
  const kind = String(value || "") as UploadKind;
  return UPLOAD_KINDS.has(kind) ? kind : null;
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return new URL(input, window.location.href);
  if (input instanceof URL) return new URL(input.href);
  return new URL(input.url, window.location.href);
}

function findUploadCard(kind: UploadKind) {
  const needles = CARD_NEEDLES[kind];
  return Array.from(
    document.querySelectorAll<HTMLLabelElement>("label.mapper-upload-card"),
  ).find((card) => {
    const text = String(card.textContent || "").toLowerCase();
    return needles.some((needle) => text.includes(needle));
  });
}

function resetCardClasses(card: HTMLLabelElement) {
  card.classList.remove(
    "rekixo-upload-active",
    "rekixo-upload-server",
    "rekixo-upload-done",
    "rekixo-upload-error",
  );
}

function setUploadCard(
  kind: UploadKind,
  state: "uploading" | "server" | "done" | "error",
  progress: number,
  label: string,
) {
  const card = findUploadCard(kind);
  if (!card) return;
  resetCardClasses(card);
  card.classList.add("rekixo-upload-active", `rekixo-upload-${state}`);
  card.style.setProperty(
    "--rekixo-upload-progress",
    `${Math.max(0, Math.min(100, progress)).toFixed(1)}%`,
  );
  card.dataset.rekixoUploadLabel = label;
}

function clearUploadCard(kind: UploadKind, delay = 0) {
  window.setTimeout(() => {
    const card = findUploadCard(kind);
    if (!card) return;
    resetCardClasses(card);
    card.style.removeProperty("--rekixo-upload-progress");
    delete card.dataset.rekixoUploadLabel;
  }, delay);
}

function parsePolygon(value: unknown) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length < 4 || parsed.length > 80) return null;
    const points: [number, number][] = [];
    for (const point of parsed) {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !Number.isFinite(Number(point[0])) ||
        !Number.isFinite(Number(point[1]))
      )
        return null;
      points.push([Number(point[0]), Number(point[1])]);
    }
    return points;
  } catch {
    return null;
  }
}

function alreadyHasSideSemantics(plot: MapperPlotPayload) {
  if (String(plot.edgeSemantics || "").trim()) return true;
  return [
    plot.frontEdgeIndex,
    plot.backEdgeIndex,
    plot.depthEdgeIndex,
    plot.depth2EdgeIndex,
  ].some((value) => value !== null && value !== undefined && String(value).trim() !== "");
}

function withStoredSideMapping(
  plot: MapperPlotPayload,
  config: SideConfig,
): MapperPlotPayload {
  if (alreadyHasSideSemantics(plot)) return plot;
  const id = String(plot.id || "").trim();
  const direction = config.directions[id];
  if (!direction) return plot;

  const polygon = parsePolygon(plot.polygon);
  if (!polygon) return plot;

  const opposite: Record<EdgeDirection, EdgeDirection> = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right",
  };
  const depthDirections: Record<EdgeDirection, [EdgeDirection, EdgeDirection]> = {
    top: ["right", "left"],
    right: ["bottom", "top"],
    bottom: ["left", "right"],
    left: ["top", "bottom"],
  };
  const [depthADirection, depthBDirection] = depthDirections[direction];
  const front = edgeIndexForDisplayDirection(polygon, direction, config.rotation);
  const back = edgeIndexForDisplayDirection(polygon, opposite[direction], config.rotation);
  const depthA = edgeIndexForDisplayDirection(polygon, depthADirection, config.rotation);
  const depthB = edgeIndexForDisplayDirection(polygon, depthBDirection, config.rotation);
  const selected = [front, back, depthA, depthB];
  if (selected.some((edge) => edge == null) || new Set(selected).size !== 4) return plot;

  return {
    ...plot,
    frontEdgeIndex: front!,
    backEdgeIndex: back!,
    depthEdgeIndex: depthA!,
    depth2EdgeIndex: depthB!,
    edgeSemantics: serializePlotSideSemantics(polygon.length, {
      front: [front!],
      back: [back!],
      depthA: [depthA!],
      depthB: [depthB!],
    }),
  };
}

function responseHeaders(xhr: XMLHttpRequest) {
  const headers = new Headers();
  const raw = xhr.getAllResponseHeaders().trim();
  if (!raw) return headers;
  for (const line of raw.split(/[\r\n]+/)) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    headers.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
  }
  return headers;
}

export default function MapperUploadProgressBridge() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.rekixoMapperUploadProgress = "true";
    style.textContent = `
      .mapper-upload-card.rekixo-upload-active{overflow:hidden}
      .mapper-upload-card.rekixo-upload-active::after{
        content:"";position:absolute;left:0;bottom:0;height:4px;width:var(--rekixo-upload-progress,0%);
        background:linear-gradient(90deg,#18c97d,#5ef0ad);box-shadow:0 0 10px #23d98a99;
        transition:width .12s linear;z-index:6;pointer-events:none
      }
      .mapper-upload-card.rekixo-upload-active::before{
        content:attr(data-rekixo-upload-label);position:absolute;right:8px;bottom:6px;z-index:7;
        max-width:78%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        padding:2px 6px;border-radius:5px;background:#06101fe8;color:#c8f7e2;
        font-size:9px;font-weight:900;letter-spacing:.02em;pointer-events:none
      }
      .mapper-upload-card.rekixo-upload-server::after{
        width:100%;background:linear-gradient(90deg,#18c97d 0%,#7af7be 45%,#18c97d 90%);
        background-size:180% 100%;animation:rekixo-real-upload-server .85s linear infinite
      }
      .mapper-upload-card.rekixo-upload-done::after{width:100%;background:#2bd98b}
      .mapper-upload-card.rekixo-upload-error::after{width:100%;background:#ff5967;box-shadow:0 0 10px #ff596788}
      .mapper-upload-card.rekixo-upload-error::before{color:#ffd8dc}
      @keyframes rekixo-real-upload-server{from{background-position:120% 0}to{background-position:-80% 0}}
      @media(prefers-reduced-motion:reduce){.mapper-upload-card.rekixo-upload-server::after{animation:none}}
    `;
    document.head.appendChild(style);

    const nativeFetch: typeof window.fetch = window.fetch.bind(window);
    const sideCache = new Map<string, SideConfig>();

    const loadSideConfig = async (projectId: string) => {
      const cached = sideCache.get(projectId);
      if (cached && cached.expiresAt > Date.now()) return cached;
      try {
        const response = await nativeFetch(
          `/api/super-mapper-side-mapping?projectId=${encodeURIComponent(projectId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return null;
        const data = (await response.json()) as {
          directions?: Record<string, EdgeDirection>;
          rotation?: number;
        };
        const rotation: QuarterTurn =
          data.rotation === 1 || data.rotation === 2 || data.rotation === 3
            ? data.rotation
            : 0;
        const config: SideConfig = {
          directions: data.directions || {},
          rotation,
          expiresAt: Date.now() + 30_000,
        };
        sideCache.set(projectId, config);
        return config;
      } catch {
        return null;
      }
    };

    const patchMapperJsonBody = async (body: string) => {
      let payload: {
        projectId?: unknown;
        plot?: MapperPlotPayload;
        plots?: MapperPlotPayload[];
        [key: string]: unknown;
      };
      try {
        payload = JSON.parse(body);
      } catch {
        return body;
      }

      const projectId = String(payload.projectId || "").trim();
      if (!projectId || (!payload.plot && !Array.isArray(payload.plots))) return body;
      const config = await loadSideConfig(projectId);
      if (!config || !Object.keys(config.directions).length) return body;

      let changed = false;
      const patchOne = (plot: MapperPlotPayload) => {
        const next = withStoredSideMapping(plot, config);
        if (next !== plot) changed = true;
        return next;
      };
      const nextPayload = {
        ...payload,
        ...(payload.plot ? { plot: patchOne(payload.plot) } : {}),
        ...(Array.isArray(payload.plots) ? { plots: payload.plots.map(patchOne) } : {}),
      };
      return changed ? JSON.stringify(nextPayload) : body;
    };

    const xhrUpload = (
      input: RequestInfo | URL,
      init: RequestInit,
      data: FormData,
      kind: UploadKind,
    ) =>
      new Promise<Response>((resolve, reject) => {
        const incomingUrl = requestUrl(input);
        const targetUrl =
          kind === "sideMappingSheet"
            ? new URL("/api/super-mapper-side-mapping", window.location.href)
            : incomingUrl;
        const projectId = String(data.get("projectId") || "");
        const xhr = new XMLHttpRequest();
        xhr.open(String(init.method || "POST"), targetUrl.toString(), true);
        xhr.withCredentials = true;

        const headers = new Headers(init.headers || {});
        headers.forEach((value, key) => {
          if (key.toLowerCase() !== "content-type") xhr.setRequestHeader(key, value);
        });

        const signal = init.signal;
        const abort = () => xhr.abort();
        if (signal?.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", abort, { once: true });
        const cleanupSignal = () => signal?.removeEventListener("abort", abort);

        setUploadCard(kind, "uploading", 0, "Uploading 0%");
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || event.total <= 0) return;
          const percent = Math.min(99, (event.loaded / event.total) * 100);
          setUploadCard(kind, "uploading", percent, `Uploading ${Math.round(percent)}%`);
        };
        xhr.upload.onload = () => {
          setUploadCard(kind, "server", 100, "Uploaded 100% · server saving...");
        };
        xhr.onerror = () => {
          cleanupSignal();
          setUploadCard(kind, "error", 100, "Upload failed · tap to retry");
          clearUploadCard(kind, 4500);
          reject(new TypeError("Network request failed"));
        };
        xhr.onabort = () => {
          cleanupSignal();
          setUploadCard(kind, "error", 100, "Upload cancelled · tap to retry");
          clearUploadCard(kind, 3500);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        };
        xhr.onload = () => {
          cleanupSignal();
          const response = new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: responseHeaders(xhr),
          });

          if (xhr.status >= 200 && xhr.status < 300) {
            let successLabel = "Saved ✓";
            if (kind === "sideMappingSheet") {
              sideCache.delete(projectId);
              try {
                const result = JSON.parse(xhr.responseText) as {
                  totalCount?: number;
                  appliedCount?: number;
                  pendingCount?: number;
                };
                const total = Number(result.totalCount || 0);
                const applied = Number(result.appliedCount || 0);
                const pending = Number(result.pendingCount || 0);
                successLabel = pending
                  ? `${total} saved · ${applied} applied · ${pending} pending`
                  : `${applied || total} applied ✓`;
              } catch {
                successLabel = "Side Mapping saved ✓";
              }
            }
            setUploadCard(kind, "done", 100, successLabel);
            clearUploadCard(kind, 2600);
          } else {
            let errorLabel = `Failed (${xhr.status || "network"}) · tap to retry`;
            try {
              const result = JSON.parse(xhr.responseText) as { error?: unknown };
              if (typeof result.error === "string" && result.error.trim()) {
                errorLabel = result.error.trim().slice(0, 90);
              }
            } catch {
              // Keep the HTTP fallback label.
            }
            setUploadCard(kind, "error", 100, errorLabel);
            clearUploadCard(kind, 5500);
          }
          resolve(response);
        };
        xhr.send(data);
      });

    const patchedFetch: typeof window.fetch = async (input, init) => {
      const url = requestUrl(input);
      const sameMapperEndpoint =
        url.origin === window.location.origin && url.pathname === "/api/super-mapper";
      if (!sameMapperEndpoint || !init) return nativeFetch(input, init);

      if (init.body instanceof FormData) {
        const kind = parseUploadKind(init.body.get("kind"));
        if (kind) return xhrUpload(input, init, init.body, kind);
      }

      if (
        String(init.method || "GET").toUpperCase() === "POST" &&
        typeof init.body === "string"
      ) {
        const nextBody = await patchMapperJsonBody(init.body);
        if (nextBody !== init.body) return nativeFetch(input, { ...init, body: nextBody });
      }

      return nativeFetch(input, init);
    };

    window.fetch = patchedFetch;

    const resetSameFilePicker = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      if (!input.closest("label.mapper-upload-card")) return;
      window.setTimeout(() => {
        input.value = "";
      }, 0);
    };
    document.addEventListener("change", resetSameFilePicker, true);

    return () => {
      document.removeEventListener("change", resetSameFilePicker, true);
      if (window.fetch === patchedFetch) window.fetch = nativeFetch;
      style.remove();
    };
  }, []);

  return null;
}
