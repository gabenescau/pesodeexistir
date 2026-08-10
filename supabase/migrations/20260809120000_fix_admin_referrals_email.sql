-- ============================================================================
-- 20260809120000_fix_admin_referrals_email.sql
-- Corrige public.admin_list_referrals: profiles NAO tem coluna email; o email
-- vive em public.user_emails. A versao anterior referenciava pref.email e
-- prd.email (colunas inexistentes) e quebrava com
--   column pref.email does not exist
-- Faz LEFT JOIN com user_emails e derruba a funcao antiga antes de recriar
-- (pg_proc nao permite recriar com assinatura identica sem DROP).
-- ============================================================================

drop function if exists public.admin_list_referrals();

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
        'email', ue_ref.email
      ),
      'referred', jsonb_build_object(
        'id', prd.id,
        'name', prd.name,
        'email', ue_prd.email
      )
    )
    order by r.created_at desc
  ), '[]'::jsonb)
  into v_rows
  from public.referrals r
  join public.profiles pref on pref.id = r.referrer_user_id
  join public.profiles prd  on prd.id  = r.referred_user_id
  left join public.user_emails ue_ref on ue_ref.user_id = pref.id
  left join public.user_emails ue_prd on ue_prd.user_id = prd.id;

  return v_rows;
end;
$function$;

-- Grants: so authenticated executa (checagem interna de admin); public/anon nao.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_list_referrals'
  loop
    execute format('revoke all on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$migration$;

commit;
