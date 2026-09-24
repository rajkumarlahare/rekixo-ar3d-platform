-- Rekixo auth hardening: bound login cleanup cost and give Super Admin
-- sessions a server-side revocation version without invalidating existing v1 cookies.

CREATE INDEX IF NOT EXISTS idx_login_attempts_window_start
ON login_attempts(window_start);

CREATE TABLE IF NOT EXISTS super_admin_security (
  id TEXT PRIMARY KEY,
  session_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO super_admin_security (id, session_version, updated_at)
VALUES ('owner', 1, CURRENT_TIMESTAMP);
