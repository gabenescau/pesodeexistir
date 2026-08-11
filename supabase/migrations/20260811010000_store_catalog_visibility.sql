-- Keep the public store catalog independent from seasonal curation.
-- A product is visible in Loja when active; season_id only curates SeasonPage.

alter table if exists public.shop_products enable row level security;
alter table if exists public.seasons enable row level security;

grant select on public.shop_products to anon, authenticated;
grant select on public.seasons to anon, authenticated;

drop policy if exists "shop_products_catalog_read" on public.shop_products;
create policy "shop_products_catalog_read"
  on public.shop_products for select
  to anon, authenticated
  using (active = true or (select private.is_admin()));

drop policy if exists "seasons_catalog_read" on public.seasons;
create policy "seasons_catalog_read"
  on public.seasons for select
  to anon, authenticated
  using (status = 'active' or (select private.is_admin()));

create index if not exists shop_products_store_catalog_idx
  on public.shop_products (active, created_at desc);

create index if not exists shop_products_season_catalog_idx
  on public.shop_products (season_id, active, created_at desc);

notify pgrst, 'reload schema';
