import { requireSuperAdmin } from "@/modules/auth";
import {
  buildProjectAssetExport,
  projectAssetZipStream,
} from "@/modules/project-assets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor)
    return Response.json(
      { error: "Super Admin access required" },
      { status: 403 },
    );

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

    return new Response(projectAssetZipStream(plan), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${plan.manifest.packageFileName}"`,
        "cache-control": "private,no-store",
        "x-content-type-options": "nosniff",
        "x-rekixo-project": plan.manifest.project.id,
        "x-rekixo-export-format": String(plan.manifest.exportFormatVersion),
      },
    });
  } catch (error) {
    console.error("Project asset ZIP preparation failed", error);
    return Response.json(
      { error: "Project asset ZIP prepare nahi hui" },
      { status: 500, headers: { "cache-control": "private,no-store" } },
    );
  }
}
