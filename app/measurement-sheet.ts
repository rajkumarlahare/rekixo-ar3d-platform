import { cleanPlotId } from "./mapper-geometry";

export type MeasurementConfidence = "high" | "medium" | "low";

export type PlotMeasurementSheetRow = {
  id: string;
  front: number | null;
  back: number | null;
  depth: number | null;
  depth2: number | null;
  dimensionUnit: "ft" | "m" | "";
  frontLabel: string;
  backLabel: string;
  depthLabel: string;
  depth2Label: string;
  sideDimensions: string;
  road: string;
  sourceRef: string;
  sourceRawText: string;
  confidence: MeasurementConfidence;
  verified: boolean;
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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

const aliases: Record<string, string[]> = {
  id: ["id", "plot", "plotno", "plotnumber", "lot", "lotno", "lotnumber"],
  front: ["front", "frontage", "frontlength", "frontft", "frontfeet"],
  back: ["back", "rear", "backlength", "rearwidth", "backft", "backfeet"],
  depth: ["depth", "deptha", "plotdepth", "depthlength", "depthft", "depthfeet"],
  depth2: ["depth2", "depthb", "depthright", "otherdepth", "seconddepth"],
  dimensionUnit: ["dimensionunit", "lengthunit", "measurementunit", "unit"],
  frontLabel: ["frontlabel", "frontdisplay", "fronttext"],
  backLabel: ["backlabel", "backdisplay", "rearlabel"],
  depthLabel: ["depthlabel", "depthdisplay", "depthtext", "depthalabel"],
  depth2Label: ["depth2label", "depthblabel", "seconddepthlabel"],
  sideDimensions: ["sidedimensions", "sidemeasurements", "sidelabels", "pdfsides"],
  road: ["road", "roadaccess", "roadtext", "roadwidth"],
  sourceRef: ["sourceref", "source", "sourcepage", "pageref", "reference"],
  sourceRawText: ["sourcerawtext", "rawtext", "sourcetext", "ocrtext"],
  confidence: ["confidence", "sourceconfidence", "aiconfidence"],
  verified: ["verified", "sourceverified", "reviewed", "approved"],
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

function positiveMeasure(value: unknown, label: string) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[′’]/g, "'")
    .replace(/[″“”]/g, '"');
  const parsed = Number(normalized);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

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
      const total = feet + inches / 12;
      if (total > 0) return total;
    }
  }
  throw new Error(`${label} positive number ya feet-inch format me hona chahiye`);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function unit(value: unknown, hasNumeric: boolean) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["m", "meter", "metre", "meters", "metres"].includes(raw)) return "m" as const;
  if (["ft", "feet", "foot", "'"].includes(raw)) return "ft" as const;
  if (raw) throw new Error("Measurement Unit sirf m ya ft ho sakta hai");
  if (hasNumeric)
    throw new Error(
      "Numeric Front/Back/Depth measurements ke saath Measurement Unit dena zaroori hai",
    );
  return "" as const;
}

function confidence(value: unknown): MeasurementConfidence {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "medium";
  if (["high", "h", "verified"].includes(raw)) return "high";
  if (["medium", "med", "m", "review"].includes(raw)) return "medium";
  if (["low", "l", "uncertain"].includes(raw)) return "low";
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    if (numeric >= 0.85) return "high";
    if (numeric >= 0.6) return "medium";
    return "low";
  }
  throw new Error("Confidence high/medium/low ya 0..1 score hona chahiye");
}

function verified(value: unknown, fallback: boolean) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "y", "verified", "approved"].includes(raw)) return true;
  if (["0", "false", "no", "n", "review", "pending"].includes(raw)) return false;
  throw new Error("Verified value true/false ya yes/no hona chahiye");
}

function normalizeRow(input: Record<string, unknown>): PlotMeasurementSheetRow | null {
  const id = cleanPlotId(String(input.id || ""));
  if (!id) return null;

  const front = positiveMeasure(input.front, "Front");
  const back = positiveMeasure(input.back, "Back");
  const depth = positiveMeasure(input.depth, "Depth A");
  const depth2 = positiveMeasure(input.depth2, "Depth B");
  const hasNumeric = [front, back, depth, depth2].some((value) => value != null);
  const dimensionUnit = unit(input.dimensionUnit, hasNumeric);
  const frontLabel = cleanText(input.frontLabel, 160);
  const backLabel = cleanText(input.backLabel, 160);
  const depthLabel = cleanText(input.depthLabel, 160);
  const depth2Label = cleanText(input.depth2Label, 160);
  const sideDimensions = cleanText(input.sideDimensions, 600);
  const road = cleanText(input.road, 180);
  const sourceRef = cleanText(input.sourceRef, 240);
  const sourceRawText = cleanText(input.sourceRawText, 1200);
  const sourceConfidence = confidence(input.confidence);
  const sourceVerified = verified(input.verified, false);

  const hasAnyMeasurement =
    hasNumeric ||
    Boolean(frontLabel || backLabel || depthLabel || depth2Label || sideDimensions);
  if (!hasAnyMeasurement)
    throw new Error(`Plot ${id}: kam se kam ek side measurement/label chahiye`);

  return {
    id,
    front,
    back,
    depth,
    depth2,
    dimensionUnit,
    frontLabel,
    backLabel,
    depthLabel,
    depth2Label,
    sideDimensions,
    road,
    sourceRef,
    sourceRawText,
    confidence: sourceConfidence,
    verified: sourceVerified,
  };
}

function assertUnique(rows: PlotMeasurementSheetRow[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`Measurement sheet me duplicate Plot ID mila: ${row.id}`);
    seen.add(row.id);
  }
  return rows;
}

export function parsePlotMeasurementSheetText(text: string, filename: string) {
  if (filename.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { plots?: unknown[] })?.plots)
        ? (parsed as { plots: unknown[] }).plots
        : [];
    return assertUnique(
      list
        .map((item) => normalizedObject((item || {}) as Record<string, unknown>))
        .map(normalizeRow)
        .filter((row): row is PlotMeasurementSheetRow => Boolean(row)),
    );
  }

  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const indexes = Object.fromEntries(
    (Object.keys(aliases) as Array<keyof typeof aliases>).map((name) => [
      name,
      columnFor(headers, name),
    ]),
  ) as Record<keyof typeof aliases, number>;
  if (indexes.id < 0)
    throw new Error("Measurement sheet me Plot No/ID column chahiye");

  const value = (row: string[], index: number) => (index >= 0 ? row[index] || "" : "");
  return assertUnique(
    lines
      .slice(1)
      .map(parseCsvLine)
      .map((row) =>
        normalizeRow(
          Object.fromEntries(
            (Object.keys(indexes) as Array<keyof typeof aliases>).map((name) => [
              name,
              value(row, indexes[name]),
            ]),
          ),
        ),
      )
      .filter((row): row is PlotMeasurementSheetRow => Boolean(row)),
  );
}
