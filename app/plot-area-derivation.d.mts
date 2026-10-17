export type AreaDerivationPlot = {
  id?: string;
  sqft?: unknown;
  sqm?: unknown;
  sqyd?: unknown;
  polygon?: unknown;
  dimensions?: unknown;
  dimensionUnit?: unknown;
  front?: unknown;
  back?: unknown;
  depth?: unknown;
  depth2?: unknown;
  frontEdgeIndex?: unknown;
  backEdgeIndex?: unknown;
  depthEdgeIndex?: unknown;
  depth2EdgeIndex?: unknown;
  frontLabel?: unknown;
  backLabel?: unknown;
  depthLabel?: unknown;
  depth2Label?: unknown;
  sideDimensions?: unknown;
  edgeSemantics?: unknown;
  edgeMeasurements?: Array<{
    role?: unknown;
    edgeIndex?: unknown;
    length?: unknown;
    unit?: unknown;
    rawLabel?: unknown;
  }>;
};

export type CustomerPlotAreaOptions = {
  mapWidth?: unknown;
  mapHeight?: unknown;
  sqmToSqftFactor?: unknown;
};

export function deriveCustomerPlotAreas<T extends AreaDerivationPlot>(
  plots: T[],
  options?: CustomerPlotAreaOptions,
): Array<T & { sqft: number; sqm: number; sqyd: number; areaSource?: "mapped-geometry" | "side-measurements" }>;
