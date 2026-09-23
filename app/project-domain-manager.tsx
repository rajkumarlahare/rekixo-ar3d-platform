"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

type Domain = {
  host: string;
  projectId: string;
  kind: "public" | "admin" | "both";
  publicPrimary: number;
  adminPrimary: number;
  status: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  publicStatus: string;
  publishVersion: number;
  domains: Domain[];
  publicUrl: string;
  platformUrl: string;
  fallbackUrl: string;
  fallbackAdminUrl: string;
  platformAdminUrl: string;
  customPublicUrl: string;
  customAdminUrl: string;
  adminUrl: string;
};

const DOMAIN_PAGE_SIZE = 4;

export default function ProjectDomainManager({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/domains?summary=1", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Domain count load nahi hua");
        if (active) setTotal(Number(data.total || 0));
      })
      .catch(() => {
        // Count is non-critical. The full list still loads safely on expand.
      });
    return () => {
      active = false;
    };
  }, []);

  async function loadPage({
    reset = false,
    limit = DOMAIN_PAGE_SIZE,
  }: {
    reset?: boolean;
    limit?: number;
  } = {}) {
    if (loading) return;
    setLoading(true);
    try {
      const offset = reset ? 0 : projects.length;
      const response = await fetch(
        `/api/admin/domains?limit=${Math.max(1, limit)}&offset=${offset}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Domains load nahi hue");
      const page = (data.projects || []) as Project[];
      setProjects((current) =>
        reset
          ? page
          : [
              ...current,
              ...page.filter(
                (item) => !current.some((currentItem) => currentItem.id === item.id),
              ),
            ],
      );
      setTotal(Number(data.total || 0));
      setLoaded(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Domains load nahi hue");
    } finally {
      setLoading(false);
    }
  }

  async function reloadLoaded() {
    const limit = Math.max(DOMAIN_PAGE_SIZE, projects.length);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/domains?limit=${limit}&offset=0`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Domains load nahi hue");
      setProjects(data.projects || []);
      setTotal(Number(data.total || 0));
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) await loadPage({ reset: true });
  }

  async function mutate(label: string, request: () => Promise<Response>) {
    setBusy(label);
    try {
      const response = await request();
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Domain update nahi hua");
      await reloadLoaded();
      notify("Project domain mapping update ho gayi");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Domain update nahi hua");
    } finally {
      setBusy("");
    }
  }

  function add(project: Project, kind: "public" | "admin") {
    const host = prompt(
      kind === "public"
        ? "Public website hostname — example: rpk.example.com"
        : "Client admin hostname — example: admin.rpk.example.com",
      "",
    );
    if (!host) return;
    mutate(`${project.id}-${kind}`, () =>
      fetch("/api/admin/domains", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          host,
          kind,
          primary: true,
        }),
      }),
    );
  }

  function alias(project: Project) {
    const host = prompt("Additional public alias hostname", "");
    if (!host) return;
    mutate(`${project.id}-alias`, () =>
      fetch("/api/admin/domains", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          host,
          kind: "public",
          primary: false,
        }),
      }),
    );
  }

  function editSlug(project: Project) {
    const slug = prompt("Platform link slug", project.slug);
    if (!slug || slug === project.slug) return;
    mutate(`${project.id}-slug`, () =>
      fetch("/api/admin/domains", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          action: "slug",
          slug,
        }),
      }),
    );
  }

  function setPrimary(project: Project, domain: Domain, kind: "public" | "admin") {
    mutate(`${project.id}-${domain.host}-primary`, () =>
      fetch("/api/admin/domains", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          host: domain.host,
          kind,
          action: "set_primary",
        }),
      }),
    );
  }

  function remove(project: Project, domain: Domain) {
    if (!confirm(`${domain.host} ko project se remove karein?`)) return;
    mutate(`${project.id}-${domain.host}-delete`, () =>
      fetch(
        `/api/admin/domains?projectId=${encodeURIComponent(project.id)}&host=${encodeURIComponent(domain.host)}`,
        { method: "DELETE" },
      ),
    );
  }

  async function copy(value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    notify("Link copy ho gaya");
  }

  return (
    <section
      className={`card rekixo-domain-manager super-collapsible-card ${open ? "is-open" : "is-collapsed"}`}
    >
      <div className="client-list-head super-collapsible-head">
        <div>
          <h2>Project links & domains</h2>
          <p>
            New clients ke liye naya Worker nahi. Ek generic Rekixo Client Sites
            Worker hostname se project resolve karega.
          </p>
        </div>
        <div className="super-collapsible-meta">
          <b>{total}</b>
          <button
            type="button"
            className="super-collapse-toggle"
            aria-label={
              open
                ? "Collapse project links and domains"
                : "Expand project links and domains"
            }
            aria-expanded={open}
            onClick={() => void toggleOpen()}
          >
            <ChevronDown />
          </button>
        </div>
      </div>

      {open && (
        <div className="super-collapsible-body">
          {loading && !loaded ? (
            <div className="empty">Project links & domains load ho rahe hain…</div>
          ) : projects.length ? (
            <>
              <div className="rekixo-domain-projects">
                {projects.map((project) => (
                  <article key={project.id} className="rekixo-domain-project">
                    <header>
                      <div>
                        <b>{project.name}</b>
                        <small>
                          {project.publicStatus} · v{project.publishVersion || 0}
                        </small>
                      </div>
                      <button onClick={() => editSlug(project)}>
                        <Pencil /> Link slug
                      </button>
                    </header>

                    <div className="rekixo-domain-link">
                      <span>Canonical website</span>
                      <code>{project.publicUrl || "—"}</code>
                      <button
                        onClick={() => copy(project.publicUrl)}
                        disabled={!project.publicUrl}
                      >
                        <Copy />
                      </button>
                      {project.publicUrl && (
                        <a
                          href={project.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink />
                        </a>
                      )}
                    </div>

                    <div className="rekixo-domain-link">
                      <span>Canonical client admin</span>
                      <code>{project.adminUrl || "—"}</code>
                      <button
                        onClick={() => copy(project.adminUrl)}
                        disabled={!project.adminUrl}
                      >
                        <Copy />
                      </button>
                      {project.adminUrl && (
                        <a
                          href={project.adminUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink />
                        </a>
                      )}
                    </div>

                    <div className="rekixo-domain-link">
                      <span>Free fallback website</span>
                      <code>{project.fallbackUrl || "—"}</code>
                      <button
                        onClick={() => copy(project.fallbackUrl)}
                        disabled={!project.fallbackUrl}
                      >
                        <Copy />
                      </button>
                      {project.fallbackUrl && (
                        <a
                          href={project.fallbackUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink />
                        </a>
                      )}
                    </div>

                    <div className="rekixo-domain-link">
                      <span>Free fallback admin</span>
                      <code>{project.fallbackAdminUrl || "—"}</code>
                      <button
                        onClick={() => copy(project.fallbackAdminUrl)}
                        disabled={!project.fallbackAdminUrl}
                      >
                        <Copy />
                      </button>
                      {project.fallbackAdminUrl && (
                        <a
                          href={project.fallbackAdminUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink />
                        </a>
                      )}
                    </div>

                    <div className="rekixo-domain-actions">
                      <button
                        onClick={() => add(project, "public")}
                        disabled={Boolean(busy)}
                      >
                        <Globe2 /> Public domain
                      </button>
                      <button
                        onClick={() => alias(project)}
                        disabled={Boolean(busy)}
                      >
                        <Plus /> Public alias
                      </button>
                      <button
                        onClick={() => add(project, "admin")}
                        disabled={Boolean(busy)}
                      >
                        <Link2 /> Admin domain
                      </button>
                    </div>

                    <div className="rekixo-domain-rows">
                      {project.domains.length ? (
                        project.domains.map((domain) => (
                          <div key={domain.host}>
                            <span>
                              <b>{domain.host}</b>
                              <small>
                                {domain.kind}
                                {domain.publicPrimary
                                  ? " · public primary"
                                  : ""}
                                {domain.adminPrimary ? " · admin primary" : ""}
                              </small>
                            </span>
                            {(domain.kind === "public" ||
                              domain.kind === "both") &&
                              !domain.publicPrimary && (
                                <button
                                  onClick={() =>
                                    setPrimary(project, domain, "public")
                                  }
                                >
                                  Public primary
                                </button>
                              )}
                            {(domain.kind === "admin" ||
                              domain.kind === "both") &&
                              !domain.adminPrimary && (
                                <button
                                  onClick={() =>
                                    setPrimary(project, domain, "admin")
                                  }
                                >
                                  Admin primary
                                </button>
                              )}
                            <a
                              href={`https://${domain.host}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink />
                            </a>
                            <button
                              className="danger"
                              onClick={() => remove(project, domain)}
                            >
                              <Trash2 />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="empty">
                          Custom domain pending — fallback/platform link se
                          project preview/share kiya ja sakta hai.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {projects.length < total && (
                <button
                  type="button"
                  className="super-load-more"
                  disabled={loading}
                  onClick={() => void loadPage()}
                >
                  {loading
                    ? "Loading…"
                    : `Load ${Math.min(DOMAIN_PAGE_SIZE, total - projects.length)} more`}
                </button>
              )}
            </>
          ) : (
            <div className="empty">Abhi koi active project nahi hai।</div>
          )}

          <p className="rekixo-domain-note">
            Domain yahan save karna app routing set karta hai. Cloudflare me
            DNS/Custom Domain/Custom Hostname attachment ek separate
            infrastructure step hai.
          </p>
        </div>
      )}
    </section>
  );
}
