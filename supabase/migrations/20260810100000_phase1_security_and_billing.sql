-- Phase 1: database-authoritative authorization and bounded billing state.
-- Apply only after reviewing the remote migration order and taking a backup.

begin;

-- Compatibilidade com bancos que receberam apenas parte do schema-base.
-- Todas as alteracoes sao condicionais para permitir reexecucao segura.
do $phase1_schema$
declare
  relation_name text;
begin
  if to_regclass('public.subscriptions') is not null then
    execute 'alter table public.subscriptions add column if not exists user_id uuid';
    execute 'alter table public.subscriptions add column if not exists provider text';
    execute 'alter table public.subscriptions add column if not exists plan text';
    execute 'alter table public.subscriptions add column if not exists status text default ''pending''';
    execute 'alter table public.subscriptions add column if not exists current_period_start timestamptz';
    execute 'alter table public.subscriptions add column if not exists current_period_end timestamptz';
    execute 'alter table public.subscriptions add column if not exists created_at timestamptz default now()';
    execute 'alter table public.subscriptions add column if not exists updated_at timestamptz default now()';
  end if;

  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders add column if not exists user_id uuid';
    execute 'alter table public.orders add column if not exists product_id uuid';
    execute 'alter table public.orders add column if not exists product_name text';
    execute 'alter table public.orders add column if not exists product_category text';
    execute 'alter table public.orders add column if not exists credits_cost integer default 0';
    execute 'alter table public.orders add column if not exists real_price numeric default 0';
    execute 'alter table public.orders add column if not exists status text default ''pending''';
    execute 'alter table public.orders add column if not exists payment_method text';
    execute 'alter table public.orders add column if not exists customer jsonb';
    execute 'alter table public.orders add column if not exists address jsonb';
    execute 'alter table public.orders add column if not exists created_at timestamptz default now()';
    execute 'alter table public.orders add column if not exists updated_at timestamptz default now()';
  end if;

  if to_regclass('public.shop_redemptions') is not null then
    execute 'alter table public.shop_redemptions add column if not exists user_id uuid';
    execute 'alter table public.shop_redemptions add column if not exists product_id uuid';
    execute 'alter table public.shop_redemptions add column if not exists status text default ''pending''';
    execute 'alter table public.shop_redemptions add column if not exists credits_spent integer default 0';
    execute 'alter table public.shop_redemptions add column if not exists customer_name text';
    execute 'alter table public.shop_redemptions add column if not exists customer_email text';
    execute 'alter table public.shop_redemptions add column if not exists address jsonb';
    execute 'alter table public.shop_redemptions add column if not exists created_at timestamptz default now()';
    execute 'alter table public.shop_redemptions add column if not exists updated_at timestamptz default now()';
  end if;

  if to_regclass('public.shop_products') is not null then
    execute 'alter table public.shop_products add column if not exists name text';
    execute 'alter table public.shop_products add column if not exists category text';
    execute 'alter table public.shop_products add column if not exists credits_cost integer default 0';
    execute 'alter table public.shop_products add column if not exists real_price numeric default 0';
    execute 'alter table public.shop_products add column if not exists min_months_active numeric default 0';
    execute 'alter table public.shop_products add column if not exists active boolean default true';
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles add column if not exists avatar_url text';
    execute 'alter table public.profiles add column if not exists private_profile boolean default false';
    execute 'alter table public.profiles add column if not exists reading_activity boolean default true';
    execute 'alter table public.profiles add column if not exists show_online_status boolean default true';
  end if;

  foreach relation_name in array array[
    'posts', 'post_replies', 'post_likes', 'saved_posts',
    'reactions', 'book_page_comments', 'book_author_comments', 'suggestions',
    'post_poll_votes'
  ] loop
    if to_regclass('public.' || relation_name) is not null then
      execute format('alter table public.%I add column if not exists user_id uuid', relation_name);
    end if;
  end loop;

  foreach relation_name in array array['posts', 'post_replies', 'post_likes'] loop
    if to_regclass('public.' || relation_name) is not null then
      execute format('alter table public.%I add column if not exists created_at timestamptz default now()', relation_name);
    end if;
  end loop;

  if to_regclass('public.stripe_webhook_events') is not null then
    execute 'alter table public.stripe_webhook_events add column if not exists event_id text';
    execute 'alter table public.stripe_webhook_events add column if not exists event_type text';
    execute 'alter table public.stripe_webhook_events add column if not exists status text default ''received''';
    execute 'alter table public.stripe_webhook_events add column if not exists attempt_count integer default 0';
    execute 'alter table public.stripe_webhook_events add column if not exists attempts integer default 0';
    execute 'alter table public.stripe_webhook_events add column if not exists last_attempt_at timestamptz';
    execute 'alter table public.stripe_webhook_events add column if not exists processed_at timestamptz';
    execute 'alter table public.stripe_webhook_events add column if not exists error_message text';
    -- A migration Stripe original usa last_error. Bancos legados podem ter
    -- somente error_message; mantemos ambos para permitir rollout gradual.
    execute 'alter table public.stripe_webhook_events add column if not exists last_error text';
  end if;
end;
$phase1_schema$;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- The browser must never decide whether a paid social write is allowed.
create or replace function private.has_social_access()
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
  )
  or exists (
    select 1
    from public.subscriptions s
    where s.user_id = (select auth.uid())
      and s.status in ('active', 'trialing', 'past_due')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$function$;

revoke all on function private.has_social_access() from public, anon, authenticated;
grant execute on function private.has_social_access() to authenticated, service_role;

create index if not exists subscriptions_entitlement_lookup
  on public.subscriptions(user_id, status, current_period_end desc);
create index if not exists posts_feed_created_lookup
  on public.posts(created_at desc);
create index if not exists post_likes_post_lookup
  on public.post_likes(post_id, user_id);
create index if not exists post_replies_post_lookup
  on public.post_replies(post_id, created_at desc);

-- Profiles are not a public table. Public identity cards are served by the
-- explicitly safe RPC below; an authenticated user can read only itself,
-- unless it is an administrator.
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  );

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles_admin_all"
  on public.profiles for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;

-- Safe public identity cards. The definer is private and returns no role,
-- email, preferences, balances or activity settings.
create or replace function private.list_public_profiles(p_ids uuid[] default null)
returns table (
  id uuid,
  name text,
  username text,
  avatar text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  verified boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p.id,
    p.name,
    p.username,
    p.avatar,
    p.avatar_url,
    p.bio,
    p.created_at,
    private.profile_is_verified(p.id)
  from public.profiles p
  where (p_ids is null or p.id = any(p_ids))
    and (coalesce(p.private_profile, false) = false
     or p.id = (select auth.uid()))
$function$;

revoke all on function private.list_public_profiles(uuid[]) from public, anon, authenticated;
grant execute on function private.list_public_profiles(uuid[]) to authenticated, service_role;

create or replace function public.list_public_profiles(p_ids uuid[] default null)
returns table (
  id uuid,
  name text,
  username text,
  avatar text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  verified boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.list_public_profiles(p_ids);
$function$;

revoke all on function public.list_public_profiles(uuid[]) from public, anon, authenticated;
grant execute on function public.list_public_profiles(uuid[]) to authenticated, service_role;

-- Keep the old view unavailable through PostgREST. The app uses the RPC above.
revoke all on public.public_profiles from public, anon, authenticated;

-- User-generated data is never readable by anon. Catalog tables remain public
-- where the product intentionally exposes a catalog.
do $policies$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'posts', 'post_replies', 'post_likes', 'saved_posts', 'follows',
    'reactions', 'book_page_comments', 'book_author_comments',
    'post_polls', 'post_poll_options', 'post_poll_votes', 'suggestions'
  ] loop
    execute format('revoke select, insert, update, delete on table public.%I from anon', relation_name);
  end loop;
end
$policies$;

-- This app is authenticated-only in production. Even catalog data is served
-- only to signed-in users; no anonymous role receives table privileges.
do $catalog_permissions$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'authors', 'books', 'weekly_releases', 'categories',
    'book_ratings_public', 'reading_progress', 'subscriptions',
    'book_favorites', 'author_favorites', 'book_ratings', 'referrals',
    'collections', 'collection_items', 'user_emails', 'orders'
  ] loop
    if to_regclass(format('public.%I', relation_name)) is not null then
      execute format('revoke all on table public.%I from anon', relation_name);
    end if;
  end loop;
end
$catalog_permissions$;

-- Social read/write policies. All new interactions require the database
-- entitlement check, not a client-provided plan or flag.
drop policy if exists "posts_read" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_read_authenticated"
  on public.posts for select to authenticated using (true);
create policy "posts_insert_own_with_access"
  on public.posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.has_social_access())
  );
create policy "posts_update_own_with_access"
  on public.posts for update to authenticated
  using (user_id = (select auth.uid()) and (select private.has_social_access()))
  with check (user_id = (select auth.uid()) and (select private.has_social_access()));

drop policy if exists "post_replies_read" on public.post_replies;
drop policy if exists "post_replies_insert_own" on public.post_replies;
create policy "post_replies_read_authenticated"
  on public.post_replies for select to authenticated using (true);
create policy "post_replies_insert_own_with_access"
  on public.post_replies for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.has_social_access())
  );

drop policy if exists "post_likes_read" on public.post_likes;
drop policy if exists "post_likes_insert_own" on public.post_likes;
drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_read_authenticated"
  on public.post_likes for select to authenticated using (true);
create policy "post_likes_insert_own_with_access"
  on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_social_access()));
create policy "post_likes_delete_own_with_access"
  on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.has_social_access()));

drop policy if exists "saved_posts_all_own" on public.saved_posts;
create policy "saved_posts_all_own_with_access"
  on public.saved_posts for all to authenticated
  using (user_id = (select auth.uid()) and (select private.has_social_access()))
  with check (user_id = (select auth.uid()) and (select private.has_social_access()));

drop policy if exists "follows_read" on public.follows;
drop policy if exists "follows_write_own" on public.follows;
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_read_authenticated"
  on public.follows for select to authenticated using (true);
create policy "follows_write_own_with_access"
  on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and (select private.has_social_access()));
create policy "follows_delete_own_with_access"
  on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) and (select private.has_social_access()));

drop policy if exists "reactions_read" on public.reactions;
drop policy if exists "reactions_insert_own" on public.reactions;
drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_read_authenticated"
  on public.reactions for select to authenticated using (true);
create policy "reactions_insert_own_with_access"
  on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_social_access()));
create policy "reactions_delete_own_with_access"
  on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.has_social_access()));

drop policy if exists "book_page_comments_read" on public.book_page_comments;
drop policy if exists "book_page_comments_write_own" on public.book_page_comments;
create policy "book_page_comments_read_authenticated"
  on public.book_page_comments for select to authenticated using (true);
create policy "book_page_comments_write_own_with_access"
  on public.book_page_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_social_access()));

drop policy if exists "book_author_comments_read" on public.book_author_comments;
drop policy if exists "book_author_comments_write_own" on public.book_author_comments;
create policy "book_author_comments_read_authenticated"
  on public.book_author_comments for select to authenticated using (true);
create policy "book_author_comments_write_own_with_access"
  on public.book_author_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_social_access()));

drop policy if exists "post_polls_read" on public.post_polls;
drop policy if exists "post_polls_write_post_owner" on public.post_polls;
create policy "post_polls_read_authenticated"
  on public.post_polls for select to authenticated using (true);
create policy "post_polls_write_post_owner_with_access"
  on public.post_polls for insert to authenticated
  with check (
    (select private.has_social_access())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "post_poll_options_read" on public.post_poll_options;
drop policy if exists "post_poll_options_write" on public.post_poll_options;
create policy "post_poll_options_read_authenticated"
  on public.post_poll_options for select to authenticated using (true);
create policy "post_poll_options_write_with_access"
  on public.post_poll_options for all to authenticated
  using (
    (select private.has_social_access())
    and exists (
      select 1
      from public.post_polls poll
      join public.posts post on post.id = poll.post_id
      where poll.id = poll_id
        and post.user_id = (select auth.uid())
    )
  )
  with check (
    (select private.has_social_access())
    and exists (
      select 1
      from public.post_polls poll
      join public.posts post on post.id = poll.post_id
      where poll.id = poll_id
        and post.user_id = (select auth.uid())
    )
  );

drop policy if exists "post_poll_votes_read" on public.post_poll_votes;
drop policy if exists "post_poll_votes_own" on public.post_poll_votes;
create policy "post_poll_votes_read_authenticated"
  on public.post_poll_votes for select to authenticated using (true);
create policy "post_poll_votes_own_with_access"
  on public.post_poll_votes for all to authenticated
  using (user_id = (select auth.uid()) and (select private.has_social_access()))
  with check (user_id = (select auth.uid()) and (select private.has_social_access()));

drop policy if exists "suggestions_read" on public.suggestions;
drop policy if exists "suggestions_insert_own" on public.suggestions;
create policy "suggestions_read_authenticated"
  on public.suggestions for select to authenticated using (true);
create policy "suggestions_insert_own_with_access"
  on public.suggestions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_social_access()));

-- Orders contain customer and address JSON. Anonymous inserts were a public
-- lead-collection endpoint without ownership. New orders are authenticated
-- and tied to the submitting account.
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_created on public.orders(user_id, created_at desc);
drop policy if exists "orders_insert_public" on public.orders;
create policy "orders_insert_authenticated_own"
  on public.orders for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and customer is not null
    and address is not null
    and payment_method in ('credits', 'real')
    and status = 'pending'
  );
revoke insert on public.orders from anon;
grant insert on public.orders to authenticated;

-- One bounded server-side record per open checkout/user. The Stripe key and
-- provider session are never readable by browser roles.
create table if not exists public.billing_checkout_attempts (
  attempt_id text primary key check (char_length(attempt_id) between 16 and 100),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null check (plan_key in (
    'leitor-monthly', 'leitor-annual', 'pensador-monthly', 'pensador-annual'
  )),
  payment_method text not null check (payment_method in ('CARD', 'PIX')),
  stripe_session_id text unique,
  status text not null default 'open' check (status in ('open', 'completed', 'expired')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists billing_open_checkout_user_uidx
  on public.billing_checkout_attempts(user_id) where status = 'open';
create index if not exists billing_checkout_attempts_expiry_idx
  on public.billing_checkout_attempts(status, expires_at);
alter table public.billing_checkout_attempts enable row level security;
revoke all on table public.billing_checkout_attempts from public, anon, authenticated;
grant all on table public.billing_checkout_attempts to service_role;

-- Failed events remain in the ledger for controlled Stripe retries and audit.
alter table public.stripe_webhook_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists stripe_webhook_events_retry_idx
  on public.stripe_webhook_events(status, last_attempt_at);

commit;
