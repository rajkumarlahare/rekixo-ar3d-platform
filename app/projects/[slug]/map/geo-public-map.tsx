"use client";

import { useEffect, useRef, useState } from "react";
import { solveHomography, type MapperPoint } from "../../../mapper-geometry";
import styles from "./geo-public-map.module.css";

type PublicFeature = {
  id: string;
  name: string;
  linkedPlotId: string | null;
  source: string;
  layer: string;
  status: "available" | "booked" | "sold";
  sqft: number;
  sqm: number;
  sqyd: number;
  dimensions: string;
  road: string;
  path: [number, number][];
};

type PublicGeoData = {
  project: { id: string; name: string; slug: string };
  revision: number;
  maps: { enabled: boolean; apiKey: string | null };
  masterplanUrl: string;
  masterplanUrls?: {
    original?: string;
    mobile?: string;
    desktop?: string;
  };
  masterplanCorners: [number, number][];
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  features: PublicFeature[];
  counts: { total: number; available: number; booked: number; sold: number };
  error?: string;
};

type LatLng = { lat(): number; lng(): number };
type MapMouseEvent = { latLng?: LatLng | null };
type Listener = { remove?: () => void };
type MapInstance = {
  addListener(eventName: string, listener: () => void): Listener;
  fitBounds(bounds: unknown, padding?: number): void;
};
type Projection = {
  fromLatLngToDivPixel(latLng: LatLng): { x: number; y: number } | null;
};
type OverlayView = {
  onAdd?: () => void;
  draw?: () => void;
  onRemove?: () => void;
  setMap(map: MapInstance | null): void;
  getProjection(): Projection;
  getPanes(): { overlayLayer: HTMLElement };
};
type Polygon = {
  addListener(eventName: string, listener: (event: MapMouseEvent) => void): Listener;
  setMap(map: MapInstance | null): void;
};
type InfoWindow = {
  setContent(content: Node | string): void;
  setPosition(position: { lat: number; lng: number }): void;
  open(options: { map: MapInstance }): void;
  close(): void;
};
type GoogleRoot = {
  maps: {
    Map: new (node: HTMLElement, options: Record<string, unknown>) => MapInstance;
    LatLng: new (lat: number, lng: number) => LatLng;
    LatLngBounds: new (
      southWest?: { lat: number; lng: number },
      northEast?: { lat: number; lng: number },
    ) => unknown;
    OverlayView: new () => OverlayView;
    Polygon: new (options: Record<string, unknown>) => Polygon;
    InfoWindow: new (options?: Record<string, unknown>) => InfoWindow;
  };
};

type RekixoWindow = Window &
  typeof globalThis & {
    google?: GoogleRoot;
    __rekixoPublicGeoMapsReady?: () => void;
    gm_authFailure?: () => void;
  };

let mapsPromise: Promise<GoogleRoot> | null = null;

function win() {
  return window as RekixoWindow;
}

function ensureGoogleMapsConnectionHints() {
  const hints = [
    ["rekixo-maps-api-preconnect", "https://maps.googleapis.com"],
    ["rekixo-maps-static-preconnect", "https://maps.gstatic.com"],
  ] as const;

  for (const [id, href] of hints) {
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "";
    document.head.appendChild(link);
  }
}

function loadGoogleMaps(apiKey: string) {
  if (win().google?.maps?.Map) return Promise.resolve(win().google!);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<GoogleRoot>((resolve, reject) => {
    const callbackName = "__rekixoPublicGeoMapsReady";
    win()[callbackName] = () => {
      if (win().google?.maps?.Map) resolve(win().google!);
      else reject(new Error("Google Maps JavaScript API load nahi hui"));
    };

    const existing = document.getElementById(
      "rekixo-public-google-maps-js",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener(
        "load",
        () => {
          if (win().google?.maps?.Map) resolve(win().google!);
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "rekixo-public-google-maps-js";
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&v=weekly&loading=async&callback=${callbackName}`;
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Satellite load fail hui"));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

function cssProjectiveTransform(matrix: number[], width: number, height: number) {
  const a = matrix[0] / width;
  const b = matrix[1] / height;
  const c = matrix[2];
  const d = matrix[3] / width;
  const e = matrix[4] / height;
  const f = matrix[5];
  const g = matrix[6] / width;
  const h = matrix[7] / height;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
}

function validatePublicGeoData(payload: PublicGeoData) {
  if (
    !payload ||
    !payload.project?.slug ||
    !payload.maps ||
    typeof payload.maps.enabled !== "boolean" ||
    !payload.bounds ||
    !Array.isArray(payload.masterplanCorners) ||
    payload.masterplanCorners.length !== 4 ||
    !Array.isArray(payload.features) ||
    !payload.counts
  ) {
    throw new Error("Satellite map data incomplete hai");
  }

  for (const value of [
    payload.bounds.minLng,
    payload.bounds.minLat,
    payload.bounds.maxLng,
    payload.bounds.maxLat,
  ]) {
    if (!Number.isFinite(value))
      throw new Error("Satellite map bounds invalid hain");
  }

  return payload;
}

function googleMapsLinks(data: PublicGeoData) {
  const corners = data.masterplanCorners;
  const lng = corners.reduce((sum, [value]) => sum + value, 0) / corners.length;
  const lat = corners.reduce((sum, [, value]) => sum + value, 0) / corners.length;
  const destination = encodeURIComponent(`${lat.toFixed(7)},${lng.toFixed(7)}`);
  return {
    open: `https://www.google.com/maps/search/?api=1&query=${destination}`,
    directions:
      `https://www.google.com/maps/dir/?api=1&destination=${destination}` +
      "&travelmode=driving&dir_action=navigate",
  };
}

function plotStyle(status: string) {
  if (status === "sold") return { fillColor: "#ef334e", strokeColor: "#ff6b7f" };
  if (status === "booked") return { fillColor: "#f4b51f", strokeColor: "#ffd45f" };
  return { fillColor: "#18b968", strokeColor: "#63e6ad" };
}

function masterplanUrlForViewport(data: PublicGeoData) {
  if (window.innerWidth <= 900)
    return data.masterplanUrls?.mobile || data.masterplanUrl;
  return data.masterplanUrls?.desktop || data.masterplanUrl;
}

const MOBILE_OVERLAY_MAX_DIMENSION = 2304;
const DESKTOP_OVERLAY_MAX_DIMENSION = 3072;
const PLOT_RENDER_CHUNK_SIZE = 24;

function addMasterplanOverlay(
  google: GoogleRoot,
  map: MapInstance,
  url: string,
  corners: [number, number][],
) {
  const overlay = new google.maps.OverlayView();
  let host: HTMLDivElement | null = null;
  let sourceImage: HTMLImageElement | null = null;
  let surface: HTMLImageElement | HTMLCanvasElement | null = null;
  let surfaceWidth = 0;
  let surfaceHeight = 0;
  let drawFrame: number | null = null;

  const draw = () => {
    if (drawFrame !== null) return;
    drawFrame = window.requestAnimationFrame(() => {
      drawFrame = null;
      if (!host || !surface || !surfaceWidth || !surfaceHeight) return;
      try {
        const projection = overlay.getProjection();
        if (!projection) return;
        const target = corners.map(([lng, lat]) =>
          projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng)),
        );
        if (target.length !== 4 || target.some((point) => !point)) return;
        const source: MapperPoint[] = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ];
        const matrix = solveHomography(
          source.map((sourcePoint, index) => ({
            source: sourcePoint,
            target: [target[index]!.x, target[index]!.y] as MapperPoint,
          })),
        );
        host.style.transform = cssProjectiveTransform(matrix, surfaceWidth, surfaceHeight);
        host.style.visibility = "visible";
      } catch (error) {
        host.style.visibility = "hidden";
        console.warn("Public masterplan overlay draw skipped", error);
      }
    });
  };

  const useOriginalImage = (image: HTMLImageElement) => {
    if (!host) return;
    surface = image;
    surfaceWidth = image.naturalWidth;
    surfaceHeight = image.naturalHeight;
    host.replaceChildren(image);
    draw();
  };

  const prepareCompositorSurface = (image: HTMLImageElement) => {
    if (!host || !image.naturalWidth || !image.naturalHeight) return;
    const largestDimension = Math.max(image.naturalWidth, image.naturalHeight);
    const maxDimension =
      window.innerWidth <= 900
        ? MOBILE_OVERLAY_MAX_DIMENSION
        : DESKTOP_OVERLAY_MAX_DIMENSION;
    if (largestDimension <= maxDimension) {
      useOriginalImage(image);
      return;
    }

    const scale = maxDimension / largestDimension;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      useOriginalImage(image);
      return;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    surface = canvas;
    surfaceWidth = canvas.width;
    surfaceHeight = canvas.height;
    host.replaceChildren(canvas);
    sourceImage = null;
    draw();
  };

  overlay.onAdd = () => {
    host = document.createElement("div");
    host.className = styles.masterplanOverlay;
    const image = document.createElement("img");
    sourceImage = image;
    image.alt = "Project masterplan";
    image.draggable = false;
    image.decoding = "async";
    image.fetchPriority = "low";
    image.onload = () => prepareCompositorSurface(image);
    image.onerror = () => {
      if (host) host.style.visibility = "hidden";
      console.warn("Public masterplan overlay image load failed");
    };
    const panes = overlay.getPanes();
    if (!panes?.overlayLayer) {
      host.style.visibility = "hidden";
      return;
    }
    panes.overlayLayer.appendChild(host);
    image.src = url;
  };

  overlay.draw = draw;
  overlay.onRemove = () => {
    if (drawFrame !== null) window.cancelAnimationFrame(drawFrame);
    if (sourceImage) {
      sourceImage.onload = null;
      sourceImage.onerror = null;
    }
    surface?.remove();
    host?.remove();
    sourceImage = null;
    surface = null;
    host = null;
    drawFrame = null;
  };
  overlay.setMap(map);
  return overlay;
}

function plotInfoCard(feature: PublicFeature) {
  const card = document.createElement("div");
  card.className = styles.infoCard;
  const title = document.createElement("strong");
  title.textContent = feature.linkedPlotId ? `Plot ${feature.linkedPlotId}` : feature.name;
  card.appendChild(title);
  const status = document.createElement("span");
  status.textContent = `Status: ${feature.status[0].toUpperCase()}${feature.status.slice(1)}`;
  card.appendChild(status);
  if (feature.sqft > 0) {
    const area = document.createElement("span");
    area.textContent = `Area: ${feature.sqft.toLocaleString("en-IN")} Sq.Ft`;
    card.appendChild(area);
  }
  if (feature.dimensions) {
    const dimensions = document.createElement("span");
    dimensions.textContent = `Dimensions: ${feature.dimensions}`;
    card.appendChild(dimensions);
  }
  if (feature.road) {
    const road = document.createElement("span");
    road.textContent = `Road: ${feature.road}`;
    card.appendChild(road);
  }
  return card;
}

function createPlotPolygon(
  google: GoogleRoot,
  map: MapInstance,
  info: InfoWindow,
  feature: PublicFeature,
) {
  const style = plotStyle(feature.status);
  const polygon = new google.maps.Polygon({
    map,
    paths: feature.path.map(([lng, lat]) => ({ lat, lng })),
    clickable: Boolean(feature.linkedPlotId),
    fillColor: style.fillColor,
    fillOpacity: feature.linkedPlotId ? 0.09 : 0.03,
    strokeColor: style.strokeColor,
    strokeOpacity: feature.linkedPlotId ? 0.95 : 0.55,
    strokeWeight: feature.linkedPlotId ? 1.6 : 1.2,
    zIndex: feature.linkedPlotId ? 30 : 20,
  });
  if (feature.linkedPlotId) {
    polygon.addListener("click", (event) => {
      info.setContent(plotInfoCard(feature));
      const fallback = feature.path[0];
      if (event.latLng) {
        info.setPosition({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      } else if (fallback) {
        info.setPosition({ lat: fallback[1], lng: fallback[0] });
      }
      info.open({ map });
    });
  }
  return polygon;
}

export default function GeoPublicMap({
  projectName,
  projectSlug,
  mapsApiKey,
}: {
  projectName: string;
  projectSlug: string;
  mapsApiKey: string | null;
}) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<PublicGeoData | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    ensureGoogleMapsConnectionHints();
    const controller = new AbortController();

    if (mapsApiKey) {
      void loadGoogleMaps(mapsApiKey).catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Google Satellite load fail hui");
      });
    }

    fetch(`/api/public-geo?projectSlug=${encodeURIComponent(projectSlug)}`, {
      cache: "default",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as PublicGeoData;
        if (!response.ok) throw new Error(payload.error || "Satellite map load nahi hua");
        return validatePublicGeoData(payload);
      })
      .then((payload) => {
        setError("");
        setMapReady(false);
        setData(payload);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Satellite map load nahi hua");
      });
    return () => controller.abort();
  }, [mapsApiKey, projectSlug]);

  useEffect(() => {
    if (!data || !mapNodeRef.current) return;
    const effectiveMapsKey = mapsApiKey || data.maps.apiKey;
    if (!effectiveMapsKey) {
      setError("Google Satellite key public website ke liye configured nahi hai");
      return;
    }

    let cancelled = false;
    let overlay: OverlayView | null = null;
    const polygons: Polygon[] = [];
    let info: InfoWindow | null = null;
    let tilesListener: Listener | null = null;
    let polygonFrame: number | null = null;
    const previousAuthFailure = win().gm_authFailure;

    setMapReady(false);
    setError("");
    win().gm_authFailure = () => {
      if (cancelled) return;
      setMapReady(false);
      setError("Google Maps API key/referrer authorization fail hui");
    };

    loadGoogleMaps(effectiveMapsKey)
      .then((google) => {
        if (cancelled || !mapNodeRef.current) return;
        const map = new google.maps.Map(mapNodeRef.current, {
          mapTypeId: "hybrid",
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          clickableIcons: true,
          gestureHandling: "greedy",
        });
        const bounds = new google.maps.LatLngBounds(
          { lat: data.bounds.minLat, lng: data.bounds.minLng },
          { lat: data.bounds.maxLat, lng: data.bounds.maxLng },
        );
        map.fitBounds(bounds, 34);

        // Do not block first usable paint on every satellite tile. tilesloaded is
        // telemetry only; the map becomes usable as soon as the Map instance exists.
        setMapReady(true);
        tilesListener = map.addListener("tilesloaded", () => {
          if (cancelled) return;
          performance.mark?.("rekixo-geo-tiles-loaded");
        });

        overlay = addMasterplanOverlay(
          google,
          map,
          masterplanUrlForViewport(data),
          data.masterplanCorners,
        );

        info = new google.maps.InfoWindow();
        let nextFeatureIndex = 0;
        const appendPlotChunk = () => {
          polygonFrame = null;
          if (cancelled || !info) return;
          const end = Math.min(nextFeatureIndex + PLOT_RENDER_CHUNK_SIZE, data.features.length);
          for (; nextFeatureIndex < end; nextFeatureIndex += 1) {
            polygons.push(createPlotPolygon(google, map, info, data.features[nextFeatureIndex]!));
          }
          if (nextFeatureIndex < data.features.length) {
            polygonFrame = window.requestAnimationFrame(appendPlotChunk);
          }
        };
        polygonFrame = window.requestAnimationFrame(appendPlotChunk);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "Google Satellite load fail hui");
      });

    return () => {
      cancelled = true;
      if (polygonFrame !== null) window.cancelAnimationFrame(polygonFrame);
      tilesListener?.remove?.();
      overlay?.setMap(null);
      polygons.forEach((polygon) => polygon.setMap(null));
      info?.close();
      win().gm_authFailure = previousAuthFailure;
    };
  }, [data, mapsApiKey]);

  const googleLinks = data ? googleMapsLinks(data) : null;

  return (
    <main className={styles.shell}>
      <div ref={mapNodeRef} className={styles.map} aria-label={`${projectName} satellite map`} />

      <header className={styles.header}>
        <div>
          <small>LIVE SATELLITE MASTERPLAN</small>
          <h1>{projectName}</h1>
          <p>{data ? `Geo revision ${data.revision}` : "Loading…"}</p>
        </div>
        <a href={`/projects/${encodeURIComponent(projectSlug)}`}>Project site</a>
      </header>

      {googleLinks && mapReady ? (
        <nav className={styles.mapActions} aria-label="External map actions">
          <a href={googleLinks.open} target="_blank" rel="noopener noreferrer">
            Open in Google Maps
          </a>
          <a href={googleLinks.directions} target="_blank" rel="noopener noreferrer">
            Directions
          </a>
        </nav>
      ) : null}

      {data ? (
        <section className={styles.legend} aria-label="Plot availability">
          <span><i className={styles.available} /> Available <b>{data.counts.available}</b></span>
          <span><i className={styles.booked} /> Booked <b>{data.counts.booked}</b></span>
          <span><i className={styles.sold} /> Sold <b>{data.counts.sold}</b></span>
          <span>Total <b>{data.counts.total}</b></span>
        </section>
      ) : null}

      {!error && (!data || !mapReady) ? (
        <div className={styles.loading}>
          {data ? "Google Satellite initialize ho raha hai…" : "Satellite map data load ho raha hai…"}
        </div>
      ) : null}
      {error ? (
        <div className={styles.error}>
          <b>Map load nahi hua</b>
          <span>{error}</span>
        </div>
      ) : null}
    </main>
  );
}
