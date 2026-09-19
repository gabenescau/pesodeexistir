-- Repair the linter hardening migration without breaking the client RPC API.
-- Public RPC names remain available, but the API-facing functions are
-- SECURITY INVOKER wrappers around private SECURITY DEFINER implementations.

begin;

-- ---------------------------------------------------------------------------
-- 1. Storage listing hardening
-- ---------------------------------------------------------------------------
-- Covers are served through signed URLs, so the bucket must be private. The
-- authenticated read policy is kept for signed URL generation, while broad
-- anonymous/public listing is removed.
update storage.buckets
   set public = false
 where id = 'covers';

drop policy if exists covers_select on storage.objects;
drop policy if exists covers_authenticated_read on storage.objects;
drop policy if exists covers_authenticated_read_v2 on storage.objects;
drop policy if exists covers_private_read on storage.objects;

create policy covers_private_read
  on storage.objects for select
  to authenticated
  using (bucket_id = 'covers');

-- Shop images use public object URLs. A public bucket does not need a broad
-- SELECT policy, so direct object downloads keep working without file listing.
drop policy if exists shop_media_public_read on storage.objects;

-- ---------------------------------------------------------------------------
-- 2. Ensure each privileged implementation has a private home
-- ---------------------------------------------------------------------------
-- Some environments already contain the private copy. In that case it is
-- reused. Otherwise the existing public implementation is moved first, which
-- avoids the duplicate-function failure from the earlier migration.
do $move_rpc_implementations$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature,
           p.proname,
           p.proargtypes
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'admin_cancel_referral', 'admin_confirm_referral',
         'admin_list_referrals', 'complete_daily_mission',
         'complete_weekly_mission', 'create_shop_order', 'current_role',
         'get_my_referral_code', 'monthly_ranking', 'redeem_product',
         'referral_claim', 'report_reading_session', 'reward_comment',
         'reward_likes_received', 'reward_login', 'reward_post',
         'spam_revert', 'wallet_state'
       )
  loop
    if not exists (
      select 1
        from pg_proc private_function
        join pg_namespace private_schema
          on private_schema.oid = private_function.pronamespace
       where private_schema.nspname = 'private'
         and private_function.proname = function_row.proname
         and private_function.proargtypes = function_row.proargtypes
    ) then
      execute format('alter function %s set schema private', function_row.signature);
    end if;
  end loop;
end
$move_rpc_implementations$;

-- Every implementation in the private schema must have a fixed search path.
do $private_rpc_search_path$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname in (
         'admin_cancel_referral', 'admin_confirm_referral',
         'admin_list_referrals', 'complete_daily_mission',
         'complete_weekly_mission', 'create_shop_order', 'current_role',
         'get_my_referral_code', 'monthly_ranking', 'redeem_product',
         'referral_claim', 'report_reading_session', 'reward_comment',
         'reward_likes_received', 'reward_login', 'reward_post',
         'spam_revert', 'wallet_state'
       )
  loop
    execute format('alter function %s set search_path = %L', function_row.signature, '');
  end loop;
end
$private_rpc_search_path$;

-- ---------------------------------------------------------------------------
-- 3. Safe API-facing wrappers
-- ---------------------------------------------------------------------------
create or replace function public.admin_cancel_referral(
  p_referrer_user_id uuid,
  p_referred_user_id uuid
)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.admin_cancel_referral($1, $2); $function$;

create or replace function public.admin_confirm_referral(
  p_referrer_user_id uuid,
  p_referred_user_id uuid
)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.admin_confirm_referral($1, $2); $function$;

create or replace function public.admin_list_referrals()
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select private.admin_list_referrals(); $function$;

create or replace function public.complete_daily_mission()
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.complete_daily_mission(); $function$;

create or replace function public.complete_weekly_mission()
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.complete_weekly_mission(); $function$;

create or replace function public.create_shop_order(
  p_product_id uuid,
  p_payment_method text,
  p_customer jsonb,
  p_address jsonb,
  p_idempotency_key text
)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.create_shop_order($1, $2, $3, $4, $5); $function$;

create or replace function public.current_role()
returns text language sql stable security invoker set search_path = ''
as $function$ select private.current_role(); $function$;

create or replace function public.get_my_referral_code()
returns text language sql security invoker set search_path = ''
as $function$ select private.get_my_referral_code(); $function$;

create or replace function public.monthly_ranking(p_limit integer default 20)
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select private.monthly_ranking($1); $function$;

create or replace function public.redeem_product(
  p_product_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_address jsonb
)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.redeem_product($1, $2, $3, $4); $function$;

create or replace function public.referral_claim(p_referred_user_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.referral_claim($1); $function$;

create or replace function public.report_reading_session(
  p_book_id uuid,
  p_seconds integer,
  p_interacted boolean
)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.report_reading_session($1, $2, $3); $function$;

create or replace function public.reward_comment(
  p_user_id uuid,
  p_text text default null
)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.reward_comment($1, $2); $function$;

create or replace function public.reward_likes_received(p_owner_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.reward_likes_received($1); $function$;

create or replace function public.reward_login()
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.reward_login(); $function$;

create or replace function public.reward_post(
  p_user_id uuid,
  p_source_ref text default null
)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.reward_post($1, $2); $function$;

create or replace function public.spam_revert(
  p_user_id uuid,
  p_days integer default 7
)
returns jsonb language sql security invoker set search_path = ''
as $function$ select private.spam_revert($1, $2); $function$;

create or replace function public.wallet_state()
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select private.wallet_state(); $function$;

-- The browser can call the wrappers only when authenticated. Anonymous users
-- and the default PUBLIC grant must not execute the RPC surface.
grant usage on schema private to authenticated, service_role;
revoke usage on schema private from anon;

do $rpc_grants$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.proname in (
         'admin_cancel_referral', 'admin_confirm_referral',
         'admin_list_referrals', 'complete_daily_mission',
         'complete_weekly_mission', 'create_shop_order', 'current_role',
         'get_my_referral_code', 'monthly_ranking', 'redeem_product',
         'referral_claim', 'report_reading_session', 'reward_comment',
         'reward_likes_received', 'reward_login', 'reward_post',
         'spam_revert', 'wallet_state'
       )
  loop
    execute format('revoke all on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;

  for function_row in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'admin_cancel_referral', 'admin_confirm_referral',
         'admin_list_referrals', 'complete_daily_mission',
         'complete_weekly_mission', 'create_shop_order', 'current_role',
         'get_my_referral_code', 'monthly_ranking', 'redeem_product',
         'referral_claim', 'report_reading_session', 'reward_comment',
         'reward_likes_received', 'reward_login', 'reward_post',
         'spam_revert', 'wallet_state'
       )
  loop
    execute format('revoke all on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$rpc_grants$;

-- This is a project-level Auth setting and cannot be changed through SQL.
-- Enable "Prevent password leaks" in Authentication > Providers > Email.

commit;
