-- BouwFactuur D1 schema
--
-- Per-user key/value storage matching the client storage abstraction.
-- Keys: profile | clients | invoices | nextnum (JSON values)
--
-- Apply remotely:  npx wrangler d1 execute bouwfactuur --remote --file=./schema.sql
-- Apply locally:   npx wrangler d1 execute bouwfactuur --local  --file=./schema.sql

CREATE TABLE IF NOT EXISTS kv (
  user_id    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, key)
);

-- Subscription & usage tracking (one row per user)
CREATE TABLE IF NOT EXISTS accounts (
  user_id             TEXT PRIMARY KEY,
  email               TEXT,
  invoices_created    INTEGER NOT NULL DEFAULT 0,  -- lifetime counter
  stripe_customer_id  TEXT,
  subscription_status TEXT,                        -- active|trialing|past_due|canceled|...
  current_period_end  TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer ON accounts(stripe_customer_id);
