"use client";

import { CheckCircle2, Download, FileText, IndianRupee } from "lucide-react";
import { useEffect, useState } from "react";

type PricingSummary = {
  projectId?: string;
  enabled?: boolean;
  sheetName?: string;
  inventoryCount?: number;
  pricedCount?: number;
  unpricedCount?: number;
  error?: string;
};

async function jsonResult(response: Response) {
  const data = (await response.json().catch(() => ({}))) as PricingSummary;
  if (!response.ok) throw new Error(data.error || "Pricing request fail hui");
  return data;
}

export default function ProjectPricingSource({
  projectId,
  notify,
}: {
  projectId: string;
  notify: (message: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [inventoryCount, setInventoryCount] = useState(0);
  const [pricedCount, setPricedCount] = useState(0);
  const [unpricedCount, setUnpricedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function applySummary(data: PricingSummary) {
    setEnabled(Boolean(data.enabled));
    setSheetName(String(data.sheetName || ""));
    setInventoryCount(Number(data.inventoryCount || 0));
    setPricedCount(Number(data.pricedCount || 0));
    setUnpricedCount(Number(data.unpricedCount || 0));
  }

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/project-pricing?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      applySummary(await jsonResult(response));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((error) =>
      notify(error instanceof Error ? error.message : "Pricing load nahi hui"),
    );
  }, [projectId]);

  async function togglePricing(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/project-pricing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, enabled: next }),
      });
      const data = await jsonResult(response);
      applySummary(data);
      notify(
        next
          ? "Pricing feature ON — ab pricing CSV/JSON upload karein"
          : "Pricing feature OFF — saved rates safe hain aur public site se hidden hain",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Pricing setting save nahi hui");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPricing(file: File) {
    if (busy || !enabled) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("projectId", projectId);
      form.set("file", file);
      const response = await fetch("/api/admin/project-pricing", {
        method: "POST",
        body: form,
      });
      const data = await jsonResult(response);
      applySummary(data);
      notify(
        `Pricing upload ho gayi — ${Number(data.pricedCount || 0)} inventory items priced`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Pricing upload nahi hui");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const text = [
      "plot_id,from_id,to_id,pricing_type,unit,rate,fixed_price,currency",
      ",1,10,rate,sqyd,14300,,INR",
      "11,,,fixed,,,2500000,INR",
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "rekixo-pricing-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mapper-pricing-feature">
      <label className="mapper-pricing-toggle">
        <input
          type="checkbox"
          checked={enabled}
          disabled={loading || busy}
          onChange={(event) => void togglePricing(event.target.checked)}
        />
        <span className="mapper-pricing-icon"><IndianRupee /></span>
        <span>
          <b>Pricing</b>
          <small>
            Optional project feature · OFF rahe to existing client website bilkul unchanged rahegi.
          </small>
        </span>
        <em>{enabled ? "ON" : "OFF"}</em>
      </label>

      {enabled ? (
        <div className="mapper-pricing-body">
          <label className={`mapper-upload-card mapper-pricing-upload ${sheetName && pricedCount ? "ready" : ""}`}>
            <span><FileText /></span>
            <div>
              <b>{sheetName && pricedCount ? `Pricing sheet ready · ${pricedCount}` : "Upload pricing sheet"}</b>
              <small>{sheetName || "CSV/JSON · plot_id ya from_id → to_id ranges"}</small>
            </div>
            {sheetName && pricedCount ? <CheckCircle2 className="mapper-ready-icon" /> : null}
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadPricing(file);
                event.currentTarget.value = "";
              }}
            />
          </label>

          <div className="mapper-pricing-summary">
            <span>Inventory <b>{inventoryCount}</b></span>
            <span>Priced <b>{pricedCount}</b></span>
            <span>Unpriced <b>{unpricedCount}</b></span>
          </div>

          <div className="mapper-pricing-actions">
            <button type="button" disabled={busy} onClick={downloadTemplate}>
              <Download /> Download Pricing CSV Template
            </button>
            <small>
              Range rows bulk pricing ke liye; exact plot_id row range ko override kar sakti hai.
              Checkbox OFF karne se uploaded pricing delete nahi hoti.
            </small>
          </div>
        </div>
      ) : null}
    </section>
  );
}
