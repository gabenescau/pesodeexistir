-- Stripe billing: catalog constraints, webhook idempotency and provider IDs.
-- Safe for existing legacy AbacatePay/Cakto rows; new writes default to Stripe.

begin;

alter table public.subscriptions
  alter column provider set default 'stripe';

alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check check (
    provider in ('stripe', 'manual_admin', 'abacatepay', 'cakto')
  );

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check check (
    plan in (
      'ope_club_leitor_monthly',
      'ope_club_leitor_annual',
      'ope_club_pensador_monthly',
      'ope_club_pensador_annual',
      'ope_club_monthly',
      'ope_club_annual',
      'monthly',
      'annual',
      'leitor',
      'pensador'
    )
  );

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check check (
    status in (
      'pending', 'active', 'past_due', 'trialing', 'paused',
      'canceled', 'refunded', 'expired'
    )
  );

-- Pending checkouts are deliberately excluded: only confirmed access must be
-- unique per user. This also fixes duplicate-key failures caused by stale
-- pending attempts.
alter table public.subscriptions
  drop constraint if exists unique_active_subscription;
drop index if exists public.unique_active_subscription;
create unique index unique_active_subscription
  on public.subscriptions (user_id)
  where status in ('active', 'past_due', 'trialing');

create unique index if not exists subscriptions_stripe_subscription_uidx
  on public.subscriptions (provider_subscription_id)
  where provider = 'stripe' and provider_subscription_id is not null;

create unique index if not exists subscriptions_stripe_checkout_uidx
  on public.subscriptions (provider_order_id)
  where provider = 'stripe' and provider_order_id is not null;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  subscription_id text,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint stripe_webhook_event_id_length check (char_length(event_id) <= 255),
  constraint stripe_webhook_event_type_length check (char_length(event_type) <= 255),
  constraint stripe_webhook_error_length check (last_error is null or char_length(last_error) <= 500)
);

create index if not exists stripe_webhook_events_created_idx
  on public.stripe_webhook_events (created_at desc);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;

comment on table public.stripe_webhook_events is
  'Server-only Stripe webhook idempotency ledger. Never exposed to browser roles.';

commit;
