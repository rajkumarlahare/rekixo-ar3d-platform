import type { MapperPoint } from "./mapper-geometry";
import { type EdgeDirection, type QuarterTurn } from "./plot-edge-semantics";
import {
  parsePlotSideSemantics,
  type PlotFacingCardinalDirection,
  type PlotSideRole,
} from "./plot-side-semantics";

export type PlotFacingDirection =
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west";

export type PlotFacingResult = {
  direction: PlotFacingDirection;
  label: string;
  arrow: string;
  role: PlotSideRole;
};

export const PLOT_FACING_ORDER: Array<{
  direction: PlotFacingDirection;
  label: string;
  arrow: string;
}> = [
  { direction: "north", label: "North", arrow: "↑" },
  { direction: "north-east", label: "North-East", arrow: "↗" },
  { direction: "east", label: "East", arrow: "→" },
  { direction: "south-east", label: "South-East", arrow: "↘" },
  { direction: "south", label: "South", arrow: "↓" },
  { direction: "south-west", label: "South-West", arrow: "↙" },
  { direction: "west", label: "West", arrow: "←" },
  { direction: "north-west", label: "North-West", arrow: "↖" },
];

const NORTH_ANGLES: Record<EdgeDirection, number> = {
  top: -Math.PI / 2,
  right: 0,
  bottom: Math.PI / 2,
  left: Math.PI,
};

export function normalizePlotNorthDirection(value: unknown): EdgeDirection {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "right" || raw === "bottom" || raw === "left" ? raw : "top";
}

function normalizeFacingRotation(value: unknown): QuarterTurn {
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 ? parsed : 0;
}

// Plot polygons stay in canonical source-image coordinates, but the image and
// polygon are displayed with publicRotation applied. Rotate direction vectors
// through the same quarter-turn before comparing them with the selected North.
function rotateFacingVectorForDisplay(
  [x, y]: MapperPoint,
  rotation: QuarterTurn,
): MapperPoint {
  if (rotation === 1) return [-y, x];
  if (rotation === 2) return [-x, -y];
  if (rotation === 3) return [y, -x];
  return [x, y];
}

export function roadFacingRolesForPlot(
  edgeSemantics: unknown,
  pointCount: number,
): PlotSideRole[] {
  const parsed = parsePlotSideSemantics(edgeSemantics, pointCount);
  if (!parsed) return [];
  // Backward-compatible default: once a project enables Facing, an older plot
  // with valid side semantics is treated as single-road Front until the mapper
  // explicitly marks another logical side.
  return parsed.roadFacingRoles?.length
    ? [...parsed.roadFacingRoles]
    : parsed.roles.front?.length
      ? ["front"]
      : [];
}

function polygonCenter(points: MapperPoint[]): MapperPoint {
  if (!points.length) return [0, 0];
  const [x, y] = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as MapperPoint,
    [0, 0] as MapperPoint,
  );
  return [x / points.length, y / points.length];
}

function logicalSideOutwardVector(
  points: MapperPoint[],
  edges: number[],
): MapperPoint | null {
  if (points.length < 3 || !edges.length) return null;
  const center = polygonCenter(points);
  let vx = 0;
  let vy = 0;
  let longest: { x: number; y: number; length: number } | null = null;

  for (const edge of edges) {
    if (!Number.isInteger(edge) || edge < 0 || edge >= points.length) continue;
    const a = points[edge];
    const b = points[(edge + 1) % points.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) continue;

    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    let nx = -dy / length;
    let ny = dx / length;
    // Choose the normal that points away from the plot center.
    if ((mx - center[0]) * nx + (my - center[1]) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    vx += nx * length;
    vy += ny * length;
    if (!longest || length > longest.length) longest = { x: nx, y: ny, length };
  }

  const magnitude = Math.hypot(vx, vy);
  if (magnitude > 1e-9) return [vx / magnitude, vy / magnitude];
  return longest ? [longest.x, longest.y] : null;
}

function directionForVector(
  vector: MapperPoint,
  northDirection: EdgeDirection,
  rotation: QuarterTurn = 0,
) {
  const displayVector = rotateFacingVectorForDisplay(vector, rotation);
  const screenAngle = Math.atan2(displayVector[1], displayVector[0]);
  const northAngle = NORTH_ANGLES[northDirection];
  const clockwiseFromNorth =
    ((screenAngle - northAngle) % (Math.PI * 2) + Math.PI * 2) %
    (Math.PI * 2);
  const octant = Math.round(clockwiseFromNorth / (Math.PI / 4)) % 8;
  return PLOT_FACING_ORDER[octant];
}

export function plotSideDirectionResults(
  points: MapperPoint[],
  edgeSemantics: unknown,
  northDirection: unknown,
  rotation: unknown = 0,
): PlotFacingResult[] {
  if (points.length < 3) return [];
  const semantics = parsePlotSideSemantics(edgeSemantics, points.length);
  if (!semantics) return [];
  const north = normalizePlotNorthDirection(northDirection);
  const displayRotation = normalizeFacingRotation(rotation);
  const output: PlotFacingResult[] = [];
  const roles: PlotSideRole[] = ["front", "depthA", "back", "depthB"];

  for (const role of roles) {
    const vector = logicalSideOutwardVector(points, semantics.roles[role] || []);
    if (!vector) continue;
    const resolved = directionForVector(vector, north, displayRotation);
    output.push({ ...resolved, role });
  }
  return output;
}

function facingMetadata(direction: PlotFacingDirection) {
  return (
    PLOT_FACING_ORDER.find((item) => item.direction === direction) ||
    PLOT_FACING_ORDER[0]
  );
}

export function plotFacingResults(
  points: MapperPoint[],
  edgeSemantics: unknown,
  northDirection: unknown,
  rotation: unknown = 0,
): PlotFacingResult[] {
  if (points.length < 3) return [];
  const semantics = parsePlotSideSemantics(edgeSemantics, points.length);
  if (!semantics) return [];
  const roles = roadFacingRolesForPlot(edgeSemantics, points.length);
  const geometric = new Map(
    plotSideDirectionResults(points, edgeSemantics, northDirection, rotation).map((item) => [
      item.role,
      item,
    ]),
  );
  const output: PlotFacingResult[] = [];
  const seen = new Set<PlotFacingDirection>();

  for (const role of roles) {
    const override = semantics.facingDirectionOverrides?.[role] as
      | PlotFacingCardinalDirection
      | undefined;
    const resolved = override
      ? { ...facingMetadata(override), role }
      : geometric.get(role);
    if (!resolved || seen.has(resolved.direction)) continue;
    seen.add(resolved.direction);
    output.push(resolved);
  }

  output.sort(
    (a, b) =>
      PLOT_FACING_ORDER.findIndex((item) => item.direction === a.direction) -
      PLOT_FACING_ORDER.findIndex((item) => item.direction === b.direction),
  );
  return output;
}

export function cardinalDirectionDistance(
  from: PlotFacingDirection,
  to: PlotFacingCardinalDirection,
) {
  const fromIndex = PLOT_FACING_ORDER.findIndex((item) => item.direction === from);
  const toIndex = PLOT_FACING_ORDER.findIndex((item) => item.direction === to);
  if (fromIndex < 0 || toIndex < 0) return Number.POSITIVE_INFINITY;
  const raw = Math.abs(fromIndex - toIndex);
  return Math.min(raw, PLOT_FACING_ORDER.length - raw);
}

export function plotFacingText(
  points: MapperPoint[],
  edgeSemantics: unknown,
  northDirection: unknown,
  rotation: unknown = 0,
) {
  return plotFacingResults(points, edgeSemantics, northDirection, rotation)
    .map((item) => `${item.arrow} ${item.label}`)
    .join(" · ");
}
