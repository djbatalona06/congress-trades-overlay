-- Website accounts. Sign-in happens with Google or GitHub, so there is no password column.
-- We keep the least we can: who they are, what to call them, and which service they used.

CREATE TABLE users (
  id               TEXT PRIMARY KEY,      -- random uuid made by the Worker
  provider         TEXT NOT NULL,         -- google | github
  provider_user_id TEXT NOT NULL,         -- the service's own id for the person (never the email)
  email            TEXT NOT NULL,         -- verified by the service
  name             TEXT NOT NULL,
  created_at       INTEGER NOT NULL,      -- ms since epoch
  last_login_at    INTEGER NOT NULL,
  UNIQUE (provider, provider_user_id)
);

-- Only the SHA-256 of the cookie value is stored, so a copy of this table cannot be used to sign in.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL             -- ms since epoch
);
CREATE INDEX sessions_expiry ON sessions (expires_at);
