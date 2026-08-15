-- Missions are a shared benefit of every active OPE Club plan.
-- Keep the entitlement decision server-side so the client cannot unlock it
-- by changing the plan or feature in the browser.

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
      'credit_multiplier', 'vip_support', 'early_drops'
    ) then false
    when p_feature = 'missions' then exists (
      select 1
        from public.subscriptions s
       where s.user_id = p_user_id
         and s.status in (
           'active', 'trialing', 'past_due', 'paid', 'approved',
           'authorized', 'complete', 'completed', 'succeeded'
         )
         and (s.current_period_end is null or s.current_period_end > now())
         and s.plan in (
           'ope_club_leitor_monthly', 'ope_club_leitor_annual',
           'ope_club_pensador_monthly', 'ope_club_pensador_annual',
           'ope_club_monthly', 'ope_club_annual',
           'monthly', 'annual', 'leitor', 'pensador'
         )
    )
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
           'ope_club_pensador_monthly', 'ope_club_pensador_annual',
           'pensador'
         )
    )
  end;
$function$;

revoke all on function private.has_plan_entitlement(uuid, text)
  from public, anon, authenticated;
grant execute on function private.has_plan_entitlement(uuid, text)
  to service_role;

notify pgrst, 'reload schema';
commit;
