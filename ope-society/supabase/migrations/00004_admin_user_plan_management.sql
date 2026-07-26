-- OPE Club — admin user and plan management
-- Run this after the Cakto migration if admins will manage plans in the app.

alter table public.profiles
  add column if not exists email text,
  add column if not exists role text not null default 'user';

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "subscriptions_select_admin" on public.subscriptions;
drop policy if exists "subscriptions_insert_admin" on public.subscriptions;
drop policy if exists "subscriptions_update_admin" on public.subscriptions;
drop policy if exists "subscriptions_delete_admin" on public.subscriptions;

create policy "subscriptions_select_admin" on public.subscriptions
  for select to authenticated
  using (public.is_admin());

create policy "subscriptions_insert_admin" on public.subscriptions
  for insert to authenticated
  with check (public.is_admin());

create policy "subscriptions_update_admin" on public.subscriptions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "subscriptions_delete_admin" on public.subscriptions
  for delete to authenticated
  using (public.is_admin());

-- Replace with your admin email after the user confirms email and appears in profiles.
-- update public.profiles set role = 'admin' where email = 'seu-email@gmail.com';
