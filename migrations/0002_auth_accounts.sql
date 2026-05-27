CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
ON sessions (expires_at);

ALTER TABLE daily_entries RENAME TO daily_entries_legacy;

CREATE TABLE daily_entries (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  week_day TEXT NOT NULL,
  entry_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, date)
);

INSERT INTO daily_entries (user_id, date, week_day, entry_json, created_at, updated_at)
SELECT '__legacy__', date, week_day, entry_json, created_at, updated_at
FROM daily_entries_legacy;

DROP TABLE daily_entries_legacy;

CREATE INDEX IF NOT EXISTS idx_daily_entries_user_updated_at
ON daily_entries (user_id, updated_at);
