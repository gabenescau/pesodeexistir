-- Harden Supabase linter findings without changing the client RPC contract.
--
-- The application keeps calling public RPC names. Their privileged
-- implementations are moved to the non-exposed private schema and public
-- SECURITY INVOKER wrappers remain as the only API entry points.

begin;

-- ---------------------------------------------------------------------------
-- 1. Covers: private bucket, authenticated read, admin-only writes.
-- ---------------------------------------------------------------------------
update storage.buckets
   set public = false
 where id = 'covers';

drop policy if exists "covers_select" on storage.objects;
drop policy if exists "covers_authenticated_read" on storage.objects;
drop policy if exists "covers_admin_write" on storage.objects;
drop policy if exists "covers_authenticated_read_v2" on storage.objects;
drop policy if exists "covers_admin_insert_v2" on storage.objects;
drop policy if exists "covers_admin_update_v2" on storage.objects;
drop policy if exists "covers_admin_delete_v2" on storage.objects;

create policy "covers_authenticated_read_v2"
on storage.objects for select to authenticated
using (bucket_id = 'covers');

create policy "covers_admin_insert_v2"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'covers'
  and (select public.can_manage_content())
);

create policy "covers_admin_update_v2"
on storage.objects for update to authenticated
using (
  bucket_id = 'covers'
  and (select public.can_manage_content())
)
with check (
  bucket_id = 'covers'
  and (select public.can_manage_content())
);

create policy "covers_admin_delete_v2"
on storage.objects for delete to authenticated
using (
  bucket_id = 'covers'
  and (select public.can_manage_content())
);

-- ---------------------------------------------------------------------------
-- 2. Move privileged implementations out of the API schema.
-- ---------------------------------------------------------------------------
alter function public.admin_cancel_referral(uuid, uuid) set schema private;
alter function public.admin_confirm_referral(uuid, uuid) set schema private;
alter function public.admin_list_referrals() set schema private;
alter function public.complete_daily_mission() set schema private;
alter function public.complete_weekly_mission() set schema private;
alter function public.create_shop_order(uuid, text, jsonb, jsonb, text) set schema private;
alter function public.current_role() set schema private;
alter function public.get_my_referral_code() set schema private;
alter function public.monthly_ranking(integer) set schema private;
alter function public.redeem_product(uuid, text, text, jsonb) set schema private;
alter function public.referral_claim(uuid) set schema private;
alter function public.report_reading_session(uuid, integer, boolean) set schema private;
alter function public.reward_comment(uuid, text) set schema private;
alter function public.reward_likes_received(uuid) set schema private;
alter function public.reward_login() set schema private;
alter function public.reward_post(uuid, text) set schema private;
alter function public.spam_revert(uuid, integer) set schema private;
alter function public.wallet_state() set schema private;

-- Explicit search paths are retained after moving the functions. This also
-- protects the moved functions from role-controlled search_path changes.
do $migration$
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
$migration$;

-- The wrappers are invoker functions. They preserve the existing RPC names
-- and argument defaults while keeping privileged writes in private code.
create or replace function public.admin_cancel_referral(
  p_referrer_user_id uuid,
  p_referred_user_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.admin_cancel_referral($1, $2);
$function$;

create or replace function public.admin_confirm_referral(
  p_referrer_user_id uuid,
  p_referred_user_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.admin_confirm_referral($1, $2);
$function$;

create or replace function public.admin_list_referrals()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.admin_list_referrals();
$function$;

create or replace function public.complete_daily_mission()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.complete_daily_mission();
$function$;

create or replace function public.complete_weekly_mission()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.complete_weekly_mission();
$function$;

create or replace function public.create_shop_order(
  p_product_id uuid,
  p_payment_method text,
  p_customer jsonb,
  p_address jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.create_shop_order($1, $2, $3, $4, $5);
$function$;

create or replace function public.current_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.current_role();
$function$;

create or replace function public.get_my_referral_code()
returns text
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.get_my_referral_code();
$function$;

create or replace function public.monthly_ranking(p_limit integer default 20)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.monthly_ranking($1);
$function$;

create or replace function public.redeem_product(
  p_product_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_address jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.redeem_product($1, $2, $3, $4);
$function$;

create or replace function public.referral_claim(p_referred_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.referral_claim($1);
$function$;

create or replace function public.report_reading_session(
  p_book_id uuid,
  p_seconds integer,
  p_interacted boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.report_reading_session($1, $2, $3);
$function$;

create or replace function public.reward_comment(
  p_user_id uuid,
  p_text text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.reward_comment($1, $2);
$function$;

create or replace function public.reward_likes_received(p_owner_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.reward_likes_received($1);
$function$;

create or replace function public.reward_login()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.reward_login();
$function$;

create or replace function public.reward_post(
  p_user_id uuid,
  p_source_ref text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.reward_post($1, $2);
$function$;

create or replace function public.spam_revert(
  p_user_id uuid,
  p_days integer default 7
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.spam_revert($1, $2);
$function$;

create or replace function public.wallet_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.wallet_state();
$function$;

-- The wrappers need to call the private implementations. The private schema
-- is deliberately not part of the PostgREST exposed schemas.
revoke usage on schema private from anon;
grant usage on schema private to authenticated, service_role;

do $migration$
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
end
$migration$;

-- Public wrappers are the only client-facing RPC surface.
do $migration$
declare
  function_row record;
begin
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
$migration$;

commit;

-- The leaked-password warning is an Auth project setting, not a PostgreSQL
-- setting. Enable it in Supabase Dashboard > Authentication > Providers >
-- Email > Prevent password leaks, then re-run the Security Advisor.
