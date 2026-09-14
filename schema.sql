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

-- ── Invoices: one row per invoice (replaces the kv "invoices" blob) ──
-- Numbers are issued server-side (YYYY-NNNN per user per year) and are
-- unique per user, deleted rows included, so a number is never reused.
-- Content (data) is immutable after creation; only status and peppol
-- state change. Deletion is soft (bewaarplicht).
CREATE TABLE IF NOT EXISTS invoices (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  number      TEXT NOT NULL,
  year        INTEGER NOT NULL,
  seq         INTEGER,                         -- NULL for custom (free-text) numbers
  date        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',    -- open | betaald
  total       REAL,
  data        TEXT NOT NULL,                   -- full invoice JSON as saved by the app
  peppol      TEXT,                            -- JSON: { invoiceId, state, stateLabel, ... }
  peppol_ref  TEXT,                            -- B2Brouter invoice id, for webhooks
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_user_number ON invoices(user_id, number);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON invoices(user_id, deleted_at, date);
CREATE INDEX IF NOT EXISTS idx_invoices_peppol_ref ON invoices(peppol_ref);
