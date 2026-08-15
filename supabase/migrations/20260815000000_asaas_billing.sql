-- Asaas hosted checkout: one-time Pix + credit card payments.
-- Payment confirmation stays server-side and webhook processing is idempotent.

begin;

alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check;

alter table public.subscriptions
  add constraint subscriptions_provider_check check (
    provider in ('asaas', 'stripe', 'manual_admin', 'abacatepay', 'cakto')
  );

alter table public.billing_checkout_attempts
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_checkout_id text,
  add column if not exists external_reference text,
  add column if not exists customer_email text,
  add column if not exists customer_name text;

alter table public.billing_checkout_attempts
  drop constraint if exists billing_checkout_attempts_provider_check;

alter table public.billing_checkout_attempts
  add constraint billing_checkout_attempts_provider_check
  check (provider in ('asaas', 'stripe', 'manual_admin'));

create index if not exists billing_checkout_attempts_external_reference_idx
  on public.billing_checkout_attempts(external_reference)
  where external_reference is not null;

alter table public.billing_checkout_attempts
  drop constraint if exists billing_checkout_attempts_payment_method_check;

alter table public.billing_checkout_attempts
  add constraint billing_checkout_attempts_payment_method_check
  check (payment_method in ('CARD', 'PIX', 'ASAAS_CHECKOUT'));

alter table public.billing_checkout_attempts
  drop constraint if exists billing_checkout_attempts_status_check;

alter table public.billing_checkout_attempts
  add constraint billing_checkout_attempts_status_check
  check (status in ('open', 'completed', 'expired', 'canceled'));

create unique index if not exists billing_asaas_checkout_uidx
  on public.billing_checkout_attempts(provider_checkout_id)
  where provider = 'asaas' and provider_checkout_id is not null;

create index if not exists billing_checkout_attempts_provider_lookup
  on public.billing_checkout_attempts(provider, provider_checkout_id, status);

create unique index if not exists subscriptions_asaas_checkout_uidx
  on public.subscriptions(provider_order_id)
  where provider = 'asaas' and provider_order_id is not null;

create table if not exists public.asaas_webhook_events (
  event_id text primary key,
  event_type text not null,
  checkout_id text,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempt_count integer not null default 1
    check (attempt_count > 0 and attempt_count <= 100),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint asaas_webhook_event_id_length check (char_length(event_id) between 1 and 255),
  constraint asaas_webhook_event_type_length check (char_length(event_type) between 1 and 255),
  constraint asaas_webhook_error_length check (last_error is null or char_length(last_error) <= 500)
);

create index if not exists asaas_webhook_events_retry_idx
  on public.asaas_webhook_events(status, updated_at);

alter table public.asaas_webhook_events enable row level security;
revoke all on table public.asaas_webhook_events from public, anon, authenticated;
grant all on table public.asaas_webhook_events to service_role;

comment on table public.asaas_webhook_events is
  'Server-only Asaas webhook idempotency ledger. Never exposed to browser roles.';

commit;
