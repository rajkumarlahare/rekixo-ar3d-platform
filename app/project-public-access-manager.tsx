"use client";

import { useEffect, useState } from "react";
import { Globe2, ShieldOff } from "lucide-react";

type AccessState = {
  projectId?: string;
  projectName?: string;
  publicStatus?: string;
  enabled?: boolean;
  effectivePublicAccess?: boolean;
  error?: string;
};

export default function ProjectPublicAccessManager({
  projectId,
  notify,
}: {
  projectId: string;
  notify: (message: string) => void;
}) {
  const [state, setState] = useState<AccessState>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(
      `/api/admin/project-public-access?projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const data = (await response.json()) as AccessState;
        if (!response.ok)
          throw new Error(data.error || "Public site access load nahi hua");
        if (live) setState(data);
      })
      .catch((error) => {
        if (!live) return;
        notify(
          error instanceof Error
            ? error.message
            : "Public site access load nahi hua",
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [projectId, notify]);

  async function update(enabled: boolean) {
    if (busy) return;

    if (
      !enabled &&
      !window.confirm(
        "Public site temporarily OFF karein?\n\nSame public link par “Project Temporarily Unavailable” dikhega. Admin access aur authenticated preview chalte rahenge.",
      )
    )
      return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin/project-public-access", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, enabled }),
      });
      const data = (await response.json()) as AccessState;
      if (!response.ok)
        throw new Error(data.error || "Public site access update nahi hua");
      setState(data);
      notify(
        enabled
          ? "Public site ON — same link normal open hoga"
          : "Public site OFF — same link par temporary unavailable message dikhega",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Public site access update nahi hua",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <section className="card rekixo-profile-panel">
        Public site access load ho raha hai…
      </section>
    );

  const enabled = state.enabled !== false;
  const published = state.publicStatus === "published";

  return (
    <section className="card rekixo-profile-panel">
      <div className="rekixo-profile-head">
        <div>
          <p>PUBLIC SITE ACCESS</p>
          <h2>{state.projectName || "Project"}</h2>
          <span>
            Publish state se independent emergency control. OFF karne par project
            data, domain aur publish version safe rehte hain.
          </span>
        </div>
        <div
          className={
            enabled
              ? "rekixo-profile-readiness ready"
              : "rekixo-profile-readiness warn"
          }
        >
          {enabled ? <Globe2 /> : <ShieldOff />}
          {enabled ? "Public Site ON" : "Public Site OFF"}
        </div>
      </div>

      <div className="rekixo-profile-required-note">
        <b>Temporary access control:</b> OFF par same public URL 503
        “Project Temporarily Unavailable” dikhayega. Super Admin authenticated
        preview aur admin access unaffected rahenge.
      </div>

      <label
        className="rekixo-profile-toggle-row"
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #263750",
          borderRadius: 14,
          opacity: busy ? 0.7 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(event) => update(event.target.checked)}
        />
        {enabled ? <Globe2 /> : <ShieldOff />}
        <b>
          {busy
            ? "Updating…"
            : enabled
              ? "Public Website Enabled"
              : "Public Website Temporarily Disabled"}
        </b>
      </label>

      <div className="rekixo-profile-actions">
        <span>
          {!published
            ? "Project abhi published nahi hai; access toggle publish state ko change nahi karta."
            : enabled
              ? "Published project public visitors ke liye available hai"
              : "Published project paused hai; ON karte hi same link restore ho jayega"}
        </span>
      </div>
    </section>
  );
}
