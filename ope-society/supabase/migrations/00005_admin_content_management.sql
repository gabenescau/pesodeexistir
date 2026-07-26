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

create table if not exists public.book_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  page_number integer not null default 1,
  note text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.book_notes enable row level security;

drop policy if exists "book_notes_select_own" on public.book_notes;
drop policy if exists "book_notes_insert_own" on public.book_notes;
drop policy if exists "book_notes_update_own" on public.book_notes;
drop policy if exists "book_notes_delete_own" on public.book_notes;

create policy "book_notes_select_own" on public.book_notes
  for select to authenticated
  using (auth.uid() = user_id);

create policy "book_notes_insert_own" on public.book_notes
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "book_notes_update_own" on public.book_notes
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "book_notes_delete_own" on public.book_notes
  for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.book_notes to authenticated;

create index if not exists idx_book_notes_user_book on public.book_notes(user_id, book_id, page_number);

create table if not exists public.weekly_releases (
  id uuid default gen_random_uuid() primary key,
  book_id uuid references public.books(id) on delete cascade not null,
  release_date date not null,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (book_id, release_date)
);

alter table public.weekly_releases enable row level security;

drop policy if exists "weekly_releases_select_authenticated" on public.weekly_releases;
drop policy if exists "weekly_releases_insert_admin" on public.weekly_releases;
drop policy if exists "weekly_releases_update_admin" on public.weekly_releases;
drop policy if exists "weekly_releases_delete_admin" on public.weekly_releases;

create policy "weekly_releases_select_authenticated" on public.weekly_releases
  for select to authenticated
  using (true);

create policy "weekly_releases_insert_admin" on public.weekly_releases
  for insert to authenticated
  with check (public.is_admin());

create policy "weekly_releases_update_admin" on public.weekly_releases
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "weekly_releases_delete_admin" on public.weekly_releases
  for delete to authenticated
  using (public.is_admin());

grant select on public.weekly_releases to authenticated;
grant insert, update, delete on public.weekly_releases to authenticated;

create index if not exists idx_weekly_releases_release_date on public.weekly_releases(release_date);

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
