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

-- Additive and idempotent for existing installs; never backfill or store full IPs.
CREATE TABLE IF NOT EXISTS visitor_display (
  visitor_id TEXT PRIMARY KEY,
  masked_ip TEXT,
  updated_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visitor_display_ts ON visitor_display(updated_ts);

-- Revenue history is durable, site-scoped and independent of the legacy live cache.
CREATE TABLE IF NOT EXISTS story_visitors (
 site_id TEXT NOT NULL, visitor_id TEXT NOT NULL, first_ts INTEGER NOT NULL,
 last_ts INTEGER NOT NULL, source TEXT NOT NULL, medium TEXT, campaign TEXT,
 landing_page TEXT NOT NULL, PRIMARY KEY(site_id, visitor_id)
);
CREATE TABLE IF NOT EXISTS story_sessions (
 site_id TEXT NOT NULL, session_id TEXT NOT NULL, visitor_id TEXT NOT NULL,
 first_ts INTEGER NOT NULL, last_ts INTEGER NOT NULL, source TEXT NOT NULL,
 landing_page TEXT NOT NULL, PRIMARY KEY(site_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_story_sessions_visitor ON story_sessions(site_id,visitor_id,first_ts);
CREATE TABLE IF NOT EXISTS story_events (
 site_id TEXT NOT NULL, event_id TEXT NOT NULL, visitor_id TEXT NOT NULL,
 session_id TEXT NOT NULL, type TEXT NOT NULL, ts INTEGER NOT NULL,
 path TEXT NOT NULL, properties TEXT NOT NULL DEFAULT '{}', city TEXT, country TEXT,
 lat REAL, lng REAL, device TEXT, masked_ip TEXT,
 PRIMARY KEY(site_id,event_id)
);
CREATE INDEX IF NOT EXISTS idx_story_events_time ON story_events(site_id,ts);
CREATE INDEX IF NOT EXISTS idx_story_events_visitor ON story_events(site_id,visitor_id,ts);
CREATE TABLE IF NOT EXISTS story_payments (
 site_id TEXT NOT NULL, provider TEXT NOT NULL, payment_id TEXT NOT NULL,
 webhook_id TEXT NOT NULL, visitor_id TEXT, session_id TEXT, ts INTEGER NOT NULL,
 amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, attribution TEXT NOT NULL,
 candidate_visitor_id TEXT, candidate_session_id TEXT, related_payment_id TEXT,
 PRIMARY KEY(site_id,provider,payment_id)
);
CREATE INDEX IF NOT EXISTS idx_story_payments_time ON story_payments(site_id,ts);
CREATE TRIGGER IF NOT EXISTS story_event_session_guard BEFORE INSERT ON story_events
WHEN NOT EXISTS (SELECT 1 FROM story_sessions WHERE site_id=NEW.site_id AND session_id=NEW.session_id AND visitor_id=NEW.visitor_id)
BEGIN SELECT RAISE(ABORT, 'Session belongs to another visitor'); END;

-- Search Console is aggregate-only; deliberately no visitor/session columns.
CREATE TABLE IF NOT EXISTS search_console_daily (
 site_id TEXT NOT NULL, date TEXT NOT NULL, page TEXT NOT NULL, query TEXT NOT NULL,
 clicks INTEGER NOT NULL, impressions INTEGER NOT NULL, ctr REAL NOT NULL, position REAL NOT NULL,
 PRIMARY KEY(site_id,date,page,query)
);
CREATE TABLE IF NOT EXISTS payment_aliases (
 site_id TEXT NOT NULL, provider TEXT NOT NULL, external_id TEXT NOT NULL, payment_id TEXT NOT NULL,
 PRIMARY KEY(site_id,provider,external_id)
);
