-- Migration: Create a transactional function to decrement user dataset_credits atomically
CREATE OR REPLACE FUNCTION decrement_user_credit(p_user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  SELECT dataset_credits INTO current_credits FROM users WHERE email = p_user_email FOR UPDATE;
  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN FALSE;
  END IF;
  UPDATE users SET dataset_credits = dataset_credits - 1 WHERE email = p_user_email;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
