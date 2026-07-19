CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, page_url TEXT NOT NULL, preferred_quality TEXT,
  state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, progress INTEGER NOT NULL DEFAULT 0,
  output_path TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, stage TEXT NOT NULL,
  message TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traces_job_id ON traces(job_id);
