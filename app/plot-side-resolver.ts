import type { MapperPoint } from "./mapper-geometry";
import {
  edgeIndexForDisplayDirection,
  type EdgeDirection,
  type QuarterTurn,
} from "./plot-edge-semantics";
import { serializePlotSideSemantics } from "./plot-side-semantics";

export type ResolvedFourSides = {
  front: number;
  back: number;
  depthA: number;
  depthB: number;
  edgeSemantics: string;
};

export function resolveFourSideEdges(
  polygon: MapperPoint[],
  frontDirection: EdgeDirection,
  rotation: QuarterTurn = 0,
): ResolvedFourSides | null {
  if (polygon.length < 4) return null;
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

  const front = edgeIndexForDisplayDirection(polygon, frontDirection, rotation);
  const back = edgeIndexForDisplayDirection(
    polygon,
    opposite[frontDirection],
    rotation,
  );
  const [depthADirection, depthBDirection] = depthDirections[frontDirection];
  const depthA = edgeIndexForDisplayDirection(
    polygon,
    depthADirection,
    rotation,
  );
  const depthB = edgeIndexForDisplayDirection(
    polygon,
    depthBDirection,
    rotation,
  );
  const selected = [front, back, depthA, depthB];
  if (selected.some((edge) => edge == null) || new Set(selected).size !== 4)
    return null;

  const edgeSemantics = serializePlotSideSemantics(polygon.length, {
    front: [front!],
    back: [back!],
    depthA: [depthA!],
    depthB: [depthB!],
  });
  if (!edgeSemantics) return null;
  return {
    front: front!,
    back: back!,
    depthA: depthA!,
    depthB: depthB!,
    edgeSemantics,
  };
}

export function frontFirstFourSideEdges(
  pointCount: number,
): ResolvedFourSides | null {
  if (pointCount !== 4) return null;
  const edgeSemantics = serializePlotSideSemantics(pointCount, {
    front: [0],
    depthA: [1],
    back: [2],
    depthB: [3],
  });
  if (!edgeSemantics) return null;
  return {
    front: 0,
    depthA: 1,
    back: 2,
    depthB: 3,
    edgeSemantics,
  };
}
