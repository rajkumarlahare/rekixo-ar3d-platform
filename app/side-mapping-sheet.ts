import { cleanPlotId } from "./mapper-geometry";
import type { EdgeDirection } from "./plot-edge-semantics";

export type SideMappingSheetRow = {
  id: string;
  front: EdgeDirection;
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

function normalizeDirection(value: unknown): EdgeDirection | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["top", "up", "upar", "north", "n", "↑"].includes(raw)) return "top";
  if (["right", "east", "e", "→"].includes(raw)) return "right";
  if (["bottom", "down", "neeche", "south", "s", "↓"].includes(raw)) return "bottom";
  if (["left", "west", "w", "←"].includes(raw)) return "left";
  return null;
}

export function parseSideMappingSheetText(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const idIndex = headers.findIndex((header) =>
    ["id", "plot", "plotno", "plotnumber", "lot", "lotno", "lotnumber"].includes(header),
  );
  const frontIndex = headers.findIndex((header) =>
    ["front", "frontdirection", "roadfront", "roadfrontdirection"].includes(header),
  );

  if (idIndex < 0 || frontIndex < 0) {
    throw new Error("Side Mapping CSV me Plot No/ID aur Front Direction columns chahiye");
  }

  const seen = new Set<string>();
  const rows: SideMappingSheetRow[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const id = cleanPlotId(values[idIndex] || "");
    const front = normalizeDirection(values[frontIndex]);

    if (!id && !String(values[frontIndex] || "").trim()) continue;
    if (!id) throw new Error("Side Mapping CSV me blank Plot ID mila");
    if (!front)
      throw new Error(`Plot ${id}: Front Direction top/right/bottom/left me se hona chahiye`);
    if (seen.has(id)) throw new Error(`Side Mapping CSV me duplicate Plot ID mila: ${id}`);
    seen.add(id);
    rows.push({ id, front });
  }

  return rows;
}
