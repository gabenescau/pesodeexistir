-- ============================================
-- Cakto Integration — Subscriptions, Checkout Sessions, Webhook Events
-- ============================================

-- 1. RECREATE SUBSCRIPTIONS TABLE
DROP TABLE IF EXISTS public.subscriptions CASCADE;

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  provider TEXT NOT NULL DEFAULT 'cakto',

  provider_product_id TEXT,
  provider_offer_id TEXT,
  provider_order_id TEXT,
  provider_subscription_id TEXT,
  provider_customer_id TEXT,

  customer_email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'ope_club_monthly',

  status TEXT NOT NULL DEFAULT 'pending',

  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_active_subscription UNIQUE (user_id)
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_provider_subscription_id ON subscriptions(provider_subscription_id);
CREATE INDEX idx_subscriptions_customer_email ON subscriptions(customer_email);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_select_admin" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "subscriptions_insert_service" ON public.subscriptions
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "subscriptions_update_service" ON public.subscriptions
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "subscriptions_delete_admin" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- 2. CHECKOUT SESSIONS
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  user_email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'cakto',

  provider_product_id TEXT,
  provider_offer_id TEXT,
  provider_order_id TEXT,

  status TEXT NOT NULL DEFAULT 'pending',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkout_sessions_user_id ON checkout_sessions(user_id);
CREATE INDEX idx_checkout_sessions_status ON checkout_sessions(status);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkout_sessions_select_own" ON public.checkout_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "checkout_sessions_insert_own" ON public.checkout_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "checkout_sessions_update_service" ON public.checkout_sessions
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider TEXT NOT NULL DEFAULT 'cakto',
  external_event_id TEXT,
  event_type TEXT,

  payload JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,

  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,

  UNIQUE(provider, external_event_id)
);

CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_insert_service" ON public.webhook_events
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "webhook_events_select_service" ON public.webhook_events
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY "webhook_events_select_admin" ON public.webhook_events
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- 4. STATUS MAPPING FUNCTION
CREATE OR REPLACE FUNCTION map_cakto_status_to_internal(cakto_status TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE cakto_status
    WHEN 'active' THEN 'active'
    WHEN 'paid' THEN 'active'
    WHEN 'inactive' THEN 'past_due'
    WHEN 'canceled' THEN 'canceled'
    WHEN 'expired' THEN 'expired'
    WHEN 'paused' THEN 'past_due'
    WHEN 'trial' THEN 'active'
    WHEN 'refunded' THEN 'refunded'
    WHEN 'chargedback' THEN 'chargeback'
    WHEN 'waiting_payment' THEN 'pending'
    WHEN 'processing' THEN 'pending'
    WHEN 'refused' THEN 'past_due'
    ELSE 'pending'
  END;
END;
$$;
