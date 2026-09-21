import { requireSuperAdmin } from "@/modules/auth";
import { engineAdminUrl, engineProjectStatus, project3DLink } from "@/modules/engine-integration";

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor)
    return Response.json({ error: "Super Admin access required" }, { status: 403 });

  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });

  const link = await project3DLink(projectId);
  if (!link || link.status !== "active")
    return Response.json({ error: "3D project is not linked" }, { status: 404 });

  const engine = await engineProjectStatus(link.engineSlug);
  if (!engine?.project || engine.project.id !== link.engineProjectId)
    return Response.json({ error: "Linked Engine project is unavailable" }, { status: 409 });

  // Stage 5 transfers project context only. The Engine Admin remains read-only;
  // no Platform credential/session is exposed to the Engine.
  return Response.redirect(engineAdminUrl(link.engineSlug, projectId), 302);
}
