CREATE TABLE analysis_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Searchable fields from appDetails
  app_title TEXT NOT NULL,
  description TEXT,
  developer TEXT,
  version TEXT,
  app_url TEXT NOT NULL,
  hash_url TEXT NOT NULL UNIQUE,
  app_score NUMERIC,
  reviews INTEGER,
  icon TEXT,
  platform TEXT NOT NULL,
  
  -- Review summary fields
  total_reviews INTEGER,
  average_rating NUMERIC,
  score_distribution JSONB,
  
  -- Timestamps
  timestamp BIGINT NOT NULL,
  
  -- Full report stored as JSONB
  full_report JSONB NOT NULL,
  
  -- Database management
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance and querying
CREATE INDEX idx_analysis_reports_platform ON analysis_reports(platform);
CREATE INDEX idx_analysis_reports_developer ON analysis_reports(developer);
CREATE INDEX idx_analysis_reports_total_reviews ON analysis_reports(total_reviews);
CREATE INDEX idx_analysis_reports_average_rating ON analysis_reports(average_rating);
CREATE INDEX idx_analysis_reports_timestamp ON analysis_reports(timestamp);
CREATE INDEX idx_analysis_reports_hash_url ON analysis_reports(hash_url);