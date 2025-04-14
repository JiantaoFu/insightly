-- supabase/migrations/20250206015223_create_comparison_reports_table.sql
CREATE TABLE IF NOT EXISTS comparison_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  urls TEXT[] NOT NULL,
  hash_url TEXT NOT NULL UNIQUE,
  competitors TEXT NOT NULL,
  final_report TEXT NOT NULL,
  timestamp BIGINT NOT NULL
);

-- Indexes for performance and querying
CREATE INDEX IF NOT EXISTS idx_comparison_reports_hash_url ON comparison_reports(hash_url);
CREATE INDEX IF NOT EXISTS idx_comparison_reports_timestamp ON comparison_reports(timestamp);