-- Repair the server-only prerequisites used by /api/stripe-checkout.
-- Safe to run after a partial migration rollout: it does not delete billing data.

begin;

create table if not exists public.api_rate_limits (
  key_hash text not null,
  scope text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  constraint api_rate_limits_pkey primary key (key_hash, scope, window_start),
  constraint api_rate_limits_request_count_check check (request_count > 0)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant all on table public.api_rate_limits to service_role;

create or replace function public.check_api_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at bigint)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_window_start timestamptz;
  v_count integer;
  v_reset_at bigint;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_scope is null or p_scope !~ '^[a-z0-9:_-]{1,64}$'
     or p_limit is null or p_limit < 1 or p_limit > 10000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'RATE_LIMIT_ARGUMENTS_INVALIDOS';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := extract(
    epoch from (v_window_start + make_interval(secs => p_window_seconds))
  )::bigint;

  insert into public.api_rate_limits(key_hash, scope, window_start, request_count)
  values (p_key_hash, p_scope, v_window_start, 1)
  on conflict (key_hash, scope, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  return query
  select v_count <= p_limit,
         greatest(0, p_limit - v_count),
         v_reset_at;
end;
$function$;

revoke all on function public.check_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_api_rate_limit(text, text, integer, integer)
  to service_role;

create table if not exists public.billing_checkout_attempts (
  attempt_id text primary key check (char_length(attempt_id) between 16 and 100),
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

update public.billing_checkout_attempts
set status = 'expired', updated_at = now()
where status = 'open' and expires_at <= now();

with ranked as (
  select attempt_id,
         row_number() over (
           partition by user_id order by created_at desc, attempt_id desc
         ) as row_number
  from public.billing_checkout_attempts
  where status = 'open'
), duplicates as (
  select attempt_id from ranked where row_number > 1
)
update public.billing_checkout_attempts attempt
set status = 'expired', updated_at = now()
where attempt.attempt_id in (select attempt_id from duplicates);

drop index if exists public.billing_open_checkout_pair_uidx;
drop index if exists public.billing_open_checkout_user_uidx;
create unique index if not exists billing_open_checkout_user_uidx
  on public.billing_checkout_attempts(user_id)
  where status = 'open';
create index if not exists billing_checkout_attempts_expiry_idx
  on public.billing_checkout_attempts(status, expires_at);
create index if not exists billing_checkout_attempts_user_status_idx
  on public.billing_checkout_attempts(user_id, status, created_at desc);

commit;
