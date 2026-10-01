"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, LocateFixed, RefreshCw, RotateCw, Save, Trash2 } from "lucide-react";
import Geo3DPlacementVisual from "./geo-3d-placement-visual";

type PlacementState = {
  schemaReady?: boolean;
  scope?: {
    geoProjectId: string;
    platformProject: { id: string; name: string; slug: string };
    isGeoLab: boolean;
  };
  placement?: {
    longitude: number;
    latitude: number;
    altitudeM: number;
    headingDeg: number;
    pitchDeg: number;
    rollDeg: number;
    scale: number;
    publicEnabled: boolean;
    engineReleaseId: string;
    engineReleaseVersion: number;
  } | null;
  suggestedCenter?: { longitude: number; latitude: number; source: string } | null;
  visualFeatures?: Array<{
    id: string;
    name: string;
    linkedPlotId: string | null;
    source: string;
    path: [number, number][];
  }>;
  maps?: { enabled: boolean; apiKey: string | null };
  link?: {
    engineProjectId: string;
    engineSlug: string;
    publicEnabled: boolean;
    status: string;
  } | null;
  engine?: {
    project: { id: string; name: string; slug: string; status: string };
    model?: { id: string; name: string; mimeType: string; available: boolean } | null;
    geoModel?: {
      id: string;
      name: string;
      mimeType: string;
      byteSize?: number;
      available: boolean;
      variant: "geo-optimized";
    } | null;
    renderVariant?: "geo-optimized" | "source";
    release?: { id: string; version: number } | null;
    previewModelUrl?: string | null;
  } | null;
  error?: string;
};

type FormState = {
  longitude: string;
  latitude: string;
  altitudeM: string;
  headingDeg: string;
  pitchDeg: string;
  rollDeg: string;
  scale: string;
  publicEnabled: boolean;
};

const emptyForm: FormState = {
  longitude: "",
  latitude: "",
  altitudeM: "0",
  headingDeg: "0",
  pitchDeg: "0",
  rollDeg: "0",
  scale: "1",
  publicEnabled: false,
};

export default function Geo3DPlacementManager({
  projectId,
  notify,
}: {
  projectId: string;
  notify: (message: string) => void;
}) {
  const [state, setState] = useState<PlacementState>();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!projectId) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/3d-geo-placement?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as PlacementState;
      if (!response.ok) throw new Error(body.error || "3D Geo placement load nahi hua");
      setState(body);
      const placement = body.placement;
      setForm(
        placement
          ? {
              longitude: String(placement.longitude),
              latitude: String(placement.latitude),
              altitudeM: String(placement.altitudeM),
              headingDeg: String(placement.headingDeg),
              pitchDeg: String(placement.pitchDeg),
              rollDeg: String(placement.rollDeg),
              scale: String(placement.scale),
              publicEnabled: placement.publicEnabled,
            }
          : {
              ...emptyForm,
              longitude: body.suggestedCenter ? String(body.suggestedCenter.longitude) : "",
              latitude: body.suggestedCenter ? String(body.suggestedCenter.latitude) : "",
            },
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "3D Geo placement load nahi hua");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  const canPublish = useMemo(
    () =>
      state?.link?.status === "active" &&
      state.link.publicEnabled &&
      state.engine?.project.status === "published" &&
      state.engine?.model?.available &&
      state.engine.model.mimeType === "model/gltf-binary",
    [state],
  );

  function patch(key: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const numericPlacement = useMemo(() => {
    const longitude = Number(form.longitude);
    const latitude = Number(form.latitude);
    const altitudeM = Number(form.altitudeM);
    const headingDeg = Number(form.headingDeg);
    const pitchDeg = Number(form.pitchDeg);
    const rollDeg = Number(form.rollDeg);
    const scale = Number(form.scale);
    const coordinatesPresent =
      form.longitude.trim().length > 0 && form.latitude.trim().length > 0;
    return {
      longitude,
      latitude,
      altitudeM,
      headingDeg,
      pitchDeg,
      rollDeg,
      scale,
      valid:
        coordinatesPresent &&
        Number.isFinite(longitude) &&
        longitude >= -180 &&
        longitude <= 180 &&
        Number.isFinite(latitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        Number.isFinite(altitudeM) &&
        Number.isFinite(headingDeg) &&
        Number.isFinite(pitchDeg) &&
        Number.isFinite(rollDeg) &&
        Number.isFinite(scale) &&
        scale > 0,
    };
  }, [form]);

  const moveAnchor = useCallback((longitude: number, latitude: number) => {
    setForm((current) => ({
      ...current,
      longitude: longitude.toFixed(7),
      latitude: latitude.toFixed(7),
    }));
  }, []);

  function nudge(
    key: "altitudeM" | "headingDeg" | "scale",
    delta: number,
    min: number,
    max: number,
  ) {
    setForm((current) => {
      const value = Number(current[key]);
      const next = Math.min(max, Math.max(min, (Number.isFinite(value) ? value : 0) + delta));
      return {
        ...current,
        [key]:
          key === "scale"
            ? next.toFixed(3)
            : key === "altitudeM"
              ? next.toFixed(2)
              : next.toFixed(1),
      };
    });
  }

  function useGeoCenter() {
    const center = state?.suggestedCenter;
    if (!center) return;
    setForm((current) => ({
      ...current,
      longitude: String(center.longitude),
      latitude: String(center.latitude),
    }));
  }

  async function save() {
    if (!numericPlacement.valid) {
      notify(
        "Pehle valid project longitude/latitude set karein. Blank coordinates ko 0,0 ke roop me save nahi kiya jayega.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/3d-geo-placement", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          longitude: Number(form.longitude),
          latitude: Number(form.latitude),
          altitudeM: Number(form.altitudeM),
          headingDeg: Number(form.headingDeg),
          pitchDeg: Number(form.pitchDeg),
          rollDeg: Number(form.rollDeg),
          scale: Number(form.scale),
          publicEnabled: form.publicEnabled,
        }),
      });
      const body = (await response.json()) as PlacementState;
      if (!response.ok) throw new Error(body.error || "3D Geo placement save nahi hui");
      setState(body);
      notify(
        form.publicEnabled
          ? "3D building customer Geo map ke liye enabled hai"
          : "3D placement draft save ho gaya; customer map unchanged hai",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "3D Geo placement save nahi hui");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/3d-geo-placement?projectId=${encodeURIComponent(projectId)}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "3D placement remove nahi hui");
      setState((current) => ({ ...current, placement: null }));
      setForm({
        ...emptyForm,
        longitude: state?.suggestedCenter ? String(state.suggestedCenter.longitude) : "",
        latitude: state?.suggestedCenter ? String(state.suggestedCenter.latitude) : "",
      });
      notify("3D placement remove ho gayi; existing Geo map safe hai");
    } catch (error) {
      notify(error instanceof Error ? error.message : "3D placement remove nahi hui");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="section-title">
        <Box />
        <div>
          <h2>3D Building on Geo Map</h2>
          <p>
            Linked Engine GLB ko real project location par place karein. Feature opt-in hai:
            bina explicitly enable kiye existing customer Geo map bilkul nahi badlega.
          </p>
        </div>
      </div>

      {!state?.schemaReady ? (
        <p className="notice">Geo 3D placement migration apply hone ke baad controls active honge.</p>
      ) : null}

      <div className="health-grid">
        <article>
          <span>CUSTOMER PROJECT</span>
          <strong>{state?.scope?.platformProject.name || "—"}</strong>
          <small>{state?.scope?.isGeoLab ? "Geo Lab se source project resolve hua" : "Direct project"}</small>
        </article>
        <article>
          <span>ENGINE</span>
          <strong>{state?.engine?.project.name || state?.link?.engineSlug || "Not linked"}</strong>
          <small>{state?.engine?.project.status || "3D link required"}</small>
        </article>
        <article>
          <span>MODEL</span>
          <strong>
            {state?.engine?.renderVariant === "geo-optimized"
              ? state.engine.geoModel?.name || state.engine.model?.name || "—"
              : state?.engine?.model?.name || "—"}
          </strong>
          <small>
            {state?.engine?.renderVariant === "geo-optimized"
              ? `Geo optimized${state.engine.geoModel?.byteSize ? ` · ${(state.engine.geoModel.byteSize / 1_000_000).toFixed(1)} MB` : ""} · source release pinned`
              : state?.engine?.model?.mimeType || "Published GLB required"}
          </small>
        </article>
        <article>
          <span>PINNED RELEASE</span>
          <strong>{state?.placement ? `v${state.placement.engineReleaseVersion}` : "Not saved"}</strong>
          <small>Engine release badalne par 3D auto-hide hoga jab tak re-save na ho.</small>
        </article>
      </div>

      {numericPlacement.valid ? (
        <Geo3DPlacementVisual
          apiKey={state?.maps?.apiKey || null}
          modelUrl={state?.engine?.previewModelUrl || null}
          features={state?.visualFeatures || []}
          longitude={numericPlacement.longitude}
          latitude={numericPlacement.latitude}
          altitudeM={numericPlacement.altitudeM}
          headingDeg={numericPlacement.headingDeg}
          pitchDeg={numericPlacement.pitchDeg}
          rollDeg={numericPlacement.rollDeg}
          scale={numericPlacement.scale}
          disabled={busy}
          onPositionChange={moveAnchor}
          notify={notify}
        />
      ) : null}

      <div className="form-grid">
        <label>
          <span>Longitude</span>
          <input value={form.longitude} onChange={(e) => patch("longitude", e.target.value)} />
        </label>
        <label>
          <span>Latitude</span>
          <input value={form.latitude} onChange={(e) => patch("latitude", e.target.value)} />
        </label>
        <label>
          <span>Ground offset (m)</span>
          <input value={form.altitudeM} onChange={(e) => patch("altitudeM", e.target.value)} />
          <input
            aria-label="Ground offset visual slider"
            type="range"
            min="-5"
            max="15"
            step="0.05"
            value={Number.isFinite(Number(form.altitudeM)) ? Number(form.altitudeM) : 0}
            onChange={(e) => patch("altitudeM", e.target.value)}
          />
          <span className="client-contact-fallback">
            <button type="button" onClick={() => nudge("altitudeM", -0.1, -1000, 10000)} disabled={busy}>-10 cm</button>
            <button type="button" onClick={() => nudge("altitudeM", 0.1, -1000, 10000)} disabled={busy}>+10 cm</button>
          </span>
        </label>
        <label>
          <span>Heading (°)</span>
          <input value={form.headingDeg} onChange={(e) => patch("headingDeg", e.target.value)} />
          <input
            aria-label="Heading visual slider"
            type="range"
            min="-180"
            max="180"
            step="0.5"
            value={Number.isFinite(Number(form.headingDeg)) ? Number(form.headingDeg) : 0}
            onChange={(e) => patch("headingDeg", e.target.value)}
          />
          <span className="client-contact-fallback">
            <button type="button" onClick={() => nudge("headingDeg", -1, -3600, 3600)} disabled={busy}>-1°</button>
            <button type="button" onClick={() => nudge("headingDeg", 1, -3600, 3600)} disabled={busy}>+1°</button>
          </span>
        </label>
        <label>
          <span>Scale</span>
          <input value={form.scale} onChange={(e) => patch("scale", e.target.value)} />
          <input
            aria-label="Scale visual slider"
            type="range"
            min="0.1"
            max="3"
            step="0.01"
            value={Number.isFinite(Number(form.scale)) ? Number(form.scale) : 1}
            onChange={(e) => patch("scale", e.target.value)}
          />
          <span className="client-contact-fallback">
            <button type="button" onClick={() => nudge("scale", -0.01, 0.001, 1000)} disabled={busy}>-1%</button>
            <button type="button" onClick={() => nudge("scale", 0.01, 0.001, 1000)} disabled={busy}>+1%</button>
          </span>
        </label>
        <label>
          <span>Pitch / Roll</span>
          <div className="client-contact-fallback">
            <input value={form.pitchDeg} onChange={(e) => patch("pitchDeg", e.target.value)} aria-label="Pitch degrees" />
            <input value={form.rollDeg} onChange={(e) => patch("rollDeg", e.target.value)} aria-label="Roll degrees" />
          </div>
        </label>

        <label className="wide">
          <span>Customer 3D Site</span>
          <span className="client-contact-fallback">
            <input
              type="checkbox"
              checked={form.publicEnabled}
              disabled={!canPublish}
              onChange={(e) => patch("publicEnabled", e.target.checked)}
            />
            <span>
              Customer Geo map me “3D Site” mode dikhayein
              {!canPublish ? " · linked published GLB + Public 3D required" : ""}
            </span>
          </span>
        </label>
      </div>

      <div className="topbar-actions">
        <button type="button" onClick={useGeoCenter} disabled={busy || !state?.suggestedCenter}>
          <LocateFixed size={18} /> Use Geo center
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            patch("headingDeg", "0");
            patch("pitchDeg", "0");
            patch("rollDeg", "0");
            patch("scale", "1");
            patch("altitudeM", "0");
          }}
        >
          <RotateCw size={18} /> Reset alignment
        </button>
        <button
          className="primary"
          type="button"
          onClick={save}
          disabled={
            busy ||
            !state?.schemaReady ||
            !state?.link ||
            !numericPlacement.valid
          }
        >
          <Save size={18} /> {busy ? "Saving…" : "Save placement"}
        </button>
        <button type="button" onClick={() => void load()} disabled={busy}>
          <RefreshCw size={18} /> Refresh
        </button>
        {state?.placement ? (
          <button type="button" onClick={remove} disabled={busy}>
            <Trash2 size={18} /> Remove placement
          </button>
        ) : null}
      </div>

      <small>
        Safety: source model bytes, masterplan calibration, plot geometry aur existing published Geo snapshot ko ye feature modify nahi karta.
      </small>
    </section>
  );
}
