begin;

-- Upload tickets are intentionally one-time credentials. The Edge Function
-- consumes the nonce through this restricted RPC before touching Storage.
create table if not exists private.upload_ticket_nonces (
  nonce_hash text primary key,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now(),
  constraint upload_ticket_nonces_hash_check
    check (nonce_hash ~ '^[0-9a-f]{64}$'),
  constraint upload_ticket_nonces_expiry_check
    check (expires_at > consumed_at - interval '10 minutes')
);

alter table private.upload_ticket_nonces enable row level security;
drop policy if exists upload_ticket_nonces_deny_direct_access on private.upload_ticket_nonces;
create policy upload_ticket_nonces_deny_direct_access
  on private.upload_ticket_nonces
  for all to public
  using (false)
  with check (false);

revoke all on table private.upload_ticket_nonces from public, anon, authenticated;
grant select, insert, delete on table private.upload_ticket_nonces to service_role;

create or replace function public.consume_upload_ticket_nonce(
  p_nonce_hash text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     or p_nonce_hash is null
     or p_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at is null
     or p_expires_at <= now() then
    return false;
  end if;

  delete from private.upload_ticket_nonces
   where expires_at < now();

  insert into private.upload_ticket_nonces(nonce_hash, expires_at)
  values (p_nonce_hash, p_expires_at)
  on conflict (nonce_hash) do nothing;

  return found;
end;
$function$;

revoke all on function public.consume_upload_ticket_nonce(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_upload_ticket_nonce(text, timestamptz)
  to service_role;

-- One RPC updates the user and IP counters together. This halves the
-- database round trips made by every authenticated rate-limited request.
create or replace function public.check_api_rate_limit_batch(p_checks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_row record;
  v_result jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  if p_checks is null or jsonb_typeof(p_checks) <> 'array'
     or jsonb_array_length(p_checks) < 1
     or jsonb_array_length(p_checks) > 2 then
    raise exception 'RATE_LIMIT_ARGUMENTS_INVALIDOS';
  end if;

  for v_item in select value from jsonb_array_elements(p_checks) loop
    v_count := v_count + 1;
    select allowed, remaining, reset_at
      into v_row
      from public.check_api_rate_limit(
        v_item->>'key_hash',
        v_item->>'scope',
        (v_item->>'limit')::integer,
        (v_item->>'window_seconds')::integer
      );
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'allowed', v_row.allowed,
      'remaining', v_row.remaining,
      'reset_at', v_row.reset_at
    ));
  end loop;

  return v_result;
end;
$function$;

revoke all on function public.check_api_rate_limit_batch(jsonb)
  from public, anon, authenticated;
grant execute on function public.check_api_rate_limit_batch(jsonb)
  to service_role;

-- A poll vote is changed in one transaction. The composite primary key still
-- prevents duplicates, while this function prevents a delete/insert race.
create or replace function public.set_poll_vote(
  p_poll_id uuid,
  p_option_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.post_poll_options
     where id = p_option_id and poll_id = p_poll_id
  ) then
    raise exception 'INVALID_POLL_OPTION' using errcode = '22023';
  end if;

  delete from public.post_poll_votes
   where poll_id = p_poll_id and user_id = v_user_id;

  insert into public.post_poll_votes(poll_id, option_id, user_id)
  values (p_poll_id, p_option_id, v_user_id);

  return jsonb_build_object('option_id', p_option_id);
end;
$function$;

revoke all on function public.set_poll_vote(uuid, uuid) from public, anon;
grant execute on function public.set_poll_vote(uuid, uuid) to authenticated, service_role;

-- These columns are the only ones needed by the application to render the
-- public interaction lists. The indexes keep the new bounded queries cheap.
create index if not exists reactions_target_lookup
  on public.reactions(target_type, target_id, emoji, user_id);

commit;
