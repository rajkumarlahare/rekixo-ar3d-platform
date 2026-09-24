"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  HardDrive,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type ManifestFile = {
  path: string;
  label: string;
  section: string;
  source: "generated" | "r2";
  sizeBytes: number;
  contentType: string;
};

type MissingFile = {
  id: string;
  label: string;
  section: string;
  reason: string;
};

type Manifest = {
  exportFormatVersion: number;
  generatedAt: string;
  packageFileName: string;
  project: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    status: string;
    publicStatus: string;
    publishVersion: number;
    publishedAt: string | null;
  };
  counts: {
    plots: number;
    measurements: number;
    pricing: number;
    gallery: number;
    domains: number;
    admins: number;
    memberships: number;
    geoControlPoints: number;
    geoFeatures: number;
    geoSources: number;
    geoVersions: number;
    publishedPlots: number;
    publishedMeasurements: number;
  };
  options: {
    includeLinkedGeoLab: boolean;
  };
  capabilities: {
    linkedGeoLab: { id: string; name: string } | null;
    historicalBinaryVersions: false;
    engineBinaryAssets: false;
  };
  estimatedContentBytes: number;
  files: ManifestFile[];
  missing: MissingFile[];
  warnings: string[];
  excludedSensitiveData: string[];
};

const sectionLabels: Record<string, string> = {
  manifest: "Manifest & recovery notes",
  data: "Project data",
  mapper: "Mapper source files",
  branding: "Branding & media",
  gallery: "Gallery",
  published: "Published snapshot",
  geo: "Geo / GIS",
  integration: "3D integration",
};

function bytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** power).toFixed(power === 0 ? 0 : value / 1024 ** power >= 10 ? 1 : 2)} ${units[power]}`;
}

function dateTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProjectAssetsManager({
  projectId,
  notify,
}: {
  projectId: string;
  notify: (message: string) => void;
}) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeLinkedGeoLab, setIncludeLinkedGeoLab] = useState(false);
  const [downloadStarting, setDownloadStarting] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ projectId });
      if (includeLinkedGeoLab) query.set("includeLinkedGeoLab", "1");
      const response = await fetch(`/api/admin/project-assets?${query.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as Manifest & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Project assets load nahi hue");
      setManifest(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Project assets load nahi hue";
      setError(message);
      setManifest(null);
      notify(message);
    } finally {
      setLoading(false);
    }
  }, [includeLinkedGeoLab, notify, projectId]);

  useEffect(() => {
    setIncludeLinkedGeoLab(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ManifestFile[]>();
    for (const file of manifest?.files || []) {
      const list = groups.get(file.section) || [];
      list.push(file);
      groups.set(file.section, list);
    }
    return Array.from(groups.entries()).sort(
      ([left], [right]) =>
        Object.keys(sectionLabels).indexOf(left) - Object.keys(sectionLabels).indexOf(right),
    );
  }, [manifest]);

  const missingBySection = useMemo(() => {
    const groups = new Map<string, MissingFile[]>();
    for (const item of manifest?.missing || []) {
      const list = groups.get(item.section) || [];
      list.push(item);
      groups.set(item.section, list);
    }
    return groups;
  }, [manifest]);

  function startDownload() {
    if (!manifest || downloadStarting) return;
    const query = new URLSearchParams({ projectId });
    if (includeLinkedGeoLab) query.set("includeLinkedGeoLab", "1");
    const anchor = document.createElement("a");
    anchor.href = `/api/admin/project-assets/download?${query.toString()}`;
    anchor.download = manifest.packageFileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    setDownloadStarting(true);
    anchor.click();
    anchor.remove();
    notify("Project ZIP streaming download start ho gaya");
    window.setTimeout(() => setDownloadStarting(false), 1800);
  }

  if (loading) {
    return (
      <section className="project-assets-card card">
        <div className="project-assets-loading">
          <RefreshCw className="spin" />
          <div>
            <b>Project asset inventory check ho rahi hai</b>
            <span>D1 + R2 ko read-only mode me verify kiya ja raha hai.</span>
          </div>
        </div>
      </section>
    );
  }

  if (error || !manifest) {
    return (
      <section className="project-assets-card card">
        <div className="project-assets-error">
          <AlertTriangle />
          <div>
            <b>{error || "Project asset inventory unavailable"}</b>
            <span>Koi project data change nahi hua. Dobara inventory load karein.</span>
          </div>
          <button type="button" onClick={() => void load()}>
            <RefreshCw /> Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="project-assets-shell">
      <section className="project-assets-card card">
        <div className="project-assets-head">
          <div className="project-assets-head-icon">
            <FileArchive />
          </div>
          <div>
            <span className="project-assets-kicker">READ-ONLY PROJECT EXPORT</span>
            <h2>{manifest.project.name}</h2>
            <p>
              Current working data + current published snapshot + source assets ko
              ek recovery-ready streaming ZIP me export karein.
            </p>
          </div>
          <span className="project-assets-format">FORMAT V{manifest.exportFormatVersion}</span>
        </div>

        <div className="project-assets-stats">
          <article>
            <Database />
            <span>
              <small>Plots / Measurements</small>
              <b>
                {manifest.counts.plots} / {manifest.counts.measurements}
              </b>
            </span>
          </article>
          <article>
            <HardDrive />
            <span>
              <small>Estimated content</small>
              <b>{bytes(manifest.estimatedContentBytes)}</b>
            </span>
          </article>
          <article>
            <Archive />
            <span>
              <small>Files in package</small>
              <b>{manifest.files.length + 1}</b>
            </span>
          </article>
          <article className={manifest.missing.length ? "warn" : "ok"}>
            {manifest.missing.length ? <AlertTriangle /> : <CheckCircle2 />}
            <span>
              <small>Optional missing</small>
              <b>{manifest.missing.length}</b>
            </span>
          </article>
        </div>

        <div className="project-assets-project-meta">
          <span>
            <small>Project ID</small>
            <b>{manifest.project.id}</b>
          </span>
          <span>
            <small>Project status</small>
            <b>{manifest.project.status}</b>
          </span>
          <span>
            <small>Public status</small>
            <b>{manifest.project.publicStatus}</b>
          </span>
          <span>
            <small>Publish version</small>
            <b>{manifest.project.publishVersion}</b>
          </span>
        </div>

        {manifest.capabilities.linkedGeoLab ? (
          <label className="project-assets-option">
            <input
              type="checkbox"
              checked={includeLinkedGeoLab}
              onChange={(event) => setIncludeLinkedGeoLab(event.target.checked)}
            />
            <span>
              <b>Include linked Geo Lab workspace</b>
              <small>
                {manifest.capabilities.linkedGeoLab.name} · explicit advanced export.
                Normal project data ke saath automatically mix nahi hota.
              </small>
            </span>
          </label>
        ) : null}

        {manifest.warnings.length ? (
          <div className="project-assets-warnings">
            {manifest.warnings.map((warning) => (
              <span key={warning}>
                <AlertTriangle /> {warning}
              </span>
            ))}
          </div>
        ) : null}

        <div className="project-assets-actions">
          <button
            className="primary project-assets-download"
            type="button"
            onClick={startDownload}
            disabled={downloadStarting}
          >
            <Download />
            {downloadStarting ? "Starting download..." : "Download Full Project ZIP"}
          </button>
          <button type="button" className="project-assets-refresh" onClick={() => void load()}>
            <RefreshCw /> Refresh inventory
          </button>
          <small>
            ZIP browser tak stream hoti hai; server poori archive ko memory me buffer nahi karta.
          </small>
        </div>
      </section>

      <section className="project-assets-security card">
        <ShieldCheck />
        <div>
          <b>Safe export boundary</b>
          <span>
            Password hashes/salts, sessions, login-attempt data, Super Admin/Cloudflare
            secrets aur AR3D Engine binary scenes/models ZIP me include nahi hote.
          </span>
        </div>
      </section>

      <div className="project-assets-sections">
        {grouped.map(([section, files]) => {
          const missing = missingBySection.get(section) || [];
          const total = files.reduce((sum, file) => sum + file.sizeBytes, 0);
          return (
            <details className="project-assets-section card" key={section} open={section === "mapper"}>
              <summary>
                <span>
                  <b>{sectionLabels[section] || section}</b>
                  <small>
                    {files.length} ready · {missing.length} unavailable · {bytes(total)}
                  </small>
                </span>
                <em>{files.length}</em>
              </summary>
              <div className="project-assets-file-list">
                {files.map((file) => (
                  <article key={file.path}>
                    <CheckCircle2 />
                    <span>
                      <b>{file.label}</b>
                      <small>{file.path}</small>
                    </span>
                    <em>{bytes(file.sizeBytes)}</em>
                  </article>
                ))}
                {missing.map((item) => (
                  <article className="missing" key={item.id}>
                    <AlertTriangle />
                    <span>
                      <b>{item.label}</b>
                      <small>{item.reason}</small>
                    </span>
                    <em>—</em>
                  </article>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <section className="project-assets-footer-note">
        Inventory generated {dateTime(manifest.generatedAt)} · archive name{" "}
        <b>{manifest.packageFileName}</b>
      </section>
    </div>
  );
}
