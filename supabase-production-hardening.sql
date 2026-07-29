-- OPE Club - hardening de producao
-- Rode este arquivo uma vez no SQL Editor do Supabase antes de publicar o codigo.
-- Ele e idempotente e pode ser executado novamente sem duplicar policies.

begin;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists private_profile boolean not null default false,
  add column if not exists reading_activity boolean not null default true,
  add column if not exists show_online_status boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_name_length_check,
  drop constraint if exists profiles_bio_length_check;

alter table public.profiles
  add constraint profiles_name_length_check
    check (name is null or char_length(btrim(name)) between 1 and 80) not valid,
  add constraint profiles_bio_length_check
    check (bio is null or char_length(bio) <= 500) not valid;

alter function public.is_admin() set search_path = '';
alter function public.has_active_subscription() set search_path = '';
alter function public.profile_is_verified(uuid) set search_path = '';

revoke all on function public.is_admin() from public;
revoke all on function public.has_active_subscription() from public;
revoke all on function public.profile_is_verified(uuid) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_active_subscription() to authenticated;
grant execute on function public.profile_is_verified(uuid) to authenticated;

alter function public.can_read_book_pdf(text) set search_path = '';
revoke all on function public.can_read_book_pdf(text) from public;
grant execute on function public.can_read_book_pdf(text) to authenticated;

-- Corrige integridade preexistente antes de criar os indices unicos usados
-- pelos upserts/toggles do aplicativo.
delete from public.reading_progress
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, book_id
        order by updated_at desc nulls last, id desc
      ) as duplicate_number
    from public.reading_progress
  ) duplicates
  where duplicate_number > 1
);

create unique index if not exists reading_progress_user_book_unique_idx
  on public.reading_progress(user_id, book_id);

delete from public.reactions
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, target_type, target_id, emoji
        order by created_at desc nulls last, id desc
      ) as duplicate_number
    from public.reactions
  ) duplicates
  where duplicate_number > 1
);

create unique index if not exists reactions_user_target_emoji_unique_idx
  on public.reactions(user_id, target_type, target_id, emoji);

create index if not exists posts_feed_cursor_idx
  on public.posts(created_at desc, id desc);
create index if not exists follows_following_id_idx
  on public.follows(following_id);
create index if not exists saved_posts_post_id_idx
  on public.saved_posts(post_id);
create index if not exists reactions_target_idx
  on public.reactions(target_type, target_id);
create index if not exists book_page_comments_page_idx
  on public.book_page_comments(book_id, page_number, created_at);
create index if not exists book_notes_user_book_page_idx
  on public.book_notes(user_id, book_id, page_number);

-- Exclusao de conta e de catalogo nao pode deixar dados orfaos nem falhar por
-- FKs antigas sem ON DELETE.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.user_emails drop constraint if exists user_emails_user_id_fkey;
alter table public.user_emails
  add constraint user_emails_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.subscriptions drop constraint if exists subscriptions_user_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.posts drop constraint if exists posts_user_id_fkey;
alter table public.posts
  add constraint posts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.post_likes drop constraint if exists post_likes_user_id_fkey;
alter table public.post_likes
  add constraint post_likes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.post_likes drop constraint if exists post_likes_post_id_fkey;
alter table public.post_likes
  add constraint post_likes_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;

alter table public.post_replies drop constraint if exists post_replies_user_id_fkey;
alter table public.post_replies
  add constraint post_replies_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.post_replies drop constraint if exists post_replies_post_id_fkey;
alter table public.post_replies
  add constraint post_replies_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;

alter table public.follows drop constraint if exists follows_follower_id_fkey;
alter table public.follows
  add constraint follows_follower_id_fkey
  foreign key (follower_id) references auth.users(id) on delete cascade;
alter table public.follows drop constraint if exists follows_following_id_fkey;
alter table public.follows
  add constraint follows_following_id_fkey
  foreign key (following_id) references auth.users(id) on delete cascade;

alter table public.reactions drop constraint if exists reactions_user_id_fkey;
alter table public.reactions
  add constraint reactions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.saved_posts drop constraint if exists saved_posts_user_id_fkey;
alter table public.saved_posts
  add constraint saved_posts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.saved_posts drop constraint if exists saved_posts_post_id_fkey;
alter table public.saved_posts
  add constraint saved_posts_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;

alter table public.book_favorites drop constraint if exists book_favorites_user_id_fkey;
alter table public.book_favorites
  add constraint book_favorites_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.book_favorites drop constraint if exists book_favorites_book_id_fkey;
alter table public.book_favorites
  add constraint book_favorites_book_id_fkey
  foreign key (book_id) references public.books(id) on delete cascade;

alter table public.author_favorites drop constraint if exists author_favorites_user_id_fkey;
alter table public.author_favorites
  add constraint author_favorites_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.author_favorites drop constraint if exists author_favorites_author_id_fkey;
alter table public.author_favorites
  add constraint author_favorites_author_id_fkey
  foreign key (author_id) references public.authors(id) on delete cascade;

alter table public.reading_progress drop constraint if exists reading_progress_user_id_fkey;
alter table public.reading_progress
  add constraint reading_progress_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.reading_progress drop constraint if exists reading_progress_book_id_fkey;
alter table public.reading_progress
  add constraint reading_progress_book_id_fkey
  foreign key (book_id) references public.books(id) on delete cascade;

alter table public.book_notes drop constraint if exists book_notes_user_id_fkey;
alter table public.book_notes
  add constraint book_notes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.book_notes drop constraint if exists book_notes_book_id_fkey;
alter table public.book_notes
  add constraint book_notes_book_id_fkey
  foreign key (book_id) references public.books(id) on delete cascade;

alter table public.book_page_comments drop constraint if exists book_page_comments_user_id_fkey;
alter table public.book_page_comments
  add constraint book_page_comments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.book_page_comments drop constraint if exists book_page_comments_book_id_fkey;
alter table public.book_page_comments
  add constraint book_page_comments_book_id_fkey
  foreign key (book_id) references public.books(id) on delete cascade;

alter table public.weekly_releases drop constraint if exists weekly_releases_book_id_fkey;
alter table public.weekly_releases
  add constraint weekly_releases_book_id_fkey
  foreign key (book_id) references public.books(id) on delete cascade;

alter table public.posts drop constraint if exists posts_book_id_fkey;
alter table public.posts
  add constraint posts_book_id_fkey
  foreign key (book_id) references public.books(id) on delete set null;

alter table public.profiles enable row level security;

drop policy if exists "profiles_authenticated_select" on public.profiles;
create policy "profiles_authenticated_select"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.is_admin()
  or coalesce(private_profile, false) = false
);

drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

revoke insert, update on public.profiles from authenticated;
grant insert (
  id, name, username, avatar, avatar_url, bio, theme, created_at, updated_at,
  private_profile, reading_activity, show_online_status
) on public.profiles to authenticated;
grant update (
  name, username, avatar, avatar_url, bio, theme, updated_at,
  private_profile, reading_activity, show_online_status
) on public.profiles to authenticated;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

drop view if exists public.public_profiles;
create view public.public_profiles
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.username,
  p.avatar,
  p.avatar_url,
  p.bio,
  p.private_profile,
  p.reading_activity,
  p.show_online_status,
  public.profile_is_verified(p.id) as verified
from public.profiles p
where coalesce(p.private_profile, false) = false
   or p.id = (select auth.uid());

grant select on public.public_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.user_emails enable row level security;
drop policy if exists "user_emails_own_or_admin_select" on public.user_emails;
create policy "user_emails_own_or_admin_select"
on public.user_emails for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

alter table public.reading_progress enable row level security;
drop policy if exists "reading_progress_owner_all" on public.reading_progress;
create policy "reading_progress_owner_all"
on public.reading_progress for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.book_notes enable row level security;
drop policy if exists "book_notes_owner_all" on public.book_notes;
create policy "book_notes_owner_all"
on public.book_notes for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.follows enable row level security;
drop policy if exists "follows_authenticated_select" on public.follows;
create policy "follows_authenticated_select"
on public.follows for select to authenticated using (true);
drop policy if exists "follows_owner_insert" on public.follows;
create policy "follows_owner_insert"
on public.follows for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and follower_id <> following_id
);
drop policy if exists "follows_owner_delete" on public.follows;
create policy "follows_owner_delete"
on public.follows for delete to authenticated
using (follower_id = (select auth.uid()));

alter table public.book_page_comments enable row level security;
drop policy if exists "book_comments_authenticated_select" on public.book_page_comments;
create policy "book_comments_authenticated_select"
on public.book_page_comments for select to authenticated using (true);
drop policy if exists "book_comments_owner_insert" on public.book_page_comments;
create policy "book_comments_owner_insert"
on public.book_page_comments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (public.has_active_subscription() or public.is_admin())
);
drop policy if exists "book_comments_owner_delete" on public.book_page_comments;
create policy "book_comments_owner_delete"
on public.book_page_comments for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

alter table public.reactions enable row level security;
drop policy if exists "reactions_authenticated_select" on public.reactions;
create policy "reactions_authenticated_select"
on public.reactions for select to authenticated using (true);
drop policy if exists "reactions_owner_insert" on public.reactions;
create policy "reactions_owner_insert"
on public.reactions for insert to authenticated
with check (user_id = (select auth.uid()));
drop policy if exists "reactions_owner_delete" on public.reactions;
create policy "reactions_owner_delete"
on public.reactions for delete to authenticated
using (user_id = (select auth.uid()));

alter table public.book_favorites enable row level security;
drop policy if exists "book_favorites_owner_all" on public.book_favorites;
create policy "book_favorites_owner_all"
on public.book_favorites for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.author_favorites enable row level security;
drop policy if exists "author_favorites_owner_all" on public.author_favorites;
create policy "author_favorites_owner_all"
on public.author_favorites for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.weekly_releases enable row level security;
drop policy if exists "weekly_releases_authenticated_select" on public.weekly_releases;
create policy "weekly_releases_authenticated_select"
on public.weekly_releases for select to authenticated using (true);
drop policy if exists "weekly_releases_admin_all" on public.weekly_releases;
create policy "weekly_releases_admin_all"
on public.weekly_releases for all to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.categories enable row level security;
drop policy if exists "categories_authenticated_select" on public.categories;
create policy "categories_authenticated_select"
on public.categories for select to authenticated using (true);
drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all"
on public.categories for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.api_rate_limits (
  key_hash text not null,
  scope text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (key_hash, scope, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create index if not exists api_rate_limits_window_start_idx
  on public.api_rate_limits(window_start);

create or replace function public.check_api_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if p_key_hash is null
     or length(p_key_hash) <> 64
     or p_scope is null
     or length(p_scope) > 80
     or p_limit < 1
     or p_limit > 10000
     or p_window_seconds < 1
     or p_window_seconds > 86400 then
    raise exception 'invalid rate limit parameters';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (
    key_hash, scope, window_start, request_count
  )
  values (p_key_hash, p_scope, current_window, 1)
  on conflict (key_hash, scope, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into current_count;

  return jsonb_build_object(
    'allowed', current_count <= p_limit,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - current_count),
    'reset_at', extract(epoch from current_window + make_interval(secs => p_window_seconds))::bigint
  );
end;
$$;

revoke all on function public.check_api_rate_limit(text, text, integer, integer) from public;
revoke all on function public.check_api_rate_limit(text, text, integer, integer) from anon, authenticated;
grant execute on function public.check_api_rate_limit(text, text, integer, integer) to service_role;

commit;
