"use client";

import { Check, IndianRupee, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Plot = {
  id: string;
  sqft: number;
  sqm: number;
  sqyd: number;
};

type PricingRow = {
  plotId: string;
  pricingType: "rate" | "fixed";
  unit: "sqyd" | "sqft" | "sqm";
  rate: number | null;
  fixedPrice: number | null;
  currency: string;
};

type PricingResponse = {
  enabled?: boolean;
  editable?: boolean;
  pricing?: PricingRow[];
  error?: string;
};

const UNIT_LABELS = {
  sqyd: "Sq. Yards",
  sqft: "Sq. Feet",
  sqm: "Sq. Meters",
} as const;

async function jsonResult(response: Response) {
  const data = (await response.json().catch(() => ({}))) as PricingResponse;
  if (!response.ok) throw new Error(data.error || "Pricing request fail hui");
  return data;
}

function money(value: number, currency = "INR") {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  } catch {
    return `₹${Math.round(value).toLocaleString("en-IN")}`;
  }
}

function samePricing(rows: PricingRow[]) {
  if (!rows.length) return null;
  const first = rows[0];
  return rows.every(
    (row) =>
      row.pricingType === first.pricingType &&
      row.unit === first.unit &&
      row.rate === first.rate &&
      row.fixedPrice === first.fixedPrice &&
      row.currency === first.currency,
  )
    ? first
    : null;
}

export default function ClientPlotPricing({
  plots,
  notify,
}: {
  plots: Plot[];
  notify: (message: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [editable, setEditable] = useState(false);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [pricingType, setPricingType] = useState<"rate" | "fixed">("rate");
  const [unit, setUnit] = useState<"sqyd" | "sqft" | "sqm">("sqyd");
  const [rate, setRate] = useState("");
  const [fixedPrice, setFixedPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const pricingByPlot = useMemo(
    () => new Map(pricing.map((row) => [row.plotId, row])),
    [pricing],
  );
  const filteredPlots = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? plots.filter((plot) => plot.id.toLowerCase().includes(needle))
      : plots;
  }, [plots, query]);
  const selectedPlots = useMemo(() => {
    const selected = new Set(selectedIds);
    return plots.filter((plot) => selected.has(plot.id));
  }, [plots, selectedIds]);

  useEffect(() => {
    let active = true;
    fetch("/api/client/plot-pricing", { cache: "no-store" })
      .then(jsonResult)
      .then((data) => {
        if (!active) return;
        setEditable(Boolean(data.enabled && data.editable));
        setPricing(data.pricing || []);
      })
      .catch((error) => {
        if (active)
          notify(error instanceof Error ? error.message : "Pricing load nahi hui");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [notify]);

  function applySelection(next: string[]) {
    const unique = [...new Set(next)];
    setSelectedIds(unique);

    const rows = unique
      .map((plotId) => pricingByPlot.get(plotId))
      .filter((row): row is PricingRow => Boolean(row));
    if (rows.length !== unique.length) return;

    const shared = samePricing(rows);
    if (!shared) return;
    setPricingType(shared.pricingType);
    setUnit(shared.unit);
    setRate(shared.rate ? String(shared.rate) : "");
    setFixedPrice(shared.fixedPrice ? String(shared.fixedPrice) : "");
  }

  function togglePlot(plotId: string) {
    applySelection(
      selectedIds.includes(plotId)
        ? selectedIds.filter((id) => id !== plotId)
        : [...selectedIds, plotId],
    );
  }

  function previewFor(plot: Plot) {
    if (pricingType === "fixed") {
      const value = Number(fixedPrice);
      return value > 0 ? value : null;
    }
    const unitRate = Number(rate);
    const area = Number(plot[unit]);
    return unitRate > 0 && area > 0 ? area * unitRate : null;
  }

  async function mutate(action: "apply" | "remove") {
    if (busy || !selectedIds.length) return;
    if (
      action === "remove" &&
      !window.confirm(`Selected ${selectedIds.length} plot pricing remove karein?`)
    )
      return;

    setBusy(true);
    try {
      const response = await fetch("/api/client/plot-pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          plotIds: selectedIds,
          ...(action === "apply"
            ? {
                pricingType,
                unit,
                rate: pricingType === "rate" ? Number(rate) : null,
                fixedPrice:
                  pricingType === "fixed" ? Number(fixedPrice) : null,
                currency: "INR",
              }
            : {}),
        }),
      });
      const data = await jsonResult(response);
      setPricing(data.pricing || []);
      notify(
        action === "apply"
          ? `${selectedIds.length} plot pricing save ho gayi`
          : `${selectedIds.length} plot pricing remove ho gayi`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Pricing save nahi hui");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !editable) return null;

  const numericRate = Number(rate);
  const numericFixed = Number(fixedPrice);
  const canApply =
    selectedIds.length > 0 &&
    (pricingType === "rate" ? numericRate > 0 : numericFixed > 0);

  return (
    <div className="card client-pricing-editor">
      <div className="client-pricing-head">
        <div>
          <p>CLIENT PRICING</p>
          <h2>Plot Pricing</h2>
          <small>
            Sirf selected plot pricing change hogi. Area, polygon, status aur
            mapping untouched rahenge.
          </small>
        </div>
        <span>
          <IndianRupee /> {pricing.length} priced
        </span>
      </div>

      <div className="client-pricing-toolbar">
        <label className="client-pricing-search">
          <Search />
          <input
            value={query}
            placeholder="Plot number search"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => applySelection(filteredPlots.map((plot) => plot.id))}
        >
          Select visible ({filteredPlots.length})
        </button>
        <button type="button" onClick={() => applySelection([])}>
          Clear selection
        </button>
      </div>

      <div className="client-pricing-plot-list">
        {filteredPlots.map((plot) => {
          const row = pricingByPlot.get(plot.id);
          const checked = selectedIds.includes(plot.id);
          return (
            <label
              key={plot.id}
              className={checked ? "selected" : ""}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePlot(plot.id)}
              />
              <b>{plot.id}</b>
              <span>
                {plot.sqyd.toLocaleString("en-IN")} Sq.Yd
              </span>
              <em>
                {row
                  ? row.pricingType === "fixed"
                    ? money(Number(row.fixedPrice || 0), row.currency)
                    : `${money(Number(row.rate || 0), row.currency)} / ${UNIT_LABELS[row.unit]}`
                  : "No price"}
              </em>
            </label>
          );
        })}
      </div>

      <div className="client-pricing-form">
        <div className="client-pricing-selected">
          Selected <b>{selectedIds.length}</b>
        </div>

        <label>
          <span>Pricing mode</span>
          <select
            value={pricingType}
            onChange={(event) =>
              setPricingType(event.target.value as "rate" | "fixed")
            }
          >
            <option value="rate">Rate × Area</option>
            <option value="fixed">Fixed Price</option>
          </select>
        </label>

        {pricingType === "rate" ? (
          <>
            <label>
              <span>Calculate by</span>
              <select
                value={unit}
                onChange={(event) =>
                  setUnit(event.target.value as "sqyd" | "sqft" | "sqm")
                }
              >
                <option value="sqyd">Sq. Yards</option>
                <option value="sqft">Sq. Feet</option>
                <option value="sqm">Sq. Meters</option>
              </select>
            </label>
            <label>
              <span>Rate / {UNIT_LABELS[unit]}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={rate}
                placeholder="14300"
                onChange={(event) => setRate(event.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            <span>Fixed price</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={fixedPrice}
              placeholder="2500000"
              onChange={(event) => setFixedPrice(event.target.value)}
            />
          </label>
        )}
      </div>

      {selectedPlots.length ? (
        <div className="client-pricing-preview">
          <b>Automatic Base Price Preview</b>
          {selectedPlots.slice(0, 8).map((plot) => {
            const base = previewFor(plot);
            return (
              <div key={plot.id}>
                <span>
                  Plot {plot.id}
                  {pricingType === "rate"
                    ? ` · ${Number(plot[unit]).toLocaleString("en-IN")} ${UNIT_LABELS[unit]}`
                    : ""}
                </span>
                <strong>{base ? money(base) : "—"}</strong>
              </div>
            );
          })}
          {selectedPlots.length > 8 ? (
            <small>+ {selectedPlots.length - 8} aur selected plots</small>
          ) : null}
        </div>
      ) : null}

      <div className="client-pricing-actions">
        <button
          type="button"
          className="primary"
          disabled={busy || !canApply}
          onClick={() => void mutate("apply")}
        >
          <Check /> {busy ? "Saving…" : `Apply to ${selectedIds.length || 0} Plot${selectedIds.length === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy || !selectedIds.length}
          onClick={() => void mutate("remove")}
        >
          <Trash2 /> Remove Price
        </button>
      </div>
    </div>
  );
}
