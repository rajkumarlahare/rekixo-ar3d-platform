import { env } from "cloudflare:workers";
import { publicProjectId } from "@/modules/projects";
import {
  publicSiteEnabled,
  publicSiteUnavailableResponse,
} from "@/modules/public-site-access";

export async function GET(request: Request) {
  const projectId = await publicProjectId(request);
  if (!projectId) {
    return Response.json(
      { error: "Published project nahi mila" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }
  if (!(await publicSiteEnabled(projectId))) {
    return publicSiteUnavailableResponse();
  }

  const rows = await env.DB.prepare(
    "SELECT id,status FROM plots WHERE project_id=? AND inventory_active=1 ORDER BY id",
  )
    .bind(projectId)
    .all<{ id: string; status: string }>();

  return Response.json(
    {
      projectId,
      statuses: rows.results.map((row) => ({
        id: row.id,
        status:
          row.status === "booked" || row.status === "sold"
            ? row.status
            : "available",
      })),
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-rekixo-project": projectId,
      },
    },
  );
}
