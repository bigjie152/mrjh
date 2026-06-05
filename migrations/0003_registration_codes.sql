CREATE TABLE IF NOT EXISTS registration_codes (
  code_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT,
  consumed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_registration_codes_consumed_at
ON registration_codes (consumed_at);
