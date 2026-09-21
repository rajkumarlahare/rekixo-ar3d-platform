import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "@/modules/auth";
import { writeAudit } from "@/modules/audit";
import {
  type EdgeDirection,
  type QuarterTurn,
} from "@/modules/plots";
import { parseSideMappingSheetText } from "@/modules/mapper";
import { resolveFourSideEdges } from "@/modules/plots";

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

async function writeSetting(
  projectId: string,
  key: string,
  value: string,
  now: string,
) {
  await env.DB.prepare(
    "INSERT INTO settings (project_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
  )
    .bind(projectId, key, value, now)
    .run();
}

function normalizeRotation(value: unknown): QuarterTurn {
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 ? parsed : 0;
}

function validDirection(value: unknown): value is EdgeDirection {
  return value === "top" || value === "right" || value === "bottom" || value === "left";
}

function readDirectionMap(value: unknown) {
  if (!value || typeof value !== "string") return {} as Record<string, EdgeDirection>;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {} as Record<string, EdgeDirection>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, EdgeDirection] =>
        Boolean(entry[0]) && validDirection(entry[1]),
      ),
    );
  } catch {
    return {} as Record<string, EdgeDirection>;
  }
}

function parsePolygon(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (!Array.isArray(parsed) || parsed.length < 4 || parsed.length > 80) return null;
    const points: [number, number][] = [];
    for (const point of parsed) {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !Number.isFinite(Number(point[0])) ||
        !Number.isFinite(Number(point[1]))
      )
        return null;
      points.push([Number(point[0]), Number(point[1])]);
    }
    return points;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();

  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  if (!(await projectExists(projectId)))
    return Response.json({ error: "Project nahi mila" }, { status: 404 });

  const settings = await env.DB.prepare(
    "SELECT key,value FROM settings WHERE project_id=? AND key IN ('sideMappingDirections','publicRotation','sideMappingSheetName','sideMappingSheetCount','sideMappingAppliedCount','sideMappingPendingCount')",
  )
    .bind(projectId)
    .all<{ key: string; value: string }>();
  const values = Object.fromEntries(settings.results.map((item) => [item.key, item.value]));

  return Response.json(
    {
      ok: true,
      directions: readDirectionMap(values.sideMappingDirections),
      rotation: normalizeRotation(values.publicRotation),
      name: values.sideMappingSheetName || "",
      totalCount: Number(values.sideMappingSheetCount || 0),
      appliedCount: Number(values.sideMappingAppliedCount || 0),
      pendingCount: Number(values.sideMappingPendingCount || 0),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data"))
    return Response.json({ error: "Side Mapping CSV upload required" }, { status: 400 });

  const form = await request.formData();
  const projectId = String(form.get("projectId") || "");
  const kind = String(form.get("kind") || "");
  const file = form.get("file");

  if (kind !== "sideMappingSheet")
    return Response.json({ error: "Invalid Side Mapping upload" }, { status: 400 });
  if (!(await projectExists(projectId)))
    return Response.json({ error: "Project nahi mila" }, { status: 404 });
  if (!(file instanceof File))
    return Response.json({ error: "CSV file nahi mili" }, { status: 400 });

  const extension = file.name.toLowerCase().split(".").pop() || "";
  if (extension !== "csv")
    return Response.json({ error: "Side Mapping ke liye CSV file choose karein" }, { status: 400 });
  if (file.size > 1024 * 1024)
    return Response.json({ error: "Side Mapping CSV 1 MB se chhoti rakhein" }, { status: 400 });

  const sourceText = await file.text();
  let rows;
  try {
    rows = parseSideMappingSheetText(sourceText);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Side Mapping CSV parse nahi hui" },
      { status: 400 },
    );
  }
  if (!rows.length)
    return Response.json({ error: "Side Mapping CSV me valid rows nahi mili" }, { status: 400 });
  if (rows.length > 2000)
    return Response.json({ error: "Ek Side Mapping CSV me adhiktam 2000 rows rakhein" }, { status: 400 });

  const plotRows = await env.DB.prepare(
    "SELECT id,polygon FROM plots WHERE project_id=?",
  )
    .bind(projectId)
    .all<{ id: string; polygon: string | null }>();
  const byId = new Map(plotRows.results.map((item) => [item.id, item]));
  const unknown = rows.filter((row) => !byId.has(row.id)).map((row) => row.id);
  if (unknown.length) {
    return Response.json(
      {
        error:
          "Side Mapping CSV me unknown Plot ID mile: " +
          unknown.slice(0, 12).join(", ") +
          (unknown.length > 12 ? "..." : ""),
      },
      { status: 400 },
    );
  }

  const rotationRow = await env.DB.prepare(
    "SELECT value FROM settings WHERE project_id=? AND key='publicRotation' LIMIT 1",
  )
    .bind(projectId)
    .first<{ value: string }>();
  const rotation = normalizeRotation(rotationRow?.value);
  const now = new Date().toISOString();

  const updates: Array<{
    id: string;
    pointCount: number;
    front: number;
    back: number;
    depthA: number;
    depthB: number;
    edgeSemantics: string;
  }> = [];
  const pendingIds: string[] = [];

  for (const row of rows) {
    const stored = byId.get(row.id)!;
    const polygon = parsePolygon(stored.polygon);
    if (!polygon) {
      pendingIds.push(row.id);
      continue;
    }
    const resolved = resolveFourSideEdges(polygon, row.front, rotation);
    if (!resolved) {
      pendingIds.push(row.id);
      continue;
    }
    updates.push({ id: row.id, pointCount: polygon.length, ...resolved });
  }

  for (let index = 0; index < updates.length; index += 80) {
    const chunk = updates.slice(index, index + 80);
    await env.DB.batch(
      chunk.map((row) =>
        env.DB.prepare(
          "UPDATE plots SET front_edge_index=?,back_edge_index=?,depth_edge_index=?,depth2_edge_index=?,edge_semantics=?,updated_at=? WHERE project_id=? AND id=?",
        ).bind(
          row.front,
          row.back,
          row.depthA,
          row.depthB,
          row.edgeSemantics,
          now,
          projectId,
          row.id,
        ),
      ),
    );
  }

  const bindingWrites = updates.flatMap((row) =>
    ([
      ["front", row.front],
      ["back", row.back],
      ["depthA", row.depthA],
      ["depthB", row.depthB],
    ] as const).map(([role, edge]) =>
      env.DB.prepare(
        "UPDATE plot_edge_measurements SET edge_index=?,point_count=?,updated_at=? WHERE project_id=? AND plot_id=? AND role=?",
      ).bind(edge, row.pointCount, now, projectId, row.id, role),
    ),
  );
  for (let index = 0; index < bindingWrites.length; index += 80) {
    await env.DB.batch(bindingWrites.slice(index, index + 80));
  }

  const directions = Object.fromEntries(rows.map((row) => [row.id, row.front]));
  await env.BUCKET.put(`projects/${projectId}/mapper/sideMappingSheet`, sourceText, {
    httpMetadata: { contentType: "text/csv; charset=utf-8" },
  });
  await Promise.all([
    writeSetting(projectId, "sideMappingSheetName", file.name.slice(0, 240), now),
    writeSetting(projectId, "sideMappingSheetCount", String(rows.length), now),
    writeSetting(projectId, "sideMappingAppliedCount", String(updates.length), now),
    writeSetting(projectId, "sideMappingPendingCount", String(pendingIds.length), now),
    writeSetting(projectId, "sideMappingDirections", JSON.stringify(directions), now),
  ]);

  await writeAudit(actor, "mapper.sideMapping_imported", projectId, null, {
    filename: file.name,
    totalCount: rows.length,
    appliedCount: updates.length,
    pendingCount: pendingIds.length,
    pendingIds: pendingIds.slice(0, 80),
    updatedFields: [
      "front_edge_index",
      "back_edge_index",
      "depth_edge_index",
      "depth2_edge_index",
      "edge_semantics",
    ],
  });

  return Response.json({
    ok: true,
    name: file.name,
    count: updates.length,
    totalCount: rows.length,
    appliedCount: updates.length,
    pendingCount: pendingIds.length,
    pendingIds: pendingIds.slice(0, 80),
  });
}
