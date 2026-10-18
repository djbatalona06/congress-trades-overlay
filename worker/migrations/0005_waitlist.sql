-- Waitlists on the website: mobile version, Desk plan, beta testers.
-- Each person gets a share code; referred_by records whose code brought them.
-- The email is used only to say the list has opened. One email unsubscribes.

CREATE TABLE waitlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,             -- lower-cased and trimmed
  list        TEXT NOT NULL,             -- mobile | desk | beta
  ref_code    TEXT NOT NULL UNIQUE,      -- 8 characters, this person's own share code
  referred_by TEXT,                      -- ref_code of whoever sent them, if it was real
  created_at  INTEGER NOT NULL,          -- ms since epoch
  UNIQUE (email, list)
);
CREATE INDEX waitlist_referred_by ON waitlist (referred_by);
