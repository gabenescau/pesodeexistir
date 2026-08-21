begin;

-- The badge is derived only from server-side role/entitlement state. It is
-- never read from a client-writable profile flag.
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
  or private.has_plan_entitlement(profile_id, 'verified_badge');
$function$;

revoke all on function private.profile_is_verified(uuid)
  from public, anon, authenticated;
grant execute on function private.profile_is_verified(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
