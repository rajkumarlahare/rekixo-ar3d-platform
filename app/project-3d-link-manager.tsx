"use client";

import { useEffect, useState } from "react";
import { Box, ExternalLink, Link2, RefreshCw, Trash2 } from "lucide-react";

type LinkState = {
  project?: { id: string; name: string; slug: string };
  link?: {
    engineProjectId: string;
    engineSlug: string;
    status: string;
    publicEnabled: boolean;
    publicUrl: string;
  } | null;
  engine?: {
    project: { id: string; slug: string; name: string; status: string };
    activeModelAvailable: boolean;
    enabledSceneCount: number;
  } | null;
  adminHandoffUrl?: string | null;
};

export default function Project3DLinkManager({
  projectId,
  notify,
}: {
  projectId: string;
  notify: (message: string) => void;
}) {
  const [state, setState] = useState<LinkState>();
  const [slug, setSlug] = useState("");
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!projectId) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/3d-link?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as LinkState & { error?: string };
      if (!response.ok) throw new Error(body.error || "3D link load failed");
      setState(body);
      setSlug(body.link?.engineSlug || "");
      setPublicEnabled(Boolean(body.link?.publicEnabled));
    } catch (error) {
      notify(error instanceof Error ? error.message : "3D link load failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/3d-link", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, engineSlug: slug, publicEnabled }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "3D link save failed");
      notify("3D Engine link saved");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "3D link save failed");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/3d-link?projectId=${encodeURIComponent(projectId)}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "3D link remove failed");
      notify("3D Engine link removed");
      setState(undefined);
      setSlug("");
      setPublicEnabled(false);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "3D link remove failed");
      setBusy(false);
    }
  }

  const engineStatus = state?.engine?.project.status;
  const canPublish = engineStatus === "published";

  return (
    <section className="card">
      <div className="section-title">
        <Box />
        <div>
          <h2>AR3D Engine Link</h2>
          <p>
            Platform project ko isolated 3D Engine project se link karein. Model/scene
            data Engine database me hi rahega.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <label className="wide">
          <span>Engine project slug</span>
          <input
            value={slug}
            placeholder="example: jyoti-paradise"
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            disabled={busy}
          />
          <small>Engine Admin project registry ka exact slug use karein.</small>
        </label>

        <label className="wide">
          <span>Public 3D experience</span>
          <span className="client-contact-fallback">
            <input
              type="checkbox"
              checked={publicEnabled}
              disabled={busy || (Boolean(state?.link) && !canPublish)}
              onChange={(event) => setPublicEnabled(event.target.checked)}
            />
            <span>
              Platform public project par 3D button expose karein
              {state?.link && !canPublish ? " (Engine project published hona chahiye)" : ""}
            </span>
          </span>
        </label>
      </div>

      {state?.link ? (
        <div className="health-grid">
          <article>
            <span>ENGINE PROJECT</span>
            <strong>{state.engine?.project.name || state.link.engineSlug}</strong>
            <small>{state.link.engineProjectId}</small>
          </article>
          <article>
            <span>ENGINE STATUS</span>
            <strong>{state.engine?.project.status || "Unavailable"}</strong>
            <small>{state.engine?.enabledSceneCount ?? 0} enabled modules</small>
          </article>
          <article>
            <span>ACTIVE MODEL</span>
            <strong>{state.engine?.activeModelAvailable ? "Live" : "Pending"}</strong>
            <small>Verified from Engine API</small>
          </article>
          <article>
            <span>PUBLIC LINK</span>
            <strong>{state.link.publicEnabled && canPublish ? "Enabled" : "Off"}</strong>
            <small>{state.link.publicUrl}</small>
          </article>
        </div>
      ) : null}

      <div className="topbar-actions">
        <button className="primary" type="button" disabled={busy || !slug} onClick={save}>
          <Link2 size={18} /> {busy ? "Checking…" : "Verify & Save Link"}
        </button>
        <button type="button" disabled={busy} onClick={() => void load()}>
          <RefreshCw size={18} /> Refresh
        </button>
        {state?.adminHandoffUrl ? (
          <a
            className="mapper-preview-link"
            href={state.adminHandoffUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink /> Open linked 3D Admin
          </a>
        ) : null}
        {state?.link ? (
          <button type="button" disabled={busy} onClick={remove}>
            <Trash2 size={18} /> Unlink
          </button>
        ) : null}
      </div>
    </section>
  );
}
