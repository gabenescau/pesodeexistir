-- OPE Club — admin via profiles.role + checkout session support
-- Run this after 00001_schema.sql if your Supabase project already exists.

alter table public.profiles
  add column if not exists email text,
  add column if not exists role text not null default 'user';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'name', new.email), 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.profiles.name, excluded.name),
        avatar = coalesce(public.profiles.avatar, excluded.avatar);

  return new;
end;
$$;

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

drop policy if exists "authors_insert_admin" on public.authors;
drop policy if exists "authors_update_admin" on public.authors;
drop policy if exists "authors_delete_admin" on public.authors;

create policy "authors_insert_admin" on public.authors
  for insert to authenticated
  with check (public.is_admin());

create policy "authors_update_admin" on public.authors
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authors_delete_admin" on public.authors
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "books_insert_admin" on public.books;
drop policy if exists "books_update_admin" on public.books;
drop policy if exists "books_delete_admin" on public.books;

create policy "books_insert_admin" on public.books
  for insert to authenticated
  with check (public.is_admin());

create policy "books_update_admin" on public.books
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "books_delete_admin" on public.books
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "posts_delete_admin" on public.posts;

create policy "posts_delete_admin" on public.posts
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "subscriptions_select_admin" on public.subscriptions;
drop policy if exists "subscriptions_update_admin" on public.subscriptions;
drop policy if exists "subscriptions_insert_admin" on public.subscriptions;

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

create table if not exists public.checkout_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_email text,
  checkout_url text,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table public.checkout_sessions enable row level security;

drop policy if exists "checkout_sessions_insert_own" on public.checkout_sessions;
drop policy if exists "checkout_sessions_select_own" on public.checkout_sessions;
drop policy if exists "checkout_sessions_select_admin" on public.checkout_sessions;

create policy "checkout_sessions_insert_own" on public.checkout_sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "checkout_sessions_select_own" on public.checkout_sessions
  for select to authenticated
  using (auth.uid() = user_id);

create policy "checkout_sessions_select_admin" on public.checkout_sessions
  for select to authenticated
  using (public.is_admin());

-- Optional: make your current account admin after creating it:
-- update public.profiles set role = 'admin' where email = 'seu-email@gmail.com';
