import {
  mapNormalizedPointToGeo,
  solveGeoCalibration,
  type GeoControlPoint,
} from "./geo-calibration";
import {
  applyGeoFineAlignment,
  geoAlignmentAnchor,
  normalizeGeoFineAlignment,
} from "./geo-fine-alignment";

type SnapshotFeature = {
  id?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

export type GeoPublicSnapshot = {
  schemaVersion?: number;
  revision?: number;
  featureCollection?: { features?: SnapshotFeature[] };
  controlPoints?: GeoControlPoint[];
  fineAlignment?: unknown;
};

export type GeoPublicManifestFeature = {
  id: string;
  name: string;
  linkedPlotId: string | null;
  source: string;
  layer: string;
  path: [number, number][];
};

export type GeoPublicManifest = {
  schemaVersion: 1;
  revision: number;
  masterplanCorners: [number, number][];
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  features: GeoPublicManifestFeature[];
};

function polygonRing(raw: unknown) {
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) return [] as [number, number][];
  const result: [number, number][] = [];
  for (const point of raw[0] as unknown[]) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    result.push([x, y]);
  }
  return result;
}

export function buildGeoPublicManifest(snapshot: GeoPublicSnapshot, revision: number) {
  const controlPoints = Array.isArray(snapshot.controlPoints)
    ? snapshot.controlPoints
    : [];
  if (controlPoints.length < 4)
    throw new Error("Published calibration incomplete hai");

  const calibration = solveGeoCalibration(controlPoints);
  const fineAlignment = normalizeGeoFineAlignment(snapshot.fineAlignment);
  const anchor = geoAlignmentAnchor(calibration);
  const transform = (point: [number, number]) =>
    applyGeoFineAlignment(point, anchor, fineAlignment) as [number, number];

  const cornerSources: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const masterplanCorners = cornerSources.map((point) =>
    transform(mapNormalizedPointToGeo(calibration, point)),
  );

  const features = (snapshot.featureCollection?.features || [])
    .filter((feature) => feature.geometry?.type === "Polygon")
    .map((feature, index) => {
      const properties = feature.properties || {};
      const linkedPlotId = String(properties.linkedPlotId || "").trim() || null;
      const rawPath = polygonRing(feature.geometry?.coordinates);
      return {
        id: String(feature.id || linkedPlotId || `feature-${index + 1}`),
        name: String(properties.name || (linkedPlotId ? `Plot ${linkedPlotId}` : "Site feature")),
        linkedPlotId,
        source: String(properties.source || ""),
        layer: String(properties.layer || ""),
        path: rawPath.map(transform),
      } satisfies GeoPublicManifestFeature;
    })
    .filter((feature) => feature.path.length >= 3);

  const allPoints = [
    ...masterplanCorners,
    ...features.flatMap((feature) => feature.path),
  ];
  const manifest: GeoPublicManifest = {
    schemaVersion: 1,
    revision,
    masterplanCorners,
    bounds: {
      minLng: Math.min(...allPoints.map((point) => point[0])),
      minLat: Math.min(...allPoints.map((point) => point[1])),
      maxLng: Math.max(...allPoints.map((point) => point[0])),
      maxLat: Math.max(...allPoints.map((point) => point[1])),
    },
    features,
  };
  return manifest;
}

export function parseGeoPublicManifest(raw: string, revision: number) {
  const manifest = JSON.parse(raw) as GeoPublicManifest;
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.revision !== revision ||
    !Array.isArray(manifest.masterplanCorners) ||
    manifest.masterplanCorners.length !== 4 ||
    !manifest.bounds ||
    !Array.isArray(manifest.features)
  ) {
    throw new Error("Published Geo manifest invalid hai");
  }
  return manifest;
}
