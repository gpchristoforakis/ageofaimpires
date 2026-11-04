CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  page TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  comment TEXT NOT NULL CHECK(length(comment) BETWEEN 1 AND 3000),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_page ON comments(page, id);
CREATE TABLE IF NOT EXISTS comment_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
