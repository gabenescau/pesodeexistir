-- Consolidates the Supabase advisor findings without weakening RLS.
--
-- This migration does three things:
--   1. Wraps auth helpers in scalar subqueries for RLS init-plan performance.
--   2. Consolidates the affected permissive policies while preserving their
--      original OR semantics and role boundaries.
--   3. Removes only redundant, non-constraint indexes from the reported
--      duplicate groups. Constraint-owned indexes are always preserved.

-- 1. Avoid evaluating auth helpers once per row in RLS policies.
do $advisor_auth_initplan$
declare
  policy_row record;
  policy_qual text;
  policy_check text;
begin
  for policy_row in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual is not null or with_check is not null)
  loop
    policy_qual := policy_row.qual;
    policy_check := policy_row.with_check;

    if policy_qual is not null then
      policy_qual := replace(policy_qual, '(select auth.uid())', '__advisor_auth_uid__');
      policy_qual := replace(policy_qual, 'auth.uid()', '(select auth.uid())');
      policy_qual := replace(policy_qual, '__advisor_auth_uid__', '(select auth.uid())');
      policy_qual := replace(policy_qual, '(select auth.role())', '__advisor_auth_role__');
      policy_qual := replace(policy_qual, 'auth.role()', '(select auth.role())');
      policy_qual := replace(policy_qual, '__advisor_auth_role__', '(select auth.role())');
      policy_qual := replace(policy_qual, '(select auth.jwt())', '__advisor_auth_jwt__');
      policy_qual := replace(policy_qual, 'auth.jwt()', '(select auth.jwt())');
      policy_qual := replace(policy_qual, '__advisor_auth_jwt__', '(select auth.jwt())');
    end if;

    if policy_check is not null then
      policy_check := replace(policy_check, '(select auth.uid())', '__advisor_auth_uid__');
      policy_check := replace(policy_check, 'auth.uid()', '(select auth.uid())');
      policy_check := replace(policy_check, '__advisor_auth_uid__', '(select auth.uid())');
      policy_check := replace(policy_check, '(select auth.role())', '__advisor_auth_role__');
      policy_check := replace(policy_check, 'auth.role()', '(select auth.role())');
      policy_check := replace(policy_check, '__advisor_auth_role__', '(select auth.role())');
      policy_check := replace(policy_check, '(select auth.jwt())', '__advisor_auth_jwt__');
      policy_check := replace(policy_check, 'auth.jwt()', '(select auth.jwt())');
      policy_check := replace(policy_check, '__advisor_auth_jwt__', '(select auth.jwt())');
    end if;

    if policy_qual is distinct from policy_row.qual
       and policy_row.cmd in ('r', 'd', 'w', '*') then
      execute format(
        'alter policy %I on %I.%I using (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        policy_qual
      );
    end if;

    if policy_check is distinct from policy_row.with_check
       and policy_row.cmd in ('a', 'w', '*') then
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        policy_check
      );
    end if;
  end loop;
end;
$advisor_auth_initplan$;

-- 2. Merge the affected permissive policies. PostgreSQL combines permissive
-- policies with OR. The new policy therefore contains the exact OR of the
-- previous expressions, with explicit role guards where needed.
do $advisor_policy_consolidation$
declare
  table_row record;
  policy_row record;
  action_code text;
  policy_expression text;
  using_expression text;
  check_expression text;
  role_expression text;
  policy_name text;
  has_policy boolean;
  drop_names text[] := array[]::text[];
begin
  for table_row in
    select * from (values
      ('authors'::text),
      ('books'::text),
      ('categories'::text),
      ('profiles'::text),
      ('posts'::text),
      ('post_likes'::text),
      ('post_replies'::text),
      ('post_poll_options'::text),
      ('post_poll_votes'::text),
      ('post_polls'::text),
      ('reactions'::text),
      ('saved_posts'::text),
      ('follows'::text),
      ('reading_progress'::text),
      ('subscriptions'::text),
      ('book_notes'::text),
      ('book_page_comments'::text),
      ('book_author_comments'::text),
      ('book_favorites'::text),
      ('author_favorites'::text),
      ('book_ratings'::text),
      ('suggestions'::text),
      ('user_emails'::text),
      ('weekly_releases'::text),
      ('seasons'::text),
      ('shop_products'::text)
    ) as affected(table_name)
  loop
    -- Rebuild all four operations on the affected tables. This is necessary
    -- because a FOR ALL policy can appear in several advisor rows.
    foreach action_code in array array['r', 'a', 'w', 'd']
    loop
      using_expression := null;
      check_expression := null;
      has_policy := false;

      for policy_row in
        select policyname, roles, cmd, qual, with_check
        from pg_policies
        where schemaname = 'public'
          and tablename = table_row.table_name
          and permissive = 'PERMISSIVE'
          and policyname not like 'advisor_%'
          and roles && array['public'::name, 'anon'::name, 'authenticated'::name]
          and (cmd = '*' or cmd = action_code)
      loop
        has_policy := true;

        -- A policy for PUBLIC applies to every role. A policy scoped to anon
        -- or authenticated is preserved with a role guard inside the merged
        -- expression, so the single replacement policy can remain public.
        role_expression := null;
        if 'public'::name = any(policy_row.roles) then
          role_expression := 'true';
        else
          if 'anon'::name = any(policy_row.roles) then
            role_expression := '((select auth.role()) = ''anon'')';
          end if;
          if 'authenticated'::name = any(policy_row.roles) then
            if role_expression is null then
              role_expression := '((select auth.role()) = ''authenticated'')';
            else
              role_expression := role_expression || ' or ((select auth.role()) = ''authenticated'')';
            end if;
          end if;
        end if;

        if action_code in ('r', 'd', 'w') then
          policy_expression := coalesce(policy_row.qual, 'true');
          policy_expression := replace(policy_expression, '(select auth.uid())', '__advisor_auth_uid__');
          policy_expression := replace(policy_expression, 'auth.uid()', '(select auth.uid())');
          policy_expression := replace(policy_expression, '__advisor_auth_uid__', '(select auth.uid())');
          policy_expression := replace(policy_expression, '(select auth.role())', '__advisor_auth_role__');
          policy_expression := replace(policy_expression, 'auth.role()', '(select auth.role())');
          policy_expression := replace(policy_expression, '__advisor_auth_role__', '(select auth.role())');
          policy_expression := replace(policy_expression, '(select auth.jwt())', '__advisor_auth_jwt__');
          policy_expression := replace(policy_expression, 'auth.jwt()', '(select auth.jwt())');
          policy_expression := replace(policy_expression, '__advisor_auth_jwt__', '(select auth.jwt())');
          if role_expression <> 'true' then
            policy_expression := '(' || role_expression || ' and (' || policy_expression || '))';
          else
            policy_expression := '(' || policy_expression || ')';
          end if;
          using_expression := case
            when using_expression is null then policy_expression
            else using_expression || ' or ' || policy_expression
          end;
        end if;

        if action_code in ('a', 'w') then
          -- WITH CHECK defaults to USING for UPDATE and to TRUE for INSERT.
          policy_expression := case
            when policy_row.with_check is not null then policy_row.with_check
            when action_code = 'w' then coalesce(policy_row.qual, 'true')
            else 'true'
          end;
          policy_expression := replace(policy_expression, '(select auth.uid())', '__advisor_auth_uid__');
          policy_expression := replace(policy_expression, 'auth.uid()', '(select auth.uid())');
          policy_expression := replace(policy_expression, '__advisor_auth_uid__', '(select auth.uid())');
          policy_expression := replace(policy_expression, '(select auth.role())', '__advisor_auth_role__');
          policy_expression := replace(policy_expression, 'auth.role()', '(select auth.role())');
          policy_expression := replace(policy_expression, '__advisor_auth_role__', '(select auth.role())');
          policy_expression := replace(policy_expression, '(select auth.jwt())', '__advisor_auth_jwt__');
          policy_expression := replace(policy_expression, 'auth.jwt()', '(select auth.jwt())');
          policy_expression := replace(policy_expression, '__advisor_auth_jwt__', '(select auth.jwt())');
          if role_expression <> 'true' then
            policy_expression := '(' || role_expression || ' and (' || policy_expression || '))';
          else
            policy_expression := '(' || policy_expression || ')';
          end if;
          check_expression := case
            when check_expression is null then policy_expression
            else check_expression || ' or ' || policy_expression
          end;
        end if;

        if not (policy_row.policyname = any(drop_names)) then
          drop_names := array_append(drop_names, policy_row.policyname);
        end if;
      end loop;

      if has_policy then
        policy_name := 'advisor_' || substr(md5(table_row.table_name || ':' || action_code), 1, 16);
        execute format('drop policy if exists %I on public.%I', policy_name, table_row.table_name);

        if action_code = 'r' then
          execute format(
            'create policy %I on public.%I as permissive for select to public using (%s)',
            policy_name, table_row.table_name, using_expression
          );
        elsif action_code = 'a' then
          execute format(
            'create policy %I on public.%I as permissive for insert to public with check (%s)',
            policy_name, table_row.table_name, check_expression
          );
        elsif action_code = 'w' then
          execute format(
            'create policy %I on public.%I as permissive for update to public using (%s) with check (%s)',
            policy_name, table_row.table_name, using_expression, check_expression
          );
        elsif action_code = 'd' then
          execute format(
            'create policy %I on public.%I as permissive for delete to public using (%s)',
            policy_name, table_row.table_name, using_expression
          );
        end if;
      end if;
    end loop;
  end loop;

  foreach policy_name in array drop_names
  loop
    for table_row in
      select distinct schemaname, tablename
      from pg_policies
      where schemaname = 'public' and policyname = policy_name
    loop
      execute format('drop policy if exists %I on %I.%I', policy_name, table_row.schemaname, table_row.tablename);
    end loop;
  end loop;
end;
$advisor_policy_consolidation$;

-- 3. Remove only redundant indexes from the exact groups reported by the
-- advisor. If a listed index backs a constraint, it is retained.
do $advisor_duplicate_indexes$
declare
  group_row record;
  index_row record;
  keep_oid oid;
begin
  for group_row in
    select * from (values
      ('public'::name, 'book_notes'::name, array['book_notes_user_book_page_idx','idx_book_notes_user_book']::text[]),
      ('public'::name, 'book_page_comments'::name, array['book_page_comments_book_page_lookup','idx_book_page_comments_book_page']::text[]),
      ('public'::name, 'follows'::name, array['follows_following_id_idx','idx_follows_following','idx_follows_following_id']::text[]),
      ('public'::name, 'post_likes'::name, array['idx_post_likes_post','idx_post_likes_post_id','post_likes_post_id_idx']::text[]),
      ('public'::name, 'post_poll_options'::name, array['idx_post_poll_options_poll','post_poll_options_poll_id_idx']::text[]),
      ('public'::name, 'post_replies'::name, array['idx_post_replies_post','idx_post_replies_post_id']::text[]),
      ('public'::name, 'posts'::name, array['idx_posts_created_at','posts_feed_created_lookup']::text[]),
      ('public'::name, 'reactions'::name, array['idx_reactions_target','reactions_target_idx']::text[]),
      ('public'::name, 'reactions'::name, array['reactions_user_id_target_type_target_id_emoji_key','reactions_user_target_emoji_uidx','reactions_user_target_emoji_unique_idx']::text[]),
      ('public'::name, 'reading_progress'::name, array['idx_reading_progress_user','idx_reading_progress_user_id']::text[]),
      ('public'::name, 'reading_progress'::name, array['reading_progress_user_book_unique_idx','reading_progress_user_id_book_id_key','uq_reading_progress_user_book']::text[]),
      ('public'::name, 'stripe_webhook_events'::name, array['stripe_webhook_events_retry_idx','stripe_webhook_events_status_retry_idx']::text[]),
      ('public'::name, 'stripe_webhook_events'::name, array['stripe_webhook_events_event_id_key','stripe_webhook_events_event_id_uidx']::text[]),
      ('public'::name, 'subscriptions'::name, array['idx_subscriptions_user_id','subscriptions_user_id_idx']::text[]),
      ('public'::name, 'subscriptions'::name, array['subscriptions_provider_stripe_unique','subscriptions_stripe_subscription_uidx']::text[]),
      ('public'::name, 'suggestions'::name, array['idx_suggestions_status','suggestions_status_created_at_idx']::text[]),
      ('public'::name, 'suggestions'::name, array['idx_suggestions_user_id','suggestions_user_id_idx']::text[]),
      ('public'::name, 'weekly_releases'::name, array['uq_weekly_releases_book_date','weekly_releases_book_id_release_date_key']::text[])
    ) as groups(schema_name, table_name, index_names)
  loop
    keep_oid := null;

    -- Prefer a constraint-owned index. Otherwise keep the first index in the
    -- group, which is the migration's canonical/covering definition.
    select c.oid into keep_oid
    from unnest(group_row.index_names) with ordinality as listed(index_name, position)
    join pg_class c on c.relname = listed.index_name
    join pg_namespace n on n.oid = c.relnamespace
    join pg_index i on i.indexrelid = c.oid
    where n.nspname = group_row.schema_name
    order by
      case when exists (select 1 from pg_constraint con where con.conindid = c.oid)
        then 0 else 1 end,
      listed.position
    limit 1;

    if keep_oid is null then
      -- Every index in this group may have been removed by an earlier
      -- deployment. In that case the loop below simply does nothing.
      keep_oid := null;
    end if;

    for index_row in
      select c.oid, c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_index i on i.indexrelid = c.oid
      where n.nspname = group_row.schema_name
        and c.relname = any(group_row.index_names)
        and c.oid <> keep_oid
        and not exists (select 1 from pg_constraint con where con.conindid = c.oid)
    loop
      execute format('drop index if exists %I.%I', group_row.schema_name, index_row.relname);
    end loop;
  end loop;
end;
$advisor_duplicate_indexes$;
