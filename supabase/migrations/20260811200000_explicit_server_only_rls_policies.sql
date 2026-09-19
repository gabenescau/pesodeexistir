-- Make server-only access explicit for relations that intentionally have no
-- browser-facing RLS policy.
--
-- These tables contain wallet state, reward bookkeeping, checkout
-- reservations, or webhook idempotency data. Browser roles must not read or
-- write them. The application server uses service_role and keeps working
-- because service_role bypasses RLS and retains table privileges.

begin;

do $server_only_rls$
declare
  target record;
  deny_anon_policy text;
  deny_authenticated_policy text;
begin
  for target in
    select *
    from (values
      ('private', 'login_streak'),
      ('private', 'reading_reward_daily'),
      ('private', 'reading_reward_sessions'),
      ('private', 'wallet_counters'),
      ('private', 'wallet_ledger'),
      ('public', 'billing_checkout_attempts'),
      ('public', 'stripe_webhook_events')
    ) as relations(schema_name, table_name)
  loop
    if to_regclass(format('%I.%I', target.schema_name, target.table_name)) is null then
      raise notice 'Skipping missing server-only table %.%', target.schema_name, target.table_name;
      continue;
    end if;

    execute format(
      'alter table %I.%I enable row level security',
      target.schema_name,
      target.table_name
    );

    execute format(
      'revoke all on table %I.%I from public, anon, authenticated',
      target.schema_name,
      target.table_name
    );

    execute format(
      'grant all on table %I.%I to service_role',
      target.schema_name,
      target.table_name
    );

    deny_anon_policy := format('server_only_%s_%s_anon', target.schema_name, target.table_name);
    deny_authenticated_policy := format('server_only_%s_%s_authenticated', target.schema_name, target.table_name);

    execute format(
      'drop policy if exists %I on %I.%I',
      deny_anon_policy,
      target.schema_name,
      target.table_name
    );
    execute format(
      'drop policy if exists %I on %I.%I',
      deny_authenticated_policy,
      target.schema_name,
      target.table_name
    );

    -- Restrictive policies remain a deny boundary even if a permissive policy
    -- is accidentally added in a later migration.
    execute format(
      'create policy %I on %I.%I as restrictive for all to anon using (false) with check (false)',
      deny_anon_policy,
      target.schema_name,
      target.table_name
    );
    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated using (false) with check (false)',
      deny_authenticated_policy,
      target.schema_name,
      target.table_name
    );
  end loop;
end
$server_only_rls$;

comment on table private.login_streak is
  'Server-only login streak state. Browser roles are denied by RLS.';
comment on table private.reading_reward_daily is
  'Server-only daily reading reward state. Browser roles are denied by RLS.';
comment on table private.reading_reward_sessions is
  'Server-only reading reward sessions. Browser roles are denied by RLS.';
comment on table private.wallet_counters is
  'Server-only wallet counters. Browser roles are denied by RLS.';
comment on table private.wallet_ledger is
  'Server-only wallet ledger. Browser roles are denied by RLS.';
comment on table public.billing_checkout_attempts is
  'Server-only Stripe checkout reservations. Browser roles are denied by RLS.';
comment on table public.stripe_webhook_events is
  'Server-only Stripe webhook idempotency records. Browser roles are denied by RLS.';

commit;
