-- ============================================================================
-- 20260809030000_admin_seasons_and_referrals.sql
-- 1. Tabela public.seasons (admin CRUD direto, leitura p/ todos) para a aba
--    "Seasons" do painel admin deixar de usar localStorage.
-- 2. RPCs admin de indicacoes (lista com nomes + confirmar/cancelar), seguindo
--    o padrao de spam_revert: SECURITY DEFINER + private.is_admin() + search_path ''.
-- 3. Fix M15: revoga EXECUTE de authenticated nas funcoes private.* de carteira
--    (mantem apenas service_role). Os RPCs public.* SECURITY DEFINER continuam
--    funcionando (executam como owner).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. public.seasons
-- ---------------------------------------------------------------------------
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','active','archived')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists seasons_status on public.seasons(status, created_at desc);

drop trigger if exists trg_seasons_updated_at on public.seasons;
create trigger trg_seasons_updated_at before update on public.seasons
  for each row execute function public.touch_updated_at();

alter table public.seasons enable row level security;

drop policy if exists "seasons_read" on public.seasons;
create policy "seasons_read"
  on public.seasons for select
  to anon, authenticated
  using (true);

drop policy if exists "seasons_admin_write" on public.seasons;
create policy "seasons_admin_write"
  on public.seasons for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "seasons_admin_update" on public.seasons;
create policy "seasons_admin_update"
  on public.seasons for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "seasons_admin_delete" on public.seasons;
create policy "seasons_admin_delete"
  on public.seasons for delete
  to authenticated
  using ((select private.is_admin()));

grant select on public.seasons to anon, authenticated;
grant insert, update, delete on public.seasons to authenticated;

-- ---------------------------------------------------------------------------
-- 2. RPCs admin de indicacoes
-- ---------------------------------------------------------------------------
-- Lista todas as indicacoes com nomes/emails (admin). Status derivado:
--   confirmed  -> rewarded_at preenchido
--   pending    -> ainda nao recompensado
create or replace function public.admin_list_referrals()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb;
begin
  if not private.is_admin() then raise exception 'PERMISSAO_NEGADA'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.referrer_user_id::text || '_' || r.referred_user_id::text,
      'created_at', r.created_at,
      'rewarded_at', r.rewarded_at,
      'status', case when r.rewarded_at is not null then 'confirmed' else 'pending' end,
      'referrer', jsonb_build_object(
        'id', pref.id,
        'name', pref.name,
        'email', pref.email
      ),
      'referred', jsonb_build_object(
        'id', prd.id,
        'name', prd.name,
        'email', prd.email
      )
    )
    order by r.created_at desc
  ), '[]'::jsonb)
  into v_rows
  from public.referrals r
  join public.profiles pref on pref.id = r.referrer_user_id
  join public.profiles prd  on prd.id  = r.referred_user_id;

  return v_rows;
end;
$function$;

-- Confirma uma indicacao como admin: marca rewarded_at e recompensa o
-- indicador (500 XP + 100 creditos) de forma idempotente.
create or replace function public.admin_confirm_referral(p_referrer_user_id uuid, p_referred_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_referral public.referrals%rowtype;
begin
  if not private.is_admin() then raise exception 'PERMISSAO_NEGADA'; end if;
  if p_referrer_user_id is null or p_referred_user_id is null then
    raise exception 'PARAMETRO_INVALIDO';
  end if;

  select * into v_referral from public.referrals
  where referrer_user_id = p_referrer_user_id
    and referred_user_id = p_referred_user_id;

  if v_referral.referrer_user_id is null then raise exception 'INDICACAO_NAO_ENCONTRADA'; end if;

  if v_referral.rewarded_at is null then
    perform private.award_both(p_referrer_user_id, 500, 100, 'referral', p_referred_user_id::text, true);
    update public.referrals
       set rewarded_at = now()
     where referrer_user_id = p_referrer_user_id
       and referred_user_id = p_referred_user_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$function$;

-- Cancela uma indicacao como admin (remove a relacao). O indicador que ja
-- tiver recompensa recebida nao eh revertido (reversao de rewards segue o
-- fluxo spam_revert, fora de escopo aqui).
create or replace function public.admin_cancel_referral(p_referrer_user_id uuid, p_referred_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.is_admin() then raise exception 'PERMISSAO_NEGADA'; end if;
  if p_referrer_user_id is null or p_referred_user_id is null then
    raise exception 'PARAMETRO_INVALIDO';
  end if;

  delete from public.referrals
  where referrer_user_id = p_referrer_user_id
    and referred_user_id = p_referred_user_id;

  return jsonb_build_object('ok', true);
end;
$function$;

-- Grants dos novos RPCs: so admin executa via checagem interna; authenticated
-- precisa de EXECUTE para a checagem ocorrer. O public/anon nao executa.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_list_referrals','admin_confirm_referral','admin_cancel_referral')
  loop
    execute format('revoke all on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$migration$;

-- ---------------------------------------------------------------------------
-- 3. Fix M15: revoga EXECUTE de authenticated nas private.* de carteira.
-- As funcoes public.* que as chamam sao SECURITY DEFINER (rodam como owner),
-- entao nao dependem do grant do chamador. O unico caminho que poderia ser
-- abusado era a chamada direta via cliente a um schema privado; isso nao era
-- possivel via PostgREST, mas a exposicao de EXECUTE a authenticated era um
-- risco latente de regressao. Mantem-se apenas service_role.
-- ---------------------------------------------------------------------------
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
        'xp_threshold','level_from_xp','day_activity_totals','bump_counter',
        'get_counter','award_both','active_months','can_target',
        'is_repetitive_comment','likes_received_today','wallet_state_core'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', function_row.signature);
    execute format('grant execute on function %s to service_role', function_row.signature);
  end loop;
end
$migration$;

commit;
