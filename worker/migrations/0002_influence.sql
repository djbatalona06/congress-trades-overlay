-- Influence layer. Both tables stay empty until their ingest jobs exist, and the
-- API then simply sends empty lists. Every row keeps its source link.

-- Outside money reported to the FEC. All groups share these columns, so none is treated differently.
CREATE TABLE ie_spend (
  id                TEXT PRIMARY KEY,     -- the FEC's own transaction id
  committee_id      TEXT NOT NULL,
  committee_name    TEXT NOT NULL,
  member_slug       TEXT NOT NULL,        -- same slug Bargo uses, so it joins to trade rows
  candidate_name    TEXT NOT NULL,
  support_or_oppose TEXT NOT NULL,        -- support | oppose
  amount            INTEGER NOT NULL,     -- whole dollars
  spend_date        TEXT NOT NULL,        -- YYYY-MM-DD
  url               TEXT NOT NULL,        -- the FEC filing
  retrieved_at      INTEGER NOT NULL      -- ms since epoch
);
CREATE INDEX ie_member_date ON ie_spend (member_slug, spend_date DESC);

-- Tax provisions in bills. A rule proposes ('rule'); nothing is sent to users until a person
-- has reviewed it (reviewer is set).
CREATE TABLE bill_tax_flags (
  bill_id      TEXT NOT NULL REFERENCES bills (id),
  section_cite TEXT NOT NULL,             -- e.g. "26 U.S.C. 45X"
  flagged_by   TEXT NOT NULL,             -- rule | human
  reviewer     TEXT,                      -- NULL = still in the review queue
  reviewed_at  TEXT,
  PRIMARY KEY (bill_id, section_cite)
);
