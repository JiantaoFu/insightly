CREATE TABLE IF NOT EXISTS analysis_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Searchable fields from appDetails
  app_title TEXT NOT NULL,
  description TEXT,
  developer TEXT,
  app_url TEXT NOT NULL,
  hash_url TEXT NOT NULL UNIQUE,
  app_score NUMERIC,
  icon TEXT,
  platform TEXT NOT NULL,

  -- Review summary fields
  total_reviews INTEGER,
  average_rating NUMERIC,

  -- Timestamps
  timestamp BIGINT NOT NULL
);

-- Indexes for performance and querying
CREATE INDEX IF NOT EXISTS idx_analysis_reports_platform ON analysis_reports(platform);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_developer ON analysis_reports(developer);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_total_reviews ON analysis_reports(total_reviews);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_average_rating ON analysis_reports(average_rating);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_timestamp ON analysis_reports(timestamp);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_hash_url ON analysis_reports(hash_url);