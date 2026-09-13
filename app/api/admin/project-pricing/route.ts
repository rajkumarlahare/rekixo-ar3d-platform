import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "../../admin-auth";
import { writeAudit } from "../../audit";
import { expandPricingRules, parsePricingSheetText } from "../../plot-pricing-sheet";

const PRICING_ENABLED_KEY = "pricingEnabled";
const PRICING_SHEET_NAME_KEY = "pricingSheetName";
const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

async function projectExists(projectId: string) {
  return Boolean(
    await env.DB.prepare(
      "SELECT id FROM projects WHERE id=? AND status!='deleted' LIMIT 1",
    )
      .bind(projectId)
      .first(),
  );
}

async function setting(projectId: string, key: string) {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE project_id=? AND key=? LIMIT 1",
  )
    .bind(projectId, key)
    .first<{ value: string }>();
  return row?.value || "";
}

function settingUpsert(projectId: string, key: string, value: string, now: string) {
  return env.DB.prepare(
    "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
  ).bind(projectId, key, value, now);
}

async function readSummary(projectId: string) {
  const [enabledValue, sheetName, inventory, pricingRows] = await Promise.all([
    setting(projectId, PRICING_ENABLED_KEY),
    setting(projectId, PRICING_SHEET_NAME_KEY),
    env.DB.prepare("SELECT COUNT(*) AS count FROM plots WHERE project_id=?")
      .bind(projectId)
      .first<{ count: number }>(),
    env.DB.prepare(
      "SELECT plot_id AS plotId,pricing_type AS pricingType,unit,rate,fixed_price AS fixedPrice,currency FROM plot_pricing WHERE project_id=? ORDER BY plot_id",
    )
      .bind(projectId)
      .all<{
        plotId: string;
        pricingType: string;
        unit: string;
        rate: number | null;
        fixedPrice: number | null;
        currency: string;
      }>(),
  ]);
  const inventoryCount = Number(inventory?.count || 0);
  return {
    enabled: enabledValue === "1",
    sheetName,
    inventoryCount,
    pricedCount: pricingRows.results.length,
    unpricedCount: Math.max(0, inventoryCount - pricingRows.results.length),
    pricing: pricingRows.results,
  };
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();

  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  if (!(await projectExists(projectId)))
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  return Response.json(
    { projectId, ...(await readSummary(projectId)) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { projectId?: unknown; enabled?: unknown }
    | null;
  const projectId = String(body?.projectId || "");
  if (!(await projectExists(projectId)))
    return Response.json({ error: "Project nahi mila" }, { status: 404 });
  if (typeof body?.enabled !== "boolean")
    return Response.json({ error: "Pricing checkbox value invalid hai" }, { status: 400 });

  const now = new Date().toISOString();
  await settingUpsert(projectId, PRICING_ENABLED_KEY, body.enabled ? "1" : "0", now).run();
  await writeAudit(actor, "project.pricing_toggled", projectId, null, {
    enabled: body.enabled,
  });

  return Response.json({ projectId, ...(await readSummary(projectId)) });
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data"))
    return Response.json({ error: "Pricing file upload expected hai" }, { status: 415 });

  const form = await request.formData();
  const projectId = String(form.get("projectId") || "");
  const file = form.get("file");

  if (!(await projectExists(projectId)))
    return Response.json({ error: "Project nahi mila" }, { status: 404 });
  if (!(file instanceof File))
    return Response.json({ error: "Pricing file nahi mili" }, { status: 400 });

  const extension = file.name.toLowerCase().split(".").pop() || "";
  if (!["csv", "json"].includes(extension))
    return Response.json({ error: "Pricing CSV ya JSON file choose karein" }, { status: 400 });
  if (file.size > 1024 * 1024)
    return Response.json({ error: "Pricing file 1 MB se chhoti rakhein" }, { status: 400 });

  try {
    const inventory = await env.DB.prepare(
      "SELECT id FROM plots WHERE project_id=? ORDER BY id",
    )
      .bind(projectId)
      .all<{ id: string }>();
    if (!inventory.results.length)
      return Response.json(
        { error: "Pehle Plot details sheet upload karein" },
        { status: 409 },
      );

    const rules = parsePricingSheetText(await file.text(), file.name);
    const expanded = expandPricingRules(
      rules,
      inventory.results.map((plot) => plot.id),
    );
    const now = new Date().toISOString();

    // D1 batch keeps project replacement all-or-nothing: old pricing is not left half-replaced.
    const statements = [
      env.DB.prepare("DELETE FROM plot_pricing WHERE project_id=?").bind(projectId),
      ...expanded.map((row) =>
        env.DB.prepare(
          "INSERT INTO plot_pricing (project_id,plot_id,pricing_type,unit,rate,fixed_price,currency,updated_at) VALUES (?,?,?,?,?,?,?,?)",
        ).bind(
          projectId,
          row.plotId,
          row.pricingType,
          row.unit,
          row.rate,
          row.fixedPrice,
          row.currency,
          now,
        ),
      ),
      settingUpsert(projectId, PRICING_SHEET_NAME_KEY, file.name.slice(0, 240), now),
    ];
    await env.DB.batch(statements);

    await writeAudit(actor, "project.pricing_uploaded", projectId, null, {
      filename: file.name,
      ruleCount: rules.length,
      pricedCount: expanded.length,
      inventoryCount: inventory.results.length,
    });

    return Response.json({
      ok: true,
      projectId,
      ruleCount: rules.length,
      ...(await readSummary(projectId)),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Pricing sheet process nahi hui",
      },
      { status: 400 },
    );
  }
}
