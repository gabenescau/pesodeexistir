-- Compatibilidade final das fases de seguranca e billing.
-- Pode ser executada em um banco existente sem apagar dados. Depois dela,
-- execute novamente a migration 20260810300000_phase3_billing_concurrency.sql.

begin;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  subscription_id text,
  status text not null default 'processing',
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.stripe_webhook_events
  add column if not exists event_id text,
  add column if not exists event_type text,
  add column if not exists subscription_id text,
  add column if not exists status text default 'processing',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text,
  add column if not exists error_message text,
  add column if not exists processed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Algumas bases antigas tinham somente error_message. Copiamos apenas valores
-- existentes, sem substituir um erro mais recente já gravado em last_error.
update public.stripe_webhook_events
set last_error = left(error_message, 500)
where last_error is null
  and error_message is not null;

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;

create unique index if not exists stripe_webhook_events_event_id_uidx
  on public.stripe_webhook_events(event_id);
create index if not exists stripe_webhook_events_created_idx
  on public.stripe_webhook_events(created_at desc);
create index if not exists stripe_webhook_events_retry_idx
  on public.stripe_webhook_events(status, last_attempt_at);

-- A ledger de tentativas e usada pelo endpoint server-only. Se a tabela foi
-- criada parcialmente em uma base antiga, completamos apenas o contrato.
create table if not exists public.billing_checkout_attempts (
  attempt_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null,
  payment_method text not null,
  stripe_session_id text unique,
  status text not null default 'open',
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_checkout_attempts
  add column if not exists user_id uuid,
  add column if not exists plan_key text,
  add column if not exists payment_method text,
  add column if not exists stripe_session_id text,
  add column if not exists status text default 'open',
  add column if not exists expires_at timestamptz default (now() + interval '30 minutes'),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.billing_checkout_attempts enable row level security;
revoke all on table public.billing_checkout_attempts from public, anon, authenticated;
grant all on table public.billing_checkout_attempts to service_role;

create unique index if not exists billing_open_checkout_user_uidx
  on public.billing_checkout_attempts(user_id)
  where status = 'open';
create unique index if not exists billing_checkout_attempts_stripe_session_uidx
  on public.billing_checkout_attempts(stripe_session_id)
  where stripe_session_id is not null;
create index if not exists billing_checkout_attempts_expiry_idx
  on public.billing_checkout_attempts(status, expires_at);

commit;
