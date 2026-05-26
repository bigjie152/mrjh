PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS daily_entries (
  date TEXT PRIMARY KEY,
  weekday TEXT NOT NULL,
  biggest_deviation TEXT NOT NULL DEFAULT '',
  improvement TEXT NOT NULL DEFAULT '',
  general_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 6),
  text TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_date) REFERENCES daily_entries(date) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_entry_position
  ON tasks(entry_date, position);

CREATE TABLE IF NOT EXISTS time_blocks (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('planned', 'actual')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  task_position INTEGER,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_date) REFERENCES daily_entries(date) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_time_blocks_entry_kind
  ON time_blocks(entry_date, kind, order_index);

CREATE INDEX IF NOT EXISTS idx_daily_entries_updated_at
  ON daily_entries(updated_at);
