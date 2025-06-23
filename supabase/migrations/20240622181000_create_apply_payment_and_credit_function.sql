-- Migration: Create a transactional function to apply payment and credit atomically

create or replace function apply_payment_and_credit(
  p_user_email text,
  p_stripe_session_id text,
  p_amount integer,
  p_datasets integer
) returns boolean as $$
begin
  -- Atomically insert the payment record using the unique stripe_session_id
  -- as a gatekeeper. If the session ID already exists, the ON CONFLICT
  -- clause ensures we do nothing and the function will exit gracefully.
  -- This is the core of making the function idempotent and safe from race conditions.
  insert into payments (user_email, stripe_session_id, amount, datasets)
    values (p_user_email, p_stripe_session_id, p_amount, p_datasets)
    on conflict (stripe_session_id) do nothing;

  -- 'found' is a special PL/pgSQL variable. It's true if the preceding
  -- command (the INSERT) affected at least one row. If the ON CONFLICT
  -- path was taken, no row was inserted, and 'found' will be false.
  if not found then
    -- This means the payment was a duplicate. Log or return false.
    return false;
  end if;

  -- If we reach this point, the payment was new and successfully inserted.
  -- Now we can safely grant the credits to the user.
  -- The entire function runs in a transaction, so if this update fails,
  -- the initial payment insert will be rolled back automatically.
  insert into users (email, dataset_credits)
    values (p_user_email, p_datasets)
    on conflict (email) do update
      set dataset_credits = users.dataset_credits + excluded.dataset_credits;

  return true; -- Success!
end;
$$ language plpgsql;
