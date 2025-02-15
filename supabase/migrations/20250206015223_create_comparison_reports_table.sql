-- supabase/migrations/20250206015223_create_comparison_reports_table.sql
CREATE TABLE comparison_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  urls TEXT[] NOT NULL,
  hash_url TEXT NOT NULL UNIQUE,
  competitors TEXT NOT NULL,
  final_report TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance and querying
CREATE INDEX idx_comparison_reports_hash_url ON comparison_reports(hash_url);
CREATE INDEX idx_comparison_reports_timestamp ON comparison_reports(timestamp);