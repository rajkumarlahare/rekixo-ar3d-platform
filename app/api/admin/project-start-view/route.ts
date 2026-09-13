import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "../../../admin-auth";
import { writeAudit } from "../../../audit";

const MODE_KEY = "publicInitialViewMode";
const X_KEY = "publicInitialFocusX";
const Y_KEY = "publicInitialFocusY";
const MODES = new Set(["legacy", "plots", "custom"]);
const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

function unit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

async function loadState(projectId: string) {
  const project = await env.DB.prepare(
    "SELECT id,name FROM projects WHERE id=? AND status!='deleted' LIMIT 1",
  )
    .bind(projectId)
    .first<{ id: string; name: string }>();
  if (!project) return null;

  const rows = await env.DB.prepare(
    "SELECT key,value FROM settings WHERE project_id=? AND key IN (?,?,?)",
  )
    .bind(projectId, MODE_KEY, X_KEY, Y_KEY)
    .all<{ key: string; value: string }>();
  const raw = Object.fromEntries(rows.results.map((row) => [row.key, row.value]));
  const mode = MODES.has(raw[MODE_KEY]) ? raw[MODE_KEY] : "legacy";
  const x = unit(raw[X_KEY]) ?? 0.5;
  const y = unit(raw[Y_KEY]) ?? 0.5;

  return {
    projectId,
    projectName: project.name,
    mode,
    x,
    y,
    configured: mode !== "legacy",
  };
}

function upsert(projectId: string, key: string, value: string, now: string) {
  return env.DB.prepare(
    "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
  ).bind(projectId, key, value, now);
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();

  const projectId =
    new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });

  const state = await loadState(projectId);
  if (!state)
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  return Response.json(state, {
    headers: { "cache-control": "no-store" },
  });
}

export async function PATCH(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: unknown;
    mode?: unknown;
    x?: unknown;
    y?: unknown;
  };
  const projectId = String(body.projectId || "").trim();
  const mode = String(body.mode || "").trim();

  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });
  if (!MODES.has(mode))
    return Response.json({ error: "Start view mode invalid hai" }, { status: 400 });

  const before = await loadState(projectId);
  if (!before)
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  const now = new Date().toISOString();
  const statements: ReturnType<typeof env.DB.prepare>[] = [];

  if (mode === "legacy") {
    statements.push(
      env.DB.prepare(
        "DELETE FROM settings WHERE project_id=? AND key IN (?,?,?)",
      ).bind(projectId, MODE_KEY, X_KEY, Y_KEY),
    );
  } else if (mode === "plots") {
    statements.push(upsert(projectId, MODE_KEY, mode, now));
    statements.push(
      env.DB.prepare(
        "DELETE FROM settings WHERE project_id=? AND key IN (?,?)",
      ).bind(projectId, X_KEY, Y_KEY),
    );
  } else {
    const x = unit(body.x);
    const y = unit(body.y);
    if (x === null || y === null) {
      return Response.json(
        { error: "Custom focus point 0 se 1 ke beech hona chahiye" },
        { status: 400 },
      );
    }
    statements.push(
      upsert(projectId, MODE_KEY, mode, now),
      upsert(projectId, X_KEY, x.toFixed(6), now),
      upsert(projectId, Y_KEY, y.toFixed(6), now),
    );
  }

  await env.DB.batch(statements);
  await writeAudit(actor, "project.start_view_updated", projectId, null, {
    before: { mode: before.mode, x: before.x, y: before.y },
    after: {
      mode,
      x: mode === "custom" ? unit(body.x) : null,
      y: mode === "custom" ? unit(body.y) : null,
    },
  });

  const state = await loadState(projectId);
  return Response.json(state, {
    headers: { "cache-control": "no-store" },
  });
}
