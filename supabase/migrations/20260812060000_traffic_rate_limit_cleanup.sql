-- Keep the existing server-side limiter bounded without exposing its state to
-- browser roles. The API already calls this function through service_role.

begin;

create table if not exists public.api_rate_limits (
  key_hash text not null,
  scope text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (key_hash, scope, window_start)
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
  v_retention_seconds integer;
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
  v_retention_seconds := greatest(p_window_seconds * 2, 3600);

  -- The primary key already supports this key/scope lookup. Removing stale
  -- windows here prevents one row per request window from accumulating forever.
  delete from public.api_rate_limits
   where key_hash = p_key_hash
     and scope = p_scope
     and window_start < v_window_start - make_interval(secs => v_retention_seconds);

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

analyze public.api_rate_limits;

commit;
