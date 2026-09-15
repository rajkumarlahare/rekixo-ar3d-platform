import { cleanPlotId } from "./mapper-geometry";

export type RoadAccessSheetRow = {
  id: string;
  road: string;
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

const ID_HEADERS = new Set([
  "id",
  "plot",
  "plotno",
  "plotnumber",
  "lot",
  "lotno",
  "lotnumber",
]);

const ROAD_HEADERS = new Set([
  "roadaccess",
  "road",
  "roadwidth",
  "accessroad",
  "frontroad",
  "roadfront",
]);

function cleanRoad(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function parseRoadAccessSheetText(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const idIndex = headers.findIndex((header) => ID_HEADERS.has(header));
  const roadIndex = headers.findIndex((header) => ROAD_HEADERS.has(header));

  if (idIndex < 0 || roadIndex < 0) {
    throw new Error("Road Access CSV me Plot No/ID aur Road Access columns chahiye");
  }

  const seen = new Set<string>();
  const rows: RoadAccessSheetRow[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const id = cleanPlotId(values[idIndex] || "");
    const road = cleanRoad(values[roadIndex] || "");

    // Blank road cells are ignored so this isolated importer can never erase a
    // previously verified road value by accident.
    if (!id || !road) continue;

    if (seen.has(id)) {
      throw new Error(`Road Access CSV me duplicate Plot ID mila: ${id}`);
    }
    seen.add(id);
    rows.push({ id, road });
  }

  return rows;
}
