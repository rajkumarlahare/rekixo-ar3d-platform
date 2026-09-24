import { requireSuperAdmin } from "@/modules/auth";
import { buildProjectAssetExport } from "@/modules/project-assets";

export const dynamic = "force-dynamic";

const denied = () =>
  Response.json({ error: "Super Admin access required" }, { status: 403 });

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();

  const url = new URL(request.url);
  const projectId = String(url.searchParams.get("projectId") || "").trim();
  if (!projectId)
    return Response.json({ error: "Project required" }, { status: 400 });

  try {
    const plan = await buildProjectAssetExport(projectId, {
      includeLinkedGeoLab: url.searchParams.get("includeLinkedGeoLab") === "1",
    });
    if (!plan)
      return Response.json({ error: "Project nahi mila" }, { status: 404 });

    return Response.json(plan.manifest, {
      headers: {
        "cache-control": "private,no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Project asset manifest failed", error);
    return Response.json(
      { error: "Project asset inventory load nahi hui" },
      { status: 500, headers: { "cache-control": "private,no-store" } },
    );
  }
}
