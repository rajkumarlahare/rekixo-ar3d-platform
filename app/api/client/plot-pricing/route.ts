import { env } from "cloudflare:workers";
import { sameOrigin, validAdminSession } from "../../../admin-auth";
import { writeAudit } from "../../../audit";

const PRICING_ENABLED_KEY = "pricingEnabled";
const CLIENT_PRICING_EDIT_KEY = "clientPricingEditEnabled";
const PRICING_SOURCE_KEY = "pricingLastEditSource";
const MAX_SELECTION = 1000;

type PricingRow = {
  plotId: string;
  pricingType: "rate" | "fixed";
  unit: "sqyd" | "sqft" | "sqm";
  rate: number | null;
  fixedPrice: number | null;
  currency: string;
};

const denied = () =>
  Response.json({ error: "Client Admin login required" }, { status: 401 });

async function permission(projectId: string) {
  const rows = await env.DB.prepare(
    "SELECT key,value FROM settings WHERE project_id=? AND key IN (?,?)",
  )
    .bind(projectId, PRICING_ENABLED_KEY, CLIENT_PRICING_EDIT_KEY)
    .all<{ key: string; value: string }>();
  const values = Object.fromEntries(rows.results.map((row) => [row.key, row.value]));
  const enabled = values[PRICING_ENABLED_KEY] === "1";
  return {
    enabled,
    editable: enabled && values[CLIENT_PRICING_EDIT_KEY] === "1",
  };
}

async function pricingRows(projectId: string) {
  const rows = await env.DB.prepare(
    "SELECT plot_id AS plotId,pricing_type AS pricingType,unit,rate,fixed_price AS fixedPrice,currency FROM plot_pricing WHERE project_id=? ORDER BY plot_id",
  )
    .bind(projectId)
    .all<PricingRow>();
  return rows.results;
}

function settingUpsert(projectId: string, key: string, value: string, now: string) {
  return env.DB.prepare(
    "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
  ).bind(projectId, key, value, now);
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1_000_000_000
    ? number
    : null;
}

function cleanPlotIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => item && item.length <= 80),
    ),
  ];
}

export async function GET() {
  const session = await validAdminSession();
  if (!session) return denied();
  if (session.role !== "client_admin")
    return Response.json({ error: "Client Admin access required" }, { status: 403 });

  const projectId = session.projectId;
  const access = await permission(projectId);

  return Response.json(
    {
      enabled: access.enabled,
      editable: access.editable,
      pricing: access.editable ? await pricingRows(projectId) : [],
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const session = await validAdminSession();
  if (!session) return denied();
  if (session.role !== "client_admin")
    return Response.json({ error: "Client Admin access required" }, { status: 403 });

  const projectId = session.projectId;
  const access = await permission(projectId);
  if (!access.enabled || !access.editable)
    return Response.json(
      { error: "Client pricing edit permission enabled nahi hai" },
      { status: 403 },
    );

  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        plotIds?: unknown;
        pricingType?: unknown;
        unit?: unknown;
        rate?: unknown;
        fixedPrice?: unknown;
        currency?: unknown;
      }
    | null;

  const action = String(body?.action || "");
  const plotIds = cleanPlotIds(body?.plotIds);
  if (!plotIds.length || plotIds.length > MAX_SELECTION)
    return Response.json(
      { error: `1 se ${MAX_SELECTION} plots select karein` },
      { status: 400 },
    );

  const inventory = await env.DB.prepare(
    "SELECT id FROM plots WHERE project_id=? ORDER BY id",
  )
    .bind(projectId)
    .all<{ id: string }>();
  const inventoryIds = new Set(inventory.results.map((plot) => plot.id));
  const unknown = plotIds.filter((plotId) => !inventoryIds.has(plotId));
  if (unknown.length)
    return Response.json(
      { error: `Unknown plot selection: ${unknown.slice(0, 5).join(", ")}` },
      { status: 400 },
    );

  const now = new Date().toISOString();

  if (action === "remove") {
    await env.DB.batch([
      ...plotIds.map((plotId) =>
        env.DB.prepare(
          "DELETE FROM plot_pricing WHERE project_id=? AND plot_id=?",
        ).bind(projectId, plotId),
      ),
      settingUpsert(projectId, PRICING_SOURCE_KEY, "client", now),
    ]);

    await writeAudit(session, "project.client_pricing_removed", projectId, null, {
      count: plotIds.length,
      sample: plotIds.slice(0, 20),
    });

    return Response.json({
      ok: true,
      action,
      count: plotIds.length,
      pricing: await pricingRows(projectId),
    });
  }

  if (action !== "apply")
    return Response.json({ error: "Pricing action invalid hai" }, { status: 400 });

  const pricingType = String(body?.pricingType || "rate");
  if (!["rate", "fixed"].includes(pricingType))
    return Response.json({ error: "Pricing type invalid hai" }, { status: 400 });

  const unit = String(body?.unit || "sqyd");
  if (!["sqyd", "sqft", "sqm"].includes(unit))
    return Response.json({ error: "Pricing unit invalid hai" }, { status: 400 });

  const currency = String(body?.currency || "INR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency))
    return Response.json({ error: "Currency invalid hai" }, { status: 400 });

  const rate = pricingType === "rate" ? positiveNumber(body?.rate) : null;
  const fixedPrice =
    pricingType === "fixed" ? positiveNumber(body?.fixedPrice) : null;
  if (pricingType === "rate" && !rate)
    return Response.json({ error: "Rate 0 se bada hona chahiye" }, { status: 400 });
  if (pricingType === "fixed" && !fixedPrice)
    return Response.json(
      { error: "Fixed price 0 se bada hona chahiye" },
      { status: 400 },
    );

  await env.DB.batch([
    ...plotIds.map((plotId) =>
      env.DB.prepare(
        "INSERT INTO plot_pricing (project_id,plot_id,pricing_type,unit,rate,fixed_price,currency,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(project_id,plot_id) DO UPDATE SET pricing_type=excluded.pricing_type,unit=excluded.unit,rate=excluded.rate,fixed_price=excluded.fixed_price,currency=excluded.currency,updated_at=excluded.updated_at",
      ).bind(
        projectId,
        plotId,
        pricingType,
        unit,
        rate,
        fixedPrice,
        currency,
        now,
      ),
    ),
    settingUpsert(projectId, PRICING_SOURCE_KEY, "client", now),
  ]);

  await writeAudit(session, "project.client_pricing_updated", projectId, null, {
    count: plotIds.length,
    sample: plotIds.slice(0, 20),
    pricingType,
    unit,
    rate,
    fixedPrice,
    currency,
  });

  return Response.json({
    ok: true,
    action,
    count: plotIds.length,
    pricing: await pricingRows(projectId),
  });
}
