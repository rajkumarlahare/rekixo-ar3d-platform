-- REKIXO_CLIENT_MOBILE_LOGIN_V1
-- Existing projects remain email-login. Projects created after this release are
-- provisioned with clientLoginMode=mobile by application code.

ALTER TABLE admin_users ADD COLUMN login_type TEXT NOT NULL DEFAULT 'email';
ALTER TABLE admin_users ADD COLUMN login_id TEXT;
ALTER TABLE admin_users ADD COLUMN mobile TEXT;

UPDATE admin_users
SET login_type='email',
    login_id=lower(trim(email))
WHERE login_id IS NULL OR trim(login_id)='';

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_login_id
ON admin_users(login_id);

CREATE INDEX IF NOT EXISTS idx_admin_users_mobile
ON admin_users(mobile);

INSERT OR IGNORE INTO settings(project_id,key,value,updated_at)
SELECT id,'clientLoginMode','email',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM projects;
