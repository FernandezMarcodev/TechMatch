-- Up Migration
-- Single-use links sent by email: email verification and (later) password reset.
-- As with sessions, only the SHA-256 of each token is stored.

CREATE TABLE email_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_tokens_user ON email_tokens (user_id, purpose);

-- Down Migration
DROP TABLE IF EXISTS email_tokens;
