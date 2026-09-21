import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { preconnect } from "react-dom";
import { panelMode } from "@/modules/auth";
import { publicGoogleMapsBrowserKey } from "@/modules/geo";
import { isPlatformAccessHost, projectBySlug } from "@/modules/public-project";
import GeoPublicMap from "./geo-public-map";

export const dynamic = "force-dynamic";

const publishedProjectBySlug = cache((slug: string) => projectBySlug(slug));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await publishedProjectBySlug(slug);
  if (!project) return { title: "Satellite Map" };
  return {
    title: `${project.name} · Satellite Map`,
    description: `${project.name} satellite masterplan and live plot availability.`,
  };
}

export default async function PublicGeoMapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (panelMode() === "super") notFound();

  // Emit connection hints in the server response so DNS/TLS can start before
  // client hydration and before either Maps JS or public Geo data is requested.
  preconnect("https://maps.googleapis.com");
  preconnect("https://maps.gstatic.com", { crossOrigin: "anonymous" });

  const { slug } = await params;
  const host = (await headers()).get("host") || "";
  if (!isPlatformAccessHost(host)) notFound();

  const [project, mapsApiKey] = await Promise.all([
    publishedProjectBySlug(slug),
    publicGoogleMapsBrowserKey(),
  ]);
  if (!project) notFound();

  return (
    <GeoPublicMap
      projectName={project.name}
      projectSlug={project.slug}
      mapsApiKey={mapsApiKey}
    />
  );
}
