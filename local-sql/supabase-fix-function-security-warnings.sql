-- Supabase Database Linter: harden SECURITY DEFINER helpers.
-- Safe to run more than once.
--
-- These helpers are used by RLS and Storage policies. They must keep
-- SECURITY DEFINER, but they do not need to be exposed as Data API RPCs.

begin;

create schema if not exists private;

-- Internal helpers remain callable for signed-in users through the public
-- SECURITY INVOKER wrappers, while private is not exposed by the Data API.
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

-- Keep every relation fully qualified because the search path is empty.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$function$;

create or replace function private.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$function$;

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
        'active', 'trialing', 'paid', 'approved', 'authorized',
        'complete', 'completed', 'succeeded'
      )
      and (s.current_period_end is null or s.current_period_end > now())
      and s.plan in ('ope_club_annual', 'ope_club_monthly')
  );
$function$;

create or replace function private.can_read_book_pdf(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_admin()
    or (
      private.has_active_subscription()
      and exists (
        select 1
        from public.books b
        where b.pdf_path = object_name
          and not exists (
            select 1
            from public.weekly_releases wr
            where wr.book_id = b.id
              and coalesce(wr.visible, true)
              and wr.release_date > current_date
          )
      )
    );
$function$;

-- Preserve the existing public function names used by policies and views.
-- These wrappers have caller privileges and therefore no longer expose a
-- SECURITY DEFINER function through /rest/v1/rpc.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.is_admin();
$function$;

create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.has_active_subscription();
$function$;

create or replace function public.profile_is_verified(profile_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.profile_is_verified(profile_id);
$function$;

create or replace function public.can_read_book_pdf(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.can_read_book_pdf(object_name);
$function$;

-- Fix every overload without assuming the arguments of this existing helper.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'is_book_released'
  loop
    execute format(
      'alter function %s set search_path = %L',
      function_row.signature,
      ''
    );
  end loop;
end
$migration$;

-- Remove PostgreSQL's default PUBLIC execution privilege. RLS/Storage
-- policies still need authenticated users to execute these internal helpers.
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.has_active_subscription() from public, anon, authenticated;
revoke all on function private.profile_is_verified(uuid) from public, anon, authenticated;
revoke all on function private.can_read_book_pdf(text) from public, anon, authenticated;

grant execute on function private.is_admin()
  to authenticated, service_role;
grant execute on function private.has_active_subscription()
  to authenticated, service_role;
grant execute on function private.profile_is_verified(uuid)
  to authenticated, service_role;
grant execute on function private.can_read_book_pdf(text)
  to authenticated, service_role;

revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.has_active_subscription() from public, anon, authenticated;
revoke all on function public.profile_is_verified(uuid) from public, anon, authenticated;
revoke all on function public.can_read_book_pdf(text) from public, anon, authenticated;

grant execute on function public.is_admin()
  to authenticated, service_role;
grant execute on function public.has_active_subscription()
  to authenticated, service_role;
grant execute on function public.profile_is_verified(uuid)
  to authenticated, service_role;
grant execute on function public.can_read_book_pdf(text)
  to authenticated, service_role;

-- Apply least privilege to every overload of is_book_released as well.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'is_book_released'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      function_row.signature
    );
    execute format(
      'grant execute on function %s to authenticated, service_role',
      function_row.signature
    );
  end loop;
end
$migration$;

commit;

-- Verification: public functions should show security_definer = false;
-- private helpers should show security_definer = true and search_path="".
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in (
  'is_admin',
  'has_active_subscription',
  'profile_is_verified',
  'can_read_book_pdf',
  'is_book_released'
)
order by n.nspname, p.proname;
