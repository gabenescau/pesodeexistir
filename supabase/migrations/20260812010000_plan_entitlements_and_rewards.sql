-- Plano entitlements: keep the pricing catalog aligned with server-enforced
-- access. Pensador-only features must never depend on frontend state.

begin;

create or replace function private.has_plan_entitlement(
  p_user_id uuid,
  p_feature text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when p_user_id is null or p_feature is null then false
    when exists (
      select 1
        from public.profiles p
       where p.id = p_user_id
         and p.role = 'admin'
    ) then true
    when p_feature not in (
      'verified_badge', 'ranking', 'missions', 'seasons',
      'credit_multiplier', 'vip_support'
    ) then false
    else exists (
      select 1
        from public.subscriptions s
       where s.user_id = p_user_id
         and s.status in (
           'active', 'trialing', 'past_due', 'paid', 'approved',
           'authorized', 'complete', 'completed', 'succeeded'
         )
         and (s.current_period_end is null or s.current_period_end > now())
         and s.plan in (
           'ope_club_pensador_monthly',
           'ope_club_pensador_annual',
           'pensador'
         )
    )
  end;
$function$;

revoke all on function private.has_plan_entitlement(uuid, text)
  from public, anon, authenticated;
grant execute on function private.has_plan_entitlement(uuid, text)
  to service_role;

-- The verified badge uses the same entitlement rule as the rest of the app.
create or replace function private.profile_is_verified(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.has_plan_entitlement(profile_id, 'verified_badge');
$function$;

revoke all on function private.profile_is_verified(uuid)
  from public, anon, authenticated;
grant execute on function private.profile_is_verified(uuid)
  to authenticated, service_role;

-- Pensador receives 2x on activity and mission rewards. The daily activity
-- cap still applies to normal activity rewards, so the multiplier cannot mint
-- unlimited credits. Referral rewards remain a separate business rule.
create or replace function private.award_both(
  p_user_id uuid,
  p_xp integer,
  p_credits integer,
  p_reason text,
  p_source_ref text default null,
  p_skip_cap boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_day date := current_date;
  v_credits integer := greatest(0, coalesce(p_credits, 0));
  v_tot record;
begin
  perform private.lock_wallet_user(p_user_id);

  if p_reason = any (array[
    'login', 'reading', 'post', 'comment', 'like_received',
    'daily_mission', 'weekly_mission'
  ]::text[])
  and private.has_plan_entitlement(p_user_id, 'credit_multiplier') then
    v_credits := v_credits * 2;
  end if;

  if not p_skip_cap then
    select * into v_tot
      from private.day_activity_totals(p_user_id, v_day);
    v_credits := least(v_credits, greatest(0, 20 - coalesce(v_tot.credits, 0)::integer));
  end if;

  if v_credits <= 0 then
    return false;
  end if;

  insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
  values (p_user_id, 'credit', v_credits, p_reason, p_source_ref, v_day);

  update public.profiles
     set credits = credits + v_credits
   where id = p_user_id;

  return true;
end;
$function$;

revoke all on function private.award_both(uuid, integer, integer, text, text, boolean)
  from public, anon, authenticated;
grant execute on function private.award_both(uuid, integer, integer, text, text, boolean)
  to service_role;

-- Missions are Pensador-only at the database boundary as well as in the UI.
create or replace function private.complete_daily_mission()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if not private.has_plan_entitlement(v_uid, 'missions') then
    raise exception 'PLANO_PENSADOR_NECESSARIO';
  end if;
  perform private.lock_wallet_user(v_uid);

  if private.get_counter(v_uid, 'login', v_day) < 1
     or private.get_counter(v_uid, 'reading_30min', v_day) < 1
     or private.get_counter(v_uid, 'post', v_day) < 1
     or private.get_counter(v_uid, 'comment', v_day) < 1
     or private.get_counter(v_uid, 'daily_mission', v_day) >= 1 then
    return private.wallet_state_core(v_uid);
  end if;

  perform private.award_both(v_uid, 0, 15, 'daily_mission', null, true);
  perform private.bump_counter(v_uid, 'daily_mission', v_day);
  return private.wallet_state_core(v_uid);
end;
$function$;

create or replace function private.complete_weekly_mission()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_week_start date := date_trunc('week', current_date)::date;
  v_streak integer;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if not private.has_plan_entitlement(v_uid, 'missions') then
    raise exception 'PLANO_PENSADOR_NECESSARIO';
  end if;
  perform private.lock_wallet_user(v_uid);
  select current into v_streak from private.login_streak where user_id = v_uid;

  if coalesce(v_streak, 0) < 7
     or private.get_counter(v_uid, 'weekly_mission', v_week_start) >= 1 then
    return private.wallet_state_core(v_uid);
  end if;

  perform private.award_both(v_uid, 0, 40, 'weekly_mission', null, true);
  perform private.bump_counter(v_uid, 'weekly_mission', v_week_start);
  return private.wallet_state_core(v_uid);
end;
$function$;

-- Credit ranking is an authenticated Pensador feature. Keep the public RPC
-- contract unchanged and enforce the entitlement in its private implementation.
create or replace function private.credits_ranking(p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_list jsonb;
  v_me jsonb;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if not private.has_plan_entitlement(v_uid, 'ranking') then
    raise exception 'PLANO_PENSADOR_NECESSARIO';
  end if;

  with ranked as (
    select p.id, p.name, p.username, p.avatar, p.avatar_url, p.credits,
           row_number() over (order by p.credits desc, p.created_at asc, p.id) as rank
      from public.profiles p
     where coalesce(p.private_profile, false) = false or p.id = v_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', id,
    'name', coalesce(nullif(name, ''), 'Membro OPE'),
    'handle', coalesce(username, ''),
    'avatar', coalesce(avatar_url, avatar, ''),
    'credits', credits,
    'rank', rank,
    'is_me', id = v_uid
  ) order by rank), '[]'::jsonb)
    into v_list
    from ranked
   where rank <= v_limit;

  with ranked as (
    select p.id, p.name, p.username, p.avatar, p.avatar_url, p.credits,
           row_number() over (order by p.credits desc, p.created_at asc, p.id) as rank
      from public.profiles p
     where coalesce(p.private_profile, false) = false or p.id = v_uid
  )
  select case when id is null then null else jsonb_build_object(
    'user_id', id,
    'name', coalesce(nullif(name, ''), 'Membro OPE'),
    'handle', coalesce(username, ''),
    'avatar', coalesce(avatar_url, avatar, ''),
    'credits', credits,
    'rank', rank,
    'is_me', true
  ) end into v_me
    from ranked where id = v_uid;

  return jsonb_build_object('list', v_list, 'me', v_me);
end;
$function$;

grant usage on schema private to authenticated, service_role;
grant execute on function private.complete_daily_mission() to authenticated, service_role;
grant execute on function private.complete_weekly_mission() to authenticated, service_role;
grant execute on function private.credits_ranking(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
