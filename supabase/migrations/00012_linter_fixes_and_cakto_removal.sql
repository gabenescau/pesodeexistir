-- OPE Club — zera os avisos do Database Linter e remove a Cakto do banco
--
-- Avisos atacados aqui:
--   0010 security_definer_view      → public_profiles (e as views de contagem)
--   0011 function_search_path_mutable → map_cakto_status_to_internal (removida)
--   0025 public_bucket_allows_listing → policy ampla de SELECT no bucket avatars
--   0028/0029 *_security_definer_function_executable → helpers movidos para o
--             schema `private`, que nao e exposto pelo PostgREST
--
-- A ideia central: RLS precisa que o usuario tenha EXECUTE nos helpers, entao
-- nao da para simplesmente revogar. O que da para fazer — e e o que a doc da
-- Supabase recomenda — e tirar as funcoes do schema exposto na API. Em
-- `private` elas continuam chamaveis pelas policies e somem de /rest/v1/rpc.

-- =====================================================================
-- 1) Schema privado dos helpers
-- =====================================================================
create schema if not exists private;

revoke all on schema private from anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function private.has_active_subscription()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = (select auth.uid())
      and lower(status) in (
        'active', 'past_due', 'trialing', 'paid', 'approved',
        'authorized', 'complete', 'completed', 'succeeded'
      )
      and (current_period_end is null or current_period_end >= now())
  );
$$;

create or replace function private.is_book_released(p_book_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    not exists (select 1 from public.weekly_releases w where w.book_id = p_book_id)
    or exists (
      select 1 from public.weekly_releases w
      where w.book_id = p_book_id
        and w.release_date <= current_date
    );
$$;

create or replace function private.is_pdf_object_released(p_name text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(bool_and(private.is_book_released(b.id)), true)
  from public.books b
  where b.pdf_url is not null
    and b.pdf_url like '%/pdfs/' || p_name;
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.has_active_subscription() from public;
revoke all on function private.is_book_released(uuid) from public;
revoke all on function private.is_pdf_object_released(text) from public;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_active_subscription() to authenticated;
grant execute on function private.is_book_released(uuid) to authenticated;
grant execute on function private.is_pdf_object_released(text) to authenticated;

-- =====================================================================
-- 2) Email sai de `profiles`
-- =====================================================================
-- Motivo: para o feed mostrar nome/avatar de outras pessoas com uma view
-- security_invoker, o usuario precisa conseguir LER a linha do outro. RLS e
-- por linha, nao por coluna — entao, enquanto o email morar em profiles,
-- abrir a linha significa abrir o email. Com o email numa tabela propria,
-- visivel so para admin, profiles fica sem nada sensivel.
create table if not exists public.user_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  updated_at timestamptz default now()
);

alter table public.user_emails enable row level security;

drop policy if exists "user_emails_select_admin" on public.user_emails;
create policy "user_emails_select_admin" on public.user_emails
  for select to authenticated
  using (private.is_admin());

revoke all on public.user_emails from anon, authenticated;
grant select on public.user_emails to authenticated;

insert into public.user_emails (user_id, email)
select id, email from public.profiles where email is not null
on conflict (user_id) do update set email = excluded.email;

alter table public.profiles drop column if exists email;

-- =====================================================================
-- 3) Triggers (funcoes tambem saem do schema exposto)
-- =====================================================================
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_username text;
  v_sufixo integer := 0;
begin
  v_base := nullif(
    regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'),
    ''
  );
  v_base := coalesce(v_base, 'leitor');
  if length(v_base) < 3 then
    v_base := v_base || 'leitor';
  end if;
  v_base := left(v_base, 20);
  v_username := v_base;

  while exists (select 1 from public.profiles where lower(username) = v_username) loop
    v_sufixo := v_sufixo + 1;
    v_username := left(v_base, 20) || v_sufixo::text;
  end loop;

  insert into public.profiles (id, name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    v_username
  )
  on conflict (id) do nothing;

  insert into public.user_emails (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update set email = excluded.email, updated_at = now();

  return new;
end;
$$;

create or replace function private.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() nulo = service_role ou SQL Editor: administracao legitima.
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not private.is_admin() then
    raise exception 'Alteracao de role nao permitida.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.prevent_role_change() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row
  execute function private.prevent_role_change();

-- =====================================================================
-- 4) Policies recriadas apontando para private.*
-- =====================================================================
-- authors
drop policy if exists "authors_insert_admin" on public.authors;
drop policy if exists "authors_update_admin" on public.authors;
drop policy if exists "authors_delete_admin" on public.authors;

create policy "authors_insert_admin" on public.authors
  for insert to authenticated with check (private.is_admin());
create policy "authors_update_admin" on public.authors
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "authors_delete_admin" on public.authors
  for delete to authenticated using (private.is_admin());

-- books
drop policy if exists "books_insert_admin" on public.books;
drop policy if exists "books_update_admin" on public.books;
drop policy if exists "books_delete_admin" on public.books;

create policy "books_insert_admin" on public.books
  for insert to authenticated with check (private.is_admin());
create policy "books_update_admin" on public.books
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "books_delete_admin" on public.books
  for delete to authenticated using (private.is_admin());

-- profiles
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_visible" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

-- Com o email fora da tabela, abrir as linhas publicas e seguro: sobra
-- id/nome/@/avatar/bio/preferencias — exatamente o que o feed mostra.
create policy "profiles_select_visible" on public.profiles
  for select to authenticated
  using (
    private_profile = false
    or id = (select auth.uid())
    or private.is_admin()
  );

create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

-- posts / respostas
drop policy if exists "posts_delete_admin" on public.posts;
drop policy if exists "posts_delete_own_or_admin" on public.posts;
create policy "posts_delete_own_or_admin" on public.posts
  for delete to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists "post_replies_delete_own_or_admin" on public.post_replies;
create policy "post_replies_delete_own_or_admin" on public.post_replies
  for delete to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());

-- subscriptions
drop policy if exists "subscriptions_select_admin" on public.subscriptions;
drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
drop policy if exists "subscriptions_insert_admin" on public.subscriptions;
drop policy if exists "subscriptions_update_admin" on public.subscriptions;
drop policy if exists "subscriptions_delete_admin" on public.subscriptions;
drop policy if exists "subscriptions_insert_service" on public.subscriptions;
drop policy if exists "subscriptions_update_service" on public.subscriptions;

create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());
create policy "subscriptions_insert_admin" on public.subscriptions
  for insert to authenticated with check (private.is_admin());
create policy "subscriptions_update_admin" on public.subscriptions
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "subscriptions_delete_admin" on public.subscriptions
  for delete to authenticated using (private.is_admin());

-- weekly_releases
drop policy if exists "weekly_releases_insert_admin" on public.weekly_releases;
drop policy if exists "weekly_releases_update_admin" on public.weekly_releases;
drop policy if exists "weekly_releases_delete_admin" on public.weekly_releases;

create policy "weekly_releases_insert_admin" on public.weekly_releases
  for insert to authenticated with check (private.is_admin());
create policy "weekly_releases_update_admin" on public.weekly_releases
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "weekly_releases_delete_admin" on public.weekly_releases
  for delete to authenticated using (private.is_admin());

-- book_page_comments
drop policy if exists "book_page_comments_select_subscribers" on public.book_page_comments;
drop policy if exists "book_page_comments_insert_own" on public.book_page_comments;
drop policy if exists "book_page_comments_delete_own_or_admin" on public.book_page_comments;

create policy "book_page_comments_select_subscribers" on public.book_page_comments
  for select to authenticated
  using (private.has_active_subscription() or private.is_admin());

create policy "book_page_comments_insert_own" on public.book_page_comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (private.has_active_subscription() or private.is_admin())
    and private.is_book_released(book_id)
  );

create policy "book_page_comments_delete_own_or_admin" on public.book_page_comments
  for delete to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());

-- storage: pdfs
drop policy if exists "pdfs_select_subscribers" on storage.objects;
drop policy if exists "pdfs_insert_admin" on storage.objects;
drop policy if exists "pdfs_update_admin" on storage.objects;
drop policy if exists "pdfs_delete_admin" on storage.objects;

create policy "pdfs_select_subscribers" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pdfs'
    and (private.has_active_subscription() or private.is_admin())
    and (private.is_admin() or private.is_pdf_object_released(name))
  );

create policy "pdfs_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pdfs' and private.is_admin());

create policy "pdfs_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'pdfs' and private.is_admin())
  with check (bucket_id = 'pdfs' and private.is_admin());

create policy "pdfs_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pdfs' and private.is_admin());

-- =====================================================================
-- 5) Lint 0025 — bucket avatars nao precisa de SELECT amplo
-- =====================================================================
-- Bucket publico serve o objeto pela URL sem passar por policy. A policy
-- ampla so servia para LISTAR o bucket inteiro, o que ninguem no app faz.
drop policy if exists "avatars_select_public" on storage.objects;

-- =====================================================================
-- 6) Lint 0010 — views deixam de rodar como dono
-- =====================================================================
drop view if exists public.post_stats;
drop view if exists public.profile_stats;

drop view if exists public.public_profiles;

create view public.public_profiles
with (security_invoker = true)
as
select id, name, username, avatar, bio
from public.profiles
where private_profile = false;

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

comment on view public.public_profiles is
  'Projecao publica de profiles. security_invoker: o RLS de profiles e quem decide as linhas.';

-- =====================================================================
-- 7) Remocao completa da Cakto
-- =====================================================================
drop function if exists public.map_cakto_status_to_internal(text);
drop function if exists public.map_cakto_status_to_internal();

drop table if exists public.webhook_events cascade;
drop table if exists public.checkout_sessions cascade;

alter table public.subscriptions drop column if exists cakto_subscription_id;
alter table public.subscriptions drop column if exists cakto_customer_id;
alter table public.subscriptions drop column if exists cakto_order_id;

-- =====================================================================
-- 8) Restos de funcoes antigas no schema exposto
-- =====================================================================
drop function if exists public.rls_auto_enable() cascade;
drop function if exists public.is_admin();
drop function if exists public.has_active_subscription();
drop function if exists public.is_book_released(uuid);
drop function if exists public.is_pdf_object_released(text);
drop function if exists public.handle_new_user();
drop function if exists public.prevent_role_change();
