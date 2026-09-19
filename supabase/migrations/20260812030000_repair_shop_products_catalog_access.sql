-- Repair the browser-facing store catalog after the early-drop policy change.
--
-- The previous policy called private.shop_product_is_released() directly but
-- revoked EXECUTE on that helper from authenticated. PostgREST therefore
-- returned 403 for the whole shop_products query. Keep the release decision
-- server-side and expose only a current-user wrapper that cannot accept an
-- arbitrary user id.

begin;

alter table if exists public.shop_products enable row level security;

alter table if exists public.shop_products
  add column if not exists early_access_at timestamptz,
  add column if not exists public_release_at timestamptz;

revoke select on public.shop_products from public, anon;
grant select on public.shop_products to authenticated;

create or replace function private.shop_product_visible_to_current_user(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.shop_product_is_released(p_product_id, (select auth.uid()));
$function$;

revoke all on function private.shop_product_visible_to_current_user(uuid)
  from public, anon, authenticated;
grant execute on function private.shop_product_visible_to_current_user(uuid)
  to authenticated, service_role;

-- Remove every old SELECT policy so a stale permissive policy cannot keep
-- evaluating a helper that no longer has browser EXECUTE privileges.
do $drop_shop_product_select_policies$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'shop_products'
       and (cmd = 'SELECT' or cmd = 'ALL')
  loop
    execute format(
      'drop policy if exists %I on public.shop_products',
      policy_row.policyname
    );
  end loop;
end
$drop_shop_product_select_policies$;

create policy shop_products_catalog_read
  on public.shop_products for select
  to authenticated
  using (
    (select private.is_admin())
    or private.shop_product_visible_to_current_user(id)
  );

notify pgrst, 'reload schema';
commit;
