-- Migration: Create a transactional function to decrement user dataset_credits atomically by user ID.
-- This is more reliable and performant than using email.

CREATE OR REPLACE FUNCTION public.decrement_user_credit_by_id(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_credits INT;
BEGIN
  -- Select current credits in a lock to prevent race conditions
  SELECT dataset_credits INTO current_credits FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users SET dataset_credits = dataset_credits - 1 WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;