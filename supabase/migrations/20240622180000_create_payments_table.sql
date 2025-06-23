-- Migration: Create payments table to track Stripe sessions and prevent replay attacks

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  stripe_session_id text not null unique,
  amount integer not null,
  datasets integer not null,
  created_at timestamptz default now()
);

-- Index for quick lookup by user_email
create index if not exists idx_payments_user_email on payments(user_email);
