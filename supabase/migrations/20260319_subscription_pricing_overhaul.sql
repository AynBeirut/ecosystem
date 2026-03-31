-- Subscription pricing overhaul
-- Adds tier enum, plan limits, trial lifecycle fields, and add-on tracking tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'subscription_tier'
  ) THEN
    CREATE TYPE subscription_tier AS ENUM ('trial', 'starter', 'pro', 'business');
  END IF;
END$$;

ALTER TABLE IF EXISTS public.store_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier_new subscription_tier,
  ADD COLUMN IF NOT EXISTS product_limit integer,
  ADD COLUMN IF NOT EXISTS storage_limit_mb integer,
  ADD COLUMN IF NOT EXISTS monthly_operations_limit integer,
  ADD COLUMN IF NOT EXISTS monthly_operations_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_share_percentage numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_grace_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_grace_days integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS allows_composed_products boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allows_manufacturing boolean DEFAULT false;

UPDATE public.store_profiles
SET subscription_tier_new = CASE
  WHEN subscription_tier::text = 'premium' THEN 'starter'::subscription_tier
  WHEN subscription_tier::text IN ('trial', 'starter', 'pro', 'business') THEN subscription_tier::text::subscription_tier
  ELSE NULL
END
WHERE subscription_tier IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.subscription_addons (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  addon_key text NOT NULL CHECK (addon_key IN ('domain_package', 'whatsapp_business', 'manufacturing_bom', 'extra_storage')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  quantity integer NOT NULL DEFAULT 1,
  price_cents integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_addons_store_id
  ON public.subscription_addons(store_id);

CREATE INDEX IF NOT EXISTS idx_subscription_addons_active
  ON public.subscription_addons(active);

CREATE TABLE IF NOT EXISTS public.subscription_operation_usage (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  month_key text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('invoice', 'purchase', 'recipe', 'sale')),
  operation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, month_key, operation_type)
);

CREATE INDEX IF NOT EXISTS idx_subscription_operation_usage_store_month
  ON public.subscription_operation_usage(store_id, month_key);

COMMENT ON COLUMN public.store_profiles.product_limit IS 'Trial=10, Starter=8, Pro=20, Business=50';
COMMENT ON COLUMN public.store_profiles.storage_limit_mb IS 'Trial=500, Starter=5120, Pro=10240, Business=20480';
COMMENT ON COLUMN public.store_profiles.monthly_operations_limit IS 'Trial=30, others NULL for unlimited';
COMMENT ON COLUMN public.store_profiles.revenue_share_percentage IS 'Trial=20, others=0';
