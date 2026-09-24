import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { panelMode } from "@/modules/auth";
import { isPlatformAccessHost, projectBySlug } from "@/modules/public-project";
import { publicSiteEnabled } from "@/modules/public-site-access";

export const dynamic = "force-dynamic";

type MetaSettings = Record<string, string>;

async function readProjectMeta(slug: string) {
  const project = await projectBySlug(slug);
  if (!project) return null;
  if (!(await publicSiteEnabled(project.id))) {
    return {
      project,
      paused: true as const,
      title: "Project Temporarily Unavailable",
      description: "This project is temporarily unavailable. Please try again later.",
      imageUrl: "",
      logoUrl: "",
      hasShareImage: false,
      brandName: "Rekixo",
      origin: "",
    };
  }

  const snapshot = await env.DB.prepare(
    "SELECT project_name AS projectName FROM project_public_snapshots WHERE project_id=? LIMIT 1",
  )
    .bind(project.id)
    .first<{ projectName: string }>();

  const rows = snapshot
    ? await env.DB.prepare(
        "SELECT key,value FROM published_settings WHERE project_id=? AND key IN ('projectName','brandName','location','address','logoName','logoVersion','shareTitle','shareDescription','shareImage','shareVersion')",
      )
        .bind(project.id)
        .all<{ key: string; value: string }>()
    : await env.DB.prepare(
        "SELECT key,value FROM settings WHERE project_id=? AND key IN ('projectName','brandName','location','address','logoName','logoVersion','shareTitle','shareDescription','shareImage','shareVersion')",
      )
        .bind(project.id)
        .all<{ key: string; value: string }>();

  const settings: MetaSettings = Object.fromEntries(
    (rows.results || []).map((row) => [row.key, row.value]),
  );

  const publishedProjectName = snapshot?.projectName || project.name;
  const title =
    settings.shareTitle || settings.projectName || publishedProjectName || "Project";
  const description =
    settings.shareDescription ||
    [settings.brandName, settings.address || settings.location]
      .filter(Boolean)
      .join(" • ") ||
    `${title} interactive plot visualization.`;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "";
  const proto = requestHeaders.get("x-forwarded-proto") || "https";
  const origin = host ? `${proto}://${host}` : "";

  const logoPath = settings.logoName
    ? `/api/project-asset/logo?projectId=${encodeURIComponent(project.id)}&variant=public&v=${encodeURIComponent(settings.logoVersion || settings.logoName)}`
    : "";
  const shareImagePath = settings.shareImage
    ? `/projects/${encodeURIComponent(project.slug)}/share-image/${encodeURIComponent(settings.shareVersion || "1")}`
    : "";
  const imagePath = shareImagePath || logoPath;
  const imageUrl =
    imagePath && origin ? new URL(imagePath, origin).toString() : imagePath || "";
  const logoUrl =
    logoPath && origin ? new URL(logoPath, origin).toString() : logoPath || "";

  return {
    project,
    paused: false as const,
    title,
    description,
    imageUrl,
    logoUrl,
    hasShareImage: Boolean(settings.shareImage),
    brandName: settings.brandName || "AR 3D Vision",
    origin,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = await readProjectMeta(slug);

  if (!meta) {
    return {
      title: "Project",
      description: "Interactive project and plot visualization.",
    };
  }

  const images = meta.imageUrl
    ? [{ url: meta.imageUrl, alt: meta.title }]
    : undefined;

  return {
    metadataBase: meta.origin ? new URL(meta.origin) : undefined,
    title: meta.title,
    description: meta.description,
    icons: meta.logoUrl
      ? { icon: meta.logoUrl, shortcut: meta.logoUrl }
      : undefined,
    openGraph: {
      type: "website",
      siteName: meta.brandName,
      title: meta.title,
      description: meta.description,
      images,
    },
    twitter: {
      card: meta.hasShareImage ? "summary_large_image" : "summary",
      title: meta.title,
      description: meta.description,
      images: meta.imageUrl ? [meta.imageUrl] : undefined,
    },
  };
}

export default async function SharedProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (panelMode() === "super") notFound();

  const { slug } = await params;
  const host = (await headers()).get("host") || "";
  if (!isPlatformAccessHost(host)) notFound();

  const project = await projectBySlug(slug);
  if (!project) notFound();

  if (!(await publicSiteEnabled(project.id))) {
    return (
      <main
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#050914",
          color: "#f7f9ff",
        }}
      >
        <section
          style={{
            width: "min(560px, 100%)",
            padding: 32,
            border: "1px solid #26344b",
            borderRadius: 18,
            background: "#0b1424",
            textAlign: "center",
          }}
        >
          <h1>Project Temporarily Unavailable</h1>
          <p>This project is temporarily unavailable. Please try again later.</p>
        </section>
      </main>
    );
  }

  const published = await env.DB.prepare(
    "SELECT publish_version AS publishVersion FROM projects WHERE id=? LIMIT 1",
  )
    .bind(project.id)
    .first<{ publishVersion: number }>();

  return (
    <main style={{ position: "fixed", inset: 0, background: "#050914" }}>
      <iframe
        title={`${project.name} website`}
        src={`/project/index.html?projectSlug=${encodeURIComponent(project.slug)}&pv=${encodeURIComponent(String(published?.publishVersion || 0))}&v=66`}
        loading="eager"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </main>
  );
}
