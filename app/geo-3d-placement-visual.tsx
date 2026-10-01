"use client";

import { useEffect, useRef, useState } from "react";
import { Box, MapPinned } from "lucide-react";
import styles from "./geo-3d-placement-visual.module.css";

type LatLng = { lat(): number; lng(): number };
type MapClickEvent = { latLng?: LatLng | null };
type Listener = { remove?: () => void };
type MapInstance = {
  addListener(eventName: string, listener: (event: MapClickEvent) => void): Listener;
  fitBounds(bounds: unknown, padding?: number): void;
  setCenter(center: { lat: number; lng: number }): void;
  setZoom(zoom: number): void;
};
type Circle = {
  setMap(map: MapInstance | null): void;
  setCenter(center: { lat: number; lng: number }): void;
};
type Polyline = {
  setMap(map: MapInstance | null): void;
  setPath(path: Array<{ lat: number; lng: number }>): void;
};
type Polygon = {
  setMap(map: MapInstance | null): void;
};
type GoogleRoot = {
  maps: {
    Map: new (node: HTMLElement, options: Record<string, unknown>) => MapInstance;
    Circle: new (options: Record<string, unknown>) => Circle;
    Polyline: new (options: Record<string, unknown>) => Polyline;
    Polygon: new (options: Record<string, unknown>) => Polygon;
    LatLngBounds: new () => {
      extend(position: { lat: number; lng: number }): void;
    };
    importLibrary?: (name: string) => Promise<unknown>;
    version?: string;
  };
};

type RekixoWindow = Window &
  typeof globalThis & {
    google?: GoogleRoot;
    __rekixoGeo3DMapsReady?: () => void;
  };

type Maps3DLibrary = {
  Map3DElement: new (options: Record<string, unknown>) => HTMLElement;
  Model3DElement: new (options: Record<string, unknown>) => HTMLElement;
  Marker3DElement?: new (options: Record<string, unknown>) => HTMLElement;
  FlattenerElement?: new (options: Record<string, unknown>) => HTMLElement;
};

type Mutable3DMap = HTMLElement & {
  center?: unknown;
  heading?: number;
  range?: number;
  tilt?: number;
  flyCameraTo?: (options: {
    endCamera: {
      center: { lat: number; lng: number; altitude: number };
      altitudeMode: "RELATIVE_TO_GROUND";
      range: number;
      tilt: number;
      heading: number;
    };
    durationMillis: number;
  }) => void | Promise<void>;
};
type Mutable3DModel = HTMLElement & {
  position?: unknown;
  orientation?: unknown;
  scale?: number;
};
type Mutable3DFlattener = HTMLElement & {
  path?: unknown;
};

type ModelDiagnosticStage =
  | "idle"
  | "loading-map"
  | "map-ready"
  | "loading-model"
  | "model-attached"
  | "model-error";

type ModelDiagnostic = {
  stage: ModelDiagnosticStage;
  httpStatus?: number;
  contentType?: string;
  finalUrl?: string;
  glbVerified?: boolean;
};

type RendererRuntimeDiagnostic = {
  mapsVersion?: string;
  loaderVersion?: string;
  maps3dPreloaded?: boolean;
  modelTag?: string;
  modelConnected?: boolean;
  resourceObserved?: boolean;
  resourceDurationMs?: number;
  webglRenderer?: string;
};

const GOOGLE_RENDERER_PROBE_URL =
  "https://maps-docs-team.web.app/assets/windmill.glb";
const GOOGLE_RENDERER_PROBE_MAP = {
  center: { lat: 39.1178, lng: -106.4452, altitude: 4395.4952 },
  range: 1500,
  tilt: 74,
  heading: 0,
} as const;
const GOOGLE_RENDERER_PROBE_MODEL = {
  position: { lat: 39.1178, lng: -106.4452, altitude: 4495.4952 },
  orientation: { heading: 0, tilt: 270, roll: 90 },
  scale: 0.15,
} as const;

let mapsPromise: Promise<GoogleRoot> | null = null;

function browserWindow() {
  return window as RekixoWindow;
}

function mapsLoaderRuntime() {
  const script = Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    ),
  )[0];
  if (!script?.src) return {};
  try {
    const url = new URL(script.src);
    const libraries = (url.searchParams.get("libraries") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      loaderVersion: url.searchParams.get("v") || "default",
      maps3dPreloaded: libraries.includes("maps3d"),
    };
  } catch {
    return {};
  }
}

function webglRendererName() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return "WebGL unavailable";
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    if (!extension) return "WebGL renderer hidden";
    return String(
      gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) || "Unknown renderer",
    ).slice(0, 160);
  } catch {
    return "WebGL renderer unavailable";
  }
}

function rendererResourceObservation() {
  try {
    const entry = performance
      .getEntriesByType("resource")
      .find((item) => item.name.includes("windmill.glb"));
    if (!entry) return {};
    return {
      resourceObserved: true,
      resourceDurationMs: Math.round(entry.duration),
    };
  } catch {
    return {};
  }
}

function completeExistingGoogleMaps(resolve: (google: GoogleRoot) => void) {
  const current = browserWindow().google;
  if (current?.maps?.Map) {
    resolve(current);
    return true;
  }
  return false;
}

function loadGoogleMaps(apiKey: string) {
  if (browserWindow().google?.maps?.Map)
    return Promise.resolve(browserWindow().google!);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<GoogleRoot>((resolve, reject) => {
    const win = browserWindow();
    if (completeExistingGoogleMaps(resolve)) return;

    const existing = Array.from(
      document.querySelectorAll<HTMLScriptElement>(
        'script[src*="maps.googleapis.com/maps/api/js"]',
      ),
    )[0];
    if (existing) {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (completeExistingGoogleMaps((google) => {
          window.clearInterval(timer);
          resolve(google);
        }))
          return;
        if (attempts >= 80) {
          window.clearInterval(timer);
          mapsPromise = null;
          reject(new Error("Google Maps JavaScript API initialize nahi hui"));
        }
      }, 100);
      return;
    }

    const callbackName = "__rekixoGeo3DMapsReady";
    win[callbackName] = () => {
      if (completeExistingGoogleMaps(resolve)) return;
      mapsPromise = null;
      reject(new Error("Google Maps JavaScript API initialize nahi hui"));
    };

    const script = document.createElement("script");
    script.id = "rekixo-geo3d-google-maps-js";
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&v=weekly&loading=async&libraries=maps3d&callback=${callbackName}`;
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Maps JavaScript API load fail hui"));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

function finite(value: number) {
  return Number.isFinite(value);
}

async function readResponsePrefix(response: Response, byteCount: number) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const output = new Uint8Array(byteCount);
  let offset = 0;
  try {
    while (offset < byteCount) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const take = Math.min(value.byteLength, byteCount - offset);
      output.set(value.subarray(0, take), offset);
      offset += take;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return output.subarray(0, offset);
}

function focus3DMap(
  map: Mutable3DMap,
  latitude: number,
  longitude: number,
  altitudeM: number,
  headingDeg: number,
) {
  // CameraOptions supports RELATIVE_TO_GROUND even though Map3DElement.center
  // itself uses absolute mean-sea-level altitude. Aim near the middle of a
  // typical building so inland/high-elevation sites remain in frame.
  const camera = {
    center: {
      lat: latitude,
      lng: longitude,
      altitude: Math.max(0, altitudeM + 10),
    },
    altitudeMode: "RELATIVE_TO_GROUND" as const,
    range: 190,
    tilt: 68,
    heading: headingDeg,
  };
  if (typeof map.flyCameraTo === "function") {
    void map.flyCameraTo({ endCamera: camera, durationMillis: 0 });
    return;
  }
  // Compatibility fallback for older Maps JS builds.
  map.center = { lat: latitude, lng: longitude };
  map.heading = headingDeg;
}

function headingEnd(
  latitude: number,
  longitude: number,
  headingDeg: number,
  distanceM = 24,
) {
  const heading = (headingDeg * Math.PI) / 180;
  const northM = Math.cos(heading) * distanceM;
  const eastM = Math.sin(heading) * distanceM;
  const lat = latitude + northM / 111_320;
  const cosLat = Math.max(
    0.2,
    Math.cos((latitude * Math.PI) / 180),
  );
  const lng = longitude + eastM / (111_320 * cosLat);
  return { lat, lng };
}

function flatteningSquarePath(
  latitude: number,
  longitude: number,
  halfSizeM: number,
) {
  const safeHalfSize = Math.max(1, halfSizeM);
  const latDelta = safeHalfSize / 111_320;
  const cosLat = Math.max(
    0.2,
    Math.cos((latitude * Math.PI) / 180),
  );
  const lngDelta = safeHalfSize / (111_320 * cosLat);
  return [
    { lat: latitude + latDelta, lng: longitude - lngDelta },
    { lat: latitude + latDelta, lng: longitude + lngDelta },
    { lat: latitude - latDelta, lng: longitude + lngDelta },
    { lat: latitude - latDelta, lng: longitude - lngDelta },
  ];
}

export default function Geo3DPlacementVisual({
  apiKey,
  modelUrl,
  modelByteSize,
  modelFingerprint,
  flattenBaseMesh,
  flattenHalfSizeM,
  features,
  longitude,
  latitude,
  altitudeM,
  headingDeg,
  pitchDeg,
  rollDeg,
  scale,
  disabled,
  onPositionChange,
  notify,
}: {
  apiKey: string | null;
  modelUrl: string | null;
  modelByteSize?: number;
  modelFingerprint?: string;
  flattenBaseMesh: boolean;
  flattenHalfSizeM: number;
  features: Array<{
    id: string;
    name: string;
    linkedPlotId: string | null;
    source: string;
    path: [number, number][];
  }>;
  longitude: number;
  latitude: number;
  altitudeM: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  scale: number;
  disabled: boolean;
  onPositionChange: (longitude: number, latitude: number) => void;
  notify: (message: string) => void;
}) {
  const [mode, setMode] = useState<"satellite" | "three-d">("satellite");
  const [rendererProbe, setRendererProbe] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [modelDiagnostic, setModelDiagnostic] = useState<ModelDiagnostic>({
    stage: "idle",
  });
  const [rendererRuntime, setRendererRuntime] =
    useState<RendererRuntimeDiagnostic>({});
  const satelliteRef = useRef<HTMLDivElement | null>(null);
  const threeDRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<Circle | null>(null);
  const headingRef = useRef<Polyline | null>(null);
  const mapClickRef = useRef<Listener | null>(null);
  const polygonsRef = useRef<Polygon[]>([]);
  const disabledRef = useRef(disabled);
  const map3DRef = useRef<Mutable3DMap | null>(null);
  const model3DRef = useRef<Mutable3DModel | null>(null);
  const flattener3DRef = useRef<Mutable3DFlattener | null>(null);

  disabledRef.current = disabled;

  const validPosition =
    finite(longitude) &&
    finite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90;

  useEffect(() => {
    if (!apiKey || !validPosition || mode !== "satellite" || !satelliteRef.current)
      return;

    let cancelled = false;
    setReady(false);
    setError("");

    loadGoogleMaps(apiKey)
      .then((google) => {
        if (cancelled || !satelliteRef.current) return;

        const center = { lat: latitude, lng: longitude };
        const map = new google.maps.Map(satelliteRef.current, {
          center,
          zoom: 20,
          mapTypeId: "hybrid",
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
          clickableIcons: true,
        });
        const marker = new google.maps.Circle({
          map,
          center,
          radius: 2.2,
          clickable: false,
          fillColor: "#2ee6a6",
          fillOpacity: 0.62,
          strokeColor: "#d8fff1",
          strokeOpacity: 1,
          strokeWeight: 2,
          zIndex: 50,
        });
        const heading = new google.maps.Polyline({
          map,
          path: [center, headingEnd(latitude, longitude, headingDeg)],
          clickable: false,
          strokeColor: "#2ee6a6",
          strokeOpacity: 1,
          strokeWeight: 4,
          zIndex: 51,
        });
        const polygons: Polygon[] = [];
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(center);
        for (const feature of features) {
          const path = feature.path
            .filter(
              ([lng, lat]) =>
                Number.isFinite(lng) &&
                Number.isFinite(lat) &&
                lng >= -180 &&
                lng <= 180 &&
                lat >= -90 &&
                lat <= 90,
            )
            .map(([lng, lat]) => ({ lat, lng }));
          if (path.length < 3) continue;
          path.forEach((point) => bounds.extend(point));
          polygons.push(
            new google.maps.Polygon({
              map,
              paths: path,
              clickable: false,
              fillColor: feature.linkedPlotId ? "#31d49b" : "#6ba6d9",
              fillOpacity: feature.linkedPlotId ? 0.07 : 0.035,
              strokeColor: feature.linkedPlotId ? "#83f1c9" : "#8db9df",
              strokeOpacity: feature.linkedPlotId ? 0.9 : 0.58,
              strokeWeight: feature.linkedPlotId ? 1.5 : 1,
              zIndex: feature.linkedPlotId ? 24 : 20,
            }),
          );
        }
        if (features.length) map.fitBounds(bounds, 54);

        const listener = map.addListener("click", (event) => {
          if (disabledRef.current || !event.latLng) return;
          onPositionChange(event.latLng.lng(), event.latLng.lat());
        });

        mapRef.current = map;
        markerRef.current = marker;
        headingRef.current = heading;
        mapClickRef.current = listener;
        polygonsRef.current = polygons;
        setReady(true);
      })
      .catch((reason) => {
        if (cancelled) return;
        const message =
          reason instanceof Error
            ? reason.message
            : "Visual placement map load nahi hua";
        setError(message);
        notify(message);
      });

    return () => {
      cancelled = true;
      mapClickRef.current?.remove?.();
      mapClickRef.current = null;
      markerRef.current?.setMap(null);
      headingRef.current?.setMap(null);
      polygonsRef.current.forEach((polygon) => polygon.setMap(null));
      polygonsRef.current = [];
      markerRef.current = null;
      headingRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, mode, validPosition, onPositionChange, features]);

  useEffect(() => {
    if (mode !== "satellite" || !validPosition) return;
    const center = { lat: latitude, lng: longitude };
    mapRef.current?.setCenter(center);
    markerRef.current?.setCenter(center);
    headingRef.current?.setPath([
      center,
      headingEnd(latitude, longitude, headingDeg),
    ]);
  }, [mode, latitude, longitude, headingDeg, validPosition]);

  useEffect(() => {
    if (
      !apiKey ||
      !modelUrl ||
      !validPosition ||
      mode !== "three-d" ||
      !threeDRef.current
    )
      return;

    let cancelled = false;
    let cleanup3D: (() => void) | undefined;
    setReady(false);
    setError("");
    setModelDiagnostic({ stage: "loading-map" });
    setRendererRuntime({});

    loadGoogleMaps(apiKey)
      .then(async (google) => {
        if (cancelled || !threeDRef.current) return;
        if (!google.maps.importLibrary)
          throw new Error("Google 3D Maps library available nahi hai");

        const library = (await google.maps.importLibrary(
          "maps3d",
        )) as Maps3DLibrary;
        if (cancelled || !threeDRef.current) return;
        setRendererRuntime({
          mapsVersion: String(google.maps.version || "unknown"),
          ...mapsLoaderRuntime(),
          webglRenderer: webglRendererName(),
        });
        setModelDiagnostic({ stage: "map-ready" });

        // Project mode verifies the exact authenticated byte path before handing
        // the final public Engine URL to Model3DElement. The Google renderer probe
        // intentionally skips browser fetch(): Google's own documented sample
        // loads the official GLB directly through Model3DElement, and a JS fetch
        // can be blocked by cross-origin policy before the renderer is tested.
        setModelDiagnostic({ stage: "loading-model" });
        let rendererModelUrl = modelUrl;
        if (rendererProbe) {
          rendererModelUrl = GOOGLE_RENDERER_PROBE_URL;
          setModelDiagnostic({
            stage: "loading-model",
            finalUrl: rendererModelUrl,
          });
        } else {
          const modelCheck = await fetch(modelUrl, {
            method: "GET",
            headers: { Range: "bytes=0-3" },
            cache: "no-store",
            credentials: "same-origin",
          });
          if (modelCheck.status !== 200 && modelCheck.status !== 206) {
            let detail = "";
            const contentType = modelCheck.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const payload = (await modelCheck.json().catch(() => null)) as
                | {
                    upstreamStatus?: number;
                    transport?: string;
                    diagnostic?: string;
                  }
                | null;
              if (payload?.upstreamStatus)
                detail += ` · upstream ${payload.upstreamStatus}`;
              if (payload?.transport) detail += ` · ${payload.transport}`;
              if (payload?.diagnostic) detail += ` · ${payload.diagnostic}`;
            } else {
              await modelCheck.body?.cancel().catch(() => {});
            }
            throw new Error(
              `3D model unavailable (${modelCheck.status}${detail})`,
            );
          }
          const finalModelUrl = modelCheck.url || modelUrl;
          rendererModelUrl = finalModelUrl;
          const contentType = modelCheck.headers.get("content-type") || "";
          const modelStatus = modelCheck.status;
          const magicBytes = await readResponsePrefix(modelCheck, 4);
          const magic = new TextDecoder().decode(magicBytes);
          if (magic !== "glTF")
            throw new Error("3D model preview returned invalid GLB bytes");
          setModelDiagnostic({
            stage: "loading-model",
            httpStatus: modelStatus,
            contentType,
            finalUrl: finalModelUrl,
            glbVerified: true,
          });
        }

        const finalModelUrl = rendererModelUrl;

        const map = new library.Map3DElement(
          rendererProbe
            ? {
                // Exact Google documentation sample. Keep this branch free of
                // Rekixo/Jyoti camera assumptions so it isolates Model3DElement.
                center: GOOGLE_RENDERER_PROBE_MAP.center,
                range: GOOGLE_RENDERER_PROBE_MAP.range,
                tilt: GOOGLE_RENDERER_PROBE_MAP.tilt,
                heading: GOOGLE_RENDERER_PROBE_MAP.heading,
                mode: "HYBRID",
              }
            : {
                // Start broad. Once terrain is steady, focus with a
                // terrain-relative CameraOptions target.
                center: {
                  lat: latitude,
                  lng: longitude,
                },
                range: 700,
                tilt: 52,
                heading: headingDeg,
                mode: "HYBRID",
                gestureHandling: "GREEDY",
              },
        ) as Mutable3DMap;
        const flattener = !rendererProbe && flattenBaseMesh
          ? (() => {
              if (!library.FlattenerElement)
                throw new Error(
                  "Google 3D mesh flattener is unavailable in this Maps build",
                );
              return new library.FlattenerElement({
                path: flatteningSquarePath(
                  latitude,
                  longitude,
                  flattenHalfSizeM,
                ),
              }) as Mutable3DFlattener;
            })()
          : null;

        const model = new library.Model3DElement({
          // Project mode uses the final public Engine URL reached by the
          // authenticated preflight. Probe mode mirrors Google's official
          // Model3DElement sample at the exact same Rekixo anchor.
          src: finalModelUrl,
          position: rendererProbe
            ? GOOGLE_RENDERER_PROBE_MODEL.position
            : {
                lat: latitude,
                lng: longitude,
                altitude: altitudeM,
              },
          orientation: rendererProbe
            ? GOOGLE_RENDERER_PROBE_MODEL.orientation
            : {
                heading: headingDeg,
                tilt: pitchDeg,
                roll: rollDeg,
              },
          scale: rendererProbe ? GOOGLE_RENDERER_PROBE_MODEL.scale : scale,
          altitudeMode: rendererProbe
            ? "CLAMP_TO_GROUND"
            : "RELATIVE_TO_GROUND",
        }) as Mutable3DModel;

        const anchorBeacon = !rendererProbe && library.Marker3DElement
          ? new library.Marker3DElement({
              position: {
                lat: latitude,
                lng: longitude,
                altitude: Math.max(0, altitudeM + 3),
              },
              altitudeMode: "RELATIVE_TO_GROUND",
              label: "ANCHOR",
              drawsWhenOccluded: true,
              sizePreserved: true,
            })
          : null;

        let modelAttached = false;
        const markAttached = () => {
          modelAttached = true;
          model3DRef.current = model;
          setRendererRuntime((current) => ({
            ...current,
            modelTag: model.tagName.toLowerCase(),
            modelConnected: model.isConnected,
          }));
          setModelDiagnostic((current) => ({
            ...current,
            stage: "model-attached",
          }));
          setReady(true);
        };
        const attachProjectModel = () => {
          if (cancelled || modelAttached) return;
          focus3DMap(map, latitude, longitude, altitudeM, headingDeg);
          if (flattener) {
            map.append(flattener);
            flattener3DRef.current = flattener;
          }
          if (anchorBeacon) map.append(anchorBeacon);
          map.append(model);
          markAttached();
          // Re-focus after custom elements are attached. This avoids a stale
          // broad camera target surviving the initial terrain steady-state.
          window.requestAnimationFrame(() => {
            if (!cancelled)
              focus3DMap(map, latitude, longitude, altitudeM, headingDeg);
          });
        };
        const steadyListener = (event: Event) => {
          const steady = event as Event & { isSteady?: boolean };
          if (steady.isSteady) attachProjectModel();
        };
        const mapErrorListener = () => {
          if (cancelled) return;
          setModelDiagnostic((current) => ({
            ...current,
            stage: "model-error",
          }));
          setError("Google 3D map initialize nahi hui");
        };
        map.addEventListener("gmp-error", mapErrorListener);

        threeDRef.current.replaceChildren(map);
        map3DRef.current = map;

        let attachFallback: number | undefined;
        let probeObservationTimer: number | undefined;
        if (rendererProbe) {
          // Google docs append the model directly after the map is connected.
          // Do exactly that: no flattener, marker, steady wait or camera helper.
          map.append(model);
          markAttached();
          probeObservationTimer = window.setTimeout(() => {
            if (cancelled) return;
            setRendererRuntime((current) => ({
              ...current,
              ...rendererResourceObservation(),
            }));
          }, 3000);
        } else {
          map.addEventListener("gmp-steadychange", steadyListener);
          // Some Maps JS versions can become steady before the first event
          // reaches app code. Keep a bounded project-mode fallback.
          attachFallback = window.setTimeout(attachProjectModel, 1500);
        }

        cleanup3D = () => {
          if (attachFallback !== undefined)
            window.clearTimeout(attachFallback);
          if (probeObservationTimer !== undefined)
            window.clearTimeout(probeObservationTimer);
          map.removeEventListener("gmp-steadychange", steadyListener);
          map.removeEventListener("gmp-error", mapErrorListener);
        };
      })
      .catch((reason) => {
        if (cancelled) return;
        const message =
          reason instanceof Error
            ? reason.message
            : "3D visual preview load nahi hua";
        setModelDiagnostic((current) => ({
          ...current,
          stage: "model-error",
        }));
        setError(message);
        notify(message);
      });

    return () => {
      cancelled = true;
      cleanup3D?.();
      map3DRef.current = null;
      model3DRef.current = null;
      flattener3DRef.current = null;
      threeDRef.current?.replaceChildren();
    };
  }, [
    apiKey,
    modelUrl,
    modelFingerprint,
    rendererProbe,
    mode,
    validPosition,
    flattenBaseMesh,
    flattenHalfSizeM,
  ]);

  useEffect(() => {
    if (mode !== "three-d" || !validPosition || rendererProbe) return;
    if (map3DRef.current) {
      focus3DMap(
        map3DRef.current,
        latitude,
        longitude,
        altitudeM,
        headingDeg,
      );
    }
    if (flattener3DRef.current && flattenBaseMesh) {
      flattener3DRef.current.path = flatteningSquarePath(
        latitude,
        longitude,
        flattenHalfSizeM,
      );
    }
    if (model3DRef.current) {
      model3DRef.current.position = {
        lat: latitude,
        lng: longitude,
        altitude: rendererProbe ? 0 : altitudeM,
      };
      model3DRef.current.orientation = rendererProbe
        ? { heading: 0, tilt: 270, roll: 90 }
        : {
            heading: headingDeg,
            tilt: pitchDeg,
            roll: rollDeg,
          };
      if (rendererProbe) model3DRef.current.scale = 0.15;
      else model3DRef.current.scale = scale;
    }
  }, [
    mode,
    validPosition,
    longitude,
    latitude,
    altitudeM,
    headingDeg,
    pitchDeg,
    rollDeg,
    scale,
    rendererProbe,
    flattenBaseMesh,
    flattenHalfSizeM,
  ]);

  if (!apiKey || !validPosition) {
    return (
      <div className={styles.empty}>
        <MapPinned size={18} />
        <span>
          Visual placement ke liye Google Maps key aur valid Geo coordinates
          chahiye.
        </span>
      </div>
    );
  }

  return (
    <section className={styles.visual} aria-label="Visual 3D building placement">
      <header className={styles.toolbar}>
        <div>
          <strong>Visual placement</strong>
          <small>
            Satellite par click karke building anchor move karein; 3D me heading,
            scale aur ground offset live verify karein.
          </small>
        </div>
        <div className={styles.modes} role="group" aria-label="Placement preview mode">
          <button
            type="button"
            aria-pressed={mode === "satellite"}
            onClick={() => setMode("satellite")}
          >
            <MapPinned size={15} /> Satellite
          </button>
          <button
            type="button"
            aria-pressed={mode === "three-d"}
            disabled={!modelUrl}
            onClick={() => setMode("three-d")}
          >
            <Box size={15} /> 3D Preview
          </button>
          {mode === "three-d" ? (
            <>
              <button
                type="button"
                aria-pressed={rendererProbe}
                onClick={() => setRendererProbe((current) => !current)}
              >
                {rendererProbe ? "Project model" : "Google model test"}
              </button>
              {!rendererProbe ? (
                <button
                  type="button"
                  onClick={() => {
                    if (map3DRef.current)
                      focus3DMap(
                        map3DRef.current,
                        latitude,
                        longitude,
                        altitudeM,
                        headingDeg,
                      );
                  }}
                >
                  Focus building
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      <div className={styles.canvasShell}>
        <div
          ref={satelliteRef}
          className={mode === "satellite" ? styles.canvas : styles.hidden}
        />
        <div
          ref={threeDRef}
          className={mode === "three-d" ? styles.canvas : styles.hidden}
        />
        {!ready && !error ? (
          <div className={styles.loading}>
            {mode === "three-d"
              ? modelDiagnostic.stage === "loading-model"
                ? "Geo GLB verify ho raha hai…"
                : modelDiagnostic.stage === "map-ready"
                  ? "3D model initialize ho raha hai…"
                  : "Google 3D map initialize ho raha hai…"
              : "Preview initialize ho raha hai…"}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}
      </div>

      <footer className={styles.status}>
        <span>
          {rendererProbe ? "Probe anchor" : "Anchor"}:{" "}
          {(rendererProbe
            ? GOOGLE_RENDERER_PROBE_MODEL.position.lat
            : latitude
          ).toFixed(7)}
          ,{" "}
          {(rendererProbe
            ? GOOGLE_RENDERER_PROBE_MODEL.position.lng
            : longitude
          ).toFixed(7)}
        </span>
        <span>Heading {headingDeg.toFixed(1)}°</span>
        <span>Scale {scale.toFixed(3)}</span>
        <span>Ground {altitudeM.toFixed(2)} m</span>
        {mode === "three-d" ? (
          <>
            {rendererProbe ? (
              <span>Probe source: direct Google official GLB</span>
            ) : (
              <span>
                Geo GLB: {modelDiagnostic.glbVerified ? "verified" : "checking"}
                {modelByteSize
                  ? ` · ${(modelByteSize / 1_000_000).toFixed(2)} MB`
                  : ""}
              </span>
            )}
            {!rendererProbe && modelDiagnostic.httpStatus ? (
              <span>
                HTTP {modelDiagnostic.httpStatus}
                {modelDiagnostic.contentType
                  ? ` · ${modelDiagnostic.contentType.split(";")[0]}`
                  : ""}
              </span>
            ) : null}
            {rendererProbe ? (
              <span>Renderer probe: exact Google docs sample · Colorado</span>
            ) : modelFingerprint ? (
              <span>Geo build: {modelFingerprint.slice(0, 12)}</span>
            ) : null}
            <span>
              Model element:{" "}
              {modelDiagnostic.stage === "model-attached"
                ? "attached"
                : modelDiagnostic.stage === "model-error"
                  ? "error"
                  : "pending"}
            </span>
            {rendererProbe && rendererRuntime.mapsVersion ? (
              <span>
                Maps JS {rendererRuntime.mapsVersion} · loader{" "}
                {rendererRuntime.loaderVersion || "unknown"} · maps3d{" "}
                {rendererRuntime.maps3dPreloaded ? "preloaded" : "dynamic"}
              </span>
            ) : null}
            {rendererProbe && rendererRuntime.modelTag ? (
              <span>
                {rendererRuntime.modelTag} · DOM{" "}
                {rendererRuntime.modelConnected ? "connected" : "detached"} · resource{" "}
                {rendererRuntime.resourceObserved
                  ? "observed" +
                    (rendererRuntime.resourceDurationMs
                      ? ` · ${rendererRuntime.resourceDurationMs}ms`
                      : "")
                  : "not exposed yet"}
              </span>
            ) : null}
            {rendererProbe && rendererRuntime.webglRenderer ? (
              <span>GPU: {rendererRuntime.webglRenderer}</span>
            ) : null}
            {!rendererProbe && flattenBaseMesh ? (
              <span>
                Google base mesh: flattened · {(flattenHalfSizeM * 2).toFixed(0)}m ×{" "}
                {(flattenHalfSizeM * 2).toFixed(0)}m
              </span>
            ) : null}
          </>
        ) : null}
      </footer>
    </section>
  );
}
