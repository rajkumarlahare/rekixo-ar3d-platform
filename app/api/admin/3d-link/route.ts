import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "@/modules/auth";
import { writeAudit } from "@/modules/audit";
import {
  AR3D_INTEGRATION_CONTRACT_VERSION,
  engineAdminUrl,
  engineProjectStatus,
  enginePublicUrl,
  project3DLink,
} from "@/modules/engine-integration";

const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

async function platformProject(projectId: string) {
  return env.DB.prepare(
    "SELECT id,name,slug,status FROM projects WHERE id=? AND status!='deleted' LIMIT 1",
  )
    .bind(projectId)
    .first<{ id: string; name: string; slug: string; status: string }>();
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();

  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });

  const project = await platformProject(projectId);
  if (!project)
    return Response.json({ error: "Platform project not found" }, { status: 404 });

  const link = await project3DLink(projectId);
  const engine = link ? await engineProjectStatus(link.engineSlug) : null;

  return Response.json(
    {
      contractVersion: AR3D_INTEGRATION_CONTRACT_VERSION,
      project,
      link,
      engine: engine?.project
        ? {
            project: engine.project,
            activeModelAvailable: Boolean(engine.activeModel?.available),
            enabledSceneCount: (engine.scenes || []).filter((scene) => scene.enabled).length,
          }
        : null,
      adminHandoffUrl:
        link?.status === "active"
          ? `/api/admin/3d-handoff?projectId=${encodeURIComponent(projectId)}`
          : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    engineSlug?: string;
    publicEnabled?: boolean;
  };
  const projectId = String(body.projectId || "").trim();
  const engineSlug = String(body.engineSlug || "").trim().toLowerCase();
  if (!projectId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(engineSlug))
    return Response.json({ error: "Valid Platform project and Engine slug required" }, { status: 400 });

  const project = await platformProject(projectId);
  if (!project)
    return Response.json({ error: "Platform project not found" }, { status: 404 });

  const engine = await engineProjectStatus(engineSlug);
  if (!engine?.project)
    return Response.json({ error: "Engine project not found or Engine unavailable" }, { status: 409 });

  const publicEnabled = Boolean(body.publicEnabled);
  if (publicEnabled && engine.project.status !== "published")
    return Response.json(
      { error: "Public 3D can be enabled only for a published Engine project" },
      { status: 409 },
    );

  const now = new Date().toISOString();
  const publicUrl = enginePublicUrl(engine.project.slug);

  try {
    await env.DB.prepare(
      `INSERT INTO project_3d_links (
          platform_project_id,engine_project_id,engine_slug,status,public_enabled,
          public_url,updated_by,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(platform_project_id) DO UPDATE SET
          engine_project_id=excluded.engine_project_id,
          engine_slug=excluded.engine_slug,
          status='active',
          public_enabled=excluded.public_enabled,
          public_url=excluded.public_url,
          updated_by=excluded.updated_by,
          updated_at=excluded.updated_at`,
    )
      .bind(
        projectId,
        engine.project.id,
        engine.project.slug,
        "active",
        publicEnabled ? 1 : 0,
        publicUrl,
        actor.email,
        now,
        now,
      )
      .run();
  } catch {
    return Response.json(
      { error: "This Engine project is already linked to another Platform project" },
      { status: 409 },
    );
  }

  await writeAudit(actor, "project.3d_link_updated", projectId, engine.project.id, {
    engineSlug: engine.project.slug,
    publicEnabled,
    engineStatus: engine.project.status,
  });

  return Response.json(
    {
      ok: true,
      link: await project3DLink(projectId),
      engine: {
        project: engine.project,
        adminUrl: engineAdminUrl(engine.project.slug, projectId),
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });

  const current = await project3DLink(projectId);
  if (!current)
    return Response.json({ ok: true, removed: false });

  await env.DB.prepare("DELETE FROM project_3d_links WHERE platform_project_id=?")
    .bind(projectId)
    .run();
  await writeAudit(actor, "project.3d_link_removed", projectId, current.engineProjectId, {
    engineSlug: current.engineSlug,
  });

  return Response.json({ ok: true, removed: true });
}
