"use client";

import { Building2, Eye, EyeOff, LockKeyhole, Mail, Phone } from "lucide-react";
import { type FormEvent, useState } from "react";
import { LOGIN_CRITICAL_CSS } from "./login-critical";

type LoginFormProps = {
  mode: "super" | "client";
  loginType?: "email" | "mobile" | "mixed";
  projectId?: string;
  projectSlug?: string;
  projectName?: string;
  successPath?: string;
  changePasswordPath?: string;
  backPath?: string;
  initialError?: string;
};

function BuilderAdminMark() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Builder crane">
      <path className="builder-mark-gold" d="M17 8h29M21 8v44M13 52h22M21 16h21M42 16v22M42 38h7M49 38v6" />
      <path className="builder-mark-gold" d="M21 13l-5 6h10l-5-6Zm0 9-5 6h10l-5-6Zm0 9-5 6h10l-5-6Zm0 9-5 6h10l-5-6Z" />
      <path className="builder-mark-red" d="M29 29h10l4 7H27l2-7Zm4-6h5v6h-5v-6Zm16 21c0 3-2 5-5 5" />
    </svg>
  );
}

export default function LoginForm({
  mode,
  loginType = "mixed",
  projectId = "",
  projectSlug = "",
  projectName = "",
  successPath = "/admin",
  changePasswordPath = "/admin/change-password",
  backPath = "",
  initialError = "",
}: LoginFormProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const isSuper = mode === "super";
  const effectiveLoginType = isSuper ? "email" : loginType;
  const loginLabel =
    effectiveLoginType === "mobile"
      ? "MOBILE NUMBER"
      : effectiveLoginType === "email"
        ? "EMAIL ADDRESS"
        : "EMAIL OR MOBILE NUMBER";
  const loginPlaceholder =
    effectiveLoginType === "mobile"
      ? "9876543210"
      : effectiveLoginType === "email"
        ? isSuper
          ? "owner@rekixo.com"
          : "client@example.com"
        : "Email or mobile number";
  const tenantLabel = projectName.trim() || projectSlug.trim() || "Your project";
  const resolvedBackPath =
    backPath || (projectSlug ? `/projects/${encodeURIComponent(projectSlug)}` : "/");
  const resolvedLoginPath = projectSlug
    ? `/projects/${encodeURIComponent(projectSlug)}/admin-login`
    : "/admin/login";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId, password, projectId, projectSlug }),
      });
      const result = await response.json().catch(() => ({ error: "Login failed" }));
      if (response.ok) {
        location.replace(result.mustChangePassword ? changePasswordPath : successPath);
        return;
      }
      setError(result.error || "Login failed");
    } catch {
      setError("Network error. Dobara try karein.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Critical UI must survive a broken/delayed external stylesheet request. */}
      <style data-rekixo-login-critical>{LOGIN_CRITICAL_CSS}</style>
      <main className="login-page" data-rekixo-login>
        <section className="login-card" aria-labelledby="login-title">
          <div className={`login-icon${isSuper ? "" : " login-icon--builder"}`} aria-hidden="true">{isSuper ? <Building2 /> : <BuilderAdminMark />}</div>
          <h1 id="login-title">{isSuper ? "Rekixo Super Admin" : "Builder Admin"}</h1>
          <p className="login-context">
            {isSuper ? "Central client & project management" : <>Project: <b>{tenantLabel}</b></>}
          </p>

          <form action="/api/admin/login" method="post" onSubmit={submit} aria-busy={busy}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="projectSlug" value={projectSlug} />
            <input type="hidden" name="successPath" value={successPath} />
            <input type="hidden" name="changePasswordPath" value={changePasswordPath} />
            <input type="hidden" name="returnPath" value={resolvedLoginPath} />
            <label htmlFor="login-id">
              <span>{loginLabel}</span>
              <div className="login-input">
                {effectiveLoginType === "mobile" ? <Phone aria-hidden="true" /> : <Mail aria-hidden="true" />}
                <input
                  id="login-id"
                  name="loginId"
                  type={effectiveLoginType === "email" ? "email" : effectiveLoginType === "mobile" ? "tel" : "text"}
                  inputMode={effectiveLoginType === "mobile" ? "tel" : effectiveLoginType === "email" ? "email" : "text"}
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  placeholder={loginPlaceholder}
                />
              </div>
            </label>

            <label htmlFor="login-password">
              <span>PASSWORD</span>
              <div className="login-input">
                <LockKeyhole aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>

            {error ? <div className="login-error" role="alert" aria-live="polite">{error}</div> : null}
            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "Signing in…" : isSuper ? "Sign In as Super Admin" : "Sign In to Dashboard"}
            </button>
          </form>

          {!isSuper ? <a className="back-link" href={resolvedBackPath}>← Back to Project</a> : null}
        </section>
      </main>
    </>
  );
}
