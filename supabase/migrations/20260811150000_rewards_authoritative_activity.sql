-- Server-authoritative rewards hardening.
-- Apply after the existing rewards, linter and store migrations.

begin;

-- Serializes all balance-changing operations for one account. The browser can
-- request an operation more than once, but it cannot race the wallet ledger.
create or replace function private.lock_wallet_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  perform 1
    from public.profiles
   where id = p_user_id
   for update;

  if not found then
    raise exception 'PERFIL_NAO_ENCONTRADO';
  end if;
end;
$function$;

revoke all on function private.lock_wallet_user(uuid) from public, anon, authenticated;
grant execute on function private.lock_wallet_user(uuid) to service_role;

-- A report is accepted at most once per book every ten seconds and is capped
-- per day. This limits replay/spam while keeping the reader's 30-second batches.
create table if not exists private.reading_reward_sessions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  day_key date not null,
  last_report_at timestamptz,
  reported_seconds integer not null default 0 check (reported_seconds between 0 and 7200),
  primary key (user_id, book_id, day_key)
);

revoke all on table private.reading_reward_sessions from public, anon, authenticated;
grant select, insert, update, delete on table private.reading_reward_sessions to service_role;

create table if not exists private.reading_reward_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_key date not null,
  last_report_at timestamptz,
  primary key (user_id, day_key)
);

revoke all on table private.reading_reward_daily from public, anon, authenticated;
grant select, insert, update, delete on table private.reading_reward_daily to service_role;

-- Credits are the only spendable currency. Keep the legacy XP argument for API
-- compatibility, but never award XP from this function anymore.
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

create or replace function private.reward_login()
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
  perform private.lock_wallet_user(v_uid);

  if private.get_counter(v_uid, 'login', v_day) = 0 then
    insert into private.login_streak(user_id, current, best, last_day)
    values (v_uid, 1, 1, v_day)
    on conflict (user_id) do update set
      current = case
        when private.login_streak.last_day = v_day - 1 then private.login_streak.current + 1
        else 1
      end,
      best = greatest(
        private.login_streak.best,
        case when private.login_streak.last_day = v_day - 1
          then private.login_streak.current + 1 else 1 end
      ),
      last_day = v_day;

    perform private.award_both(v_uid, 0, 1, 'login', null, false);
    perform private.bump_counter(v_uid, 'login', v_day);
  end if;

  return private.wallet_state_core(v_uid);
end;
$function$;

create or replace function private.report_reading_session(
  p_book_id uuid,
  p_seconds integer,
  p_interacted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
  v_sec integer;
  v_elapsed integer;
  v_session private.reading_reward_sessions%rowtype;
  v_daily private.reading_reward_daily%rowtype;
  v_total integer;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  perform private.lock_wallet_user(v_uid);

  if not exists (select 1 from public.books where id = p_book_id)
     or not private.is_book_released(p_book_id) then
    raise exception 'LIVRO_NAO_LIBERADO';
  end if;

  insert into private.reading_reward_daily(user_id, day_key)
  values (v_uid, v_day)
  on conflict (user_id, day_key) do nothing;

  select * into v_daily
    from private.reading_reward_daily
   where user_id = v_uid and day_key = v_day
   for update;

  if v_daily.last_report_at is not null
     and v_daily.last_report_at > now() - interval '10 seconds' then
    return private.wallet_state_core(v_uid);
  end if;

  -- Do not accept a fabricated 60-second report when only two seconds passed.
  -- The first report establishes the session; later reports use elapsed time.
  if v_daily.last_report_at is null then
    v_sec := 0;
  else
    v_elapsed := greatest(0, floor(extract(epoch from (now() - v_daily.last_report_at)))::integer);
    v_sec := least(greatest(0, coalesce(p_seconds, 0)), 60, v_elapsed);
  end if;

  update private.reading_reward_daily
     set last_report_at = now()
   where user_id = v_uid and day_key = v_day;

  insert into private.reading_reward_sessions(user_id, book_id, day_key)
  values (v_uid, p_book_id, v_day)
  on conflict (user_id, book_id, day_key) do nothing;

  select * into v_session
    from private.reading_reward_sessions
   where user_id = v_uid and book_id = p_book_id and day_key = v_day
   for update;

  if not coalesce(p_interacted, false) or v_sec = 0 then
    return private.wallet_state_core(v_uid);
  end if;

  update private.reading_reward_sessions
     set last_report_at = now(),
         reported_seconds = least(7200, reported_seconds + v_sec)
   where user_id = v_uid and book_id = p_book_id and day_key = v_day;

  v_total := private.bump_counter(v_uid, 'reading_sec', v_day, v_sec);

  if v_total >= 900 and private.get_counter(v_uid, 'reading_15min', v_day) = 0 then
    perform private.award_both(v_uid, 0, 5, 'reading', '15min', false);
    perform private.bump_counter(v_uid, 'reading_15min', v_day);
  end if;

  if v_total >= 1800 and private.get_counter(v_uid, 'reading_30min', v_day) = 0 then
    perform private.award_both(v_uid, 0, 5, 'reading', '30min', false);
    perform private.bump_counter(v_uid, 'reading_30min', v_day);
  end if;

  return private.wallet_state_core(v_uid);
end;
$function$;

-- Reward only real posts created by this account today. Calling this RPC before
-- publishing cannot mint anything because the count-derived delta is zero.
create or replace function private.reward_post(p_user_id uuid, p_source_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
  v_total integer;
  v_rewarded integer;
  v_delta integer;
begin
  if v_uid is null or p_user_id is distinct from v_uid then
    raise exception 'PERMISSAO_NEGADA';
  end if;
  perform private.lock_wallet_user(v_uid);

  select least(2, count(*)::integer) into v_total
    from public.posts
   where user_id = v_uid
     and created_at >= v_day::timestamptz
     and created_at < (v_day + 1)::timestamptz
     and coalesce(tag, '') not like 'entity-thread:%'
     and coalesce(text, '') not like '[thread]%';
  v_rewarded := private.get_counter(v_uid, 'post', v_day);
  v_delta := greatest(0, v_total - v_rewarded);

  if v_delta > 0 then
    perform private.award_both(v_uid, 0, v_delta * 3, 'post', p_source_ref, false);
    perform private.bump_counter(v_uid, 'post', v_day, v_delta);
  end if;

  return private.wallet_state_core(v_uid);
end;
$function$;

-- Count distinct comments stored in the database. A client cannot submit a
-- fake text and cannot repeat one comment to claim five rewards.
create or replace function private.reward_comment(p_user_id uuid, p_text text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
  v_total integer;
  v_rewarded integer;
  v_delta integer;
begin
  if v_uid is null or p_user_id is distinct from v_uid then
    raise exception 'PERMISSAO_NEGADA';
  end if;
  perform private.lock_wallet_user(v_uid);

  select least(5, count(*)::integer) into v_total
    from (
      select lower(btrim(text)) as body
        from public.post_replies
       where user_id = v_uid
         and created_at >= v_day::timestamptz
         and created_at < (v_day + 1)::timestamptz
      union
      select lower(btrim(text)) as body
        from public.book_page_comments
       where user_id = v_uid
         and created_at >= v_day::timestamptz
         and created_at < (v_day + 1)::timestamptz
    ) comments;
  v_rewarded := private.get_counter(v_uid, 'comment', v_day);
  v_delta := greatest(0, v_total - v_rewarded);

  if v_delta > 0 then
    perform private.award_both(v_uid, 0, v_delta * 2, 'comment', null, false);
    perform private.bump_counter(v_uid, 'comment', v_day, v_delta);
  end if;

  return private.wallet_state_core(v_uid);
end;
$function$;

-- The UI objective is one comment, so the server snapshot uses the same rule.
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

-- Replace the public snapshot implementation so the UI and claim RPC agree.
create or replace function private.wallet_state_core(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_streak record;
  v_today record;
  v_week_start date := date_trunc('week', current_date)::date;
begin
  select * into v_profile from public.profiles where id = p_uid;
  if v_profile.id is null then return null; end if;
  select * into v_streak from private.login_streak where user_id = p_uid;
  select * into v_today from private.day_activity_totals(p_uid, current_date);

  return jsonb_build_object(
    'xp', v_profile.xp,
    'credits', v_profile.credits,
    'streak', jsonb_build_object(
      'current', coalesce(v_streak.current, 0),
      'best', coalesce(v_streak.best, 0),
      'lastDay', v_streak.last_day
    ),
    'today', jsonb_build_object(
      'xp', coalesce(v_today.xp, 0),
      'credits', coalesce(v_today.credits, 0),
      'login', private.get_counter(p_uid, 'login', current_date),
      'readingSec', private.get_counter(p_uid, 'reading_sec', current_date),
      'reading15', private.get_counter(p_uid, 'reading_15min', current_date),
      'reading30', private.get_counter(p_uid, 'reading_30min', current_date),
      'post', private.get_counter(p_uid, 'post', current_date),
      'comment', private.get_counter(p_uid, 'comment', current_date),
      'likeReceived', private.get_counter(p_uid, 'like_received', current_date)
    ),
    'caps', jsonb_build_object('xp', 0, 'credits', 20),
    'missions', jsonb_build_object(
      'daily', jsonb_build_object(
        'done', private.get_counter(p_uid, 'daily_mission', current_date) >= 1,
        'objectives', jsonb_build_object(
          'login', private.get_counter(p_uid, 'login', current_date) >= 1,
          'reading30', private.get_counter(p_uid, 'reading_30min', current_date) >= 1,
          'post', private.get_counter(p_uid, 'post', current_date) >= 1,
          'comments', private.get_counter(p_uid, 'comment', current_date) >= 1
        )
      ),
      'weekly', jsonb_build_object(
        'done', private.get_counter(p_uid, 'weekly_mission', v_week_start) >= 1,
        'streakNeeded', 7
      )
    )
  );
end;
$function$;

-- A like is a database event, so the owner reward is emitted here instead of
-- trusting a browser call that can name an arbitrary owner.
create or replace function private.credit_likes_received(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_day date := current_date;
  v_total integer;
  v_rewarded integer;
  v_delta integer;
  v_activity record;
  v_award integer;
begin
  if p_owner_id is null then return; end if;
  perform private.lock_wallet_user(p_owner_id);
  v_total := least(private.likes_received_today(p_owner_id), 20)::integer;
  v_rewarded := private.get_counter(p_owner_id, 'like_received', v_day);
  v_delta := greatest(0, v_total - v_rewarded);
  if v_delta <= 0 then return; end if;

  select * into v_activity from private.day_activity_totals(p_owner_id, v_day);
  v_award := least(v_delta, greatest(0, 20 - coalesce(v_activity.credits, 0)::integer));
  if v_award <= 0 then return; end if;

  perform private.award_both(p_owner_id, 0, v_award, 'like_received', null, false);
  perform private.bump_counter(p_owner_id, 'like_received', v_day, v_award);
end;
$function$;

create or replace function private.reward_like_received_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    perform private.credit_likes_received(v_owner);
  end if;
  return new;
end;
$function$;

-- Legacy RPC compatibility: it can only refresh the caller's own reward state.
-- The normal path is the database trigger above, which has the actual liker row.
create or replace function private.reward_likes_received(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or p_owner_id is distinct from auth.uid() then
    raise exception 'PERMISSAO_NEGADA';
  end if;
  perform private.credit_likes_received(p_owner_id);
  return private.wallet_state_core(p_owner_id);
end;
$function$;

drop trigger if exists trg_reward_like_received on public.post_likes;
create trigger trg_reward_like_received
after insert on public.post_likes
for each row execute function private.reward_like_received_after_insert();

revoke all on function private.credit_likes_received(uuid) from public, anon, authenticated;
revoke all on function private.reward_like_received_after_insert() from public, anon, authenticated;
grant execute on function private.credit_likes_received(uuid) to service_role;
grant execute on function private.reward_like_received_after_insert() to service_role;

-- All replaced private functions remain callable only through the existing
-- authenticated public wrappers or trusted database triggers.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname in (
         'reward_login', 'report_reading_session', 'reward_post',
         'reward_comment', 'complete_daily_mission',
         'complete_weekly_mission', 'wallet_state_core'
       )
  loop
    execute format('alter function %s set search_path = %L', function_row.signature, '');
    execute format('revoke all on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$migration$;

commit;
