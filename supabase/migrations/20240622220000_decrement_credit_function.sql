-- Migration: Create a transactional function to decrement user credit atomically
-- This function will check if the user has at least 1 credit, decrement by 1 if so, and return true. If not, return false.

create or replace function decrement_user_credit(p_user_email text)
returns boolean
language plpgsql
as $$
declare
  current_credits integer;
begin
  select dataset_credits into current_credits from users where email = p_user_email for update;
  if current_credits is null or current_credits < 1 then
    return false;
  end if;
  update users set dataset_credits = dataset_credits - 1 where email = p_user_email;
  return true;
end;
$$;
