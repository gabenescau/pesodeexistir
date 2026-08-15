-- ============================================================================
-- 20260809070000_monthly_ranking_rpc.sql
-- RPC public.monthly_ranking: top membros por XP ganho no mes corrente,
-- lido do ledger (private.wallet_ledger), com nome/username/avatar do perfil.
-- SECURITY DEFINER: o ledger nao tem grant para authenticated; a funcao roda
-- como owner (postgres) e expoe apenas o agregado. Perfis privados sao
-- filtrados (so o proprio dono se ve). Retorna { list, me }.
-- ============================================================================

create or replace function public.monthly_ranking(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_month_start date := date_trunc('month', current_date)::date;
  v_uid uuid := auth.uid();
  v_rows jsonb;
  v_me jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rank', t.rn,
      'user_id', t.user_id,
      'name', t.name,
      'username', t.username,
      'handle', t.username,
      'avatar', t.avatar,
      'avatar_url', t.avatar_url,
      'xp', t.xp,
      'level', t.level,
      'is_me', t.user_id = v_uid
    ) order by t.rn
  ), '[]'::jsonb)
  into v_rows
  from (
    select
      p.id as user_id,
      p.name,
      p.username,
      p.avatar,
      p.avatar_url,
      sum(l.amount) as xp,
      private.level_from_xp(p.xp) as level,
      row_number() over (order by sum(l.amount) desc) as rn
    from private.wallet_ledger l
    join public.profiles p on p.id = l.user_id
    where l.currency = 'xp'
      and l.amount > 0
      and l.day_key >= v_month_start
      and (p.private_profile = false or p.id = v_uid)
    group by p.id
    order by xp desc
    limit greatest(1, coalesce(p_limit, 20))
  ) t;

  -- Posicao do proprio usuario mesmo quando fora do top N.
  select jsonb_build_object(
    'rank', t.rn,
    'user_id', t.user_id,
    'xp', t.xp,
    'level', t.level
  )
  into v_me
  from (
    select
      p.id as user_id,
      sum(l.amount) as xp,
      private.level_from_xp(p.xp) as level,
      row_number() over (order by sum(l.amount) desc) as rn
    from private.wallet_ledger l
    join public.profiles p on p.id = l.user_id
    where l.currency = 'xp'
      and l.amount > 0
      and l.day_key >= v_month_start
      and (p.private_profile = false or p.id = v_uid)
    group by p.id
  ) t
  where t.user_id = v_uid;

  return jsonb_build_object('list', v_rows, 'me', v_me);
end;
$function$;

-- Grants: so authenticated executa; revoga de public/anon.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'monthly_ranking'
  loop
    execute format('revoke all on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$migration$;

commit;
