create table if not exists market_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null default 'Default market',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists market_watchlist_apps (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references market_watchlists(id) on delete cascade,
  role text not null check (role in ('my-app', 'competitor')),
  app_url text not null,
  app_title text,
  platform text check (platform in ('ios', 'android')),
  developer text,
  icon text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (watchlist_id, app_url)
);

create table if not exists market_review_snapshots (
  id uuid primary key default gen_random_uuid(),
  watchlist_app_id uuid not null references market_watchlist_apps(id) on delete cascade,
  source_review_id text,
  review_hash text not null,
  rating numeric,
  review_text text not null,
  reviewed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  unique (watchlist_app_id, review_hash)
);

create table if not exists market_topic_trends (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references market_watchlists(id) on delete cascade,
  topic text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  current_mentions integer not null default 0,
  previous_mentions integer not null default 0,
  sentiment text check (sentiment in ('positive', 'mixed', 'negative')),
  example_review text,
  created_at timestamptz not null default now()
);

create table if not exists weekly_intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references market_watchlists(id) on delete cascade,
  title text not null,
  summary text not null,
  report_markdown text not null,
  generated_at timestamptz not null default now(),
  delivery_status text not null default 'preview' check (delivery_status in ('preview', 'queued', 'sent', 'failed'))
);
