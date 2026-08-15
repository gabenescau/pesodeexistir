-- Early drops are controlled by the database, not by localStorage or the UI.
-- Pensador may see a product during early_access_at; everyone sees it from
-- public_release_at. A null public_release_at keeps the existing immediate
-- publication behavior.

begin;

alter table if exists public.shop_products
  add column if not exists early_access_at timestamptz,
  add column if not exists public_release_at timestamptz;

alter table if exists public.shop_products
  drop constraint if exists shop_products_release_window_check;

alter table if exists public.shop_products
  add constraint shop_products_release_window_check
  check (
    early_access_at is null
    or public_release_at is null
    or early_access_at <= public_release_at
  );

create index if not exists shop_products_early_release_lookup
  on public.shop_products (active, early_access_at, public_release_at, created_at desc);

-- Keep the entitlement catalog authoritative when the feature is used by RLS
-- and by purchase guards.
create or replace function private.has_plan_entitlement(
  p_user_id uuid,
  p_feature text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when p_user_id is null or p_feature is null then false
    when exists (
      select 1
        from public.profiles p
       where p.id = p_user_id
         and p.role = 'admin'
    ) then true
    when p_feature not in (
      'verified_badge', 'ranking', 'missions', 'seasons',
      'credit_multiplier', 'vip_support', 'early_drops'
    ) then false
    else exists (
      select 1
        from public.subscriptions s
       where s.user_id = p_user_id
         and s.status in (
           'active', 'trialing', 'past_due', 'paid', 'approved',
           'authorized', 'complete', 'completed', 'succeeded'
         )
         and (s.current_period_end is null or s.current_period_end > now())
         and s.plan in (
           'ope_club_pensador_monthly',
           'ope_club_pensador_annual',
           'pensador'
         )
    )
  end;
$function$;

revoke all on function private.has_plan_entitlement(uuid, text)
  from public, anon, authenticated;
grant execute on function private.has_plan_entitlement(uuid, text)
  to service_role;

create or replace function private.shop_product_is_released(
  p_product_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select
        p.active = true
        and (
          p.public_release_at is null
          or p.public_release_at <= now()
          or (
            p.early_access_at is not null
            and p.early_access_at <= now()
            and private.has_plan_entitlement(p_user_id, 'early_drops')
          )
        )
       from public.shop_products p
      where p.id = p_product_id
    ),
    false
  );
$function$;

revoke all on function private.shop_product_is_released(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.shop_product_is_released(uuid, uuid)
  to service_role;

-- The API can still return a product by id, so the same rule is enforced by
-- the table policy and cannot be bypassed by changing a URL or request body.
drop policy if exists "shop_products_catalog_read" on public.shop_products;
create policy "shop_products_catalog_read"
  on public.shop_products for select
  to anon, authenticated
  using (
    (select private.is_admin())
    or private.shop_product_is_released(id, auth.uid())
  );

-- SECURITY DEFINER purchase functions bypass normal table RLS. These trigger
-- guards keep early-release rules authoritative for both credit redemptions
-- and real-money shop orders.
create or replace function private.enforce_shop_product_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.shop_product_is_released(new.product_id, new.user_id) then
    raise exception 'PRODUTO_NAO_DISPONIVEL';
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_shop_product_release()
  from public, anon, authenticated;
grant execute on function private.enforce_shop_product_release()
  to service_role;

drop trigger if exists trg_enforce_shop_redemption_release on public.shop_redemptions;
create trigger trg_enforce_shop_redemption_release
  before insert on public.shop_redemptions
  for each row execute function private.enforce_shop_product_release();

drop trigger if exists trg_enforce_shop_order_release on public.orders;
create trigger trg_enforce_shop_order_release
  before insert on public.orders
  for each row execute function private.enforce_shop_product_release();

notify pgrst, 'reload schema';
commit;
