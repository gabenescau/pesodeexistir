-- OPE Club — fix final de admin, assinaturas e permissões da Data API
-- Rode este arquivo no SQL Editor do Supabase quando:
-- - o usuário virou admin em profiles.role, mas o app não reconhece;
-- - o admin não consegue salvar autores/livros/lançamentos/planos;
-- - o usuário tem assinatura, mas o app ainda manda assinar.

-- 1) Garante colunas usadas pelo app em profiles
alter table public.profiles
  add column if not exists email text,
  add column if not exists role text not null default 'user',
  add column if not exists private_profile boolean not null default false,
  add column if not exists reading_activity boolean not null default true,
  add column if not exists show_online_status boolean not null default true;

-- 2) Sincroniza profiles com auth.users para contas antigas
insert into public.profiles (id, email, name, avatar)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'name', split_part(users.email, '@', 1)),
  upper(left(coalesce(users.raw_user_meta_data ->> 'name', users.email), 1))
from auth.users as users
where not exists (
  select 1
  from public.profiles as profiles
  where profiles.id = users.id
);

update public.profiles as profiles
set email = users.email,
    updated_at = now()
from auth.users as users
where profiles.id = users.id
  and (profiles.email is null or profiles.email <> users.email);

-- 3) Trigger de criação de perfil sempre com email
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
        avatar = coalesce(public.profiles.avatar, excluded.avatar),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 4) Função única de admin baseada em profiles.role
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 5) RLS ligado nas tabelas que o app usa
alter table public.authors enable row level security;
alter table public.books enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_replies enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reading_progress enable row level security;

-- 6) Grants para a Data API do Supabase
grant select on public.authors, public.books to anon, authenticated;
grant insert, update, delete on public.authors, public.books to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.posts, public.post_likes, public.post_replies to authenticated;
grant insert, update, delete on public.posts to authenticated;
grant insert, delete on public.post_likes, public.post_replies to authenticated;

grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update on public.reading_progress to authenticated;

-- 7) Profiles: usuário vê/edita o próprio; admin vê/edita todos
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.is_admin());

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- 8) Autores/livros: leitura pública, escrita só admin
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

-- 9) Posts/likes/replies
drop policy if exists "posts_select_authenticated" on public.posts;
drop policy if exists "posts_insert_authenticated" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
drop policy if exists "posts_delete_own" on public.posts;
drop policy if exists "posts_delete_admin" on public.posts;

create policy "posts_select_authenticated" on public.posts
  for select to authenticated
  using (true);

create policy "posts_insert_authenticated" on public.posts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "posts_update_own" on public.posts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "posts_delete_own_or_admin" on public.posts
  for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- 10) Assinaturas: usuário vê a própria; admin gerencia todas
drop policy if exists "subscriptions_select_own" on public.subscriptions;
drop policy if exists "subscriptions_select_admin" on public.subscriptions;
drop policy if exists "subscriptions_insert_admin" on public.subscriptions;
drop policy if exists "subscriptions_update_admin" on public.subscriptions;
drop policy if exists "subscriptions_delete_admin" on public.subscriptions;
drop policy if exists "subscriptions_insert_service" on public.subscriptions;
drop policy if exists "subscriptions_update_service" on public.subscriptions;

create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

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

create policy "subscriptions_insert_service" on public.subscriptions
  for insert to service_role
  with check (true);

create policy "subscriptions_update_service" on public.subscriptions
  for update to service_role
  using (true)
  with check (true);

-- 11) Checkout/webhooks
create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  provider text not null default 'cakto',
  provider_product_id text,
  provider_offer_id text,
  provider_order_id text,
  checkout_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkout_sessions enable row level security;
grant select, insert, update on public.checkout_sessions to authenticated;

drop policy if exists "checkout_sessions_select_own" on public.checkout_sessions;
drop policy if exists "checkout_sessions_insert_own" on public.checkout_sessions;
drop policy if exists "checkout_sessions_select_admin" on public.checkout_sessions;
drop policy if exists "checkout_sessions_update_service" on public.checkout_sessions;

create policy "checkout_sessions_select_own_or_admin" on public.checkout_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "checkout_sessions_insert_own" on public.checkout_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "checkout_sessions_update_admin" on public.checkout_sessions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cakto',
  external_event_id text,
  event_type text,
  payload jsonb not null,
  status text not null default 'received',
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, external_event_id)
);

alter table public.webhook_events enable row level security;
grant select on public.webhook_events to authenticated;

drop policy if exists "webhook_events_select_admin" on public.webhook_events;
drop policy if exists "webhook_events_insert_service" on public.webhook_events;
drop policy if exists "webhook_events_select_service" on public.webhook_events;

create policy "webhook_events_select_admin" on public.webhook_events
  for select to authenticated
  using (public.is_admin());

create policy "webhook_events_insert_service" on public.webhook_events
  for insert to service_role
  with check (true);

create policy "webhook_events_select_service" on public.webhook_events
  for select to service_role
  using (true);

-- 12) Lançamentos semanais
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
grant select, insert, update, delete on public.weekly_releases to authenticated;

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

-- 13) Storage de PDFs
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
  with check (bucket_id = 'pdfs' and public.is_admin());

create policy "pdfs_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'pdfs' and public.is_admin())
  with check (bucket_id = 'pdfs' and public.is_admin());

create policy "pdfs_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pdfs' and public.is_admin());

-- 14) Índices úteis
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_subscriptions_user_status on public.subscriptions(user_id, status);
create index if not exists idx_weekly_releases_release_date on public.weekly_releases(release_date);
