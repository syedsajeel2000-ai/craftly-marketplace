-- One row per (day, category): 15 category generators, one batch per day each.
-- daily_batches is a generated claim log, so rebuilding it is safe — at worst
-- today's already-claimed slots are forgotten and the generator re-runs them.
DROP TABLE IF EXISTS daily_batches;

CREATE TABLE daily_batches (
  day        TEXT    NOT NULL,
  category   TEXT    NOT NULL,
  listings   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (day, category)
);
