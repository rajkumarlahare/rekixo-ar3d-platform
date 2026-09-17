import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "../../../admin-auth";
import { writeAudit } from "../../../audit";
import {
  PROJECT_CUSTOMER_ACTION_SETTING_KEYS,
  projectCustomerActionSettingEntries,
  projectCustomerActionsFromSettings,
  validateProjectCustomerActionsPatch,
} from "../../../project-customer-actions";

const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

async function loadProjectCustomerActions(projectId: string) {
  const project = await env.DB.prepare(
    "SELECT id,name FROM projects WHERE id=? AND status!='deleted' LIMIT 1",
  )
    .bind(projectId)
    .first<{ id: string; name: string }>();
  if (!project) return null;

  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE project_id=? AND key=? LIMIT 1",
  )
    .bind(
      projectId,
      PROJECT_CUSTOMER_ACTION_SETTING_KEYS.customerCallEnabled,
    )
    .first<{ value: string }>();

  return {
    projectId,
    projectName: project.name,
    actions: projectCustomerActionsFromSettings({
      customerCallEnabled: row?.value,
    }),
  };
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();

  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });

  const state = await loadProjectCustomerActions(projectId);
  if (!state)
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  return Response.json(state, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    changes?: Record<string, unknown>;
  };
  const projectId = String(body.projectId || "").trim();
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });

  const before = await loadProjectCustomerActions(projectId);
  if (!before)
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  const checked = validateProjectCustomerActionsPatch(body.changes || {});
  if (!checked.ok)
    return Response.json({ error: checked.error }, { status: 400 });

  const entries = projectCustomerActionSettingEntries(checked.values);
  if (entries.length) {
    const now = new Date().toISOString();
    await env.DB.batch(
      entries.map(([key, value]) =>
        env.DB.prepare(
          "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
        ).bind(projectId, key, value, now),
      ),
    );
    await writeAudit(actor, "project.customer_actions_updated", projectId, null, {
      before: before.actions,
      changes: checked.values,
    });
  }

  const state = await loadProjectCustomerActions(projectId);
  return Response.json(state, { headers: { "cache-control": "no-store" } });
}
