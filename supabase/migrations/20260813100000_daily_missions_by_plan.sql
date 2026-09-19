-- Daily mission rotation and shared access for every active paid plan.
-- The server derives the mission set from current_date and the subscription;
-- the browser only renders the snapshot and can never choose its reward.

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
    when p_feature = 'missions' then exists (
      select 1
        from public.subscriptions s
       where s.user_id = p_user_id
         and lower(s.status) in (
           'active', 'trialing', 'past_due', 'paid', 'approved',
           'authorized', 'complete', 'completed', 'succeeded'
         )
         and (s.current_period_end is null or s.current_period_end >= now())
         and s.plan in (
           'ope_club_leitor_monthly', 'ope_club_leitor_annual',
           'ope_club_pensador_monthly', 'ope_club_pensador_annual',
           'ope_club_monthly', 'ope_club_annual',
           'monthly', 'annual', 'leitor', 'pensador'
         )
    )
    when p_feature in (
      'verified_badge', 'ranking', 'seasons', 'credit_multiplier',
      'vip_support', 'early_drops'
    ) then exists (
      select 1
        from public.subscriptions s
       where s.user_id = p_user_id
         and lower(s.status) in (
           'active', 'trialing', 'past_due', 'paid', 'approved',
           'authorized', 'complete', 'completed', 'succeeded'
         )
         and (s.current_period_end is null or s.current_period_end >= now())
         and s.plan in (
           'ope_club_pensador_monthly', 'ope_club_pensador_annual', 'pensador'
         )
    )
    else false
  end;
$function$;

revoke all on function private.has_plan_entitlement(uuid, text)
  from public, anon, authenticated;
grant execute on function private.has_plan_entitlement(uuid, text) to service_role;

create or replace function private.mission_plan_tier(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when exists (
      select 1 from public.profiles p
       where p.id = p_user_id and p.role = 'admin'
    ) then 'pensador'
    when exists (
      select 1
        from public.subscriptions s
       where s.user_id = p_user_id
         and lower(s.status) in (
           'active', 'trialing', 'past_due', 'paid', 'approved',
           'authorized', 'complete', 'completed', 'succeeded'
         )
         and (s.current_period_end is null or s.current_period_end >= now())
         and s.plan in (
           'ope_club_pensador_monthly', 'ope_club_pensador_annual', 'pensador'
         )
    ) then 'pensador'
    when private.has_plan_entitlement(p_user_id, 'missions') then 'leitor'
    else null
  end;
$function$;

revoke all on function private.mission_plan_tier(uuid)
  from public, anon, authenticated;
grant execute on function private.mission_plan_tier(uuid) to service_role;

-- The same objective keys are already produced by the authoritative activity
-- RPCs. Only the selection and copy rotate; counters and credits stay server-side.
create or replace function private.daily_mission_definition(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tier text := coalesce(private.mission_plan_tier(p_user_id), 'leitor');
  v_variant integer := mod((current_date - date '2024-01-01')::integer, 3);
  v_key text;
  v_title text;
  v_reward integer;
  v_objectives jsonb;
begin
  if v_tier = 'pensador' then
    v_reward := 25;
    if v_variant = 0 then
      v_key := 'pensador-focus';
      v_title := 'Foco e conversa';
      v_objectives := jsonb_build_array(
        jsonb_build_object('key', 'login', 'counter', 'login', 'target', 1, 'title', 'Check-in do dia', 'description', 'Entre no OPE Club e mantenha sua sequencia.'),
        jsonb_build_object('key', 'reading30', 'counter', 'reading_30min', 'target', 1, 'title', 'Leitura profunda', 'description', 'Leia por pelo menos 30 minutos na Biblioteca.'),
        jsonb_build_object('key', 'post', 'counter', 'post', 'target', 1, 'title', 'Publique uma ideia', 'description', 'Compartilhe uma reflexao com a comunidade.'),
        jsonb_build_object('key', 'comment', 'counter', 'comment', 'target', 1, 'title', 'Entre na conversa', 'description', 'Deixe um comentario que acrescente ao debate.')
      );
    elsif v_variant = 1 then
      v_key := 'pensador-rhythm';
      v_title := 'Ritmo de pensador';
      v_objectives := jsonb_build_array(
        jsonb_build_object('key', 'login', 'counter', 'login', 'target', 1, 'title', 'Presenca diaria', 'description', 'Comece o dia dentro da comunidade.'),
        jsonb_build_object('key', 'reading15', 'counter', 'reading_15min', 'target', 1, 'title', 'Leia com atencao', 'description', 'Leia por pelo menos 15 minutos.'),
        jsonb_build_object('key', 'post', 'counter', 'post', 'target', 1, 'title', 'Abra uma ideia', 'description', 'Publique uma reflexao ou pergunta.'),
        jsonb_build_object('key', 'comment', 'counter', 'comment', 'target', 1, 'title', 'Responda alguem', 'description', 'Participe de uma conversa da comunidade.')
      );
    else
      v_key := 'pensador-dialogue';
      v_title := 'Leitura em dialogo';
      v_objectives := jsonb_build_array(
        jsonb_build_object('key', 'login', 'counter', 'login', 'target', 1, 'title', 'Check-in do dia', 'description', 'Entre no OPE Club e mantenha sua sequencia.'),
        jsonb_build_object('key', 'reading30', 'counter', 'reading_30min', 'target', 1, 'title', 'Mergulho na leitura', 'description', 'Leia por pelo menos 30 minutos.'),
        jsonb_build_object('key', 'post', 'counter', 'post', 'target', 1, 'title', 'Compartilhe uma descoberta', 'description', 'Publique algo que encontrou na leitura.'),
        jsonb_build_object('key', 'comment', 'counter', 'comment', 'target', 1, 'title', 'Continue o dialogo', 'description', 'Comente uma publicacao da comunidade.')
      );
    end if;
  elsif v_variant = 0 then
    v_key := 'leitor-rhythm';
    v_title := 'Ritmo de leitura';
    v_reward := 15;
    v_objectives := jsonb_build_array(
      jsonb_build_object('key', 'login', 'counter', 'login', 'target', 1, 'title', 'Check-in do dia', 'description', 'Entre no OPE Club e mantenha sua sequencia.'),
      jsonb_build_object('key', 'reading30', 'counter', 'reading_30min', 'target', 1, 'title', 'Leia 30 minutos', 'description', 'Leia qualquer obra na Biblioteca.'),
      jsonb_build_object('key', 'comment', 'counter', 'comment', 'target', 1, 'title', 'Participe da conversa', 'description', 'Deixe um comentario em uma publicacao.')
    );
  elsif v_variant = 1 then
    v_key := 'leitor-ideia';
    v_title := 'Uma ideia compartilhada';
    v_reward := 15;
    v_objectives := jsonb_build_array(
      jsonb_build_object('key', 'login', 'counter', 'login', 'target', 1, 'title', 'Presenca diaria', 'description', 'Comece o dia dentro da comunidade.'),
      jsonb_build_object('key', 'reading30', 'counter', 'reading_30min', 'target', 1, 'title', 'Leia 30 minutos', 'description', 'Escolha uma obra e avance na leitura.'),
      jsonb_build_object('key', 'post', 'counter', 'post', 'target', 1, 'title', 'Publique uma reflexao', 'description', 'Compartilhe uma ideia com a comunidade.')
    );
  else
    v_key := 'leitor-dialogo';
    v_title := 'Leitura em dialogo';
    v_reward := 15;
    v_objectives := jsonb_build_array(
      jsonb_build_object('key', 'login', 'counter', 'login', 'target', 1, 'title', 'Check-in do dia', 'description', 'Entre no OPE Club e mantenha sua sequencia.'),
      jsonb_build_object('key', 'post', 'counter', 'post', 'target', 1, 'title', 'Abra uma conversa', 'description', 'Publique uma reflexao ou pergunta.'),
      jsonb_build_object('key', 'comment', 'counter', 'comment', 'target', 1, 'title', 'Responda alguem', 'description', 'Participe de uma conversa da comunidade.')
    );
  end if;

  return jsonb_build_object(
    'date', current_date,
    'tier', v_tier,
    'setId', v_key,
    'title', v_title,
    'reward', v_reward,
    'objectives', v_objectives
  );
end;
$function$;

revoke all on function private.daily_mission_definition(uuid)
  from public, anon, authenticated;
grant execute on function private.daily_mission_definition(uuid) to service_role;

create or replace function private.complete_daily_mission()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
  v_definition jsonb;
  v_objective jsonb;
  v_reward integer;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if not private.has_plan_entitlement(v_uid, 'missions') then
    raise exception 'PLANO_ATIVO_NECESSARIO';
  end if;

  perform private.lock_wallet_user(v_uid);
  v_definition := private.daily_mission_definition(v_uid);
  v_reward := greatest(0, coalesce((v_definition->>'reward')::integer, 15));

  if private.get_counter(v_uid, 'daily_mission', v_day) >= 1 then
    return private.wallet_state_core(v_uid);
  end if;

  for v_objective in
    select value from jsonb_array_elements(v_definition->'objectives')
  loop
    if private.get_counter(
      v_uid,
      v_objective->>'counter',
      v_day
    ) < greatest(1, coalesce((v_objective->>'target')::integer, 1)) then
      return private.wallet_state_core(v_uid);
    end if;
  end loop;

  perform private.award_both(v_uid, 0, v_reward, 'daily_mission', v_definition->>'setId', true);
  perform private.bump_counter(v_uid, 'daily_mission', v_day);
  return private.wallet_state_core(v_uid);
end;
$function$;

revoke all on function private.complete_daily_mission()
  from public, anon, authenticated;
grant execute on function private.complete_daily_mission() to authenticated, service_role;

create or replace function public.complete_daily_mission()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$ select private.complete_daily_mission(); $function$;

revoke all on function public.complete_daily_mission() from public, anon;
grant execute on function public.complete_daily_mission() to authenticated, service_role;

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
  v_daily jsonb := private.daily_mission_definition(p_uid);
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
        'definition', v_daily,
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

revoke all on function private.wallet_state_core(uuid)
  from public, anon;
grant execute on function private.wallet_state_core(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
