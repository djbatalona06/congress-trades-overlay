-- Bills that passed a chamber, reached the President or became law.
-- policy_area: NULL = not looked up yet, '' = looked up and none assigned.
CREATE TABLE bills (
  id          TEXT PRIMARY KEY,           -- "119-hr-1234"
  congress    INTEGER NOT NULL,
  type        TEXT NOT NULL,              -- HR, S, HJRES, ...
  number      TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL,              -- passed_chamber | to_president | became_law | vetoed
  action_date TEXT NOT NULL,              -- YYYY-MM-DD of the latest action
  action_text TEXT NOT NULL,
  public_law  TEXT,                       -- "119-5"
  url         TEXT NOT NULL,
  policy_area TEXT
);
CREATE INDEX bills_area_date ON bills (policy_area, action_date DESC);
CREATE INDEX bills_missing_area ON bills (action_date DESC) WHERE policy_area IS NULL;

CREATE TABLE executive_orders (
  document_number  TEXT PRIMARY KEY,      -- Federal Register document number
  eo_number        INTEGER,
  title            TEXT NOT NULL,
  abstract         TEXT NOT NULL DEFAULT '',
  signing_date     TEXT,
  publication_date TEXT NOT NULL,
  url              TEXT NOT NULL
);
CREATE INDEX orders_date ON executive_orders (publication_date DESC);

-- Trade rows exactly as the upstream source returned them, per ticker.
CREATE TABLE trade_cache (
  ticker     TEXT PRIMARY KEY,
  fetched_at INTEGER NOT NULL,            -- ms since epoch
  rows_json  TEXT NOT NULL
);

CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
