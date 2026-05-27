CREATE TABLE IF NOT EXISTS daily_entries (
  date TEXT PRIMARY KEY,
  week_day TEXT NOT NULL,
  entry_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_entries_updated_at
ON daily_entries (updated_at);
