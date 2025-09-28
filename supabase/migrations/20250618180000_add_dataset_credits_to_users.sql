-- Migration: Add dataset_credits column to users table for Stripe quota logic

alter table users
  add column if not exists dataset_credits integer not null default 0;

-- (Optional) Add triggers to update updated_at on row change
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language 'plpgsql';

drop trigger if exists set_updated_at on users;
create trigger set_updated_at
before update on users
for each row
execute procedure update_updated_at_column();
