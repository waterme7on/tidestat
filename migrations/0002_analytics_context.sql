-- Run on existing TideStat installs before deploying the analytics Worker.
-- Idempotent and additive. Historical unknown context is intentionally not fabricated.
CREATE TABLE IF NOT EXISTS visitor_context (
 site_id TEXT NOT NULL, visitor_id TEXT NOT NULL, first_ts INTEGER NOT NULL, context TEXT NOT NULL,
 PRIMARY KEY(site_id,visitor_id)
);
CREATE TABLE IF NOT EXISTS event_context (
 site_id TEXT NOT NULL, event_id TEXT NOT NULL, context TEXT NOT NULL,
 PRIMARY KEY(site_id,event_id)
);
CREATE INDEX IF NOT EXISTS idx_story_payments_visitor ON story_payments(site_id,visitor_id,ts);
