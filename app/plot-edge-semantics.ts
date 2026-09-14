import type { MapperPoint } from "./mapper-geometry";

export type QuarterTurn = 0 | 1 | 2 | 3;
export type EdgeDirection = "top" | "right" | "bottom" | "left";

function displayPoint([x, y]: MapperPoint, rotation: QuarterTurn): MapperPoint {
  if (rotation === 1) return [1 - y, x];
  if (rotation === 2) return [1 - x, 1 - y];
  if (rotation === 3) return [y, 1 - x];
  return [x, y];
}

function center(points: MapperPoint[]): MapperPoint {
  const sum = points.reduce(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y] as MapperPoint,
    [0, 0] as MapperPoint,
  );
  return points.length ? [sum[0] / points.length, sum[1] / points.length] : [0.5, 0.5];
}

export function edgeIndexForDisplayDirection(
  sourcePoints: MapperPoint[],
  direction: EdgeDirection,
  rotation: QuarterTurn = 0,
) {
  if (sourcePoints.length < 3) return null;
  const points = sourcePoints.map((point) => displayPoint(point, rotation));
  const c = center(points);
  let winner = 0;
  let best = -Infinity;

  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = mx - c[0];
    const dy = my - c[1];
    const score =
      direction === "left" ? -dx :
      direction === "right" ? dx :
      direction === "top" ? -dy :
      dy;
    if (score > best) {
      best = score;
      winner = index;
    }
  }
  return winner;
}
