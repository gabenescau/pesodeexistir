-- Final integrity and access hardening.
-- Apply after the existing security, rewards and billing migrations.
-- This migration is additive: it does not expose user tables or change the
-- public contract of the catalog/RPCs used by the application.

begin;

-- ---------------------------------------------------------------------------
-- 1. Keep all application tables behind RLS and close anonymous table access.
-- The app is authenticated-only in production. Public-looking data is still
-- readable by signed-in users through the existing policies/RPCs.
-- ---------------------------------------------------------------------------
do $access$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'profiles', 'user_emails', 'authors', 'books', 'categories', 'posts',
    'post_likes', 'post_replies', 'reading_progress', 'subscriptions',
    'book_notes', 'weekly_releases', 'follows', 'book_page_comments',
    'reactions', 'saved_posts', 'book_favorites', 'author_favorites',
    'suggestions', 'post_polls', 'post_poll_options', 'post_poll_votes',
    'api_rate_limits', 'book_author_comments', 'book_ratings', 'collections',
    'collection_items', 'shop_products', 'shop_redemptions', 'referrals',
    'seasons', 'orders', 'billing_checkout_attempts', 'suggestion_likes',
    'stripe_webhook_events', 'abacatepay_webhook_events'
  ] loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format('alter table public.%I enable row level security', relation_name);
      execute format('revoke all on table public.%I from anon', relation_name);
    end if;
  end loop;
end
$access$;

-- These relations contain secrets, balances, addresses, provider IDs or
-- operational ledgers. Their browser role is intentionally service-only.
do $internal_access$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'user_emails', 'api_rate_limits', 'stripe_webhook_events',
    'billing_checkout_attempts', 'abacatepay_webhook_events'
  ] loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', relation_name);
    end if;
  end loop;
end
$internal_access$;

revoke all on public.profiles from anon;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_public_select" on public.profiles;

-- The profile table is only for the owner/admin. Public identity cards use
-- list_public_profiles(), which omits role, credits, XP, email and settings.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  );

-- ---------------------------------------------------------------------------
-- 2. Prevent business-logic abuse and cross-entity references.
-- ---------------------------------------------------------------------------
do $constraints$
begin
  if to_regclass('public.follows') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.follows'::regclass
         and conname = 'follows_no_self_follow'
     ) then
    alter table public.follows
      add constraint follows_no_self_follow check (follower_id <> following_id);
  end if;

  if to_regclass('public.post_replies') is not null then
    create unique index if not exists post_replies_id_post_uidx
      on public.post_replies(id, post_id);
    alter table public.post_replies
      drop constraint if exists post_replies_parent_same_post_fkey;
    alter table public.post_replies
      add constraint post_replies_parent_same_post_fkey
      foreign key (parent_id, post_id)
      references public.post_replies(id, post_id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.post_poll_options') is not null
     and to_regclass('public.post_poll_votes') is not null then
    create unique index if not exists post_poll_options_id_poll_uidx
      on public.post_poll_options(id, poll_id);
    alter table public.post_poll_votes
      drop constraint if exists post_poll_votes_option_same_poll_fkey;
    alter table public.post_poll_votes
      add constraint post_poll_votes_option_same_poll_fkey
      foreign key (option_id, poll_id)
      references public.post_poll_options(id, poll_id)
      not valid;
  end if;

  if to_regclass('public.book_author_comments') is not null then
    create unique index if not exists book_author_comments_id_target_uidx
      on public.book_author_comments(id, target_type, target_id);
    alter table public.book_author_comments
      drop constraint if exists book_author_comments_parent_same_target_fkey;
    alter table public.book_author_comments
      add constraint book_author_comments_parent_same_target_fkey
      foreign key (parent_id, target_type, target_id)
      references public.book_author_comments(id, target_type, target_id)
      on delete cascade
      not valid;
  end if;
end
$constraints$;

-- A user may use one emoji reaction per target. The existing application
-- supports different emoji types, so the emoji remains part of the key.
do $reaction_dedup$
begin
  if to_regclass('public.reactions') is not null then
    delete from public.reactions duplicate_row
     using public.reactions kept_row
     where duplicate_row.ctid > kept_row.ctid
       and duplicate_row.user_id = kept_row.user_id
       and duplicate_row.target_type = kept_row.target_type
       and duplicate_row.target_id = kept_row.target_id
       and duplicate_row.emoji = kept_row.emoji;

    create unique index if not exists reactions_user_target_emoji_uidx
      on public.reactions(user_id, target_type, target_id, emoji);
  end if;
end
$reaction_dedup$;

-- ---------------------------------------------------------------------------
-- 3. Indexes for bounded feed, interaction, library and billing queries.
-- ---------------------------------------------------------------------------
create index if not exists follows_following_lookup
  on public.follows(following_id, created_at desc);
create index if not exists saved_posts_post_lookup
  on public.saved_posts(post_id, created_at desc);
create index if not exists reactions_target_lookup
  on public.reactions(target_type, target_id, created_at desc);
create index if not exists post_poll_votes_option_lookup
  on public.post_poll_votes(option_id, poll_id);
create index if not exists post_poll_options_poll_order_lookup
  on public.post_poll_options(poll_id, sort_order, created_at);
create index if not exists book_author_comments_target_lookup
  on public.book_author_comments(target_type, target_id, created_at desc);
create index if not exists book_page_comments_book_page_lookup
  on public.book_page_comments(book_id, page_number, created_at desc);
create index if not exists weekly_releases_book_date_lookup
  on public.weekly_releases(book_id, release_date asc);
create index if not exists books_author_lookup
  on public.books(author_id, created_at desc);
create index if not exists posts_user_created_lookup
  on public.posts(user_id, created_at desc);

-- The immediate plan-switch flow owns one open reservation per user. This is
-- intentionally later than 20260810800000, which temporarily created a
-- per-plan/method index and could allow abandoned checkouts to accumulate.
update public.billing_checkout_attempts
   set status = 'expired',
       updated_at = now()
 where status = 'open'
   and expires_at <= now();

with ranked as (
  select attempt_id,
         row_number() over (
           partition by user_id
           order by created_at desc, attempt_id desc
         ) as row_number
    from public.billing_checkout_attempts
   where status = 'open'
), duplicates as (
  select attempt_id from ranked where row_number > 1
)
update public.billing_checkout_attempts attempt
   set status = 'expired',
       updated_at = now()
 where attempt.attempt_id in (select attempt_id from duplicates);

drop index if exists public.billing_open_checkout_pair_uidx;
drop index if exists public.billing_open_checkout_user_uidx;
create unique index if not exists billing_open_checkout_user_uidx
  on public.billing_checkout_attempts(user_id)
  where status = 'open';

commit;
