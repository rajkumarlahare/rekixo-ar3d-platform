import { cleanPlotId } from "./mapper-geometry";

export type PricingUnit = "sqyd" | "sqft" | "sqm";
export type PricingType = "rate" | "fixed";

export type PricingRule = {
  plotId: string;
  fromId: string;
  toId: string;
  pricingType: PricingType;
  unit: PricingUnit;
  rate: number | null;
  fixedPrice: number | null;
  currency: string;
};

export type ExpandedPricing = {
  plotId: string;
  pricingType: PricingType;
  unit: PricingUnit;
  rate: number | null;
  fixedPrice: number | null;
  currency: string;
};

const aliases = {
  plotId: ["plotid", "plot", "id", "plotno", "plotnumber"],
  fromId: ["fromid", "from", "start", "startid", "fromplot", "fromplotid"],
  toId: ["toid", "to", "end", "endid", "toplot", "toplotid"],
  pricingType: ["pricingtype", "type", "mode", "pricetype"],
  unit: ["unit", "rateunit", "per"],
  rate: ["rate", "ratepersqyd", "ratepersqft", "ratepersqm", "unitrate"],
  fixedPrice: ["fixedprice", "price", "baseprice", "amount"],
  currency: ["currency", "curr"],
} as const;

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

function columnFor(headers: string[], options: readonly string[]) {
  return headers.findIndex((header) => options.includes(header));
}

function money(value: unknown) {
  const raw = String(value ?? "")
    .replace(/[₹$€£,\s]/g, "")
    .trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeUnit(value: unknown): PricingUnit {
  const raw = String(value || "sqyd").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (["sqyd", "sqyard", "sqyards", "squareyard", "squareyards"].includes(raw)) return "sqyd";
  if (["sqft", "sqfeet", "squarefeet", "squarefoot"].includes(raw)) return "sqft";
  if (["sqm", "sqmeter", "sqmeters", "squaremeter", "squaremeters", "squaremetre"].includes(raw))
    return "sqm";
  throw new Error(`Pricing unit "${String(value)}" supported nahi hai`);
}

function normalizeType(value: unknown, rate: number | null, fixedPrice: number | null): PricingType {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fixedPrice && !rate ? "fixed" : "rate";
  if (["rate", "perunit", "unitrate"].includes(raw)) return "rate";
  if (["fixed", "fixedprice", "lumpsum"].includes(raw)) return "fixed";
  throw new Error(`Pricing type "${String(value)}" supported nahi hai`);
}

function normalizeCurrency(value: unknown) {
  const currency = String(value || "INR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency 3-letter code me honi chahiye");
  return currency;
}

function normalizeObject(input: Record<string, unknown>) {
  const byHeader = new Map(
    Object.entries(input).map(([key, value]) => [normalizeHeader(key), value]),
  );
  const result: Record<string, unknown> = {};
  for (const [name, options] of Object.entries(aliases)) {
    const alias = options.find((option) => byHeader.has(option));
    if (alias) result[name] = byHeader.get(alias);
  }
  return result;
}

function normalizeRule(input: Record<string, unknown>, rowNumber: number): PricingRule {
  const plotId = cleanPlotId(String(input.plotId || ""));
  const fromId = cleanPlotId(String(input.fromId || ""));
  const toId = cleanPlotId(String(input.toId || ""));
  const hasExact = Boolean(plotId);
  const hasRange = Boolean(fromId || toId);

  if (hasExact && hasRange)
    throw new Error(`Pricing row ${rowNumber}: plot_id aur range dono ek saath use na karein`);
  if (!hasExact && !(fromId && toId))
    throw new Error(`Pricing row ${rowNumber}: plot_id ya from_id + to_id chahiye`);

  const rate = money(input.rate);
  const fixedPrice = money(input.fixedPrice);
  const pricingType = normalizeType(input.pricingType, rate, fixedPrice);
  const unit = normalizeUnit(input.unit);
  const currency = normalizeCurrency(input.currency);

  if (pricingType === "rate" && !rate)
    throw new Error(`Pricing row ${rowNumber}: rate 0 se bada hona chahiye`);
  if (pricingType === "fixed" && !fixedPrice)
    throw new Error(`Pricing row ${rowNumber}: fixed_price 0 se bada hona chahiye`);

  return {
    plotId,
    fromId,
    toId,
    pricingType,
    unit,
    rate: pricingType === "rate" ? rate : null,
    fixedPrice: pricingType === "fixed" ? fixedPrice : null,
    currency,
  };
}

export function parsePricingSheetText(text: string, filename: string) {
  if (filename.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { pricing?: unknown[] })?.pricing)
        ? (parsed as { pricing: unknown[] }).pricing
        : [];
    if (!list.length) throw new Error("Pricing JSON me rows nahi mili");
    return list.map((item, index) =>
      normalizeRule(
        normalizeObject((item || {}) as Record<string, unknown>),
        index + 1,
      ),
    );
  }

  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Pricing CSV me header aur kam se kam 1 data row chahiye");

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const indexes = {
    plotId: columnFor(headers, aliases.plotId),
    fromId: columnFor(headers, aliases.fromId),
    toId: columnFor(headers, aliases.toId),
    pricingType: columnFor(headers, aliases.pricingType),
    unit: columnFor(headers, aliases.unit),
    rate: columnFor(headers, aliases.rate),
    fixedPrice: columnFor(headers, aliases.fixedPrice),
    currency: columnFor(headers, aliases.currency),
  };

  if (indexes.plotId < 0 && (indexes.fromId < 0 || indexes.toId < 0))
    throw new Error("Pricing CSV me plot_id ya from_id + to_id columns chahiye");
  if (indexes.rate < 0 && indexes.fixedPrice < 0)
    throw new Error("Pricing CSV me rate ya fixed_price column chahiye");

  const value = (row: string[], index: number) => (index >= 0 ? row[index] || "" : "");
  return lines.slice(1).map(parseCsvLine).map((row, index) =>
    normalizeRule(
      {
        plotId: value(row, indexes.plotId),
        fromId: value(row, indexes.fromId),
        toId: value(row, indexes.toId),
        pricingType: value(row, indexes.pricingType),
        unit: value(row, indexes.unit),
        rate: value(row, indexes.rate),
        fixedPrice: value(row, indexes.fixedPrice),
        currency: value(row, indexes.currency),
      },
      index + 2,
    ),
  );
}

function splitRangeId(value: string) {
  const clean = cleanPlotId(value);
  const match = clean.match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return { clean, prefix: match[1], number: Number(match[2]) };
}

function samePricing(a: ExpandedPricing, b: ExpandedPricing) {
  return (
    a.pricingType === b.pricingType &&
    a.unit === b.unit &&
    a.rate === b.rate &&
    a.fixedPrice === b.fixedPrice &&
    a.currency === b.currency
  );
}

function expandedFromRule(plotId: string, rule: PricingRule): ExpandedPricing {
  return {
    plotId,
    pricingType: rule.pricingType,
    unit: rule.unit,
    rate: rule.rate,
    fixedPrice: rule.fixedPrice,
    currency: rule.currency,
  };
}

export function expandPricingRules(rules: PricingRule[], existingPlotIds: string[]) {
  const canonicalIds = existingPlotIds.map((id) => cleanPlotId(id)).filter(Boolean);
  const existing = new Set(canonicalIds);
  const result = new Map<string, ExpandedPricing>();

  // Range rules first. Overlapping ranges with different prices are rejected.
  for (const rule of rules.filter((item) => !item.plotId)) {
    const from = splitRangeId(rule.fromId);
    const to = splitRangeId(rule.toId);
    if (!from || !to || from.prefix !== to.prefix)
      throw new Error(`Pricing range ${rule.fromId} → ${rule.toId} valid same-prefix range nahi hai`);
    const start = Math.min(from.number, to.number);
    const end = Math.max(from.number, to.number);
    const matched = canonicalIds.filter((id) => {
      const parsed = splitRangeId(id);
      return parsed && parsed.prefix === from.prefix && parsed.number >= start && parsed.number <= end;
    });
    if (!matched.length)
      throw new Error(`Pricing range ${rule.fromId} → ${rule.toId} kisi inventory plot se match nahi hua`);

    for (const plotId of matched) {
      const next = expandedFromRule(plotId, rule);
      const previous = result.get(plotId);
      if (previous && !samePricing(previous, next))
        throw new Error(`Overlapping pricing ranges Plot ${plotId} par conflict kar rahe hain`);
      result.set(plotId, next);
    }
  }

  // Exact plot rows intentionally override a range, but duplicate exact rows are rejected.
  const exactSeen = new Set<string>();
  for (const rule of rules.filter((item) => item.plotId)) {
    if (!existing.has(rule.plotId))
      throw new Error(`Pricing Plot ${rule.plotId} inventory me nahi mila`);
    if (exactSeen.has(rule.plotId))
      throw new Error(`Pricing Plot ${rule.plotId} duplicate exact row hai`);
    exactSeen.add(rule.plotId);
    result.set(rule.plotId, expandedFromRule(rule.plotId, rule));
  }

  if (!result.size) throw new Error("Pricing sheet se koi plot price create nahi hua");
  if (result.size > 5000) throw new Error("Pricing sheet me bahut zyada plots hain");

  return [...result.values()].sort((a, b) =>
    a.plotId.localeCompare(b.plotId, undefined, { numeric: true, sensitivity: "base" }),
  );
}
