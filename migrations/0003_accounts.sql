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
