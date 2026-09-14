import { cleanPlotId } from "./mapper-geometry";

export type PlotSheetRow = {
  id: string;
  sqft: number;
  sqm: number;
  sqyd: number;
  dimensions: string;
  road: string;
  front: number | null;
  depth: number | null;
  back: number | null;
  depth2: number | null;
  dimensionUnit: "ft" | "m" | "";
  frontEdgeIndex: number | null;
  depthEdgeIndex: number | null;
  backEdgeIndex: number | null;
  depth2EdgeIndex: number | null;
  frontLabel: string;
  depthLabel: string;
  backLabel: string;
  depth2Label: string;
  sideDimensions: string;
  notes: string;
};

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(current.trim());
      current = "";
    } else current += char;
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

const aliases: Record<string, string[]> = {
  id: ["id", "plot", "plotno", "plotnumber", "lot", "lotno", "lotnumber"],
  sqft: ["sqft", "squarefeet", "squarefoot", "areaft", "areasqft"],
  sqm: ["sqm", "squaremetre", "squaremeter", "m2", "areasqm"],
  sqyd: ["sqyd", "squareyard", "squareyards", "yd2", "areasqyd"],
  dimensions: ["dimensions", "dimension", "size", "plotsize", "measurement"],
  road: ["road", "roadaccess", "facing", "face", "roadfacing"],
  front: ["front", "frontage", "frontlength", "frontft", "frontfeet"],
  depth: ["depth", "plotdepth", "depthlength", "depthft", "depthfeet", "deptha"],
  back: ["back", "rear", "backlength", "rearwidth", "backft", "backfeet"],
  depth2: ["depth2", "depthb", "depthright", "otherdepth", "seconddepth"],
  dimensionUnit: ["dimensionunit", "lengthunit", "measurementunit", "unit"],
  frontEdge: ["frontedge", "frontedge1based", "roadedge", "roadsideedge"],
  depthEdge: ["depthedge", "depthedge1based", "depthsideedge", "depthaedge"],
  backEdge: ["backedge", "rearedge", "backedge1based"],
  depth2Edge: ["depth2edge", "depthbedge", "seconddepthedge"],
  frontLabel: ["frontlabel", "frontdisplay", "fronttext", "frontdisplaylabel"],
  depthLabel: ["depthlabel", "depthdisplay", "depthtext", "depthdisplaylabel", "depthalabel"],
  backLabel: ["backlabel", "rearlabell", "reardisplay", "backdisplay"],
  depth2Label: ["depth2label", "depthblabel", "seconddepthlabel"],
  sideDimensions: ["sidedimensions", "sidemeasurements", "sidelabels", "pdfsides"],
  notes: ["notes", "note", "remarks", "remark"],
};

function columnFor(headers: string[], name: keyof typeof aliases) {
  const options = aliases[name];
  return headers.findIndex((header) => options.includes(header));
}

function normalizedObject(input: Record<string, unknown>) {
  const byHeader = new Map(
    Object.entries(input).map(([key, value]) => [normalizeHeader(key), value]),
  );
  const output: Record<string, unknown> = {};
  (Object.keys(aliases) as Array<keyof typeof aliases>).forEach((name) => {
    const alias = aliases[name].find((option) => byHeader.has(option));
    if (alias) output[name] = byHeader.get(alias);
  });
  return output;
}

function assertUniqueRows(rows: PlotSheetRow[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  rows.forEach((row) => {
    if (seen.has(row.id)) duplicates.add(row.id);
    seen.add(row.id);
  });
  if (duplicates.size) {
    throw new Error(
      `Plot sheet me duplicate Plot ID mile: ${[...duplicates].slice(0, 8).join(", ")}`,
    );
  }
  return rows;
}

function finite(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function optionalPositive(value: unknown, label: string) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/[′’]/g, "'")
    .replace(/[″“”]/g, '"');

  const parsed = Number(normalized);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  // Approved-plan human input:
  // 18'-11", 18' 11", 18 ft 11 in, 44', 44 ft.
  const feetInches = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*[-\s]*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches))?$/i,
  );
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = feetInches[2] ? Number(feetInches[2]) : 0;
    if (
      Number.isFinite(feet) &&
      feet >= 0 &&
      Number.isFinite(inches) &&
      inches >= 0 &&
      inches < 12
    ) {
      const totalFeet = feet + inches / 12;
      if (totalFeet > 0) return totalFeet;
    }
  }

  throw new Error(
    `${label} positive number ya feet-inch format (18 ft 11 in) me hona chahiye`,
  );
}

function dimensionUnit(value: unknown, dimensions: string, hasMeasurement: boolean) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["ft", "feet", "foot", "'"].includes(raw)) return "ft" as const;
  if (["m", "meter", "metre", "meters", "metres"].includes(raw)) return "m" as const;
  if (raw) throw new Error("Dimension Unit sirf ft ya m ho sakta hai");
  if (!hasMeasurement) return "" as const;
  const hint = dimensions.toLowerCase().replace(/[′’]/g, "'");
  if (hint.includes("'") || /\b(ft|feet|foot)\b/.test(hint)) return "ft" as const;
  if (/\b(m|meter|metre|meters|metres)\b/.test(hint)) return "m" as const;
  return "ft" as const;
}

function edgeIndex(value: unknown, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const oneBased = Number(raw);
  if (!Number.isInteger(oneBased) || oneBased < 1 || oneBased > 80)
    throw new Error(`${label} 1 se 80 ke beech integer hona chahiye`);
  return oneBased - 1;
}

function cleanDimensionText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeRow(input: Record<string, unknown>): PlotSheetRow | null {
  const id = cleanPlotId(String(input.id || ""));
  if (!id) return null;
  let sqft = finite(input.sqft);
  let sqm = finite(input.sqm);
  let sqyd = finite(input.sqyd);
  if (!sqft && sqm) sqft = sqm * 10.7639;
  if (!sqft && sqyd) sqft = sqyd * 9;
  if (!sqm && sqft) sqm = sqft / 10.7639;
  if (!sqyd && sqft) sqyd = sqft / 9;
  if (!sqft) return null;
  const dimensions = String(input.dimensions || "").trim().slice(0, 120);
  const front = optionalPositive(input.front, "Front");
  const depth = optionalPositive(input.depth, "Depth");
  const back = optionalPositive(input.back, "Back");
  const depth2 = optionalPositive(input.depth2, "Depth 2");
  const measurementHint = [
    dimensions,
    String(input.front ?? ""),
    String(input.depth ?? ""),
    String(input.back ?? ""),
    String(input.depth2 ?? ""),
  ].join(" ");
  const unit = dimensionUnit(
    input.dimensionUnit,
    measurementHint,
    front !== null || depth !== null || back !== null || depth2 !== null,
  );
  return {
    id,
    sqft,
    sqm,
    sqyd,
    dimensions,
    road: String(input.road || "").trim().slice(0, 160),
    front,
    depth,
    back,
    depth2,
    dimensionUnit: unit,
    frontEdgeIndex: edgeIndex(input.frontEdge, "Front Edge"),
    depthEdgeIndex: edgeIndex(input.depthEdge, "Depth Edge"),
    backEdgeIndex: edgeIndex(input.backEdge, "Back Edge"),
    depth2EdgeIndex: edgeIndex(input.depth2Edge, "Depth 2 Edge"),
    frontLabel: cleanDimensionText(input.frontLabel, 160),
    depthLabel: cleanDimensionText(input.depthLabel, 160),
    backLabel: cleanDimensionText(input.backLabel, 160),
    depth2Label: cleanDimensionText(input.depth2Label, 160),
    sideDimensions: cleanDimensionText(input.sideDimensions, 500),
    notes: String(input.notes || "").trim().slice(0, 2000),
  };
}

export function parsePlotSheetText(text: string, filename: string) {
  if (filename.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { plots?: unknown[] })?.plots)
        ? (parsed as { plots: unknown[] }).plots
        : [];
    return assertUniqueRows(
      list
        .map((item) => normalizedObject((item || {}) as Record<string, unknown>))
        .map((item) => normalizeRow(item))
        .filter((row): row is PlotSheetRow => Boolean(row)),
    );
  }

  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const indexes = {
    id: columnFor(headers, "id"),
    sqft: columnFor(headers, "sqft"),
    sqm: columnFor(headers, "sqm"),
    sqyd: columnFor(headers, "sqyd"),
    dimensions: columnFor(headers, "dimensions"),
    road: columnFor(headers, "road"),
    front: columnFor(headers, "front"),
    depth: columnFor(headers, "depth"),
    back: columnFor(headers, "back"),
    depth2: columnFor(headers, "depth2"),
    dimensionUnit: columnFor(headers, "dimensionUnit"),
    frontEdge: columnFor(headers, "frontEdge"),
    depthEdge: columnFor(headers, "depthEdge"),
    backEdge: columnFor(headers, "backEdge"),
    depth2Edge: columnFor(headers, "depth2Edge"),
    frontLabel: columnFor(headers, "frontLabel"),
    depthLabel: columnFor(headers, "depthLabel"),
    backLabel: columnFor(headers, "backLabel"),
    depth2Label: columnFor(headers, "depth2Label"),
    sideDimensions: columnFor(headers, "sideDimensions"),
    notes: columnFor(headers, "notes"),
  };
  if (indexes.id < 0 || (indexes.sqft < 0 && indexes.sqm < 0 && indexes.sqyd < 0)) {
    throw new Error("CSV me Plot No/ID aur area column (sqft/sqm/sqyd) chahiye");
  }
  const value = (row: string[], index: number) => (index >= 0 ? row[index] || "" : "");
  return assertUniqueRows(
    lines
      .slice(1)
      .map(parseCsvLine)
      .map((row) =>
        normalizeRow({
          id: value(row, indexes.id),
          sqft: value(row, indexes.sqft),
          sqm: value(row, indexes.sqm),
          sqyd: value(row, indexes.sqyd),
          dimensions: value(row, indexes.dimensions),
          road: value(row, indexes.road),
          front: value(row, indexes.front),
          depth: value(row, indexes.depth),
          back: value(row, indexes.back),
          depth2: value(row, indexes.depth2),
          dimensionUnit: value(row, indexes.dimensionUnit),
          frontEdge: value(row, indexes.frontEdge),
          depthEdge: value(row, indexes.depthEdge),
          backEdge: value(row, indexes.backEdge),
          depth2Edge: value(row, indexes.depth2Edge),
          frontLabel: value(row, indexes.frontLabel),
          depthLabel: value(row, indexes.depthLabel),
          backLabel: value(row, indexes.backLabel),
          depth2Label: value(row, indexes.depth2Label),
          sideDimensions: value(row, indexes.sideDimensions),
          notes: value(row, indexes.notes),
        }),
      )
      .filter((row): row is PlotSheetRow => Boolean(row)),
  );
}
