"use client";

import { useEffect, useState } from "react";
import { PhoneCall, PhoneOff, Save } from "lucide-react";
import type { ProjectCustomerActions } from "./project-customer-actions";

type ApiState = {
  projectId?: string;
  projectName?: string;
  actions?: ProjectCustomerActions;
  error?: string;
};

const DEFAULT_ACTIONS: ProjectCustomerActions = {
  customerCallEnabled: true,
};

export default function ProjectCustomerActionsManager({
  projectId,
  notify,
}: {
  projectId: string;
  notify: (message: string) => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [actions, setActions] = useState<ProjectCustomerActions>(DEFAULT_ACTIONS);
  const [saved, setSaved] = useState<ProjectCustomerActions>(DEFAULT_ACTIONS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(
      `/api/admin/project-customer-actions?projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const data = (await response.json()) as ApiState;
        if (!response.ok)
          throw new Error(data.error || "Customer actions load nahi hue");
        if (!live) return;
        const next = data.actions || DEFAULT_ACTIONS;
        setProjectName(data.projectName || "Project");
        setActions(next);
        setSaved(next);
      })
      .catch((error) => {
        if (!live) return;
        notify(error instanceof Error ? error.message : "Customer actions load nahi hue");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [projectId, notify]);

  const dirty = actions.customerCallEnabled !== saved.customerCallEnabled;

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/project-customer-actions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          changes: { customerCallEnabled: actions.customerCallEnabled },
        }),
      });
      const data = (await response.json()) as ApiState;
      if (!response.ok)
        throw new Error(data.error || "Customer actions save nahi hue");
      const next = data.actions || actions;
      setActions(next);
      setSaved(next);
      notify(
        next.customerCallEnabled
          ? "Customer calling ON — public site par Call buttons available hain"
          : "Customer calling OFF — public site se Call buttons hata diye gaye",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Customer actions save nahi hue");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return <section className="card rekixo-profile-panel">Customer actions load ho rahe hain…</section>;

  return (
    <section className="card rekixo-profile-panel">
      <div className="rekixo-profile-head">
        <div>
          <p>CUSTOMER WEBSITE ACTIONS</p>
          <h2>{projectName}</h2>
          <span>
            Project-wise controls. Default ON hai, isliye doosre aur future projects par calling automatically available rahegi.
          </span>
        </div>
        <div
          className={
            actions.customerCallEnabled
              ? "rekixo-profile-readiness ready"
              : "rekixo-profile-readiness warn"
          }
        >
          {actions.customerCallEnabled ? <PhoneCall /> : <PhoneOff />}
          {actions.customerCallEnabled ? "Calling ON" : "Calling OFF"}
        </div>
      </div>

      <div className="rekixo-profile-required-note">
        <b>Customer Calling:</b> OFF karne par header ka phone icon aur plot details ka
        “Call Now” dono hide ho jayenge. WhatsApp aur baaki customer features par koi
        effect nahi padega.
      </div>

      <label
        className="rekixo-profile-toggle-row"
        style={{ marginTop: 16, padding: 16, border: "1px solid #263750", borderRadius: 14 }}
      >
        <input
          type="checkbox"
          checked={actions.customerCallEnabled}
          onChange={(event) =>
            setActions((current) => ({
              ...current,
              customerCallEnabled: event.target.checked,
            }))
          }
        />
        {actions.customerCallEnabled ? <PhoneCall /> : <PhoneOff />}
        <b>Customer Calling {actions.customerCallEnabled ? "Enabled" : "Disabled"}</b>
      </label>

      <div className="rekixo-profile-actions">
        <button className="primary" disabled={busy || !dirty} onClick={save}>
          <Save />
          {busy ? "Saving…" : dirty ? "Save Customer Actions" : "Actions Saved"}
        </button>
        <span>
          {actions.customerCallEnabled
            ? "Header + plot drawer calling visible"
            : "WhatsApp-only customer contact layout"}
        </span>
      </div>
    </section>
  );
}
