export type PlotSideRole = "front" | "back" | "depthA" | "depthB";
export type PlotSideLayout = "three" | "four";

export type PlotSideSemanticsV1 = {
  version: 1;
  pointCount: number;
  // Optional so every existing saved project remains valid without migration.
  // "three" means Front + Back + Depth A; Depth B is intentionally N/A.
  layout?: PlotSideLayout;
  roles: Partial<Record<PlotSideRole, number[]>>;
};

const ROLES: PlotSideRole[] = ["front", "back", "depthA", "depthB"];

function cleanEdges(value: unknown, pointCount: number) {
  if (!Array.isArray(value)) return [];
  const output: number[] = [];
  for (const item of value) {
    if (
      (typeof item !== "number" && typeof item !== "string") ||
      String(item).trim() === ""
    ) continue;
    const edge = Number(item);
    if (!Number.isInteger(edge) || edge < 0 || edge >= pointCount) continue;
    if (!output.includes(edge)) output.push(edge);
  }
  return output.slice(0, Math.max(1, pointCount));
}

export function parsePlotSideSemantics(
  value: unknown,
  pointCount?: number,
): PlotSideSemanticsV1 | null {
  if (value == null || String(value).trim() === "") return null;
  try {
    const parsed =
      typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return null;
    const source = parsed as {
      version?: unknown;
      pointCount?: unknown;
      layout?: unknown;
      roles?: Record<string, unknown>;
    };
    if (Number(source.version) !== 1) return null;
    const storedCount = Number(source.pointCount);
    if (!Number.isInteger(storedCount) || storedCount < 3 || storedCount > 80)
      return null;
    if (pointCount != null && storedCount !== pointCount) return null;
    const roles: PlotSideSemanticsV1["roles"] = {};
    for (const role of ROLES) {
      const edges = cleanEdges(source.roles?.[role], storedCount);
      if (edges.length) roles[role] = edges;
    }
    const layout: PlotSideLayout | undefined =
      source.layout === "three" || source.layout === "four"
        ? source.layout
        : undefined;
    return Object.keys(roles).length
      ? { version: 1, pointCount: storedCount, ...(layout ? { layout } : {}), roles }
      : null;
  } catch {
    return null;
  }
}

export function serializePlotSideSemantics(
  pointCount: number,
  roles: Partial<Record<PlotSideRole, number[]>>,
  layout?: PlotSideLayout,
) {
  if (!Number.isInteger(pointCount) || pointCount < 3 || pointCount > 80)
    return null;
  const cleaned: PlotSideSemanticsV1["roles"] = {};
  for (const role of ROLES) {
    const edges = cleanEdges(roles[role], pointCount);
    if (edges.length) cleaned[role] = edges;
  }
  return Object.keys(cleaned).length
    ? JSON.stringify({
        version: 1,
        pointCount,
        ...(layout === "three" || layout === "four" ? { layout } : {}),
        roles: cleaned,
      })
    : null;
}

export function primaryPlotSideEdge(
  value: unknown,
  role: PlotSideRole,
  pointCount?: number,
) {
  return parsePlotSideSemantics(value, pointCount)?.roles[role]?.[0] ?? null;
}

export function setPlotSideEdge(
  value: unknown,
  role: PlotSideRole,
  edge: number | null,
  pointCount: number,
) {
  const current = parsePlotSideSemantics(value, pointCount);
  const roles: Partial<Record<PlotSideRole, number[]>> = {
    ...(current?.roles || {}),
  };
  if (edge == null) delete roles[role];
  else roles[role] = [edge];
  return serializePlotSideSemantics(pointCount, roles, current?.layout);
}
