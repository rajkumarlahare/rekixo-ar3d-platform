const DEFAULT_SQM_TO_SQFT_FACTOR = 10.7639;
const SQM_TO_SQYD_FACTOR = 1.1959900463;
const METERS_TO_FEET = 3.28083989501312;
const SIDE_ROLES = [
  { role: "front", valueKey: "front", edgeKey: "frontEdgeIndex", labelKey: "frontLabel" },
  { role: "back", valueKey: "back", edgeKey: "backEdgeIndex", labelKey: "backLabel" },
  { role: "depthA", valueKey: "depth", edgeKey: "depthEdgeIndex", labelKey: "depthLabel" },
  { role: "depthB", valueKey: "depth2", edgeKey: "depth2EdgeIndex", labelKey: "depth2Label" },
];

function positive(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundArea(value) {
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(3)) : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function parsePoints(value) {
  let raw = value;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 80) return null;
  const points = raw.map((point) => {
    if (!Array.isArray(point) || point.length !== 2) return null;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null;
    return [x, y];
  });
  return points.every(Boolean) ? points : null;
}

function roleIndices(plot, pointCount) {
  let roles = {};
  const raw = plot.edgeSemantics;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && Number(parsed.version) === 1 && Number(parsed.pointCount) === pointCount && parsed.roles && typeof parsed.roles === "object") {
      for (const name of ["front", "back", "depthA", "depthB"]) {
        const value = parsed.roles[name];
        if (!Array.isArray(value)) continue;
        const clean = [...new Set(value.map(Number).filter((edge) => Number.isInteger(edge) && edge >= 0 && edge < pointCount))];
        if (clean.length) roles[name] = clean;
      }
    }
  } catch {}
  for (const side of SIDE_ROLES) {
    if (roles[side.role]?.length) continue;
    const rawEdge = plot[side.edgeKey];
    if (rawEdge === null || rawEdge === undefined || String(rawEdge).trim() === "") continue;
    const edge = Number(rawEdge);
    if (Number.isInteger(edge) && edge >= 0 && edge < pointCount) roles[side.role] = [edge];
  }
  return roles;
}

function detectUnit(plot, measurementRows = []) {
  const direct = String(plot.dimensionUnit || "").trim().toLowerCase();
  if (["ft", "feet", "foot", "'"].includes(direct)) return "ft";
  if (["m", "meter", "metre", "meters", "metres"].includes(direct)) return "m";
  const evidence = [
    plot.dimensions, plot.frontLabel, plot.backLabel, plot.depthLabel,
    plot.depth2Label, plot.sideDimensions,
    ...measurementRows.map((row) => row.rawLabel),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(ft|feet|foot|inch|inches)\b|[′'″"]/.test(evidence)) return "ft";
  if (/\b(m|meter|metre|meters|metres)\b/.test(evidence)) return "m";
  return "";
}

function parseLength(value, unit) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return unit === "m" ? parsed * METERS_TO_FEET : unit === "ft" ? parsed : 0;
  const normalized = raw.replace(/[′’]/g, "'").replace(/[″“”]/g, '"');
  const feetInches = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*[-\s]*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches))?$/i);
  if (feetInches) return Number(feetInches[1]) + (Number(feetInches[2] || 0) / 12);
  const metric = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:m|meter|metre|meters|metres)$/i);
  if (metric) return Number(metric[1]) * METERS_TO_FEET;
  return 0;
}

function measurementLength(plot, side, unit) {
  const direct = parseLength(plot[side.valueKey], unit);
  if (direct > 0) return direct;
  const rows = Array.isArray(plot.edgeMeasurements) ? plot.edgeMeasurements : [];
  const roleRows = rows.filter((row) => String(row.role || "").toLowerCase() === side.role && positive(row.length) > 0);
  if (!roleRows.length) return parseLength(plot[side.labelKey], unit);
  const segments = roleRows.map((row) => {
    const rowUnit = String(row.unit || unit).toLowerCase();
    const length = positive(row.length);
    if (!length) return 0;
    if (["m", "meter", "metre", "meters", "metres"].includes(rowUnit)) return length * METERS_TO_FEET;
    if (["ft", "feet", "foot"].includes(rowUnit)) return length;
    return 0;
  });
  if (segments.some((length) => !(length > 0))) return parseLength(plot[side.labelKey], unit);
  return segments.reduce((sum, length) => sum + length, 0);
}

function edgePathPixels(points, edgeIndices, width, height) {
  if (!points || !edgeIndices?.length) return 0;
  return edgeIndices.reduce((sum, edge) => {
    const start = points[edge];
    const end = points[(edge + 1) % points.length];
    const dx = (end[0] - start[0]) * width;
    const dy = (end[1] - start[1]) * height;
    return sum + Math.hypot(dx, dy);
  }, 0);
}

function polygonAreaPixels(points, width, height) {
  if (!points) return 0;
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const x = points[index][0] * width;
    const y = points[index][1] * height;
    const nx = next[0] * width;
    const ny = next[1] * height;
    twiceArea += x * ny - nx * y;
  }
  return Math.abs(twiceArea) / 2;
}

function dimensionsAreaSqft(plot) {
  const dimensions = String(plot.dimensions || "").replace(/,/g, "").trim();
  // Accept ordinary plot-size notations, including 25' × 60', 25 x 60,
  // 25' x 60', 25 ft by 60 ft, and 25 × 60 ft.
  const match = dimensions.match(/^\s*(\d+(?:\.\d+)?)\s*(?:'|ft\.?|feet|foot)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:'|ft\.?|feet|foot)?\s*$/i);
  if (!match) return 0;
  const first = Number(match[1]), second = Number(match[2]);
  if (!(first > 0 && second > 0)) return 0;
  return first * second;
}

function sideRectangleAreaSqft(plot) {
  const unit = detectUnit(plot, Array.isArray(plot.edgeMeasurements) ? plot.edgeMeasurements : []);
  if (!unit) return 0;
  const front = measurementLength(plot, SIDE_ROLES[0], unit);
  const back = measurementLength(plot, SIDE_ROLES[1], unit);
  const depthA = measurementLength(plot, SIDE_ROLES[2], unit);
  const depthB = measurementLength(plot, SIDE_ROLES[3], unit);
  // Both widths and depths must agree before using a rectangle formula.
  // This deliberately avoids applying a rectangle formula to tapered/irregular plots.
  const close = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= 0.01;
  if (close(front, back) && close(depthA, depthB)) {
    return ((front + back) / 2) * ((depthA + depthB) / 2);
  }
  return 0;
}

function calibrationFor(plot, width, height) {
  const points = parsePoints(plot.polygon);
  if (!points) return { points: null, pixelArea: 0, samples: [] };
  const indices = roleIndices(plot, points.length);
  const measurementRows = Array.isArray(plot.edgeMeasurements) ? plot.edgeMeasurements : [];
  const unit = detectUnit(plot, measurementRows);
  if (!unit) return { points, pixelArea: polygonAreaPixels(points, width, height), samples: [] };
  const samples = [];
  for (const side of SIDE_ROLES) {
    const pixels = edgePathPixels(points, indices[side.role], width, height);
    const lengthFt = measurementLength(plot, side, unit);
    if (pixels > 0 && lengthFt > 0) samples.push(lengthFt / pixels);
  }
  return { points, pixelArea: polygonAreaPixels(points, width, height), samples };
}

function trustedGlobalScale(samples) {
  const valid = samples.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length < 8) return 0;
  const center = median(valid);
  const inliers = valid.filter((value) => value >= center * 0.7 && value <= center * 1.3);
  return inliers.length >= 8 ? median(inliers) : 0;
}

/**
 * Fills only missing area fields. When all saved area units are unknown, it derives
 * square feet from the mapped polygon area and the robust scale fitted to saved
 * Front/Back/Depth side measurements. Geometry-derived values are explicitly tagged.
 */
export function deriveCustomerPlotAreas(plots, options = {}) {
  const width = positive(options.mapWidth);
  const height = positive(options.mapHeight);
  const rawFactor = Number(options.sqmToSqftFactor);
  const factor = Number.isFinite(rawFactor) && rawFactor >= 9 && rawFactor <= 12 ? rawFactor : DEFAULT_SQM_TO_SQFT_FACTOR;
  const canCalibrate = width > 0 && height > 0;
  const prepared = plots.map((plot) => {
    const calibration = canCalibrate
      ? calibrationFor(plot, width, height)
      : { points: null, pixelArea: 0, samples: [] };
    return { plot, ...calibration };
  });
  const globalScale = trustedGlobalScale(prepared.flatMap((item) => item.samples));

  return prepared.map((item) => {
    const plot = item.plot;
    let sqft = positive(plot.sqft);
    let sqm = positive(plot.sqm);
    let sqyd = positive(plot.sqyd);
    let areaSource = "";
    if (!(sqft > 0) && sqm > 0) sqft = sqm * factor;
    if (!(sqm > 0) && sqft > 0) sqm = sqft / factor;
    if (!(sqyd > 0) && sqm > 0) sqyd = sqm * SQM_TO_SQYD_FACTOR;
    if (!(sqm > 0) && sqyd > 0) sqm = sqyd / SQM_TO_SQYD_FACTOR;
    if (!(sqft > 0) && sqm > 0) sqft = sqm * factor;

    if (!(sqft > 0) && !(sqm > 0) && !(sqyd > 0)) {
      const dimensionsArea = dimensionsAreaSqft(plot);
      const sideArea = dimensionsArea > 0 ? 0 : sideRectangleAreaSqft(plot);
      const explicitArea = dimensionsArea > 0 ? dimensionsArea : sideArea;
      if (explicitArea > 0 && explicitArea <= 100_000_000) {
        sqft = explicitArea;
        sqm = sqft / factor;
        sqyd = sqm * SQM_TO_SQYD_FACTOR;
        areaSource = "side-measurements";
      }
    }

    if (!(sqft > 0) && !(sqm > 0) && !(sqyd > 0) && item.pixelArea > 0) {
      const local = item.samples.filter((value) => Number.isFinite(value) && value > 0);
      const localCenter = median(local);
      const localInliers = localCenter > 0
        ? local.filter((value) => value >= localCenter * 0.7 && value <= localCenter * 1.3)
        : [];
      let scale = localInliers.length >= 2 ? median(localInliers) : 0;
      if (!(scale > 0)) {
        const globalCompatible = globalScale > 0 && local.some((value) => value >= globalScale * 0.65 && value <= globalScale * 1.35);
        if (globalScale > 0 && (local.length === 0 || globalCompatible)) scale = globalScale;
      }
      const computed = item.pixelArea * scale * scale;
      if (scale > 0 && Number.isFinite(computed) && computed > 0 && computed <= 100_000_000) {
        sqft = computed;
        sqm = sqft / factor;
        sqyd = sqm * SQM_TO_SQYD_FACTOR;
        areaSource = "mapped-geometry";
      }
    }

    return {
      ...plot,
      sqft: roundArea(sqft),
      sqm: roundArea(sqm),
      sqyd: roundArea(sqyd),
      ...(areaSource ? { areaSource } : {}),
    };
  });
}
