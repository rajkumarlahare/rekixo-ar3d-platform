import { env } from "cloudflare:workers";
import { requireSuperAdmin, sameOrigin } from "@/modules/auth";
import { writeAudit } from "@/modules/audit";
import {
  cleanHostInput,
  domainSupports,
  normalizeSlug,
  validHostname,
  validSlug,
  type DomainKind,
} from "@/modules/domains";
import {
  assertDomainAvailable,
  deleteProjectDomain,
  upsertPrimaryProjectDomain,
} from "@/modules/domains";
import {
  clientFallbackHost,
  clientPlatformHost,
  sharedAdminHost,
} from "@/modules/projects";
import { currentProjectLinks } from "@/modules/projects";

const denied = () => Response.json({ error: "Super Admin access required" }, { status: 403 });
async function isGeoLab(projectId: string) {
  return Boolean(
    await env.DB.prepare(
      "SELECT 1 FROM projects WHERE id=? AND kind='geo_lab' AND status!='deleted' LIMIT 1",
    )
      .bind(projectId)
      .first(),
  );
}

type DomainRow = {
  host: string;
  projectId: string;
  kind: DomainKind;
  publicPrimary: number;
  adminPrimary: number;
  status: string;
};

function links(slug: string, publicHost?: string | null, adminHost?: string | null) {
  return currentProjectLinks(slug, publicHost, adminHost);
}

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();

  const url = new URL(request.url);
  const summaryOnly = url.searchParams.get("summary") === "1";
  const limitRaw = Number(url.searchParams.get("limit"));
  const offsetRaw = Number(url.searchParams.get("offset"));
  const paged = Number.isFinite(limitRaw) && limitRaw > 0;
  const limit = paged ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 0;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

  if (summaryOnly) {
    const total = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM projects WHERE status!='deleted'",
    ).first<{ total: number }>();
    return Response.json(
      { total: Number(total?.total || 0) },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const projectSql =
    "SELECT id,name,slug,kind,status,public_status AS publicStatus,publish_version AS publishVersion,public_host AS publicHost,admin_host AS adminHost,created_at AS createdAt,updated_at AS updatedAt FROM projects WHERE status!='deleted' ORDER BY created_at DESC";
  const projectsResult = paged
    ? await env.DB.prepare(`${projectSql} LIMIT ? OFFSET ?`).bind(limit, offset).all<{
        id: string;
        name: string;
        slug: string;
        kind: string;
        status: string;
        publicStatus: string;
        publishVersion: number;
        publicHost: string | null;
        adminHost: string | null;
        createdAt: string;
        updatedAt: string;
      }>()
    : await env.DB.prepare(projectSql).all<{
        id: string;
        name: string;
        slug: string;
        kind: string;
        status: string;
        publicStatus: string;
        publishVersion: number;
        publicHost: string | null;
        adminHost: string | null;
        createdAt: string;
        updatedAt: string;
      }>();

  const projectIds = projectsResult.results.map((project) => project.id);
  let domains: DomainRow[] = [];
  if (projectIds.length) {
    if (paged) {
      const placeholders = projectIds.map(() => "?").join(",");
      const domainResult = await env.DB.prepare(
        `SELECT host,project_id AS projectId,kind,public_primary AS publicPrimary,admin_primary AS adminPrimary,status FROM project_domains WHERE project_id IN (${placeholders}) ORDER BY created_at ASC`,
      )
        .bind(...projectIds)
        .all<DomainRow>();
      domains = domainResult.results;
    } else {
      const domainResult = await env.DB.prepare(
        "SELECT host,project_id AS projectId,kind,public_primary AS publicPrimary,admin_primary AS adminPrimary,status FROM project_domains ORDER BY created_at ASC",
      ).all<DomainRow>();
      domains = domainResult.results;
    }
  }

  const projects = projectsResult.results.map((project) => {
    const rows = domains.filter((item) => item.projectId === project.id);
    const knownHosts = new Set(rows.map((row) => row.host));
    if (project.publicHost && !knownHosts.has(project.publicHost)) {
      rows.push({
        host: project.publicHost,
        projectId: project.id,
        kind: "public",
        publicPrimary: 1,
        adminPrimary: 0,
        status: "active",
      });
      knownHosts.add(project.publicHost);
    }
    if (project.adminHost && !knownHosts.has(project.adminHost)) {
      rows.push({
        host: project.adminHost,
        projectId: project.id,
        kind: "admin",
        publicPrimary: 0,
        adminPrimary: 1,
        status: "active",
      });
    }
    const primaryPublic =
      rows.find(
        (row) =>
          row.status === "active" &&
          row.publicPrimary &&
          domainSupports(row.kind, "public"),
      )?.host || project.publicHost;
    const primaryAdmin =
      rows.find(
        (row) =>
          row.status === "active" &&
          row.adminPrimary &&
          domainSupports(row.kind, "admin"),
      )?.host || project.adminHost;
    return {
      ...project,
      domains: rows,
      ...links(project.slug, primaryPublic, primaryAdmin),
    };
  });

  const total = paged
    ? Number(
        (
          await env.DB.prepare(
            "SELECT COUNT(*) AS total FROM projects WHERE status!='deleted'",
          ).first<{ total: number }>()
        )?.total || 0,
      )
    : projects.length;

  return Response.json(
    {
      projects,
      total,
      nextOffset: offset + projects.length,
      hasMore: paged ? offset + projects.length < total : false,
      platformHost: clientPlatformHost() || null,
      fallbackHost: clientFallbackHost() || null,
      sharedAdminHost: sharedAdminHost() || null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    host?: string;
    kind?: "public" | "admin";
    primary?: boolean;
  };
  const projectId = String(body.projectId || "").trim();
  const kind = body.kind === "admin" ? "admin" : "public";
  const host = cleanHostInput(body.host);
  if (!projectId || !host || !validHostname(host))
    return Response.json({ error: "Valid project aur hostname required" }, { status: 400 });

  const project = await env.DB.prepare(
    "SELECT id FROM projects WHERE id=? AND status!='deleted' LIMIT 1",
  )
    .bind(projectId)
    .first<{ id: string }>();
  if (!project) return Response.json({ error: "Project nahi mila" }, { status: 404 });
  if (await isGeoLab(projectId))
    return Response.json({ error: "Geo Lab project par domain attach disabled hai" }, { status: 409 });

  try {
    await assertDomainAvailable(host, projectId);
    const now = new Date().toISOString();
    const existing = await env.DB.prepare(
      "SELECT kind FROM project_domains WHERE host=? AND project_id=? LIMIT 1",
    )
      .bind(host, projectId)
      .first<{ kind: DomainKind }>();

    if (body.primary !== false) {
      await upsertPrimaryProjectDomain(projectId, kind, host, now);
    } else if (existing) {
      const nextKind =
        existing.kind === "both" || existing.kind === kind ? existing.kind : "both";
      await env.DB.prepare(
        "UPDATE project_domains SET kind=?,status='active',updated_at=? WHERE host=? AND project_id=?",
      )
        .bind(nextKind, now, host, projectId)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO project_domains (host,project_id,kind,public_primary,admin_primary,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)",
      )
        .bind(host, projectId, kind, 0, 0, now, now)
        .run();
    }

    await writeAudit(actor, "project.domain_added", projectId, host, {
      kind,
      primary: body.primary !== false,
    });
    return Response.json({ ok: true, host, kind });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Domain save nahi hua" },
      { status: 409 },
    );
  }
}

export async function PATCH(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    host?: string;
    kind?: "public" | "admin";
    action?: "set_primary" | "slug";
    slug?: string;
  };
  const projectId = String(body.projectId || "").trim();
  if (!projectId) return Response.json({ error: "Project required" }, { status: 400 });

  if (body.action === "slug") {
    const slug = normalizeSlug(body.slug);
    if (!validSlug(slug))
      return Response.json({ error: "Valid public link slug required" }, { status: 400 });
    try {
      await env.DB.prepare("UPDATE projects SET slug=?,updated_at=? WHERE id=?")
        .bind(slug, new Date().toISOString(), projectId)
        .run();
      await writeAudit(actor, "project.slug_updated", projectId, slug, { slug });
      return Response.json({ ok: true, slug });
    } catch {
      return Response.json({ error: "Ye slug pehle se use ho raha hai" }, { status: 409 });
    }
  }

  if (body.action === "set_primary") {
    if (await isGeoLab(projectId))
      return Response.json({ error: "Geo Lab project par primary domain disabled hai" }, { status: 409 });
    const kind = body.kind === "admin" ? "admin" : "public";
    const host = cleanHostInput(body.host);
    if (!host) return Response.json({ error: "Hostname required" }, { status: 400 });
    try {
      await upsertPrimaryProjectDomain(projectId, kind, host);
      await writeAudit(actor, "project.domain_primary", projectId, host, { kind });
      return Response.json({ ok: true, host, kind });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Primary domain update nahi hua" },
        { status: 409 },
      );
    }
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return denied();
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin" }, { status: 403 });

  const url = new URL(request.url);
  const projectId = String(url.searchParams.get("projectId") || "");
  const host = cleanHostInput(url.searchParams.get("host"));
  if (!projectId || !host)
    return Response.json({ error: "Project aur hostname required" }, { status: 400 });

  try {
    await deleteProjectDomain(projectId, host);
    await writeAudit(actor, "project.domain_removed", projectId, host);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Domain remove nahi hua" },
      { status: 404 },
    );
  }
}
