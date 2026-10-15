-- Lobbying disclosures and the member -> FEC candidate link. Both are filled by cron jobs
-- from official sources; every row keeps its source link.

CREATE TABLE lobby_filing (
  id           TEXT PRIMARY KEY,          -- the Senate's own filing uuid
  registrant   TEXT NOT NULL,
  client       TEXT NOT NULL,
  amount       INTEGER,                   -- whole dollars; NULL when the filing gives none
  period       TEXT NOT NULL,             -- e.g. "2026 Q3"
  posted_date  TEXT NOT NULL,             -- YYYY-MM-DD
  url          TEXT NOT NULL,
  retrieved_at INTEGER NOT NULL           -- ms since epoch
);
CREATE INDEX lobby_posted ON lobby_filing (posted_date DESC);

-- One row per issue code a filing lists, so "filings for these codes" is a plain lookup.
CREATE TABLE lobby_issue (
  filing_id TEXT NOT NULL REFERENCES lobby_filing (id),
  code      TEXT NOT NULL,
  PRIMARY KEY (filing_id, code)
);
CREATE INDEX lobby_issue_code ON lobby_issue (code);

-- member_slug is the slug Bargo uses, so it joins to trade rows. A member can have several
-- FEC candidate ids (one per office they ran for).
CREATE TABLE member_fec (
  member_slug      TEXT NOT NULL,
  fec_candidate_id TEXT NOT NULL,
  chamber          TEXT NOT NULL,         -- house | senate
  state            TEXT NOT NULL,
  synced_at        INTEGER,               -- NULL = outside spending not pulled yet
  PRIMARY KEY (member_slug, fec_candidate_id)
);
CREATE INDEX member_fec_due ON member_fec (synced_at);
