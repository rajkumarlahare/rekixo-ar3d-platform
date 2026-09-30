"use client";

import { useEffect, useRef, useState } from "react";
import { Box, MapPinned } from "lucide-react";
import styles from "./geo-3d-placement-visual.module.css";

type LatLng = { lat(): number; lng(): number };
type MapClickEvent = { latLng?: LatLng | null };
type Listener = { remove?: () => void };
type MapInstance = {
  addListener(eventName: string, listener: (event: MapClickEvent) => void): Listener;
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
type GoogleRoot = {
  maps: {
    Map: new (node: HTMLElement, options: Record<string, unknown>) => MapInstance;
    Circle: new (options: Record<string, unknown>) => Circle;
    Polyline: new (options: Record<string, unknown>) => Polyline;
    importLibrary?: (name: string) => Promise<unknown>;
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
};

type Mutable3DMap = HTMLElement & {
  center?: unknown;
  heading?: number;
};
type Mutable3DModel = HTMLElement & {
  position?: unknown;
  orientation?: unknown;
  scale?: number;
};

let mapsPromise: Promise<GoogleRoot> | null = null;

function browserWindow() {
  return window as RekixoWindow;
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
      `&v=weekly&loading=async&callback=${callbackName}`;
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

export default function Geo3DPlacementVisual({
  apiKey,
  modelUrl,
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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const satelliteRef = useRef<HTMLDivElement | null>(null);
  const threeDRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<Circle | null>(null);
  const headingRef = useRef<Polyline | null>(null);
  const mapClickRef = useRef<Listener | null>(null);
  const map3DRef = useRef<Mutable3DMap | null>(null);
  const model3DRef = useRef<Mutable3DModel | null>(null);

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
        const listener = map.addListener("click", (event) => {
          if (disabled || !event.latLng) return;
          onPositionChange(event.latLng.lng(), event.latLng.lat());
        });

        mapRef.current = map;
        markerRef.current = marker;
        headingRef.current = heading;
        mapClickRef.current = listener;
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
      markerRef.current = null;
      headingRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, mode, validPosition, disabled, onPositionChange]);

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
    setReady(false);
    setError("");

    loadGoogleMaps(apiKey)
      .then(async (google) => {
        if (cancelled || !threeDRef.current) return;
        if (!google.maps.importLibrary)
          throw new Error("Google 3D Maps library available nahi hai");

        const library = (await google.maps.importLibrary(
          "maps3d",
        )) as Maps3DLibrary;
        if (cancelled || !threeDRef.current) return;

        const map = new library.Map3DElement({
          center: {
            lat: latitude,
            lng: longitude,
            altitude: Math.max(0, altitudeM + 35),
          },
          range: 190,
          tilt: 68,
          heading: headingDeg,
          mode: "HYBRID",
          gestureHandling: "GREEDY",
        }) as Mutable3DMap;
        const model = new library.Model3DElement({
          src: modelUrl,
          position: {
            lat: latitude,
            lng: longitude,
            altitude: altitudeM,
          },
          orientation: {
            heading: headingDeg,
            tilt: pitchDeg,
            roll: rollDeg,
          },
          scale,
          altitudeMode: "RELATIVE_TO_GROUND",
        }) as Mutable3DModel;

        threeDRef.current.replaceChildren(map);
        map.append(model);
        map3DRef.current = map;
        model3DRef.current = model;
        setReady(true);
      })
      .catch((reason) => {
        if (cancelled) return;
        const message =
          reason instanceof Error
            ? reason.message
            : "3D visual preview load nahi hua";
        setError(message);
        notify(message);
      });

    return () => {
      cancelled = true;
      map3DRef.current = null;
      model3DRef.current = null;
      threeDRef.current?.replaceChildren();
    };
  }, [apiKey, modelUrl, mode, validPosition]);

  useEffect(() => {
    if (mode !== "three-d" || !validPosition) return;
    if (map3DRef.current) {
      map3DRef.current.center = {
        lat: latitude,
        lng: longitude,
        altitude: Math.max(0, altitudeM + 35),
      };
      map3DRef.current.heading = headingDeg;
    }
    if (model3DRef.current) {
      model3DRef.current.position = {
        lat: latitude,
        lng: longitude,
        altitude: altitudeM,
      };
      model3DRef.current.orientation = {
        heading: headingDeg,
        tilt: pitchDeg,
        roll: rollDeg,
      };
      model3DRef.current.scale = scale;
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
          <div className={styles.loading}>Preview initialize ho raha hai…</div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}
      </div>

      <footer className={styles.status}>
        <span>
          Anchor: {latitude.toFixed(7)}, {longitude.toFixed(7)}
        </span>
        <span>Heading {headingDeg.toFixed(1)}°</span>
        <span>Scale {scale.toFixed(3)}</span>
        <span>Ground {altitudeM.toFixed(2)} m</span>
      </footer>
    </section>
  );
}
