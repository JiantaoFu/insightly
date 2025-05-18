-- Migration: Create users table for Google OAuth
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id text UNIQUE,
  email text UNIQUE,
  display_name text,
  photo_url text,
  provider text,
  last_login timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for quick lookup by Google ID
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Index for quick lookup by email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
