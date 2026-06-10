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
