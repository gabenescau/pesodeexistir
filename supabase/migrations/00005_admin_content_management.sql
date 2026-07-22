-- Correção de permissões para o painel admin gerenciar autores e livros.
-- Rode este arquivo no SQL Editor do Supabase se autores/livros não estiverem salvando.

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

alter table public.authors enable row level security;
alter table public.books enable row level security;

drop policy if exists "authors_select_public" on public.authors;
drop policy if exists "authors_insert_admin" on public.authors;
drop policy if exists "authors_update_admin" on public.authors;
drop policy if exists "authors_delete_admin" on public.authors;

create policy "authors_select_public" on public.authors
  for select to anon, authenticated
  using (true);

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

drop policy if exists "books_select_public" on public.books;
drop policy if exists "books_insert_admin" on public.books;
drop policy if exists "books_update_admin" on public.books;
drop policy if exists "books_delete_admin" on public.books;

create policy "books_select_public" on public.books
  for select to anon, authenticated
  using (true);

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

grant select on public.authors to anon;
grant select on public.books to anon;
grant select, insert, update, delete on public.authors to authenticated;
grant select, insert, update, delete on public.books to authenticated;

drop policy if exists "posts_delete_admin" on public.posts;

create policy "posts_delete_admin" on public.posts
  for delete to authenticated
  using (public.is_admin());

alter table public.profiles
  add column if not exists private_profile boolean not null default false,
  add column if not exists reading_activity boolean not null default true,
  add column if not exists show_online_status boolean not null default true;

grant select, update on public.profiles to authenticated;

alter table public.reading_progress
  add column if not exists current_page integer not null default 1,
  add column if not exists total_pages integer;

grant select, insert, update on public.reading_progress to authenticated;

insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "pdfs_select_public" on storage.objects;
drop policy if exists "pdfs_insert_admin" on storage.objects;
drop policy if exists "pdfs_update_admin" on storage.objects;
drop policy if exists "pdfs_delete_admin" on storage.objects;

create policy "pdfs_select_public" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'pdfs');

create policy "pdfs_insert_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pdfs'
    and public.is_admin()
  );

create policy "pdfs_update_admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pdfs'
    and public.is_admin()
  )
  with check (
    bucket_id = 'pdfs'
    and public.is_admin()
  );

create policy "pdfs_delete_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pdfs'
    and public.is_admin()
  );
