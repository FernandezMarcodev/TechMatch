-- Up Migration
-- User accounts (docs/17-CUENTAS-DE-USUARIO.md). Accounts are optional: CVs stay anonymous.

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the SHA-256 of each session token is stored: a database leak does not leak sessions.
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON sessions (user_id);

-- Down Migration
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
