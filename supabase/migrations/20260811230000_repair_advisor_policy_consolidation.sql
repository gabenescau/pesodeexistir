-- Repair for 20260811220000.
-- pg_policies.cmd exposes SELECT/INSERT/UPDATE/DELETE/ALL (not the internal
-- pg_policy command codes r/a/w/d/*). This migration repeats only the policy
-- part with the correct view values.

do $advisor_cleanup_existing$
declare
  policy_row record;
begin
  -- Remove only policies created by the previous advisor migration, if a
  -- deployment stopped after creating them but before dropping old policies.
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname like 'advisor_%'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$advisor_cleanup_existing$;

do $advisor_policy_repair$
declare
  table_row record;
  policy_row record;
  action_name text;
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
    foreach action_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
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
          and roles && array['public'::name, 'anon'::name, 'authenticated'::name]
          and (cmd = 'ALL' or cmd = action_name)
      loop
        has_policy := true;

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

        if action_name in ('SELECT', 'DELETE', 'UPDATE') then
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

        if action_name in ('INSERT', 'UPDATE') then
          policy_expression := case
            when policy_row.with_check is not null then policy_row.with_check
            when action_name = 'UPDATE' then coalesce(policy_row.qual, 'true')
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
        policy_name := 'advisor_' || substr(md5(table_row.table_name || ':' || action_name), 1, 16);
        execute format('drop policy if exists %I on public.%I', policy_name, table_row.table_name);

        if action_name = 'SELECT' then
          execute format(
            'create policy %I on public.%I as permissive for select to public using (%s)',
            policy_name, table_row.table_name, using_expression
          );
        elsif action_name = 'INSERT' then
          execute format(
            'create policy %I on public.%I as permissive for insert to public with check (%s)',
            policy_name, table_row.table_name, check_expression
          );
        elsif action_name = 'UPDATE' then
          execute format(
            'create policy %I on public.%I as permissive for update to public using (%s) with check (%s)',
            policy_name, table_row.table_name, using_expression, check_expression
          );
        elsif action_name = 'DELETE' then
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
$advisor_policy_repair$;
