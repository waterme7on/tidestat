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

-- Additive analytics context migration. Existing history remains unknown where not captured.
CREATE TABLE IF NOT EXISTS visitor_context (
 site_id TEXT NOT NULL, visitor_id TEXT NOT NULL, first_ts INTEGER NOT NULL, context TEXT NOT NULL,
 PRIMARY KEY(site_id,visitor_id)
);
CREATE TABLE IF NOT EXISTS event_context (
 site_id TEXT NOT NULL, event_id TEXT NOT NULL, context TEXT NOT NULL,
 PRIMARY KEY(site_id,event_id)
);
CREATE INDEX IF NOT EXISTS idx_story_payments_visitor ON story_payments(site_id,visitor_id,ts);

-- User identity and TideStat's own billing. Isolated from merchant revenue connectors.
CREATE TABLE IF NOT EXISTS account_users (id TEXT PRIMARY KEY,google_sub TEXT UNIQUE NOT NULL,email TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_oauth_states (state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,verifier TEXT NOT NULL,nonce TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS account_sessions_expiry ON account_sessions(expires_at);
CREATE TABLE IF NOT EXISTS account_sites (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,origin TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS account_sites_owner ON account_sites(user_id);
CREATE TABLE IF NOT EXISTS account_billing (user_id TEXT PRIMARY KEY,customer_id TEXT UNIQUE,subscription_id TEXT,plan TEXT NOT NULL DEFAULT 'free',status TEXT NOT NULL DEFAULT 'free',interval TEXT,subscription_created INTEGER NOT NULL DEFAULT 0,last_event_created INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS account_billing_events (id TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_usage (user_id TEXT NOT NULL,month TEXT NOT NULL,events INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,month));
CREATE TABLE IF NOT EXISTS account_event_reservations (site_id TEXT NOT NULL,event_id TEXT NOT NULL,month TEXT NOT NULL,nonce TEXT NOT NULL,PRIMARY KEY(site_id,event_id));
-- Admin-seeded claims only; there is intentionally no public claim-creation endpoint.
CREATE TABLE IF NOT EXISTS account_site_claims (id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,name TEXT NOT NULL,origin TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_checkouts (user_id TEXT PRIMARY KEY,nonce TEXT NOT NULL,plan TEXT NOT NULL,interval TEXT NOT NULL,session_id TEXT,url TEXT,expires_at INTEGER NOT NULL);
