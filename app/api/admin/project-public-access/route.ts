import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "@/modules/auth";
import { writeAudit } from "@/modules/audit";
import { PUBLIC_SITE_SETTING } from "@/modules/public-site-access";
const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

type ProjectRow = {
  id: string;
  name: string;
  publicStatus: string;
};

async function loadState(projectId: string) {
  const [project, setting] = await Promise.all([
    env.DB.prepare(
      "SELECT id,name,public_status AS publicStatus FROM projects WHERE id=? AND status='active' LIMIT 1",
    )
      .bind(projectId)
      .first<ProjectRow>(),
    env.DB.prepare(
      "SELECT value FROM settings WHERE project_id=? AND key=? LIMIT 1",
    )
      .bind(projectId, PUBLIC_SITE_SETTING)
      .first<{ value: string }>(),
  ]);

  if (!project) return null;

  // Missing setting intentionally means ON so every existing/future project remains
  // publicly accessible unless a Super Admin explicitly pauses it.
  const enabled = setting?.value !== "0";
  return {
    projectId: project.id,
    projectName: project.name,
    publicStatus: project.publicStatus,
    enabled,
    effectivePublicAccess: project.publicStatus === "published" && enabled,
  };
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
    projectId?: string;
    enabled?: boolean;
  };
  const projectId = String(body.projectId || "").trim();
  if (!projectId || typeof body.enabled !== "boolean")
    return Response.json(
      { error: "Valid project aur enabled state required" },
      { status: 400 },
    );

  const before = await loadState(projectId);
  if (!before)
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  const now = new Date().toISOString();

  if (body.enabled) {
    // ON is represented by absence of the setting. This keeps default behavior
    // future-proof and avoids writing redundant rows for normal projects.
    await env.DB.prepare(
      "DELETE FROM settings WHERE project_id=? AND key=?",
    )
      .bind(projectId, PUBLIC_SITE_SETTING)
      .run();
  } else {
    await env.DB.prepare(
      "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
      .bind(projectId, PUBLIC_SITE_SETTING, "0", now)
      .run();
  }

  await writeAudit(
    actor,
    body.enabled ? "project.public_access_enabled" : "project.public_access_disabled",
    projectId,
    null,
    {
      previousEnabled: before.enabled,
      publicStatus: before.publicStatus,
    },
  );

  const state = await loadState(projectId);
  return Response.json(state, {
    headers: { "cache-control": "no-store" },
  });
}
