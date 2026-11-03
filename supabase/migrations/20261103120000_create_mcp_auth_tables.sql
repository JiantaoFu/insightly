-- Insightly MCP server: OAuth 2.1 state, persistent API keys and daily quota.
-- Used only by mcp-server/ (service-role key). RLS is enabled with no policies,
-- so anon/authenticated keys (used by the web app) cannot read these tables.

CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_info jsonb NOT NULL,               -- RFC 7591 registration response
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcp_oauth_pending (  -- in-flight /authorize -> Google round trips
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (    -- authorization codes (sha256), single use
  code_hash text PRIMARY KEY,
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_refresh_tokens ( -- refresh tokens (sha256), rotated on use
  token_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scopes text[] NOT NULL DEFAULT '{}',
  resource text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcp_refresh_tokens_user ON mcp_refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'default',
  key_hash text NOT NULL UNIQUE,            -- sha256(full key); the key itself is shown once
  prefix text NOT NULL,                     -- first chars, for display
  daily_limit integer NOT NULL DEFAULT 25 CHECK (daily_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_user ON mcp_api_keys(user_id);

CREATE TABLE IF NOT EXISTS mcp_usage (
  subject text NOT NULL,                    -- 'user:<uuid>' | 'key:<uuid>' | 'anon:<ip>'
  day date NOT NULL,                        -- UTC day
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, day)
);

-- Atomically consume one call. Returns allowed=false (count unchanged) when at the limit.
CREATE OR REPLACE FUNCTION mcp_consume_quota(p_subject text, p_day date, p_limit integer)
RETURNS TABLE(allowed boolean, used integer)
LANGUAGE plpgsql
AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO mcp_usage AS u (subject, day, count)
  VALUES (p_subject, p_day, 1)
  ON CONFLICT (subject, day) DO UPDATE SET count = u.count + 1
  WHERE u.count < p_limit
  RETURNING u.count INTO v_count;

  IF v_count IS NULL OR v_count > p_limit THEN
    -- either conflict-without-update (at limit) or p_limit = 0 on first insert
    IF v_count IS NOT NULL THEN
      UPDATE mcp_usage SET count = count - 1 WHERE subject = p_subject AND day = p_day;
    END IF;
    SELECT m.count INTO v_count FROM mcp_usage m WHERE m.subject = p_subject AND m.day = p_day;
    RETURN QUERY SELECT false, COALESCE(v_count, 0);
  ELSE
    RETURN QUERY SELECT true, v_count;
  END IF;
END;
$$;

ALTER TABLE mcp_oauth_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_pending  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_api_keys       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_usage          ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION mcp_consume_quota(text, date, integer) FROM PUBLIC, anon, authenticated;
