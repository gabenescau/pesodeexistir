-- Advisor suggestions: add covering indexes for foreign keys and remove only
-- indexes that are provably covered by a newer, more useful index.
--
-- Unused-index findings are intentionally not mass-dropped. Supabase reports
-- an index as unused when it has not been selected since statistics were
-- reset; removing payment, admin, feed, or cleanup indexes solely for that
-- reason can create production regressions.

create index if not exists reading_reward_sessions_book_id_idx
  on private.reading_reward_sessions (book_id);

create index if not exists author_favorites_author_id_idx
  on public.author_favorites (author_id);

create index if not exists book_author_comments_parent_id_idx
  on public.book_author_comments (parent_id);

create index if not exists book_author_comments_parent_target_idx
  on public.book_author_comments (parent_id, target_type, target_id);

create index if not exists book_author_comments_user_id_idx
  on public.book_author_comments (user_id);

create index if not exists book_favorites_book_id_idx
  on public.book_favorites (book_id);

create index if not exists book_notes_book_id_idx
  on public.book_notes (book_id);

create index if not exists orders_product_id_idx
  on public.orders (product_id);

create index if not exists post_poll_votes_user_id_idx
  on public.post_poll_votes (user_id);

create index if not exists post_replies_parent_post_idx
  on public.post_replies (parent_id, post_id);

create index if not exists referrals_referred_user_id_idx
  on public.referrals (referred_user_id);

create index if not exists shop_redemptions_product_id_idx
  on public.shop_redemptions (product_id);

-- These are redundant because the later covering indexes start with the same
-- lookup columns. Drop only when the index is not owned by a constraint.
do $advisor_drop_provably_redundant$
declare
  index_row record;
begin
  for index_row in
    select * from (values
      ('public'::name, 'idx_books_author_id'::name),
      ('public'::name, 'idx_book_author_comments_target'::name),
      ('public'::name, 'idx_post_poll_options_poll'::name),
      ('public'::name, 'shop_products_active'::name),
      ('public'::name, 'idx_subscriptions_user_status'::name)
    ) as candidates(schema_name, index_name)
  loop
    if to_regclass(format('%I.%I', index_row.schema_name, index_row.index_name)) is not null
       and not exists (
         select 1
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         join pg_constraint con on con.conindid = c.oid
         where n.nspname = index_row.schema_name
           and c.relname = index_row.index_name
       ) then
      execute format('drop index if exists %I.%I', index_row.schema_name, index_row.index_name);
    end if;
  end loop;
end;
$advisor_drop_provably_redundant$;
