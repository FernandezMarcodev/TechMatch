-- Up Migration
-- CVs saved in an account (docs/17-CUENTAS-DE-USUARIO.md § Privilegios). Saving is the
-- user's choice: unsaved CVs have no user and expire after CV_RETENTION_DAYS. Deleting the
-- account deletes its CVs (and, through the existing cascades, their profiles and results).

ALTER TABLE cvs
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN saved_at TIMESTAMPTZ;

CREATE INDEX idx_cvs_user ON cvs (user_id, saved_at DESC);

-- Down Migration
DROP INDEX IF EXISTS idx_cvs_user;
ALTER TABLE cvs DROP COLUMN IF EXISTS saved_at, DROP COLUMN IF EXISTS user_id;
