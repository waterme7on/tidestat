CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  path TEXT NOT NULL,
  city TEXT,
  country TEXT,
  lat REAL,
  lng REAL,
  referrer TEXT,
  device TEXT,
  site TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(visitor_id, ts);
