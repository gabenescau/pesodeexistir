-- Retrospectiva: somente assinaturas ativas podem consultar os dados.
-- A regra fica no banco para impedir bypass pelo frontend ou por chamadas RPC diretas.

begin;

create or replace function private.retrospective_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_month_start date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_month_end date := date_trunc('month', current_date)::date;
  v_year_start date := (date_trunc('year', current_date) - interval '1 year')::date;
  v_year_end date := date_trunc('year', current_date)::date;
begin
  if p_user_id is null or not exists (
    select 1
      from public.subscriptions s
     where s.user_id = p_user_id
       and s.status in (
         'active', 'past_due', 'trialing', 'paid', 'approved',
         'authorized', 'complete', 'completed', 'succeeded'
       )
       and (s.current_period_end is null or s.current_period_end >= now())
  ) then
    return jsonb_build_object(
      'allowed', false,
      'month', null,
      'year', null
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'month', private.retrospective_period(
      p_user_id,
      v_month_start,
      v_month_end,
      'month',
      to_char(v_month_start, 'TMMonth YYYY')
    ),
    'year', private.retrospective_period(
      p_user_id,
      v_year_start,
      v_year_end,
      'year',
      to_char(v_year_start, 'YYYY')
    )
  );
end;
$function$;

revoke all on function private.retrospective_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function private.retrospective_snapshot(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
