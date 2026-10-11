ALTER TABLE users ADD COLUMN data_revision TEXT NOT NULL DEFAULT 'initial';

CREATE TABLE mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  can_write_plan INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX idx_mcp_tokens_user ON mcp_tokens(user_id);
