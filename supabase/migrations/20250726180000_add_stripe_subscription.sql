-- Migration to add Stripe subscription functionality

-- Step 1: Add stripe_customer_id to the users table
-- This column will store the unique Stripe Customer ID for each user,
-- linking your app's user records to Stripe's customer records.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add a unique constraint to prevent multiple users from having the same Stripe customer ID.
ALTER TABLE public.users
ADD CONSTRAINT users_stripe_customer_id_key UNIQUE (stripe_customer_id);


-- Step 2: Create a table to store user subscription details
-- This table tracks the active and past subscriptions for each user.
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_price_id TEXT NOT NULL,
    stripe_subscription_status TEXT NOT NULL, -- e.g., 'active', 'canceled', 'past_due'
    stripe_current_period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add a unique constraint for upsert compatibility
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT user_subscriptions_user_id_subscription_id_key UNIQUE (user_id, stripe_subscription_id);

-- Add comments to the columns for clarity
COMMENT ON COLUMN public.user_subscriptions.user_id IS 'The ID of the user in your system.';
COMMENT ON COLUMN public.user_subscriptions.stripe_customer_id IS 'The Stripe Customer ID, for easy lookups.';
COMMENT ON COLUMN public.user_subscriptions.stripe_subscription_id IS 'The unique ID for the subscription in Stripe.';
COMMENT ON COLUMN public.user_subscriptions.stripe_price_id IS 'The ID of the Stripe Price object for the plan.';
COMMENT ON COLUMN public.user_subscriptions.stripe_subscription_status IS 'The current status of the subscription (e.g., active, trialing, past_due, canceled).';
COMMENT ON COLUMN public.user_subscriptions.stripe_current_period_end IS 'The timestamp when the current subscription period ends.';


-- Step 3: Add indexes for faster lookups
-- These indexes will speed up queries on user_id and stripe_subscription_id.
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON public.user_subscriptions (stripe_subscription_id);
