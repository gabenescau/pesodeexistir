-- Checkout concurrency and server-side plan entitlements.
-- A customer can have independent attempts for different plan/method pairs,
-- while duplicate attempts for the same pair remain idempotent.

begin;

-- Expire rows that are already outside their checkout window before changing
-- the unique index. This keeps old abandoned attempts from occupying a slot.
update public.billing_checkout_attempts
   set status = 'expired',
       updated_at = now()
 where status = 'open'
   and expires_at <= now();

-- Keep the newest open attempt for a pair if a previous manual rollout left
-- duplicate rows behind. The old rows are no longer reusable.
with ranked as (
  select attempt_id,
         row_number() over (
           partition by user_id, plan_key, payment_method
           order by created_at desc, attempt_id desc
         ) as row_number
    from public.billing_checkout_attempts
   where status = 'open'
), duplicates as (
  select attempt_id from ranked where row_number > 1
)
update public.billing_checkout_attempts a
   set status = 'expired',
       updated_at = now()
 where a.attempt_id in (select attempt_id from duplicates);

drop index if exists public.billing_open_checkout_user_uidx;
create unique index if not exists billing_open_checkout_pair_uidx
  on public.billing_checkout_attempts(user_id, plan_key, payment_method)
  where status = 'open';

create index if not exists billing_checkout_attempts_user_status_idx
  on public.billing_checkout_attempts(user_id, status, created_at desc);

-- The verified badge is an entitlement of the Pensador tier (and admins),
-- never a client-controlled profile flag and not a benefit of Leitor.
create or replace function private.profile_is_verified(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.profiles p
     where p.id = profile_id
       and p.role = 'admin'
  )
  or exists (
    select 1
      from public.subscriptions s
     where s.user_id = profile_id
       and s.status in (
         'active', 'trialing', 'past_due', 'paid', 'approved', 'authorized',
         'complete', 'completed', 'succeeded'
       )
       and (s.current_period_end is null or s.current_period_end > now())
       and s.plan in (
         'ope_club_pensador_monthly',
         'ope_club_pensador_annual',
         'pensador'
       )
  );
$function$;

revoke all on function private.profile_is_verified(uuid)
  from public, anon, authenticated;
grant execute on function private.profile_is_verified(uuid)
  to authenticated, service_role;

commit;
